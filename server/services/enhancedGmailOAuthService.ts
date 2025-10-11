import { OAuth2Client } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encryptToken, decryptToken } from '../utils/tokenEncryption';

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GmailMessage {
  externalMessageId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: Date;
  htmlBody?: string;
  textBody?: string;
  labels: string[];
  attachments?: GmailAttachment[];
  snippet?: string;
}

export interface GmailAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
}

export interface RateLimitConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
}

export class EnhancedGmailOAuthService {
  private static oauth2Client: OAuth2Client;
  private static config: GmailOAuthConfig;
  private static rateLimitConfig: RateLimitConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 32000
  };
  
  static initialize(config: GmailOAuthConfig) {
    this.config = config;
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    console.log('✅ Enhanced Gmail OAuth Service initialized');
  }

  /**
   * Generate OAuth authorization URL with proper scopes
   */
  static getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId,
      prompt: 'consent',
      include_granted_scopes: true
    });
  }

  /**
   * Handle OAuth callback and store encrypted tokens
   */
  static async handleCallback(code: string, userId: string): Promise<{
    success: boolean;
    account?: any;
    error?: string;
  }> {
    try {
      // Exchange code for tokens
      const response = await this.oauth2Client.getToken(code);
      const tokens = response.tokens;
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      // Set credentials to get user info
      this.oauth2Client.setCredentials(tokens);
      
      // Get user profile information
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email) {
        throw new Error('Could not retrieve user email');
      }

      // Check if account already exists
      const existingAccount = await db.query.emailAccounts.findFirst({
        where: and(
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.emailAddress, userInfo.email)
        )
      });

      // Encrypt tokens before storage
      const encryptedAccessToken = encryptToken(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

      if (existingAccount) {
        // Update existing account with new encrypted tokens
        const [updatedAccount] = await db
          .update(emailAccounts)
          .set({
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken || existingAccount.refreshToken,
            tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(emailAccounts.id, existingAccount.id))
          .returning();

        console.log(`✅ Updated Gmail account: ${userInfo.email}`);
        
        return {
          success: true,
          account: {
            ...updatedAccount,
            accessToken: undefined,
            refreshToken: undefined,
          }
        };
      } else {
        // Create new account with encrypted tokens
        const [newAccount] = await db.insert(emailAccounts).values({
          userId,
          accountName: userInfo.name || userInfo.email,
          emailAddress: userInfo.email,
          provider: 'gmail',
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          isDefault: false,
          isActive: true,
          syncEnabled: true,
        }).returning();

        console.log(`✅ Created new Gmail account: ${userInfo.email}`);

        return {
          success: true,
          account: {
            ...newAccount,
            accessToken: undefined,
            refreshToken: undefined,
          }
        };
      }
    } catch (error) {
      console.error('Gmail OAuth callback error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback failed'
      };
    }
  }

  /**
   * Refresh access token with rate limit handling
   */
  static async refreshAccessToken(account: any): Promise<string | null> {
    try {
      if (!account.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Decrypt the refresh token
      const decryptedRefreshToken = decryptToken(account.refreshToken);
      
      if (!decryptedRefreshToken) {
        throw new Error('Failed to decrypt refresh token');
      }

      this.oauth2Client.setCredentials({
        refresh_token: decryptedRefreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Encrypt new access token
      const encryptedAccessToken = encryptToken(credentials.access_token);

      // Update account with new encrypted token
      await db
        .update(emailAccounts)
        .set({
          accessToken: encryptedAccessToken,
          tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, account.id));

      console.log(`✅ Refreshed access token for account: ${account.emailAddress}`);

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing Gmail access token:', error);
      return null;
    }
  }

  /**
   * Get Gmail client with automatic token refresh
   */
  static async getGmailClient(account: any): Promise<gmail_v1.Gmail | null> {
    try {
      // Decrypt access token
      let accessToken = decryptToken(account.accessToken);

      // Check if token is expired
      if (account.tokenExpiresAt && new Date() >= new Date(account.tokenExpiresAt)) {
        console.log('Access token expired, refreshing...');
        accessToken = await this.refreshAccessToken(account);
        
        if (!accessToken) {
          throw new Error('Failed to refresh access token');
        }
      }

      // Create OAuth2 client with current token
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: decryptToken(account.refreshToken),
      });

      // Create Gmail client
      return google.gmail({ version: 'v1', auth: oauth2Client });
    } catch (error) {
      console.error('Error creating Gmail client:', error);
      return null;
    }
  }

  /**
   * Execute API call with exponential backoff for rate limits
   */
  private static async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error.code === 429 || error.code === 403) {
        if (retryCount < this.rateLimitConfig.maxRetries) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            this.rateLimitConfig.baseDelay * Math.pow(2, retryCount),
            this.rateLimitConfig.maxDelay
          );
          
          console.log(`⏳ Rate limit hit, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.rateLimitConfig.maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeWithRetry(operation, retryCount + 1);
        }
      }
      
      // If not a rate limit error or max retries reached, throw
      throw error;
    }
  }

  /**
   * Test Gmail connection
   */
  static async testGmailConnection(account: any): Promise<{ success: boolean; error?: string; profile?: any }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      // Test by getting user profile
      const profile = await this.executeWithRetry(() => 
        gmail.users.getProfile({ userId: 'me' })
      );
      
      console.log(`✅ Gmail connection successful for ${account.emailAddress}. Messages: ${profile.data.messagesTotal}`);
      
      return { 
        success: true,
        profile: {
          emailAddress: profile.data.emailAddress,
          messagesTotal: profile.data.messagesTotal,
          threadsTotal: profile.data.threadsTotal,
          historyId: profile.data.historyId
        }
      };
    } catch (error) {
      console.error(`❌ Gmail connection failed for ${account.emailAddress}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Fetch Gmail messages with attachments
   */
  static async fetchGmailMessages(
    account: any, 
    options: {
      maxResults?: number;
      query?: string;
      labelIds?: string[];
      pageToken?: string;
    } = {}
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      const { maxResults = 50, query, labelIds, pageToken } = options;

      // Get message list
      const messageList = await this.executeWithRetry(() =>
        gmail.users.messages.list({
          userId: 'me',
          maxResults,
          q: query || undefined,
          labelIds: labelIds || undefined,
          pageToken: pageToken || undefined,
        })
      );

      const messages = messageList.data.messages || [];
      const fetchedMessages: GmailMessage[] = [];

      // Fetch full message details in batches
      for (const message of messages) {
        try {
          const fullMessage = await this.executeWithRetry(() =>
            gmail.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'full',
            })
          );

          const msg = fullMessage.data;
          const headers = msg.payload?.headers || [];
          
          // Extract headers
          const getHeader = (name: string) => 
            headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          // Extract body and attachments
          let htmlBody = '';
          let textBody = '';
          const attachments: GmailAttachment[] = [];
          
          const extractContent = (part: any) => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              textBody = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              htmlBody = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.filename && part.body?.attachmentId) {
              attachments.push({
                attachmentId: part.body.attachmentId,
                fileName: part.filename,
                mimeType: part.mimeType || 'application/octet-stream',
                size: part.body.size || 0
              });
            }
            
            if (part.parts) {
              part.parts.forEach(extractContent);
            }
          };

          if (msg.payload) {
            extractContent(msg.payload);
          }

          fetchedMessages.push({
            externalMessageId: msg.id!,
            from: getHeader('From'),
            to: getHeader('To').split(',').map(email => email.trim()).filter(Boolean),
            cc: getHeader('Cc').split(',').map(email => email.trim()).filter(Boolean),
            bcc: getHeader('Bcc').split(',').map(email => email.trim()).filter(Boolean),
            subject: getHeader('Subject') || 'No Subject',
            date: new Date(parseInt(msg.internalDate || '0')),
            htmlBody: htmlBody || undefined,
            textBody: textBody || msg.snippet || undefined,
            labels: msg.labelIds || [],
            attachments: attachments.length > 0 ? attachments : undefined,
            snippet: msg.snippet || undefined
          });
        } catch (error) {
          console.warn(`Failed to fetch message ${message.id}:`, error);
        }
      }

      return {
        messages: fetchedMessages,
        nextPageToken: messageList.data.nextPageToken || undefined
      };
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);
      throw error;
    }
  }

  /**
   * Get attachment data
   */
  static async getAttachment(
    account: any,
    messageId: string,
    attachmentId: string
  ): Promise<{ data: Buffer; fileName?: string } | null> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      const attachment = await this.executeWithRetry(() =>
        gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachmentId
        })
      );

      if (!attachment.data.data) {
        return null;
      }

      const data = Buffer.from(attachment.data.data, 'base64url');
      
      return {
        data,
        fileName: undefined // Filename is in the message part, not the attachment response
      };
    } catch (error) {
      console.error('Error getting attachment:', error);
      return null;
    }
  }

  /**
   * Send Gmail message with attachments support
   */
  static async sendGmailMessage(
    account: any,
    options: {
      to: string[];
      subject: string;
      htmlBody: string;
      textBody: string;
      cc?: string[];
      bcc?: string[];
      attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
      threadId?: string;
      inReplyTo?: string;
      references?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      const { to, subject, htmlBody, textBody, cc = [], bcc = [], attachments = [], threadId, inReplyTo, references } = options;

      // Build multipart message
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;
      
      const messageParts = [
        `From: ${account.emailAddress}`,
        `To: ${to.join(', ')}`,
        cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
        bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : '',
        `Subject: ${subject}`,
        inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
        references ? `References: ${references}` : '',
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: multipart/alternative; boundary="alt_boundary"',
        '',
        '--alt_boundary',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(textBody).toString('base64'),
        '',
        '--alt_boundary',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(htmlBody).toString('base64'),
        '',
        '--alt_boundary--',
      ].filter(Boolean);

      // Add attachments
      for (const attachment of attachments) {
        messageParts.push(
          '',
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.content.toString('base64')
        );
      }

      messageParts.push('', `--${boundary}--`);

      const message = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(message).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send message
      const result = await this.executeWithRetry(() =>
        gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage,
            threadId: threadId || undefined
          },
        })
      );

      console.log(`✅ Email sent successfully from ${account.emailAddress}`);

      return {
        success: true,
        messageId: result.data.id || undefined,
      };
    } catch (error) {
      console.error('Error sending Gmail message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  /**
   * Get all labels
   */
  static async getLabels(account: any): Promise<GmailLabel[]> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      const response = await this.executeWithRetry(() =>
        gmail.users.labels.list({ userId: 'me' })
      );

      return (response.data.labels || []).map(label => ({
        id: label.id!,
        name: label.name!,
        type: label.type!,
        messageListVisibility: label.messageListVisibility || undefined,
        labelListVisibility: label.labelListVisibility || undefined
      }));
    } catch (error) {
      console.error('Error getting labels:', error);
      throw error;
    }
  }

  /**
   * Create custom label
   */
  static async createLabel(
    account: any,
    labelName: string,
    options: {
      messageListVisibility?: 'show' | 'hide';
      labelListVisibility?: 'labelShow' | 'labelHide';
    } = {}
  ): Promise<GmailLabel | null> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      const response = await this.executeWithRetry(() =>
        gmail.users.labels.create({
          userId: 'me',
          requestBody: {
            name: labelName,
            messageListVisibility: options.messageListVisibility || 'show',
            labelListVisibility: options.labelListVisibility || 'labelShow'
          }
        })
      );

      const label = response.data;
      return {
        id: label.id!,
        name: label.name!,
        type: label.type!,
        messageListVisibility: label.messageListVisibility || undefined,
        labelListVisibility: label.labelListVisibility || undefined
      };
    } catch (error) {
      console.error('Error creating label:', error);
      return null;
    }
  }

  /**
   * Modify message labels
   */
  static async modifyMessageLabels(
    account: any,
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = []
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      await this.executeWithRetry(() =>
        gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds,
            removeLabelIds
          }
        })
      );

      return { success: true };
    } catch (error) {
      console.error('Error modifying message labels:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to modify labels'
      };
    }
  }

  /**
   * Get history for incremental sync
   */
  static async getHistory(
    account: any,
    startHistoryId: string,
    historyTypes?: string[]
  ): Promise<{ history: any[]; historyId: string } | null> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      const response = await this.executeWithRetry(() =>
        gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: historyTypes || undefined
        })
      );

      return {
        history: response.data.history || [],
        historyId: response.data.historyId!
      };
    } catch (error) {
      console.error('Error getting history:', error);
      return null;
    }
  }

  /**
   * Archive message (remove INBOX label)
   */
  static async archiveMessage(account: any, messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.modifyMessageLabels(account, messageId, [], ['INBOX']);
  }

  /**
   * Mark message as read
   */
  static async markAsRead(account: any, messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.modifyMessageLabels(account, messageId, [], ['UNREAD']);
  }

  /**
   * Mark message as unread
   */
  static async markAsUnread(account: any, messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.modifyMessageLabels(account, messageId, ['UNREAD'], []);
  }

  /**
   * Star message
   */
  static async starMessage(account: any, messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.modifyMessageLabels(account, messageId, ['STARRED'], []);
  }

  /**
   * Unstar message
   */
  static async unstarMessage(account: any, messageId: string): Promise<{ success: boolean; error?: string }> {
    return this.modifyMessageLabels(account, messageId, [], ['STARRED']);
  }

  /**
   * Move to trash
   */
  static async trashMessage(account: any, messageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      await this.executeWithRetry(() =>
        gmail.users.messages.trash({
          userId: 'me',
          id: messageId
        })
      );

      return { success: true };
    } catch (error) {
      console.error('Error trashing message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trash message'
      };
    }
  }

  /**
   * Delete account (revoke tokens and remove from database)
   */
  static async deleteAccount(accountId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get account
      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId)
        )
      });

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Try to revoke token
      try {
        const accessToken = decryptToken(account.accessToken);
        if (accessToken) {
          await this.oauth2Client.revokeToken(accessToken);
          console.log(`✅ Revoked access token for ${account.emailAddress}`);
        }
      } catch (error) {
        console.warn('Failed to revoke token (continuing with deletion):', error);
      }

      // Delete from database
      await db.delete(emailAccounts)
        .where(and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId)
        ));

      console.log(`✅ Deleted Gmail account: ${account.emailAddress}`);

      return { success: true };
    } catch (error) {
      console.error('Error deleting account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete account'
      };
    }
  }
}
