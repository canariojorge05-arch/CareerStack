import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { MultiAccountEmailService } from './multiAccountEmailService';

export class EmailSyncService {
  private static syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private static isRunning = false;

  static async startBackgroundSync(): Promise<void> {
    if (this.isRunning) {
      console.log('📧 Email sync service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting email background sync service');

    // Initial sync for all active accounts
    await this.syncAllAccounts();

    // Set up periodic sync every 1 minute for near-instant email delivery
    const globalSyncInterval = setInterval(async () => {
      await this.syncAllAccounts();
    }, 1 * 60 * 1000); // 1 minute

    // Store the global interval
    this.syncIntervals.set('global', globalSyncInterval);

    console.log('✅ Email background sync service started');
  }

  static async stopBackgroundSync(): Promise<void> {
    console.log('🛑 Stopping email background sync service');

    // Clear all intervals
    for (const [key, interval] of this.syncIntervals) {
      clearInterval(interval);
      console.log(`Cleared sync interval for ${key}`);
    }

    this.syncIntervals.clear();
    this.isRunning = false;

    console.log('✅ Email background sync service stopped');
  }

  static async syncAllAccounts(): Promise<void> {
    try {
      // Get all active accounts that have sync enabled
      let accounts;
      try {
        accounts = await db.query.emailAccounts.findMany({
          where: eq(emailAccounts.isActive, true),
        });
      } catch (dbError: any) {
        console.error('❌ Database connection failed during email sync:', dbError?.message || dbError);
        console.log('⚠️ Skipping email sync due to database connectivity issues');
        return;
      }

      const activeAccounts = accounts.filter(account => 
        account.syncEnabled && this.shouldSync(account)
      );

      if (activeAccounts.length === 0) {
        console.log('📧 No accounts need syncing');
        return;
      }

      console.log(`🔄 Syncing ${activeAccounts.length} email accounts`);

      // Sync accounts in parallel (but limit concurrency)
      const syncPromises = activeAccounts.map(account => 
        this.syncSingleAccount(account)
      );

      const results = await Promise.allSettled(syncPromises);

      // Log results
      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, index) => {
        const account = activeAccounts[index];
        if (result.status === 'fulfilled') {
          successCount++;
          console.log(`✅ Synced ${account.emailAddress}: ${result.value.syncedCount} new messages`);
        } else {
          errorCount++;
          console.error(`❌ Failed to sync ${account.emailAddress}:`, result.reason);
        }
      });

      console.log(`📊 Sync completed: ${successCount} successful, ${errorCount} failed`);
    } catch (error) {
      console.error('Error in syncAllAccounts:', error);
    }
  }

  private static shouldSync(account: any): boolean {
    if (!account.lastSyncAt) {
      return true; // Never synced before
    }

    const now = new Date();
    const lastSync = new Date(account.lastSyncAt);
    const syncFrequencyMs = (account.syncFrequency || 60) * 1000; // Default 1 minute

    return (now.getTime() - lastSync.getTime()) >= syncFrequencyMs;
  }

  private static async syncSingleAccount(account: any): Promise<{ syncedCount: number }> {
    try {
      const result = await MultiAccountEmailService.syncAccount(account.id, account.userId);
      
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      return { syncedCount: result.syncedCount || 0 };
    } catch (error) {
      console.error(`Error syncing account ${account.emailAddress}:`, error);
      throw error;
    }
  }

  static async syncAccountOnDemand(accountId: string, userId: string): Promise<{
    success: boolean;
    syncedCount?: number;
    error?: string;
  }> {
    try {
      console.log(`🔄 On-demand sync requested for account ${accountId}`);
      
      const result = await MultiAccountEmailService.syncAccount(accountId, userId);
      
      if (result.success) {
        console.log(`✅ On-demand sync completed: ${result.syncedCount} new messages`);
      }

      return result;
    } catch (error) {
      console.error('Error in on-demand sync:', error);
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

      console.log(`✅ Enabled sync for account ${accountId}`);
    } catch (error) {
      console.error('Error enabling account sync:', error);
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

      console.log(`✅ Disabled sync for account ${accountId}`);
    } catch (error) {
      console.error('Error disabling account sync:', error);
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

      console.log(`✅ Updated sync frequency for account ${accountId} to ${syncFrequency} seconds`);
    } catch (error) {
      console.error('Error updating sync frequency:', error);
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
      console.error('Error getting account sync stats:', error);
      return null;
    }
  }
}
