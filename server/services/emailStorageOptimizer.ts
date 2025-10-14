import { db } from '../db';
import { emailMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class EmailStorageOptimizer {
  private static readonly MAX_EMAIL_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
  private static readonly MAX_TOTAL_ATTACHMENTS_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly COMPRESSION_THRESHOLD = 1024; // 1KB
  private static readonly WARNING_SIZE = 5 * 1024 * 1024; // 5MB warning threshold

  /**
   * Optimize email content before storage
   */
  static async optimizeEmailContent(htmlBody: string, textBody: string): Promise<{
    htmlBody: string;
    textBody: string;
    isCompressed: boolean;
    contentHash: string;
  }> {
    // Generate content hash for deduplication
    const contentHash = createHash('sha256')
      .update(htmlBody + textBody)
      .digest('hex');

    // Check if content exceeds size limit
    const totalSize = Buffer.byteLength(htmlBody + textBody, 'utf8');
    if (totalSize > this.MAX_EMAIL_SIZE) {
      throw new Error(`Email content too large: ${totalSize} bytes`);
    }

    // Compress if content is large enough
    let isCompressed = false;
    let optimizedHtml = htmlBody;
    let optimizedText = textBody;

    if (totalSize > this.COMPRESSION_THRESHOLD) {
      try {
        const compressedHtml = await gzipAsync(Buffer.from(htmlBody, 'utf8'));
        const compressedText = await gzipAsync(Buffer.from(textBody, 'utf8'));
        
        // Only use compression if it actually saves space
        if (compressedHtml.length + compressedText.length < totalSize * 0.8) {
          optimizedHtml = compressedHtml.toString('base64');
          optimizedText = compressedText.toString('base64');
          isCompressed = true;
        }
      } catch (error) {
        logger.warn({ context: error }, 'Email compression failed:');
      }
    }

    return {
      htmlBody: optimizedHtml,
      textBody: optimizedText,
      isCompressed,
      contentHash
    };
  }

  /**
   * Decompress email content for display
   */
  static async decompressEmailContent(
    htmlBody: string, 
    textBody: string, 
    isCompressed: boolean
  ): Promise<{ htmlBody: string; textBody: string }> {
    if (!isCompressed) {
      return { htmlBody, textBody };
    }

    try {
      const decompressedHtml = await gunzipAsync(Buffer.from(htmlBody, 'base64'));
      const decompressedText = await gunzipAsync(Buffer.from(textBody, 'base64'));
      
      return {
        htmlBody: decompressedHtml.toString('utf8'),
        textBody: decompressedText.toString('utf8')
      };
    } catch (error) {
      logger.error({ error: error }, 'Email decompression failed:');
      return { htmlBody, textBody }; // Return as-is if decompression fails
    }
  }

  /**
   * Clean up old email content to save space
   */
  static async cleanupOldEmails(daysOld = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Archive old emails by removing body content but keeping metadata
    const result = await db
      .update(emailMessages)
      .set({
        htmlBody: null,
        textBody: 'Content archived due to age',
        updatedAt: new Date()
      })
      .where(eq(emailMessages.sentAt, cutoffDate))
      .returning({ id: emailMessages.id });

    return result.length;
  }

  /**
   * Validate email size before processing
   */
  static validateEmailSize(
    htmlBody: string,
    textBody: string,
    attachments?: Array<{ content: Buffer | string; filename: string }>
  ): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    totalSize: number;
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Calculate content size
    const htmlSize = Buffer.byteLength(htmlBody || '', 'utf8');
    const textSize = Buffer.byteLength(textBody || '', 'utf8');
    const contentSize = htmlSize + textSize;

    // Calculate attachment sizes
    let totalAttachmentSize = 0;
    let largestAttachment = 0;

    if (attachments) {
      for (const attachment of attachments) {
        const size = Buffer.isBuffer(attachment.content) 
          ? attachment.content.length 
          : Buffer.byteLength(attachment.content, 'utf8');
        
        totalAttachmentSize += size;
        largestAttachment = Math.max(largestAttachment, size);

        // Check individual attachment size
        if (size > this.MAX_ATTACHMENT_SIZE) {
          errors.push(`Attachment "${attachment.filename}" (${this.formatBytes(size)}) exceeds maximum size of ${this.formatBytes(this.MAX_ATTACHMENT_SIZE)}`);
        }
      }

      // Check total attachment size
      if (totalAttachmentSize > this.MAX_TOTAL_ATTACHMENTS_SIZE) {
        errors.push(`Total attachment size (${this.formatBytes(totalAttachmentSize)}) exceeds maximum of ${this.formatBytes(this.MAX_TOTAL_ATTACHMENTS_SIZE)}`);
      }
    }

    const totalSize = contentSize + totalAttachmentSize;

    // Check total email size
    if (totalSize > this.MAX_EMAIL_SIZE) {
      errors.push(`Total email size (${this.formatBytes(totalSize)}) exceeds maximum of ${this.formatBytes(this.MAX_EMAIL_SIZE)}`);
    }

    // Generate warnings for large emails
    if (totalSize > this.WARNING_SIZE && totalSize <= this.MAX_EMAIL_SIZE) {
      warnings.push(`Large email size (${this.formatBytes(totalSize)}). Consider compressing or removing attachments.`);
    }

    // Generate recommendations
    if (contentSize > this.COMPRESSION_THRESHOLD) {
      recommendations.push('Email content will be compressed to save storage space');
    }

    if (attachments && attachments.length > 5) {
      recommendations.push('Consider using cloud storage links for multiple attachments');
    }

    if (htmlSize > textSize * 3) {
      recommendations.push('HTML content is significantly larger than text. Consider optimizing HTML.');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      totalSize,
      recommendations
    };
  }

  /**
   * Format bytes to human readable format
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get storage usage statistics for a user
   */
  static async getStorageStats(userId: string): Promise<{
    totalEmails: number;
    totalSize: number;
    averageEmailSize: number;
    largestEmail: number;
    compressionSavings: number;
    recommendations: string[];
  }> {
    try {
      // This would query the database for actual statistics
      // For now, return mock data structure
      const mockStats = {
        totalEmails: 0,
        totalSize: 0,
        averageEmailSize: 0,
        largestEmail: 0,
        compressionSavings: 0,
        recommendations: [
          'Enable email compression to save storage space',
          'Consider archiving emails older than 1 year',
          'Remove large attachments and use cloud storage links'
        ]
      };

      // In a real implementation, this would:
      // 1. Query total email count for user
      // 2. Sum up all email content sizes
      // 3. Calculate compression savings
      // 4. Generate personalized recommendations

      return mockStats;
    } catch (error) {
      logger.error({ error: error }, 'Error getting storage stats:');
      throw new Error('Failed to get storage statistics');
    }
  }
}
