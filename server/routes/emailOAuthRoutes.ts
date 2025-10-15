import { Router, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../localAuth';
import { EnhancedGmailOAuthService } from '../services/enhancedGmailOAuthService';
import { OutlookOAuthService } from '../services/outlookOAuthService';
import { MultiAccountEmailService } from '../services/multiAccountEmailService';
import { EmailSyncService } from '../services/emailSyncService';
import { ParallelEmailFetcher } from '../services/parallelEmailFetcher';
import { EmailCacheService } from '../services/emailCacheService';
import { emailAccountRateLimiter } from '../middleware/emailAccountRateLimiter';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

// ========================================
// VALIDATION SCHEMAS
// ========================================

const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
  provider: z.enum(['gmail', 'outlook'], {
    errorMap: () => ({ message: 'Provider must be gmail or outlook' })
  })
});

const sendEmailSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  to: z.array(z.string().email('Invalid recipient email')).min(1, 'At least one recipient required'),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  htmlBody: z.string().min(1, 'Email body is required'),
  textBody: z.string().min(1, 'Text body is required'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // Base64 encoded
    contentType: z.string()
  })).optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional()
});

const syncAccountSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  maxResults: z.number().min(1).max(500).optional(),
  query: z.string().optional(),
  labelIds: z.array(z.string()).optional()
});

const labelActionSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  messageId: z.string().min(1, 'Message ID is required'),
  addLabels: z.array(z.string()).optional(),
  removeLabels: z.array(z.string()).optional()
});

const createLabelSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  labelName: z.string().min(1, 'Label name is required').max(100, 'Label name too long'),
  messageListVisibility: z.enum(['show', 'hide']).optional(),
  labelListVisibility: z.enum(['labelShow', 'labelHide']).optional()
});

const getAttachmentSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  messageId: z.string().min(1, 'Message ID is required'),
  attachmentId: z.string().min(1, 'Attachment ID is required')
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Verify user owns the email account
 */
async function verifyAccountOwnership(accountId: string, userId: string): Promise<
  | { error: string; status: number; account?: never }
  | { account: any; error?: never; status?: never }
> {
  const account = await db.query.emailAccounts.findFirst({
    where: and(
      eq(emailAccounts.id, accountId),
      eq(emailAccounts.userId, userId)
    )
  });

  if (!account) {
    return { error: 'Email account not found or access denied', status: 404 };
  }

  if (!account.isActive) {
    return { error: 'Email account is inactive', status: 403 };
  }

  return { account };
}

/**
 * Format error response
 */
function formatError(error: any): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
}

// ========================================
// OAUTH AUTHORIZATION ROUTES
// ========================================

/**
 * Get Gmail OAuth authorization URL
 * GET /api/email/gmail/auth-url
 */
router.get('/gmail/auth-url', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const authUrl = EnhancedGmailOAuthService.getAuthUrl(userId);
    
    logger.info(`📧 Generated Gmail auth URL for user: ${userId}`);
    
    res.json({
      success: true,
      authUrl,
      provider: 'gmail',
      message: 'Redirect user to this URL to authorize Gmail access'
    });
  } catch (error) {
    logger.error({ error: error }, 'Failed to generate Gmail auth URL:');
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      details: formatError(error)
    });
  }
});

/**
 * Get Outlook OAuth authorization URL
 * GET /api/email/outlook/auth-url
 */
router.get('/outlook/auth-url', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const authUrl = OutlookOAuthService.getAuthUrl(userId);
    
    logger.info(`📧 Generated Outlook auth URL for user: ${userId}`);
    
    res.json({
      success: true,
      authUrl,
      provider: 'outlook',
      message: 'Redirect user to this URL to authorize Outlook access'
    });
  } catch (error) {
    logger.error({ error: error }, 'Failed to generate Outlook auth URL:');
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      details: formatError(error)
    });
  }
});

/**
 * Handle OAuth callback (GET request from OAuth providers)
 * GET /api/email/oauth/callback
 */
router.get('/oauth/callback', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { code, state } = req.query;
    const userId = req.user.id;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state parameter'
      });
    }

    logger.info(`📧 Processing OAuth callback for Gmail - User: ${userId}`);

    // For now, assume Gmail since that's what we're setting up
    const result = await EnhancedGmailOAuthService.handleCallback(code as string, userId);
    
    if (result.success) {
      // Redirect to email page with success message
      res.redirect('/email?connected=true');
    } else {
      // Redirect to email page with error
      res.redirect('/email?error=connection_failed');
    }
  } catch (error) {
    logger.error({ error: error }, 'OAuth callback error:');
    res.redirect('/email?error=callback_failed');
  }
});

/**
 * Handle OAuth callback (POST request - legacy support)
 * POST /api/email/oauth/callback
 */

router.post('/oauth/callback', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { code, state, provider } = oauthCallbackSchema.parse(req.body);
    const userId = req.user.id;

    logger.info(`📧 Processing OAuth callback for ${provider} - User: ${userId}`);

    let result;
    
    if (provider === 'gmail') {
      result = await EnhancedGmailOAuthService.handleCallback(code, userId);
    } else if (provider === 'outlook') {
      result = await OutlookOAuthService.handleCallback(code, userId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported provider'
      });
    }

    if (result.success) {
      logger.info(`✅ ${provider} account connected successfully`);
      
      res.json({
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account connected successfully`,
        account: result.account
      });
    } else {
      logger.error(`❌ ${provider} OAuth failed:`, result.error);
      
      res.status(400).json({
        success: false,
        error: result.error || 'OAuth authentication failed',
        provider
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'OAuth callback error:');
    res.status(500).json({
      success: false,
      error: 'Failed to process OAuth callback',
      details: formatError(error)
    });
  }
});

// ========================================
// ACCOUNT MANAGEMENT ROUTES
// ========================================

/**
 * Get all connected email accounts
 * GET /api/email/accounts
 */
router.get('/accounts', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    
    const accounts = await db.query.emailAccounts.findMany({
      where: eq(emailAccounts.userId, userId)
    });

    // Remove sensitive data
    const sanitizedAccounts = accounts.map(account => ({
      id: account.id,
      accountName: account.accountName,
      emailAddress: account.emailAddress,
      provider: account.provider,
      isDefault: account.isDefault,
      isActive: account.isActive,
      syncEnabled: account.syncEnabled,
      lastSyncAt: account.lastSyncAt,
      createdAt: account.createdAt
    }));

    res.json({
      success: true,
      accounts: sanitizedAccounts,
      count: sanitizedAccounts.length
    });
  } catch (error) {
    logger.error({ error: error }, 'Failed to get email accounts:');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email accounts',
      details: formatError(error)
    });
  }
});

/**
 * Get specific email account
 * GET /api/email/accounts/:accountId
 */
router.get('/accounts/:accountId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    const verification = await verifyAccountOwnership(accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    // Remove sensitive data
    const sanitizedAccount = {
      id: account.id,
      accountName: account.accountName,
      emailAddress: account.emailAddress,
      provider: account.provider,
      isDefault: account.isDefault,
      isActive: account.isActive,
      syncEnabled: account.syncEnabled,
      syncFrequency: account.syncFrequency,
      lastSyncAt: account.lastSyncAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };

    res.json({
      success: true,
      account: sanitizedAccount
    });
  } catch (error) {
    logger.error({ error: error }, 'Failed to get email account:');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email account',
      details: formatError(error)
    });
  }
});

/**
 * Test email account connection
 * POST /api/email/accounts/:accountId/test
 */
router.post('/accounts/:accountId/test', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    const verification = await verifyAccountOwnership(accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    logger.info(`🔍 Testing connection for ${account.provider} account: ${account.emailAddress}`);

    let result;
    
    if (account.provider === 'gmail') {
      result = await EnhancedGmailOAuthService.testGmailConnection(account);
    } else if (account.provider === 'outlook') {
      result = await OutlookOAuthService.testOutlookConnection(account);
    } else {
      result = await MultiAccountEmailService.testAccountConnection(accountId);
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'Email account connection is working',
        provider: account.provider,
        profile: (result as any).profile || undefined
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Connection test failed',
        details: result.error,
        provider: account.provider
      });
    }
  } catch (error) {
    logger.error({ error: error }, 'Connection test failed:');
    res.status(500).json({
      success: false,
      error: 'Failed to test connection',
      details: formatError(error)
    });
  }
});

/**
 * Delete email account
 * DELETE /api/email/accounts/:accountId
 */
router.delete('/accounts/:accountId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    const verification = await verifyAccountOwnership(accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    logger.info(`🗑️  Deleting ${account.provider} account: ${account.emailAddress}`);

    let result;
    
    if (account.provider === 'gmail') {
      result = await EnhancedGmailOAuthService.deleteAccount(accountId, userId);
    } else {
      // For other providers, just delete from database
      await db.delete(emailAccounts)
        .where(and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId)
        ));
      
      result = { success: true };
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'Email account disconnected successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to disconnect account'
      });
    }
  } catch (error) {
    logger.error({ error: error }, 'Failed to delete account:');
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect email account',
      details: formatError(error)
    });
  }
});

/**
 * Update account settings
 * PATCH /api/email/accounts/:accountId
 */
router.patch('/accounts/:accountId', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    const verification = await verifyAccountOwnership(accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const updateSchema = z.object({
      accountName: z.string().min(1).max(255).optional(),
      isDefault: z.boolean().optional(),
      syncEnabled: z.boolean().optional(),
      syncFrequency: z.number().min(60).max(3600).optional() // 1 min to 1 hour
    });

    const updates = updateSchema.parse(req.body);

    await db.update(emailAccounts)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(emailAccounts.id, accountId),
        eq(emailAccounts.userId, userId)
      ));

    logger.info(`✅ Updated account settings: ${accountId}`);

    res.json({
      success: true,
      message: 'Account settings updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'Failed to update account:');
    res.status(500).json({
      success: false,
      error: 'Failed to update account settings',
      details: formatError(error)
    });
  }
});

// ========================================
// EMAIL OPERATIONS ROUTES
// ========================================

/**
 * Send email
 * POST /api/email/send
 */
router.post('/send', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const data = sendEmailSchema.parse(req.body);

    const verification = await verifyAccountOwnership(data.accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    logger.info(`📤 Sending email from ${account.emailAddress} to ${data.to.join(', ')}`);

    // Convert attachments from base64
    const attachments = data.attachments?.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType
    }));

    let result;

    if (account.provider === 'gmail') {
      result = await EnhancedGmailOAuthService.sendGmailMessage(account, {
        ...data,
        attachments
      });
    } else {
      result = await MultiAccountEmailService.sendFromAccount(data.accountId, {
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
        attachments
      });
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'Failed to send email:');
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: formatError(error)
    });
  }
});

/**
 * Sync emails from account
 * POST /api/email/sync
 */
router.post('/sync', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const data = syncAccountSchema.parse(req.body);

    const verification = await verifyAccountOwnership(data.accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    logger.info(`🔄 Starting email sync for account: ${data.accountId}`);

    const result = await EmailSyncService.syncAccountOnDemand(data.accountId, userId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Email sync completed',
        syncedCount: result.syncedCount || 0
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Sync failed'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'Email sync failed:');
    res.status(500).json({
      success: false,
      error: 'Failed to sync emails',
      details: formatError(error)
    });
  }
});

// ========================================
// GMAIL-SPECIFIC ROUTES
// ========================================

/**
 * Get Gmail labels
 * GET /api/email/gmail/:accountId/labels
 */
router.get('/gmail/:accountId/labels', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    const verification = await verifyAccountOwnership(accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    if (account.provider !== 'gmail') {
      return res.status(400).json({
        success: false,
        error: 'This operation is only available for Gmail accounts'
      });
    }

    const labels = await EnhancedGmailOAuthService.getLabels(account);

    res.json({
      success: true,
      labels,
      count: labels.length
    });
  } catch (error) {
    logger.error({ error: error }, 'Failed to get labels:');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve labels',
      details: formatError(error)
    });
  }
});

/**
 * Create Gmail label
 * POST /api/email/gmail/:accountId/labels
 */
router.post('/gmail/:accountId/labels', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    const verification = await verifyAccountOwnership(accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    if (account.provider !== 'gmail') {
      return res.status(400).json({
        success: false,
        error: 'This operation is only available for Gmail accounts'
      });
    }

    const data = createLabelSchema.parse({ accountId, ...req.body });

    const label = await EnhancedGmailOAuthService.createLabel(
      account,
      data.labelName,
      {
        messageListVisibility: data.messageListVisibility,
        labelListVisibility: data.labelListVisibility
      }
    );

    if (label) {
      res.json({
        success: true,
        message: 'Label created successfully',
        label
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create label'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'Failed to create label:');
    res.status(500).json({
      success: false,
      error: 'Failed to create label',
      details: formatError(error)
    });
  }
});

/**
 * Modify message labels
 * POST /api/email/gmail/labels/modify
 */
router.post('/gmail/labels/modify', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const data = labelActionSchema.parse(req.body);

    const verification = await verifyAccountOwnership(data.accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    if (account.provider !== 'gmail') {
      return res.status(400).json({
        success: false,
        error: 'This operation is only available for Gmail accounts'
      });
    }

    const result = await EnhancedGmailOAuthService.modifyMessageLabels(
      account,
      data.messageId,
      data.addLabels || [],
      data.removeLabels || []
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Message labels updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to update labels'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'Failed to modify labels:');
    res.status(500).json({
      success: false,
      error: 'Failed to update message labels',
      details: formatError(error)
    });
  }
});

/**
 * Get attachment
 * GET /api/email/gmail/attachments
 */
router.get('/gmail/attachments', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const data = getAttachmentSchema.parse(req.query);

    const verification = await verifyAccountOwnership(data.accountId, userId);
    
    if (verification.error) {
      return res.status(verification.status).json({
        success: false,
        error: verification.error
      });
    }

    const { account } = verification;

    if (account.provider !== 'gmail') {
      return res.status(400).json({
        success: false,
        error: 'This operation is only available for Gmail accounts'
      });
    }

    const attachment = await EnhancedGmailOAuthService.getAttachment(
      account,
      data.messageId,
      data.attachmentId
    );

    if (attachment) {
      // Send as downloadable file
      res.setHeader('Content-Type', 'application/octet-stream');
      if (attachment.fileName) {
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
      }
      res.send(attachment.data);
    } else {
      res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    logger.error({ error: error }, 'Failed to get attachment:');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve attachment',
      details: formatError(error)
    });
  }
});

/**
 * Quick actions for Gmail messages
 */
router.post('/gmail/:accountId/messages/:messageId/archive', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId, messageId } = req.params;
    const userId = req.user.id;
    const verification = await verifyAccountOwnership(accountId, userId);
    if (verification.error) return res.status(verification.status).json({ success: false, error: verification.error });
    
    const result = await EnhancedGmailOAuthService.archiveMessage(verification.account, messageId);
    res.json(result.success ? { success: true, message: 'Message archived' } : { success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: formatError(error) });
  }
});

router.post('/gmail/:accountId/messages/:messageId/read', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId, messageId } = req.params;
    const userId = req.user.id;
    const verification = await verifyAccountOwnership(accountId, userId);
    if (verification.error) return res.status(verification.status).json({ success: false, error: verification.error });
    
    const result = await EnhancedGmailOAuthService.markAsRead(verification.account, messageId);
    res.json(result.success ? { success: true, message: 'Marked as read' } : { success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: formatError(error) });
  }
});

router.post('/gmail/:accountId/messages/:messageId/unread', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId, messageId } = req.params;
    const userId = req.user.id;
    const verification = await verifyAccountOwnership(accountId, userId);
    if (verification.error) return res.status(verification.status).json({ success: false, error: verification.error });
    
    const result = await EnhancedGmailOAuthService.markAsUnread(verification.account, messageId);
    res.json(result.success ? { success: true, message: 'Marked as unread' } : { success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: formatError(error) });
  }
});

router.post('/gmail/:accountId/messages/:messageId/star', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId, messageId } = req.params;
    const userId = req.user.id;
    const verification = await verifyAccountOwnership(accountId, userId);
    if (verification.error) return res.status(verification.status).json({ success: false, error: verification.error });
    
    const result = await EnhancedGmailOAuthService.starMessage(verification.account, messageId);
    res.json(result.success ? { success: true, message: 'Message starred' } : { success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: formatError(error) });
  }
});

router.post('/gmail/:accountId/messages/:messageId/trash', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { accountId, messageId } = req.params;
    const userId = req.user.id;
    const verification = await verifyAccountOwnership(accountId, userId);
    if (verification.error) return res.status(verification.status).json({ success: false, error: verification.error });

    const result = await EnhancedGmailOAuthService.trashMessage(verification.account, messageId);
    res.json(result.success ? { success: true, message: 'Message moved to trash' } : { success: false, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: formatError(error) });
  }
});

// ========================================
// MULTI-ACCOUNT ROUTES
// ========================================

router.post('/sync-all', isAuthenticated, emailAccountRateLimiter.middleware(), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { accountIds, maxResults } = req.body;

    logger.info(`🔄 Starting parallel sync for user ${userId}`);

    const results = await ParallelEmailFetcher.fetchMultipleAccounts(
      userId,
      accountIds,
      { maxResults: maxResults || 50 }
    );

    const successCount = results.filter(r => r.success).length;
    const totalMessages = results.reduce((sum, r) => sum + r.messageCount, 0);

    res.json({
      success: true,
      message: `Synced ${successCount} accounts, ${totalMessages} new messages`,
      results,
      totalAccounts: results.length,
      successfulAccounts: successCount,
      totalMessages
    });
  } catch (error) {
    logger.error('Parallel sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync accounts',
      details: formatError(error)
    });
  }
});

router.get('/unified-inbox', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { limit, offset, accountIds } = req.query;

    // Try cache first for initial load (offset = 0)
    const cacheKey = `inbox-${offset || 0}`;
    if (!offset || offset === '0') {
      const cached = await EmailCacheService.getThreadList(userId, cacheKey);
      if (cached) {
        logger.debug(`📊 Cache hit for unified inbox ${userId}`);
        const { EmailPerformanceMonitor } = await import('../services/emailPerformanceMonitor');
        EmailPerformanceMonitor.recordCacheHit(true);
        
        return res.json({
          success: true,
          threads: cached,
          total: cached.length,
          fromCache: true
        });
      }
      
      const { EmailPerformanceMonitor } = await import('../services/emailPerformanceMonitor');
      EmailPerformanceMonitor.recordCacheHit(false);
    }

    const result = await ParallelEmailFetcher.getUnifiedInbox(userId, {
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      accountIds: accountIds ? (accountIds as string).split(',') : undefined
    });

    // Cache the result for fast subsequent loads
    if (!offset || offset === '0') {
      await EmailCacheService.cacheThreadList(userId, cacheKey, result.threads || [], { ttl: 30 });
    }

    res.json({
      success: true,
      ...result,
      fromCache: false
    });
  } catch (error) {
    logger.error('Failed to get unified inbox:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve unified inbox',
      details: formatError(error)
    });
  }
});

// Performance monitoring endpoint
router.get('/performance/stats', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { EmailPerformanceMonitor } = await import('../services/emailPerformanceMonitor');
    const stats = await EmailPerformanceMonitor.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance statistics'
    });
  }
});

// ========================================
// EMAIL SEARCH ROUTES
// ========================================

/**
 * Search emails with Gmail-style operators
 * GET /api/email/search
 * 
 * Query parameters:
 *   - q: Search query (supports Gmail operators)
 *   - limit: Max results (default: 50, max: 100)
 *   - offset: Pagination offset (default: 0)
 *   - accountId: Filter by specific account
 * 
 * Example queries:
 *   - "from:john@example.com subject:meeting"
 *   - "has:attachment is:unread after:2024-01-01"
 *   - "newer_than:7d -from:spam"
 *   - "larger:10M filename:report.pdf"
 */
router.get('/search', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { q, limit, offset, accountId } = req.query;

    const { EmailSearchService } = await import('../services/emailSearchService');
    
    const result = await EmailSearchService.searchEmails(userId, {
      query: q as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      accountIds: accountId ? [accountId as string] : undefined
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Email search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      details: formatError(error)
    });
  }
});

/**
 * Get search operator help/documentation
 * GET /api/email/search/operators
 */
router.get('/search/operators', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { EmailSearchService } = await import('../services/emailSearchService');
    const operators = EmailSearchService.getSearchOperatorHelp();
    
    res.json({
      success: true,
      operators
    });
  } catch (error) {
    logger.error('Failed to get search operators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve search operators'
    });
  }
});

/**
 * Get search analytics
 * GET /api/email/search/analytics
 */
router.get('/search/analytics', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { EmailSearchService } = await import('../services/emailSearchService');
    const analytics = await EmailSearchService.getSearchAnalytics(userId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Failed to get search analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve search analytics'
    });
  }
});

export default router;
