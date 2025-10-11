import nodemailer from 'nodemailer';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { EnhancedGmailOAuthService } from './enhancedGmailOAuthService';
import { OutlookOAuthService } from './outlookOAuthService';

export interface EmailData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export class MultiAccountEmailService {
  static async sendFromAccount(
    accountId: string,
    emailData: EmailData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get account details
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId)
      });

      if (!account || !account.isActive) {
        throw new Error('Account not found or inactive');
      }

      console.log(`📧 Sending email from ${account.provider} account: ${account.emailAddress}`);

      switch (account.provider) {
        case 'gmail':
          return await this.sendViaGmail(account, emailData);
        case 'outlook':
          return await this.sendViaOutlook(account, emailData);
        case 'smtp':
        case 'imap':
          return await this.sendViaSMTP(account, emailData);
        default:
          throw new Error(`Unsupported provider: ${account.provider}`);
      }
    } catch (error) {
      console.error('Error sending email from account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  private static async sendViaGmail(
    account: any,
    emailData: EmailData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      return await EnhancedGmailOAuthService.sendGmailMessage(
        account,
        {
          to: emailData.to,
          subject: emailData.subject,
          htmlBody: emailData.htmlBody,
          textBody: emailData.textBody,
          cc: emailData.cc || [],
          bcc: emailData.bcc || [],
          attachments: emailData.attachments
        }
      );
    } catch (error) {
      console.error('Gmail send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gmail send failed'
      };
    }
  }

  private static async sendViaOutlook(
    account: any,
    emailData: EmailData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      return await OutlookOAuthService.sendOutlookMessage(
        account,
        emailData.to,
        emailData.subject,
        emailData.htmlBody,
        emailData.textBody,
        emailData.cc || [],
        emailData.bcc || []
      );
    } catch (error) {
      console.error('Outlook send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Outlook send failed'
      };
    }
  }

  private static async sendViaSMTP(
    account: any,
    emailData: EmailData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Create SMTP transporter
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort || 587,
        secure: account.smtpSecure || false,
        auth: {
          user: account.username || account.emailAddress,
          pass: account.password,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
      });

      // Verify connection
      await transporter.verify();

      // Send email
      const result = await transporter.sendMail({
        from: `"${account.accountName}" <${account.emailAddress}>`,
        to: emailData.to.join(', '),
        cc: emailData.cc?.join(', '),
        bcc: emailData.bcc?.join(', '),
        subject: emailData.subject,
        text: emailData.textBody,
        html: emailData.htmlBody,
        attachments: emailData.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('SMTP send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP send failed'
      };
    }
  }

  static async getDefaultAccount(userId: string): Promise<any | null> {
    try {
      // First try to get the default account
      let account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.userId, userId),
        orderBy: [desc(emailAccounts.isDefault), desc(emailAccounts.createdAt)]
      });

      return account || null;
    } catch (error) {
      console.error('Error getting default account:', error);
      return null;
    }
  }

  static async testAccountConnection(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId)
      });

      if (!account) {
        throw new Error('Account not found');
      }

      switch (account.provider) {
        case 'gmail':
          return await EnhancedGmailOAuthService.testGmailConnection(account);
        case 'outlook':
          return await OutlookOAuthService.testOutlookConnection(account);
        case 'smtp':
        case 'imap':
          return await this.testSMTPConnection(account);
        default:
          throw new Error(`Unsupported provider: ${account.provider}`);
      }
    } catch (error) {
      console.error('Error testing account connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  private static async testSMTPConnection(account: any): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort || 587,
        secure: account.smtpSecure || false,
        auth: {
          user: account.username || account.emailAddress,
          pass: account.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();
      
      console.log(`✅ SMTP connection successful for ${account.emailAddress}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ SMTP connection failed for ${account.emailAddress}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP connection failed'
      };
    }
  }

  static async syncAccount(accountId: string, userId: string): Promise<{ success: boolean; syncedCount?: number; error?: string }> {
    try {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId)
      });

      if (!account) {
        throw new Error('Account not found');
      }

      let syncedCount = 0;

      switch (account.provider) {
        case 'gmail':
          // Use Gmail API to fetch messages
          const gmailResult = await EnhancedGmailOAuthService.fetchGmailMessages(account, { maxResults: 50 });
          syncedCount = await this.saveMessagesToDatabase(account, gmailResult.messages, userId);
          break;
        case 'outlook':
          // Use Graph API to fetch messages
          const outlookMessages = await OutlookOAuthService.fetchOutlookMessages(account, 50);
          syncedCount = await this.saveMessagesToDatabase(account, outlookMessages, userId);
          break;
        case 'smtp':
        case 'imap':
          // Use IMAP to fetch messages (already implemented in ImapService)
          const { ImapService } = await import('./imapService');
          syncedCount = await ImapService.syncAccountEmails(accountId, userId);
          break;
        default:
          throw new Error(`Unsupported provider for sync: ${account.provider}`);
      }

      // Update last sync time
      await db
        .update(emailAccounts)
        .set({ lastSyncAt: new Date() })
        .where(eq(emailAccounts.id, accountId));

      return {
        success: true,
        syncedCount,
      };
    } catch (error) {
      console.error('Error syncing account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  private static async saveMessagesToDatabase(
    account: any,
    messages: any[],
    userId: string
  ): Promise<number> {
    const { emailMessages, emailThreads } = await import('@shared/schema');
    let syncedCount = 0;

    for (const message of messages) {
      try {
        // Check if message already exists
        const existingMessage = await db.query.emailMessages.findFirst({
          where: eq(emailMessages.externalMessageId, message.externalMessageId)
        });

        if (existingMessage) {
          continue; // Skip if already synced
        }

        // Find or create thread
        let threadId: string;
        
        const existingThread = await db.query.emailThreads.findFirst({
          where: eq(emailThreads.subject, message.subject)
        });

        if (existingThread) {
          threadId = existingThread.id;
        } else {
          const [newThread] = await db.insert(emailThreads).values({
            subject: message.subject,
            participantEmails: [message.from, ...message.to],
            lastMessageAt: message.date,
            messageCount: 0,
            createdBy: userId,
          }).returning();
          
          threadId = newThread.id;
        }

        // Insert message
        await db.insert(emailMessages).values({
          threadId,
          emailAccountId: account.id,
          externalMessageId: message.externalMessageId,
          fromEmail: message.from,
          toEmails: message.to,
          ccEmails: message.cc || [],
          bccEmails: message.bcc || [],
          subject: message.subject,
          htmlBody: message.htmlBody,
          textBody: message.textBody,
          messageType: 'received',
          isRead: false,
          sentAt: message.date,
          createdBy: userId,
        });

        syncedCount++;
      } catch (error) {
        console.warn(`Failed to save message ${message.externalMessageId}:`, error);
      }
    }

    return syncedCount;
  }
}
