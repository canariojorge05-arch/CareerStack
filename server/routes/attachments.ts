import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, createReadStream, statSync } from 'fs';
import mime from 'mime-types';
import { isAuthenticated as auth } from '../localAuth';
import { db } from '../db';
import { attachments, emailRateLimits } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

// Configure storage
const uploadsDir = path.join(process.cwd(), 'uploads');

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 25_000_000); // default 25MB
const MAX_FILES_PER_REQUEST = Number(process.env.MAX_FILES_PER_REQUEST || 5);

interface FileUploadResponse {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
}

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  if (!existsSync(uploadsDir)) {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow common file types
  const allowedTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_REQUEST,
  }
});

// Apply auth middleware to all routes
router.use(auth);

// Simple DB-backed rate limiter for attachments
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000);
const RATE_UPLOAD_MAX = Number(process.env.RATE_UPLOAD_MAX || 10);

const attachmentsRateLimiter = async (req: any, res: any, next: any) => {
  try {
    const action = 'upload_attachment';
    const subjectKey = String(req.user?.id || 'anonymous');
    const ip = String(req.ip || 'unknown');
    const now = new Date();

    const rec = await db.query.emailRateLimits.findFirst({
      where: (t, { and, eq }) => and(eq(t.action, action), eq(t.email, subjectKey), eq(t.ip, ip)),
    });

    if (rec?.blockedUntil && rec.blockedUntil > now) {
      const retryAfter = Math.ceil((rec.blockedUntil.getTime() - now.getTime()) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    let count = rec?.count ?? 0;
    let windowStart = rec?.windowStart ?? now;
    if (now.getTime() - windowStart.getTime() > RATE_WINDOW_MS) {
      count = 0;
      windowStart = now;
    }
    count += 1;

    const shouldBlock = count > RATE_UPLOAD_MAX;
    const blockedUntil = shouldBlock ? new Date(windowStart.getTime() + RATE_WINDOW_MS) : null;

    await db
      .insert(emailRateLimits)
      .values({ action, email: subjectKey, ip, count, windowStart, blockedUntil: blockedUntil ?? undefined, updatedAt: now })
      .onConflictDoUpdate({
        target: [emailRateLimits.action, emailRateLimits.email, emailRateLimits.ip],
        set: { count, windowStart, blockedUntil: blockedUntil ?? null, updatedAt: now },
      });

    if (shouldBlock) {
      const retryAfter = Math.ceil((blockedUntil!.getTime() - now.getTime()) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    next();
  } catch (e) {
    return res.status(500).json({ message: 'Rate limit error' });
  }
};

// Upload files
router.post('/upload', attachmentsRateLimiter, upload.array('files', MAX_FILES_PER_REQUEST), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = req.user!.id;
    const { entityType, entityId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files uploaded' 
      });
    }

    const uploadedFiles = [] as Array<{ id: string; fileName: string; fileSize: number; mimeType: string; uploadedAt: Date | null }>;

    for (const file of files) {
      // Store file info in database
      const [attachment] = await db.insert(attachments).values({
        id: uuidv4(),
        fileName: file.originalname,
        filePath: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        entityType: entityType || 'general',
        entityId: entityId || null,
        uploadedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      uploadedFiles.push({
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        uploadedAt: attachment.createdAt
      });
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      files: uploadedFiles
    });

  } catch (error) {
    logger.error({ error: error }, 'File upload error:');
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get file by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user has access to this file
    if (attachment.uploadedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filePath = path.join(uploadsDir, attachment.filePath);

    if (!existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }

    const stat = statSync(filePath);

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    // Stream file to avoid loading the whole thing into memory
    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      logger.error({ error: err }, 'Stream error:');
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream file' });
      }
    });
    stream.pipe(res);

  } catch (error) {
    logger.error({ error: error }, 'File download error:');
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get files by entity
router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user!.id;

    const entityAttachments = await db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        createdAt: attachments.createdAt,
        updatedAt: attachments.updatedAt
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.entityType, entityType),
          eq(attachments.entityId, entityId),
          eq(attachments.uploadedBy, userId)
        )
      );

    res.json({
      success: true,
      attachments: entityAttachments
    });

  } catch (error) {
    logger.error({ error: error }, 'Get entity attachments error:');
    res.status(500).json({
      success: false,
      message: 'Failed to get attachments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user's all files
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { entityType, limit = '50', offset = '0' } = req.query;

    let query = db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        entityType: attachments.entityType,
        entityId: attachments.entityId,
        createdAt: attachments.createdAt,
        updatedAt: attachments.updatedAt
      })
      .from(attachments)
      .where(eq(attachments.uploadedBy, userId));

    const conditions = [eq(attachments.uploadedBy, userId)];
    if (entityType) {
      conditions.push(eq(attachments.entityType, entityType as string));
    }
    
    const userAttachments = await query
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count (use a lighter query)
    const total = userAttachments.length;

    res.json({
      success: true,
      attachments: userAttachments,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

  } catch (error) {
    logger.error({ error: error }, 'Get attachments error:');
    res.status(500).json({
      success: false,
      message: 'Failed to get attachments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete file
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user owns this file
    if (attachment.uploadedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete from database
    await db.delete(attachments).where(eq(attachments.id, id));

    // Delete from filesystem
    const filePath = path.join(uploadsDir, attachment.filePath);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    logger.error({ error: error }, 'File deletion error:');
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get file info (metadata only)
router.get('/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [attachment] = await db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        entityType: attachments.entityType,
        entityId: attachments.entityId,
        createdAt: attachments.createdAt,
        updatedAt: attachments.updatedAt
      })
      .from(attachments)
      .where(eq(attachments.id, id));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user has access to this attachment
    const [userAttachment] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.uploadedBy, userId)));

    if (!userAttachment) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      attachment
    });

  } catch (error) {
    logger.error({ error: error }, 'Get file info error:');
    res.status(500).json({
      success: false,
      message: 'Failed to get file info',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
