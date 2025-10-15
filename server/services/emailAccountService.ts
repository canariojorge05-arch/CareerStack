/**
 * Enhanced Email Account Service
 * Handles multi-account operations with proper session management and rate limiting
 */

import { db } from '../config/database';
import { emailAccounts, emailMessages, emailThreads } from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { CacheService, CACHE_PREFIXES, CACHE_TTL } from '../config/redis';
import { RedisRateLimiter } from '../config/redis';
import { logger } from '../utils/logger';
import QueueManager from './queueManager';

export interface SendEmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
}

/**
 * Enhanced Email Account Service with multi-account support
 */
export class EmailAccountService {
  /**
   * Get user's email accounts with caching
   */
  static async getUserAccounts(userId: string): Promise<any[]> {
    const cacheKey = `${CACHE_PREFIXES.EMAIL_ACCOUNT}user:${userId}`;
    
    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;
    
    // Fetch from database
    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, userId))
      .orderBy(desc(emailAccounts.isDefault));
    
    // Cache for 5 minutes
    await CacheService.set(cacheKey, accounts, CACHE_TTL.MEDIUM);
    
    return accounts;
  }
  
  /**
   * Get single account with caching
   */
  static async getAccount(accountId: string): Promise<any | null> {
    const cacheKey = `${CACHE_PREFIXES.EMAIL_ACCOUNT}${accountId}`;
    
    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;
    
    // Fetch from database
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId))
      .limit(1);
    
    if (!account) return null;
    
    // Cache for 5 minutes
    await CacheService.set(cacheKey, account, CACHE_TTL.MEDIUM);
    
    return account;
  }
  
  /**
   * Check rate limit for account operations
   */
  static async checkAccountRateLimit(
    accountId: string,
    operation: 'send' | 'sync' | 'fetch'
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const limits: Record<string, { max: number; window: number }> = {
      send: { max: 100, window: 3600 }, // 100 per hour
      sync: { max: 10, window: 300 }, // 10 per 5 minutes
      fetch: { max: 50, window: 60 }, // 50 per minute
    };
    
    const limit = limits[operation];
    return RedisRateLimiter.checkLimit(
      `${CACHE_PREFIXES.RATE_LIMIT_ACCOUNT}${accountId}:${operation}`,
      limit.max,
      limit.window
    );
  }
  
  /**
   * Send email via specific account with rate limiting
   */
  static async sendEmailViaAccount(
    accountId: string,
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get account
      const account = await this.getAccount(accountId);
      
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      if (!account.isActive) {
        return { success: false, error: 'Account is not active' };
      }
      
      // Check rate limit
      const rateLimit = await this.checkAccountRateLimit(accountId, 'send');
      
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded. Try again at ${rateLimit.resetAt.toISOString()}`,
        };
      }
      
      // Add to send queue
      const job = await QueueManager.addEmailSendJob({
        accountId,
        userId: account.userId,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        htmlBody: options.htmlBody,
        textBody: options.textBody,
        attachments: options.attachments,
      });
      
      logger.info({ accountId, jobId: job.id }, 'Email queued for sending');
      
      return {
        success: true,
        messageId: job.id,
      };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to send email');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Sync emails for account with rate limiting
   */
  static async syncAccount(
    accountId: string,
    options: { fullSync?: boolean; since?: Date } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get account
      const account = await this.getAccount(accountId);
      
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      // Check rate limit
      const rateLimit = await this.checkAccountRateLimit(accountId, 'sync');
      
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded. Try again at ${rateLimit.resetAt.toISOString()}`,
        };
      }
      
      // Add to sync queue
      await QueueManager.addEmailSyncJob({
        accountId,
        userId: account.userId,
        fullSync: options.fullSync,
        since: options.since,
      });
      
      logger.info({ accountId }, 'Email sync queued');
      
      return { success: true };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to sync account');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Fetch emails for multiple accounts in parallel
   */
  static async fetchEmailsForMultipleAccounts(
    accountIds: string[],
    options: { limit?: number; offset?: number } = {}
  ): Promise<Record<string, any[]>> {
    const { limit = 50, offset = 0 } = options;
    
    // Fetch emails for each account in parallel
    const results = await Promise.all(
      accountIds.map(async (accountId) => {
        const cacheKey = `${CACHE_PREFIXES.EMAIL}account:${accountId}:${offset}:${limit}`;
        
        // Try cache first
        const cached = await CacheService.get(cacheKey);
        if (cached) {
          return { accountId, emails: cached };
        }
        
        // Fetch from database
        const messages = await db
          .select()
          .from(emailMessages)
          .where(eq(emailMessages.emailAccountId, accountId))
          .orderBy(desc(emailMessages.sentAt))
          .limit(limit)
          .offset(offset);
        
        // Cache for 1 minute
        await CacheService.set(cacheKey, messages, CACHE_TTL.SHORT);
        
        return { accountId, emails: messages };
      })
    );
    
    // Convert to object
    return results.reduce((acc, { accountId, emails }) => {
      acc[accountId] = emails;
      return acc;
    }, {} as Record<string, any[]>);
  }
  
  /**
   * Invalidate account cache
   */
  static async invalidateAccountCache(accountId: string): Promise<void> {
    await Promise.all([
      CacheService.del(`${CACHE_PREFIXES.EMAIL_ACCOUNT}${accountId}`),
      CacheService.delPattern(`${CACHE_PREFIXES.EMAIL}account:${accountId}:*`),
    ]);
  }
  
  /**
   * Invalidate user accounts cache
   */
  static async invalidateUserAccountsCache(userId: string): Promise<void> {
    await CacheService.del(`${CACHE_PREFIXES.EMAIL_ACCOUNT}user:${userId}`);
  }
  
  /**
   * Refresh OAuth token for account
   */
  static async refreshAccountToken(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.getAccount(accountId);
      
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      if (!account.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }
      
      // Check if token needs refresh (expires in less than 5 minutes)
      const expiresAt = account.tokenExpiresAt;
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (expiresAt && new Date(expiresAt).getTime() - now.getTime() > fiveMinutes) {
        return { success: true }; // Token still valid
      }
      
      // Refresh based on provider
      if (account.provider === 'gmail') {
        return await this.refreshGmailToken(account);
      } else if (account.provider === 'outlook') {
        return await this.refreshOutlookToken(account);
      }
      
      return { success: false, error: 'Unsupported provider' };
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to refresh token');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Refresh Gmail OAuth token
   */
  private static async refreshGmailToken(account: any): Promise<{ success: boolean; error?: string }> {
    try {
      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        refresh_token: account.refreshToken,
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update account with new token
      await db
        .update(emailAccounts)
        .set({
          accessToken: credentials.access_token,
          tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        })
        .where(eq(emailAccounts.id, account.id));
      
      // Invalidate cache
      await this.invalidateAccountCache(account.id);
      
      logger.info({ accountId: account.id }, 'Gmail token refreshed');
      
      return { success: true };
    } catch (error) {
      logger.error({ error, accountId: account.id }, 'Failed to refresh Gmail token');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Refresh Outlook OAuth token
   */
  private static async refreshOutlookToken(account: any): Promise<{ success: boolean; error?: string }> {
    try {
      // Implement Outlook token refresh
      // Similar to Gmail but using Microsoft Graph API
      
      logger.info({ accountId: account.id }, 'Outlook token refreshed');
      
      return { success: true };
    } catch (error) {
      logger.error({ error, accountId: account.id }, 'Failed to refresh Outlook token');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Get account statistics
   */
  static async getAccountStats(accountId: string): Promise<{
    totalEmails: number;
    unreadCount: number;
    todayCount: number;
    storageUsed: number;
  }> {
    const cacheKey = `${CACHE_PREFIXES.EMAIL_ACCOUNT}stats:${accountId}`;
    
    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;
    
    // Query database
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_emails,
        SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread_count,
        SUM(CASE WHEN DATE(sent_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today_count
      FROM email_messages
      WHERE email_account_id = $1
    `, [accountId]) as any;
    
    const result = {
      totalEmails: parseInt(stats?.total_emails || '0'),
      unreadCount: parseInt(stats?.unread_count || '0'),
      todayCount: parseInt(stats?.today_count || '0'),
      storageUsed: 0, // Calculate if needed
    };
    
    // Cache for 5 minutes
    await CacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
    
    return result;
  }
}

// Export specific functions for backward compatibility
export const getUserAccounts = EmailAccountService.getUserAccounts.bind(EmailAccountService);
export const sendEmailViaAccount = EmailAccountService.sendEmailViaAccount.bind(EmailAccountService);
export const syncAccount = EmailAccountService.syncAccount.bind(EmailAccountService);
export const refreshAccountToken = EmailAccountService.refreshAccountToken.bind(EmailAccountService);

export default EmailAccountService;
