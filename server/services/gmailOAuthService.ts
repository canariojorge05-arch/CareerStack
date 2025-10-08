import { OAuth2Client } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GmailOAuthService {
  private static oauth2Client: OAuth2Client;
  
  static initialize(config: GmailOAuthConfig) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  static getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId to identify the user after OAuth
      prompt: 'consent' // Force consent to get refresh token
    });
  }

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

      if (existingAccount) {
        // Update existing account with new tokens
        const [updatedAccount] = await db
          .update(emailAccounts)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || existingAccount.refreshToken,
            tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(emailAccounts.id, existingAccount.id))
          .returning();

        return {
          success: true,
          account: {
            ...updatedAccount,
            accessToken: undefined,
            refreshToken: undefined,
          }
        };
      } else {
        // Create new account
        const [newAccount] = await db.insert(emailAccounts).values({
          userId,
          accountName: userInfo.name || userInfo.email,
          emailAddress: userInfo.email,
          provider: 'gmail',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          isDefault: false, // Will be set as default if it's the first account
          isActive: true,
          syncEnabled: true,
        }).returning();

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

  static async refreshAccessToken(account: any): Promise<string | null> {
    try {
      if (!account.refreshToken) {
        throw new Error('No refresh token available');
      }

      this.oauth2Client.setCredentials({
        refresh_token: account.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Update account with new token
      await db
        .update(emailAccounts)
        .set({
          accessToken: credentials.access_token,
          tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, account.id));

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing Gmail access token:', error);
      return null;
    }
  }

  static async getGmailClient(account: any): Promise<gmail_v1.Gmail | null> {
    try {
      let accessToken = account.accessToken;

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
        refresh_token: account.refreshToken,
      });

      // Create Gmail client
      return google.gmail({ version: 'v1', auth: oauth2Client });
    } catch (error) {
      console.error('Error creating Gmail client:', error);
      return null;
    }
  }

  static async testGmailConnection(account: any): Promise<{ success: boolean; error?: string }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      // Test by getting user profile
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      console.log(`✅ Gmail connection successful for ${account.emailAddress}. Messages: ${profile.data.messagesTotal}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Gmail connection failed for ${account.emailAddress}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async fetchGmailMessages(
    account: any, 
    maxResults: number = 50
  ): Promise<any[]> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      // Get message list
      const messageList = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox', // Start with inbox messages
      });

      const messages = messageList.data.messages || [];
      const fetchedMessages = [];

      // Fetch full message details
      for (const message of messages.slice(0, maxResults)) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          const msg = fullMessage.data;
          const headers = msg.payload?.headers || [];
          
          // Extract headers
          const getHeader = (name: string) => 
            headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          // Extract body
          let htmlBody = '';
          let textBody = '';
          
          const extractBody = (part: any) => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              textBody = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              htmlBody = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.parts) {
              part.parts.forEach(extractBody);
            }
          };

          if (msg.payload) {
            extractBody(msg.payload);
          }

          fetchedMessages.push({
            externalMessageId: msg.id,
            from: getHeader('From'),
            to: getHeader('To').split(',').map(email => email.trim()).filter(Boolean),
            cc: getHeader('Cc').split(',').map(email => email.trim()).filter(Boolean),
            bcc: getHeader('Bcc').split(',').map(email => email.trim()).filter(Boolean),
            subject: getHeader('Subject') || 'No Subject',
            date: new Date(parseInt(msg.internalDate || '0')),
            htmlBody: htmlBody || undefined,
            textBody: textBody || undefined,
            labels: msg.labelIds || [],
          });
        } catch (error) {
          console.warn(`Failed to fetch message ${message.id}:`, error);
        }
      }

      return fetchedMessages;
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);
      throw error;
    }
  }

  static async sendGmailMessage(
    account: any,
    to: string[],
    subject: string,
    htmlBody: string,
    textBody: string,
    cc: string[] = [],
    bcc: string[] = []
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const gmail = await this.getGmailClient(account);
      
      if (!gmail) {
        throw new Error('Failed to create Gmail client');
      }

      // Create email message
      const messageParts = [
        `From: ${account.emailAddress}`,
        `To: ${to.join(', ')}`,
        cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
        bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : '',
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="boundary123"',
        '',
        '--boundary123',
        'Content-Type: text/plain; charset=utf-8',
        '',
        textBody,
        '',
        '--boundary123',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody,
        '',
        '--boundary123--'
      ].filter(Boolean).join('\n');

      const encodedMessage = Buffer.from(messageParts).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send message
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

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
}
