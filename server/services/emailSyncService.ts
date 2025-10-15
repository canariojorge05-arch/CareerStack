import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { MultiAccountEmailService } from './multiAccountEmailService';
import { EmailCacheService } from './emailCacheService';
import { emailWebSocketManager } from './emailWebSocketManager';
import { EmailPerformanceMonitor } from './emailPerformanceMonitor';
import { logger } from '../utils/logger';

export class EmailSyncService {
  private static syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private static isRunning = false;
  private static isSyncing = false;
  private static readonly DEFAULT_SYNC_INTERVAL = 15 * 1000; // 15 seconds for ultra-fast sync
  private static readonly MIN_SYNC_INTERVAL = 10 * 1000; // 10 seconds minimum
  private static readonly MAX_CONCURRENT_SYNCS = 5; // Limit concurrent syncs

  static async startBackgroundSync(customInterval?: number): Promise<void> {
    if (this.isRunning) {
      logger.info('📧 Email sync service already running');
      return;
    }

    this.isRunning = true;
    const syncInterval = Math.max(
      customInterval || this.DEFAULT_SYNC_INTERVAL,
      this.MIN_SYNC_INTERVAL
    );
    
    logger.info(`🚀 Starting ultra-fast email sync service (${syncInterval / 1000}s interval)`);

    // Initial sync for all active accounts
    this.syncAllAccounts().catch(err => 
      logger.error({ error: err }, 'Initial sync failed')
    );

    // Set up periodic sync with configurable interval
    const globalSyncInterval = setInterval(async () => {
      if (!this.isSyncing) {
        await this.syncAllAccounts();
      } else {
        logger.debug('⏭️  Skipping sync - previous sync still in progress');
      }
    }, syncInterval);

    // Store the global interval
    this.syncIntervals.set('global', globalSyncInterval);

    logger.info(`✅ Email background sync service started with ${syncInterval / 1000}s interval`);
  }

  static async stopBackgroundSync(): Promise<void> {
    logger.info('🛑 Stopping email background sync service');

    // Clear all intervals
    for (const [key, interval] of this.syncIntervals) {
      clearInterval(interval);
      logger.info(`Cleared sync interval for ${key}`);
    }

    this.syncIntervals.clear();
    this.isRunning = false;

    logger.info('✅ Email background sync service stopped');
  }

  static async syncAllAccounts(): Promise<void> {
    if (this.isSyncing) {
      logger.debug('⏭️  Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // Get all active accounts that have sync enabled
      let accounts;
      try {
        accounts = await db.query.emailAccounts.findMany({
          where: eq(emailAccounts.isActive, true),
        });
      } catch (dbError: any) {
        logger.error({ error: dbError?.message || dbError }, '❌ Database connection failed during email sync:');
        logger.info('⚠️ Skipping email sync due to database connectivity issues');
        return;
      }

      const activeAccounts = accounts.filter(account => 
        account.syncEnabled && this.shouldSync(account)
      );

      if (activeAccounts.length === 0) {
        logger.debug('📧 No accounts need syncing');
        return;
      }

      logger.info(`🔄 Syncing ${activeAccounts.length} email accounts`);

      // Sync accounts in parallel with concurrency limit
      const results = await this.syncAccountsWithConcurrencyLimit(
        activeAccounts,
        this.MAX_CONCURRENT_SYNCS
      );

      // Log results with performance metrics
      let successCount = 0;
      let errorCount = 0;
      let totalMessages = 0;

      results.forEach((result, index) => {
        const account = activeAccounts[index];
        if (result.status === 'fulfilled') {
          successCount++;
          totalMessages += result.value.syncedCount;
          if (result.value.syncedCount > 0) {
            logger.info(`✅ Synced ${account.emailAddress}: ${result.value.syncedCount} new messages`);
          }
        } else {
          errorCount++;
          logger.error(`❌ Failed to sync ${account.emailAddress}:`, result.reason);
        }
      });

      const duration = Date.now() - startTime;
      logger.info(`📊 Sync completed in ${duration}ms: ${successCount} successful, ${errorCount} failed, ${totalMessages} new messages`);
    } catch (error) {
      logger.error({ error: error }, 'Error in syncAllAccounts:');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync accounts with concurrency limit for better performance
   */
  private static async syncAccountsWithConcurrencyLimit(
    accounts: any[],
    limit: number
  ): Promise<PromiseSettledResult<{ syncedCount: number }>[]> {
    const results: PromiseSettledResult<{ syncedCount: number }>[] = [];
    
    for (let i = 0; i < accounts.length; i += limit) {
      const batch = accounts.slice(i, i + limit);
      const batchPromises = batch.map(account => this.syncSingleAccount(account));
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  private static shouldSync(account: any): boolean {
    if (!account.lastSyncAt) {
      return true; // Never synced before
    }

    const now = new Date();
    const lastSync = new Date(account.lastSyncAt);
    const syncFrequencyMs = (account.syncFrequency || 15) * 1000; // Default 15 seconds for speed

    return (now.getTime() - lastSync.getTime()) >= syncFrequencyMs;
  }

  private static async syncSingleAccount(account: any): Promise<{ syncedCount: number }> {
    return EmailPerformanceMonitor.track(
      'email_sync',
      async () => {
        const result = await MultiAccountEmailService.syncAccount(account.id, account.userId);
        
        if (!result.success) {
          throw new Error(result.error || 'Sync failed');
        }

        // Invalidate cache and notify clients if new messages were synced
        if (result.syncedCount && result.syncedCount > 0) {
          await EmailCacheService.invalidateUserCache(account.userId);
          logger.debug(`🗑️  Invalidated cache for user ${account.userId} after sync`);

          // Send real-time notification via WebSocket
          emailWebSocketManager.broadcastToUser(account.userId, {
            type: 'email_sync_complete',
            accountId: account.id,
            newMessageCount: result.syncedCount,
            timestamp: new Date().toISOString()
          });

          logger.debug(`📡 Sent WebSocket notification to user ${account.userId}: ${result.syncedCount} new messages`);
        }

        return { syncedCount: result.syncedCount || 0 };
      },
      { accountId: account.id, provider: account.provider }
    ).catch(error => {
      logger.error(`Error syncing account ${account.emailAddress}:`, error);
      throw error;
    });
  }

  static async syncAccountOnDemand(accountId: string, userId: string): Promise<{
    success: boolean;
    syncedCount?: number;
    error?: string;
  }> {
    try {
      logger.info(`🔄 On-demand sync requested for account ${accountId}`);
      
      const result = await MultiAccountEmailService.syncAccount(accountId, userId);
      
      if (result.success) {
        logger.info(`✅ On-demand sync completed: ${result.syncedCount} new messages`);
        
        // Invalidate cache and notify client
        if (result.syncedCount && result.syncedCount > 0) {
          await EmailCacheService.invalidateUserCache(userId);
          
          emailWebSocketManager.broadcastToUser(userId, {
            type: 'email_sync_complete',
            accountId,
            newMessageCount: result.syncedCount,
            timestamp: new Date().toISOString()
          });
          
          logger.debug(`📡 Sent WebSocket notification for on-demand sync`);
        }
      }

      return result;
    } catch (error) {
      logger.error({ error: error }, 'Error in on-demand sync:');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  static async enableAccountSync(accountId: string, syncFrequency?: number): Promise<void> {
    try {
      await db
        .update(emailAccounts)
        .set({
          syncEnabled: true,
          syncFrequency: syncFrequency || 60, // Default 1 minute
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId));

      logger.info(`✅ Enabled sync for account ${accountId}`);
    } catch (error) {
      logger.error({ error: error }, 'Error enabling account sync:');
      throw error;
    }
  }

  static async disableAccountSync(accountId: string): Promise<void> {
    try {
      await db
        .update(emailAccounts)
        .set({
          syncEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId));

      // Clear any specific interval for this account
      const interval = this.syncIntervals.get(accountId);
      if (interval) {
        clearInterval(interval);
        this.syncIntervals.delete(accountId);
      }

      logger.info(`✅ Disabled sync for account ${accountId}`);
    } catch (error) {
      logger.error({ error: error }, 'Error disabling account sync:');
      throw error;
    }
  }

  static async updateSyncFrequency(accountId: string, syncFrequency: number): Promise<void> {
    try {
      await db
        .update(emailAccounts)
        .set({
          syncFrequency,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, accountId));

      logger.info(`✅ Updated sync frequency for account ${accountId} to ${syncFrequency} seconds`);
    } catch (error) {
      logger.error({ error: error }, 'Error updating sync frequency:');
      throw error;
    }
  }

  static getSyncStatus(): {
    isRunning: boolean;
    activeIntervals: number;
    accounts: string[];
  } {
    return {
      isRunning: this.isRunning,
      activeIntervals: this.syncIntervals.size,
      accounts: Array.from(this.syncIntervals.keys()),
    };
  }

  static async getAccountSyncStats(accountId: string): Promise<{
    lastSyncAt?: Date;
    syncEnabled: boolean;
    syncFrequency: number;
    nextSyncIn?: number;
  } | null> {
    try {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId)
      });

      if (!account) {
        return null;
      }

      let nextSyncIn: number | undefined;
      
      if (account.lastSyncAt && account.syncEnabled) {
        const lastSync = new Date(account.lastSyncAt);
        const syncFrequencyMs = (account.syncFrequency || 300) * 1000;
        const nextSyncTime = lastSync.getTime() + syncFrequencyMs;
        const now = Date.now();
        
        nextSyncIn = Math.max(0, Math.floor((nextSyncTime - now) / 1000));
      }

      return {
        lastSyncAt: account.lastSyncAt || undefined,
        syncEnabled: account.syncEnabled || false,
        syncFrequency: account.syncFrequency || 300,
        nextSyncIn,
      };
    } catch (error) {
      logger.error({ error: error }, 'Error getting account sync stats:');
      return null;
    }
  }
}
