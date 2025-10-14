import { ImapFlow } from 'imapflow';
import { db } from '../db';
import { emailAccounts, emailMessages, emailThreads } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface EmailAccount {
  id: string;
  emailAddress: string;
  provider: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface FetchedEmail {
  uid: number;
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: Date;
  htmlBody?: string;
  textBody?: string;
  attachments?: any[];
  folder: string;
}

export class ImapService {
  private static getImapConfig(account: EmailAccount) {
    if (account.provider === 'gmail') {
      return {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
          user: account.emailAddress,
          accessToken: account.accessToken,
        },
      };
    } else if (account.provider === 'outlook') {
      return {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
        auth: {
          user: account.emailAddress,
          accessToken: account.accessToken,
        },
      };
    } else {
      // Generic IMAP
      return {
        host: account.imapHost!,
        port: account.imapPort || 993,
        secure: account.imapSecure !== false,
        auth: {
          user: account.username || account.emailAddress,
          pass: account.password,
        },
      };
    }
  }

  static async testConnection(account: EmailAccount): Promise<{ success: boolean; error?: string }> {
    let client: ImapFlow | null = null;
    
    try {
      const config = this.getImapConfig(account);
      client = new ImapFlow(config);
      
      await client.connect();
      
      // Test basic operations
      const mailboxes = await client.list();
      logger.info(`✅ IMAP connection successful for ${account.emailAddress}. Found ${mailboxes.length} mailboxes.`);
      
      return { success: true };
    } catch (error) {
      logger.error(`❌ IMAP connection failed for ${account.emailAddress}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (e) {
          // Ignore logout errors
        }
      }
    }
  }

  static async fetchEmails(
    account: EmailAccount, 
    folder: string = 'INBOX',
    limit: number = 50
  ): Promise<FetchedEmail[]> {
    let client: ImapFlow | null = null;
    
    try {
      const config = this.getImapConfig(account);
      client = new ImapFlow(config);
      
      await client.connect();
      
      // Select the mailbox
      const mailbox = await client.getMailboxLock(folder);
      
      try {
        // Get recent messages
        const messages = [];
        const range = `${Math.max(1, (mailbox as any).exists - limit + 1)}:*`;
        
        for await (const message of client.fetch(range, {
          envelope: true,
          bodyStructure: true,
          source: true,
          uid: true,
        })) {
          const envelope = message.envelope;
          
          if (!envelope) continue;
          
          // Parse email addresses
          const from = envelope.from?.[0]?.address || '';
          const to = envelope.to?.map(addr => addr.address).filter((addr): addr is string => Boolean(addr)) || [];
          const cc = envelope.cc?.map(addr => addr.address).filter((addr): addr is string => Boolean(addr)) || [];
          const bcc = envelope.bcc?.map(addr => addr.address).filter((addr): addr is string => Boolean(addr)) || [];
          
          // Get body content
          let htmlBody = '';
          let textBody = '';
          
          try {
            // Try to get HTML body
            const htmlPart = await client.download(message.uid, '1.2', { uid: true });
            if (htmlPart) {
              htmlBody = htmlPart.toString();
            }
          } catch (e) {
            // HTML part might not exist
          }
          
          try {
            // Try to get text body
            const textPart = await client.download(message.uid, '1.1', { uid: true });
            if (textPart) {
              textBody = textPart.toString();
            }
          } catch (e) {
            // Text part might not exist
          }
          
          // If no specific parts, try to get the whole body
          if (!htmlBody && !textBody) {
            try {
              const body = await client.download(message.uid, 'TEXT', { uid: true });
              textBody = body.toString();
            } catch (e) {
              logger.warn({ context: e }, 'Could not fetch email body:');
            }
          }
          
          messages.push({
            uid: message.uid,
            messageId: envelope.messageId || `${message.uid}@${account.emailAddress}`,
            from,
            to,
            cc,
            bcc,
            subject: envelope.subject || 'No Subject',
            date: envelope.date || new Date(),
            htmlBody: htmlBody || undefined,
            textBody: textBody || undefined,
            folder,
          });
        }
        
        return messages.reverse(); // Most recent first
      } finally {
        mailbox.release();
      }
    } catch (error) {
      logger.error(`Error fetching emails for ${account.emailAddress}:`, error);
      throw error;
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (e) {
          // Ignore logout errors
        }
      }
    }
  }

  static async syncAccountEmails(accountId: string, userId: string): Promise<number> {
    try {
      // Get account details
      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId)
        ),
      });

      if (!account || !account.isActive) {
        throw new Error('Account not found or inactive');
      }

      logger.info(`🔄 Starting email sync for ${account.emailAddress}`);

      // Fetch emails from IMAP
      const fetchedEmails = await this.fetchEmails(account as any, 'INBOX', 100);
      
      let syncedCount = 0;

      for (const email of fetchedEmails) {
        // Check if email already exists
        const existingMessage = await db.query.emailMessages.findFirst({
          where: and(
            eq(emailMessages.emailAccountId, accountId),
            eq(emailMessages.externalMessageId, email.uid.toString())
          ),
        });

        if (existingMessage) {
          continue; // Skip if already synced
        }

        // Find or create thread
        let threadId: string;
        
        // Try to find existing thread by subject
        const existingThread = await db.query.emailThreads.findFirst({
          where: eq(emailThreads.subject, email.subject),
        });

        if (existingThread) {
          threadId = existingThread.id;
        } else {
          // Create new thread
          const [newThread] = await db.insert(emailThreads).values({
            subject: email.subject,
            participantEmails: [email.from, ...email.to],
            lastMessageAt: email.date,
            messageCount: 0,
            createdBy: userId,
          }).returning();
          
          threadId = newThread.id;
        }

        // Insert message
        await db.insert(emailMessages).values({
          threadId,
          emailAccountId: accountId,
          externalMessageId: email.uid.toString(),
          fromEmail: email.from,
          toEmails: email.to,
          ccEmails: email.cc,
          bccEmails: email.bcc,
          subject: email.subject,
          htmlBody: email.htmlBody,
          textBody: email.textBody,
          messageType: 'received',
          isRead: false,
          sentAt: email.date,
          externalFolder: email.folder,
          createdBy: userId,
        });

        syncedCount++;
      }

      // Update last sync time
      await db.update(emailAccounts)
        .set({ lastSyncAt: new Date() })
        .where(eq(emailAccounts.id, accountId));

      logger.info(`✅ Synced ${syncedCount} new emails for ${account.emailAddress}`);
      return syncedCount;

    } catch (error) {
      logger.error({ error: error }, 'Error syncing emails:');
      throw error;
    }
  }

  static async getMailboxes(account: EmailAccount): Promise<string[]> {
    let client: ImapFlow | null = null;
    
    try {
      const config = this.getImapConfig(account);
      client = new ImapFlow(config);
      
      await client.connect();
      
      const mailboxes = await client.list();
      return mailboxes.map(mb => mb.path);
    } catch (error) {
      logger.error(`Error getting mailboxes for ${account.emailAddress}:`, error);
      throw error;
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (e) {
          // Ignore logout errors
        }
      }
    }
  }
}
