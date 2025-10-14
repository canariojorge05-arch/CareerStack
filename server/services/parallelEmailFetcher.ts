import { db } from '../db';
import { emailAccounts, emailMessages, emailThreads } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { EnhancedGmailOAuthService } from './enhancedGmailOAuthService';
import { OutlookOAuthService } from './outlookOAuthService';
import { ImapService } from './imapService';
import { logger } from '../utils/logger';

export interface FetchOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
}

export interface AccountFetchResult {
  accountId: string;
  success: boolean;
  messageCount: number;
  error?: string;
  duration: number;
}

export class ParallelEmailFetcher {
  static async fetchMultipleAccounts(
    userId: string,
    accountIds?: string[],
    options: FetchOptions = {}
  ): Promise<AccountFetchResult[]> {
    try {
      let accounts = await db.query.emailAccounts.findMany({
        where: eq(emailAccounts.userId, userId),
      });

      if (accountIds && accountIds.length > 0) {
        accounts = accounts.filter(acc => accountIds.includes(acc.id));
      }

      accounts = accounts.filter(acc => acc.isActive && acc.syncEnabled);

      if (accounts.length === 0) {
        logger.info('No active accounts with sync enabled');
        return [];
      }

      logger.info(`🔄 Starting parallel fetch for ${accounts.length} accounts`);

      const fetchPromises = accounts.map(account =>
        this.fetchSingleAccount(account, userId, options)
      );

      const results = await Promise.allSettled(fetchPromises);

      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          logger.error(`Failed to fetch account ${accounts[index].id}:`, result.reason);
          return {
            accountId: accounts[index].id,
            success: false,
            messageCount: 0,
            error: result.reason?.message || 'Unknown error',
            duration: 0,
          };
        }
      });
    } catch (error) {
      logger.error('Error in parallel fetch:', error);
      return [];
    }
  }

  private static async fetchSingleAccount(
    account: any,
    userId: string,
    options: FetchOptions
  ): Promise<AccountFetchResult> {
    const startTime = Date.now();

    try {
      logger.info(`📥 Fetching emails for ${account.provider} account: ${account.emailAddress}`);

      let messages: any[] = [];

      switch (account.provider) {
        case 'gmail':
          const gmailResult = await EnhancedGmailOAuthService.fetchGmailMessages(
            account,
            {
              maxResults: options.maxResults || 50,
              q: options.query,
              labelIds: options.labelIds,
            }
          );
          messages = gmailResult.messages || [];
          break;

        case 'outlook':
          messages = await OutlookOAuthService.fetchOutlookMessages(
            account,
            options.maxResults || 50
          );
          break;

        case 'smtp':
        case 'imap':
          const imapResult = await ImapService.syncAccountEmails(account.id, userId);
          messages = [];
          break;

        default:
          throw new Error(`Unsupported provider: ${account.provider}`);
      }

      const savedCount = await this.saveMessagesToDatabase(account, messages, userId);

      await db
        .update(emailAccounts)
        .set({ lastSyncAt: new Date() })
        .where(eq(emailAccounts.id, account.id));

      const duration = Date.now() - startTime;
      logger.info(`✅ Fetched ${savedCount} new messages for ${account.emailAddress} in ${duration}ms`);

      return {
        accountId: account.id,
        success: true,
        messageCount: savedCount,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Failed to fetch account ${account.emailAddress}:`, error);

      return {
        accountId: account.id,
        success: false,
        messageCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  private static async saveMessagesToDatabase(
    account: any,
    messages: any[],
    userId: string
  ): Promise<number> {
    let syncedCount = 0;

    for (const message of messages) {
      try {
        const existingMessage = await db.query.emailMessages.findFirst({
          where: and(
            eq(emailMessages.externalMessageId, message.externalMessageId || message.id),
            eq(emailMessages.emailAccountId, account.id)
          ),
        });

        if (existingMessage) {
          continue;
        }

        let threadId: string;

        const existingThread = await db.query.emailThreads.findFirst({
          where: and(
            eq(emailThreads.subject, message.subject || 'No Subject'),
            eq(emailThreads.createdBy, userId)
          ),
        });

        if (existingThread) {
          threadId = existingThread.id;

          await db
            .update(emailThreads)
            .set({
              lastMessageAt: message.date || new Date(),
              messageCount: existingThread.messageCount + 1,
            })
            .where(eq(emailThreads.id, threadId));
        } else {
          const [newThread] = await db
            .insert(emailThreads)
            .values({
              subject: message.subject || 'No Subject',
              participantEmails: [
                message.from,
                ...(Array.isArray(message.to) ? message.to : []),
              ].filter(Boolean),
              lastMessageAt: message.date || new Date(),
              messageCount: 1,
              createdBy: userId,
            })
            .returning();

          threadId = newThread.id;
        }

        await db.insert(emailMessages).values({
          threadId,
          emailAccountId: account.id,
          externalMessageId: message.externalMessageId || message.id,
          fromEmail: message.from,
          toEmails: Array.isArray(message.to) ? message.to : [message.to].filter(Boolean),
          ccEmails: message.cc || [],
          bccEmails: message.bcc || [],
          subject: message.subject || 'No Subject',
          htmlBody: message.htmlBody || null,
          textBody: message.textBody || message.snippet || null,
          messageType: 'received',
          isRead: message.isRead || false,
          isStarred: message.isStarred || false,
          sentAt: message.date || new Date(),
          createdBy: userId,
        });

        syncedCount++;
      } catch (error) {
        logger.warn(`Failed to save message ${message.externalMessageId || message.id}:`, error);
      }
    }

    return syncedCount;
  }

  static async getUnifiedInbox(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      accountIds?: string[];
    } = {}
  ): Promise<{ threads: any[]; total: number; accounts: string[] }> {
    try {
      const { limit = 50, offset = 0, accountIds } = options;

      const whereConditions: any[] = [eq(emailThreads.createdBy, userId)];

      if (accountIds && accountIds.length > 0) {
        whereConditions.push(
          eq(emailMessages.emailAccountId, accountIds[0])
        );
      }

      const threads = await db.query.emailThreads.findMany({
        where: and(...whereConditions),
        orderBy: [desc(emailThreads.lastMessageAt)],
        limit,
        offset,
        with: {
          messages: {
            limit: 1,
            orderBy: [desc(emailMessages.sentAt)],
          },
        },
      });

      const accounts = await db.query.emailAccounts.findMany({
        where: eq(emailAccounts.userId, userId),
      });

      return {
        threads,
        total: threads.length,
        accounts: accounts.map(acc => acc.id),
      };
    } catch (error) {
      logger.error('Error getting unified inbox:', error);
      return { threads: [], total: 0, accounts: [] };
    }
  }
}
