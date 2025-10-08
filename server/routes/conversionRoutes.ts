import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { conversionService } from '../services/conversion-service';
import { conversionCache, enhancedRedisService } from '../services/enhanced-redis-service';
import { isAuthenticated } from '../localAuth';
import { logger } from '../utils/logger';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import { Readable } from 'stream';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files for batch upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/html',
      'application/octet-stream'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only DOCX files are allowed.'));
    }
  }
});

// Validation schemas
const convertHtmlToDocxSchema = z.object({
  html: z.string().min(1, 'HTML content is required'),
  template: z.string().optional().default('default'),
  filename: z.string().optional().default('resume.docx')
});

const batchConvertSchema = z.object({
  preserveStyles: z.boolean().optional().default(true),
  template: z.string().optional().default('default')
});

// Progress tracking for long-running operations
const progressTracker = new Map<string, { progress: number; status: string; result?: any }>();

/**
 * Convert DOCX to HTML
 */
router.post('/docx-to-html', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { preserveStyles = true } = req.body;
    const options = { preserveStyles, filename: req.file.originalname };
    
    // Check cache first
    const cachedHtml = await conversionCache.getCachedHtml(req.file.buffer, options);
    if (cachedHtml) {
      logger.info(`Cache hit for DOCX to HTML conversion: ${req.file.originalname}`);
      return res.json({
        success: true,
        html: cachedHtml,
        cached: true,
        filename: req.file.originalname
      });
    }

    // Convert using service
    const result = await conversionService.convertDocxToHtml(req.file.buffer, options);
    
    if (result.success && result.data) {
      // Cache the result
      await conversionCache.cacheDocxToHtml(req.file.buffer, result.data as string, options);
      
      res.json({
        success: true,
        html: result.data,
        hash: result.hash,
        metadata: result.metadata,
        filename: req.file.originalname
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Conversion failed'
      });
    }

  } catch (error) {
    logger.error('DOCX to HTML conversion error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Convert HTML to DOCX
 */
router.post('/html-to-docx', isAuthenticated, async (req, res) => {
  try {
    const validation = convertHtmlToDocxSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { html, template, filename } = validation.data;
    const options = { template, filename };

    // Check cache first
    const cachedDocx = await conversionCache.getCachedDocx(html, options);
    if (cachedDocx) {
      logger.info(`Cache hit for HTML to DOCX conversion`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(cachedDocx);
    }

    // Convert using service
    const result = await conversionService.convertHtmlToDocx(html, options);
    
    if (result.success && result.data) {
      // Cache the result
      await conversionCache.cacheHtmlToDocx(html, result.data as Buffer, options);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Conversion failed'
      });
    }

  } catch (error) {
    logger.error('HTML to DOCX conversion error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Batch convert multiple DOCX files
 */
router.post('/batch-convert', isAuthenticated, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const validation = batchConvertSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { preserveStyles, template } = validation.data;
    const jobId = createHash('sha256').update(`batch_${Date.now()}_${Math.random()}`).digest('hex');

    // Initialize progress tracking
    progressTracker.set(jobId, { progress: 0, status: 'starting' });

    // Process files in background
    setImmediate(async () => {
      try {
        const files = (req.files as Express.Multer.File[]).map(file => ({
          buffer: file.buffer,
          filename: file.originalname
        }));

        progressTracker.set(jobId, { progress: 10, status: 'processing' });

        const results = await conversionService.batchConvert(files, { preserveStyles });
        
        progressTracker.set(jobId, { 
          progress: 100, 
          status: 'completed',
          result: results
        });

        // Clean up progress after 1 hour
        setTimeout(() => progressTracker.delete(jobId), 3600000);

      } catch (error) {
        progressTracker.set(jobId, { 
          progress: 0, 
          status: 'failed',
          result: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });

    res.json({
      success: true,
      jobId,
      message: 'Batch conversion started',
      statusUrl: `/api/conversion/batch-status/${jobId}`
    });

  } catch (error) {
    logger.error('Batch conversion error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get batch conversion status
 */
router.get('/batch-status/:jobId', isAuthenticated, async (req, res) => {
  try {
    const { jobId } = req.params;
    const progress = progressTracker.get(jobId);

    if (!progress) {
      return res.status(404).json({
        error: 'Job not found or expired'
      });
    }

    res.json({
      success: true,
      jobId,
      progress: progress.progress,
      status: progress.status,
      result: progress.result
    });

  } catch (error) {
    logger.error('Batch status check error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Export multiple resumes as ZIP
 */
router.post('/export-zip', isAuthenticated, async (req, res) => {
  try {
    const { resumes } = req.body;
    
    if (!Array.isArray(resumes) || resumes.length === 0) {
      return res.status(400).json({ error: 'No resumes provided' });
    }

    const zip = new JSZip();
    const jobId = createHash('sha256').update(`export_${Date.now()}_${Math.random()}`).digest('hex');

    // Initialize progress
    progressTracker.set(jobId, { progress: 0, status: 'starting' });

    // Process exports in background
    setImmediate(async () => {
      try {
        for (let i = 0; i < resumes.length; i++) {
          const resume = resumes[i];
          const progress = Math.round(((i + 1) / resumes.length) * 90); // Reserve 10% for ZIP creation
          
          progressTracker.set(jobId, { 
            progress, 
            status: `Processing ${resume.filename || `resume_${i + 1}`}` 
          });

          // Convert HTML to DOCX
          const result = await conversionService.convertHtmlToDocx(resume.html, {
            template: resume.template || 'default',
            filename: resume.filename || `resume_${i + 1}.docx`
          });

          if (result.success && result.data) {
            zip.file(resume.filename || `resume_${i + 1}.docx`, result.data as Buffer);
          }
        }

        progressTracker.set(jobId, { progress: 95, status: 'Creating ZIP archive' });

        // Generate ZIP
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        
        progressTracker.set(jobId, { 
          progress: 100, 
          status: 'completed',
          result: { zipBuffer: zipBuffer.toString('base64') }
        });

        // Clean up after 1 hour
        setTimeout(() => progressTracker.delete(jobId), 3600000);

      } catch (error) {
        progressTracker.set(jobId, { 
          progress: 0, 
          status: 'failed',
          result: { error: error instanceof Error ? error.message : 'Export failed' }
        });
      }
    });

    res.json({
      success: true,
      jobId,
      message: 'Export started',
      statusUrl: `/api/conversion/export-status/${jobId}`
    });

  } catch (error) {
    logger.error('ZIP export error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get export status and download ZIP
 */
router.get('/export-status/:jobId', isAuthenticated, async (req, res) => {
  try {
    const { jobId } = req.params;
    const progress = progressTracker.get(jobId);

    if (!progress) {
      return res.status(404).json({
        error: 'Export job not found or expired'
      });
    }

    if (progress.status === 'completed' && progress.result?.zipBuffer) {
      // Return ZIP file
      const zipBuffer = Buffer.from(progress.result.zipBuffer, 'base64');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="resumes.zip"');
      return res.send(zipBuffer);
    }

    res.json({
      success: true,
      jobId,
      progress: progress.progress,
      status: progress.status,
      downloadReady: progress.status === 'completed'
    });

  } catch (error) {
    logger.error('Export status check error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get conversion service status
 */
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const queueStatus = await conversionService.getQueueStatus();
    const cacheStats = await enhancedRedisService.getStats();
    
    res.json({
      success: true,
      service: 'conversion',
      queue: queueStatus,
      cache: cacheStats,
      activeJobs: progressTracker.size
    });

  } catch (error) {
    logger.error('Status check error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Clear conversion cache
 */
router.delete('/cache', isAuthenticated, async (req, res) => {
  try {
    const cleared = await conversionCache.clearConversionCache();
    
    res.json({
      success: true,
      message: `Cleared ${cleared} cached items`
    });

  } catch (error) {
    logger.error('Cache clear error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;
