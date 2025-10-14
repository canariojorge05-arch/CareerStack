import { Router } from 'express';
import { EmailStorageOptimizer } from '../services/emailStorageOptimizer';
import { EmailSpamFilter } from '../services/emailSpamFilter';
import { EmailExportService } from '../services/emailExportService';
import { EmailSignatureService } from '../services/emailSignatureService';
import { isAuthenticated } from '../localAuth';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// ===== EMAIL SIZE LIMITS & STORAGE =====

/**
 * Get storage statistics for user
 */
router.get('/storage/stats', async (req, res) => {
  try {
    const userId = req.user!.id;
    const stats = await EmailStorageOptimizer.getStorageStats(userId);
    res.json(stats);
  } catch (error) {
    logger.error({ error: error }, 'Error getting storage stats:');
    res.status(500).json({ error: 'Failed to get storage statistics' });
  }
});

/**
 * Validate email size before sending
 */
router.post('/storage/validate', async (req, res) => {
  try {
    const { htmlBody, textBody, attachments } = req.body;
    
    const validation = EmailStorageOptimizer.validateEmailSize(
      htmlBody || '',
      textBody || '',
      attachments
    );
    
    res.json(validation);
  } catch (error) {
    logger.error({ error: error }, 'Error validating email size:');
    res.status(500).json({ error: 'Failed to validate email size' });
  }
});

/**
 * Clean up old emails
 */
router.post('/storage/cleanup', async (req, res) => {
  try {
    const { daysOld = 365 } = req.body;
    const cleanedCount = await EmailStorageOptimizer.cleanupOldEmails(daysOld);
    
    res.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} old emails`
    });
  } catch (error) {
    logger.error({ error: error }, 'Error cleaning up emails:');
    res.status(500).json({ error: 'Failed to cleanup emails' });
  }
});

// ===== SPAM FILTERING =====

/**
 * Analyze email for spam
 */
router.post('/spam/analyze', async (req, res) => {
  try {
    const { subject, htmlBody, textBody, fromEmail, attachments } = req.body;
    
    const analysis = EmailSpamFilter.analyzeEmail(
      subject || '',
      htmlBody || '',
      textBody || '',
      fromEmail || '',
      attachments
    );
    
    res.json(analysis);
  } catch (error) {
    logger.error({ error: error }, 'Error analyzing spam:');
    res.status(500).json({ error: 'Failed to analyze email for spam' });
  }
});

/**
 * Get spam filter statistics
 */
router.get('/spam/stats', async (req, res) => {
  try {
    const stats = EmailSpamFilter.getFilterStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error: error }, 'Error getting spam stats:');
    res.status(500).json({ error: 'Failed to get spam statistics' });
  }
});

/**
 * Update spam filter with user feedback
 */
router.post('/spam/feedback', async (req, res) => {
  try {
    const { emailId, isSpam, feedback } = req.body;
    
    EmailSpamFilter.updateFilter(emailId, isSpam, feedback);
    
    res.json({
      success: true,
      message: 'Spam filter updated with your feedback'
    });
  } catch (error) {
    logger.error({ error: error }, 'Error updating spam filter:');
    res.status(500).json({ error: 'Failed to update spam filter' });
  }
});

// ===== EMAIL EXPORT =====

/**
 * Export emails
 */
router.post('/export', async (req, res) => {
  try {
    const userId = req.user!.id;
    const options = req.body;
    
    // Validate export options
    if (!options.format || !['json', 'csv', 'mbox', 'eml'].includes(options.format)) {
      return res.status(400).json({ error: 'Invalid export format' });
    }
    
    const result = await EmailExportService.exportEmails(userId, options);
    
    if (result.success) {
      res.json({
        success: true,
        exportId: result.exportId,
        fileName: result.fileName,
        totalEmails: result.totalEmails,
        fileSize: result.fileSize,
        downloadUrl: `/api/email-enhancements/export/download/${result.exportId}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error({ error: error }, 'Error exporting emails:');
    res.status(500).json({ error: 'Failed to export emails' });
  }
});

/**
 * Download exported file
 */
router.get('/export/download/:exportId', async (req, res) => {
  try {
    const { exportId } = req.params;
    
    // In a real implementation, this would:
    // 1. Verify the export belongs to the user
    // 2. Check if the file exists
    // 3. Stream the file to the client
    // 4. Set appropriate headers for download
    
    res.status(501).json({ error: 'Download functionality not yet implemented' });
  } catch (error) {
    logger.error({ error: error }, 'Error downloading export:');
    res.status(500).json({ error: 'Failed to download export' });
  }
});

/**
 * Get export history
 */
router.get('/export/history', async (req, res) => {
  try {
    const userId = req.user!.id;
    const history = await EmailExportService.getExportHistory(userId);
    res.json(history);
  } catch (error) {
    logger.error({ error: error }, 'Error getting export history:');
    res.status(500).json({ error: 'Failed to get export history' });
  }
});

/**
 * Clean up old export files
 */
router.post('/export/cleanup', async (req, res) => {
  try {
    const { maxAgeHours = 24 } = req.body;
    const deletedCount = await EmailExportService.cleanupOldExports(maxAgeHours);
    
    res.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} old export files`
    });
  } catch (error) {
    logger.error({ error: error }, 'Error cleaning up exports:');
    res.status(500).json({ error: 'Failed to cleanup export files' });
  }
});

// ===== EMAIL SIGNATURES =====

/**
 * Get signature templates
 */
router.get('/signatures/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const templates = EmailSignatureService.getSignatureTemplates(category as string);
    res.json(templates);
  } catch (error) {
    logger.error({ error: error }, 'Error getting signature templates:');
    res.status(500).json({ error: 'Failed to get signature templates' });
  }
});

/**
 * Generate signature from template
 */
router.post('/signatures/generate', async (req, res) => {
  try {
    const { templateId, variables } = req.body;
    
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }
    
    const result = EmailSignatureService.generateSignatureFromTemplate(templateId, variables || {});
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      htmlContent: result.htmlContent,
      textContent: result.textContent
    });
  } catch (error) {
    logger.error({ error: error }, 'Error generating signature:');
    res.status(500).json({ error: 'Failed to generate signature' });
  }
});

/**
 * Get user's signatures
 */
router.get('/signatures', async (req, res) => {
  try {
    const userId = req.user!.id;
    const signatures = await EmailSignatureService.getUserSignatures(userId);
    res.json(signatures);
  } catch (error) {
    logger.error({ error: error }, 'Error getting signatures:');
    res.status(500).json({ error: 'Failed to get signatures' });
  }
});

/**
 * Create new signature
 */
router.post('/signatures', async (req, res) => {
  try {
    const userId = req.user!.id;
    const signatureData = req.body;
    
    // Validate required fields
    if (!signatureData.name || !signatureData.htmlContent) {
      return res.status(400).json({ error: 'Name and HTML content are required' });
    }
    
    // Validate signature content
    const validation = EmailSignatureService.validateSignature(
      signatureData.htmlContent,
      signatureData.textContent || ''
    );
    
    const result = await EmailSignatureService.createSignature(userId, signatureData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        signatureId: result.signatureId,
        validation
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error({ error: error }, 'Error creating signature:');
    res.status(500).json({ error: 'Failed to create signature' });
  }
});

/**
 * Update signature
 */
router.put('/signatures/:signatureId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { signatureId } = req.params;
    const updates = req.body;
    
    const result = await EmailSignatureService.updateSignature(signatureId, userId, updates);
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error({ error: error }, 'Error updating signature:');
    res.status(500).json({ error: 'Failed to update signature' });
  }
});

/**
 * Delete signature
 */
router.delete('/signatures/:signatureId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { signatureId } = req.params;
    
    const result = await EmailSignatureService.deleteSignature(signatureId, userId);
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error({ error: error }, 'Error deleting signature:');
    res.status(500).json({ error: 'Failed to delete signature' });
  }
});

/**
 * Get default signature
 */
router.get('/signatures/default', async (req, res) => {
  try {
    const userId = req.user!.id;
    const signature = await EmailSignatureService.getDefaultSignature(userId);
    res.json(signature);
  } catch (error) {
    logger.error({ error: error }, 'Error getting default signature:');
    res.status(500).json({ error: 'Failed to get default signature' });
  }
});

/**
 * Auto-detect signature variables from user profile
 */
router.get('/signatures/auto-variables', async (req, res) => {
  try {
    const userId = req.user!.id;
    const variables = await EmailSignatureService.autoDetectVariables(userId);
    res.json(variables);
  } catch (error) {
    logger.error({ error: error }, 'Error auto-detecting variables:');
    res.status(500).json({ error: 'Failed to auto-detect variables' });
  }
});

/**
 * Preview signature
 */
router.post('/signatures/preview', async (req, res) => {
  try {
    const { htmlContent, textContent, variables } = req.body;
    
    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    const preview = EmailSignatureService.previewSignature(
      htmlContent,
      textContent || '',
      variables
    );
    
    res.json(preview);
  } catch (error) {
    logger.error({ error: error }, 'Error previewing signature:');
    res.status(500).json({ error: 'Failed to preview signature' });
  }
});

/**
 * Get signature statistics
 */
router.get('/signatures/stats', async (req, res) => {
  try {
    const userId = req.user!.id;
    const stats = await EmailSignatureService.getSignatureStats(userId);
    res.json(stats);
  } catch (error) {
    logger.error({ error: error }, 'Error getting signature stats:');
    res.status(500).json({ error: 'Failed to get signature statistics' });
  }
});

export default router;
