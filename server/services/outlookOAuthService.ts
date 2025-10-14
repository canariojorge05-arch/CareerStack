import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface OutlookOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId?: string;
}

class CustomAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

export class OutlookOAuthService {
  private static config: OutlookOAuthConfig;

  static initialize(config: OutlookOAuthConfig) {
    this.config = config;
  }

  static getAuthUrl(userId: string): string {
    const tenantId = this.config.tenantId || 'common';
    const scopes = [
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read',
      'offline_access'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: scopes,
      state: userId,
      response_mode: 'query',
      prompt: 'consent'
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  static async handleCallback(code: string, userId: string): Promise<{
    success: boolean;
    account?: any;
    error?: string;
  }> {
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      // Get user profile
      const graphClient = Client.initWithMiddleware({
        authProvider: new CustomAuthProvider(tokens.access_token)
      });

      const userProfile = await graphClient.api('/me').get();

      if (!userProfile.mail && !userProfile.userPrincipalName) {
        throw new Error('Could not retrieve user email');
      }

      const emailAddress = userProfile.mail || userProfile.userPrincipalName;

      // Check if account already exists
      const existingAccount = await db.query.emailAccounts.findFirst({
        where: and(
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.emailAddress, emailAddress)
        )
      });

      const expiresAt = tokens.expires_in ? 
        new Date(Date.now() + tokens.expires_in * 1000) : null;

      if (existingAccount) {
        // Update existing account
        const [updatedAccount] = await db
          .update(emailAccounts)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || existingAccount.refreshToken,
            tokenExpiresAt: expiresAt,
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
          accountName: userProfile.displayName || emailAddress,
          emailAddress,
          provider: 'outlook',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
          isDefault: false,
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
      logger.error({ error: error }, 'Outlook OAuth callback error:');
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

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: account.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        throw new Error('No access token in refresh response');
      }

      const expiresAt = tokens.expires_in ? 
        new Date(Date.now() + tokens.expires_in * 1000) : null;

      // Update account with new token
      await db
        .update(emailAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || account.refreshToken,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, account.id));

      return tokens.access_token;
    } catch (error) {
      logger.error({ error: error }, 'Error refreshing Outlook access token:');
      return null;
    }
  }

  static async getGraphClient(account: any): Promise<Client | null> {
    try {
      let accessToken = account.accessToken;

      // Check if token is expired
      if (account.tokenExpiresAt && new Date() >= new Date(account.tokenExpiresAt)) {
        logger.info('Access token expired, refreshing...');
        accessToken = await this.refreshAccessToken(account);
        
        if (!accessToken) {
          throw new Error('Failed to refresh access token');
        }
      }

      return Client.initWithMiddleware({
        authProvider: new CustomAuthProvider(accessToken)
      });
    } catch (error) {
      logger.error({ error: error }, 'Error creating Graph client:');
      return null;
    }
  }

  static async testOutlookConnection(account: any): Promise<{ success: boolean; error?: string }> {
    try {
      const graphClient = await this.getGraphClient(account);
      
      if (!graphClient) {
        throw new Error('Failed to create Graph client');
      }

      // Test by getting user profile
      const profile = await graphClient.api('/me').get();
      
      logger.info(`✅ Outlook connection successful for ${account.emailAddress}. User: ${profile.displayName}`);
      
      return { success: true };
    } catch (error) {
      logger.error(`❌ Outlook connection failed for ${account.emailAddress}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async fetchOutlookMessages(
    account: any, 
    maxResults: number = 50
  ): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient(account);
      
      if (!graphClient) {
        throw new Error('Failed to create Graph client');
      }

      // Get messages from inbox
      const messages = await graphClient
        .api('/me/mailFolders/inbox/messages')
        .top(maxResults)
        .select('id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,body,bodyPreview')
        .get();

      return messages.value.map((msg: any) => ({
        externalMessageId: msg.id,
        from: msg.from?.emailAddress?.address || '',
        to: msg.toRecipients?.map((r: any) => r.emailAddress?.address).filter(Boolean) || [],
        cc: msg.ccRecipients?.map((r: any) => r.emailAddress?.address).filter(Boolean) || [],
        bcc: msg.bccRecipients?.map((r: any) => r.emailAddress?.address).filter(Boolean) || [],
        subject: msg.subject || 'No Subject',
        date: new Date(msg.receivedDateTime),
        htmlBody: msg.body?.contentType === 'html' ? msg.body.content : undefined,
        textBody: msg.body?.contentType === 'text' ? msg.body.content : msg.bodyPreview,
      }));
    } catch (error) {
      logger.error({ error: error }, 'Error fetching Outlook messages:');
      throw error;
    }
  }

  static async sendOutlookMessage(
    account: any,
    to: string[],
    subject: string,
    htmlBody: string,
    textBody: string,
    cc: string[] = [],
    bcc: string[] = []
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const graphClient = await this.getGraphClient(account);
      
      if (!graphClient) {
        throw new Error('Failed to create Graph client');
      }

      const message = {
        subject,
        body: {
          contentType: 'html',
          content: htmlBody,
        },
        toRecipients: to.map(email => ({
          emailAddress: { address: email }
        })),
        ccRecipients: cc.map(email => ({
          emailAddress: { address: email }
        })),
        bccRecipients: bcc.map(email => ({
          emailAddress: { address: email }
        })),
      };

      const result = await graphClient
        .api('/me/sendMail')
        .post({ message });

      return {
        success: true,
        messageId: 'sent', // Graph API doesn't return message ID for sent messages
      };
    } catch (error) {
      logger.error({ error: error }, 'Error sending Outlook message:');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  static async getOutlookFolders(account: any): Promise<string[]> {
    try {
      const graphClient = await this.getGraphClient(account);
      
      if (!graphClient) {
        throw new Error('Failed to create Graph client');
      }

      const folders = await graphClient
        .api('/me/mailFolders')
        .select('displayName,id')
        .get();

      return folders.value.map((folder: any) => folder.displayName);
    } catch (error) {
      logger.error({ error: error }, 'Error getting Outlook folders:');
      throw error;
    }
  }
}
