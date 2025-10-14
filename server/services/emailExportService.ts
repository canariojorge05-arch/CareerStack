import { db } from '../db';
import { emailMessages, emailThreads, emailAccounts, emailAttachments } from '@shared/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

export interface ExportOptions {
  format: 'json' | 'csv' | 'mbox' | 'eml';
  dateFrom?: Date;
  dateTo?: Date;
  accountIds?: string[];
  includeAttachments?: boolean;
  includeDeleted?: boolean;
  maxEmails?: number;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  totalEmails: number;
  fileSize: number;
  exportId: string;
  error?: string;
}

export class EmailExportService {
  private static readonly EXPORT_DIR = join(process.cwd(), 'exports', 'emails');
  private static readonly MAX_EXPORT_SIZE = 500 * 1024 * 1024; // 500MB
  private static readonly MAX_EMAILS_PER_EXPORT = 10000;

  /**
   * Export user's emails in specified format
   */
  static async exportEmails(
    userId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Generate unique export ID
      const exportId = this.generateExportId(userId);
      
      // Validate options
      const validationResult = this.validateExportOptions(options);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.error,
          totalEmails: 0,
          fileSize: 0,
          exportId
        };
      }

      // Ensure export directory exists
      await this.ensureExportDirectory();

      // Fetch emails based on options
      const emails = await this.fetchEmailsForExport(userId, options);
      
      if (emails.length === 0) {
        return {
          success: false,
          error: 'No emails found matching the specified criteria',
          totalEmails: 0,
          fileSize: 0,
          exportId
        };
      }

      // Generate export file
      const exportResult = await this.generateExportFile(emails, options, exportId);

      return {
        success: true,
        filePath: exportResult.filePath,
        fileName: exportResult.fileName,
        totalEmails: emails.length,
        fileSize: exportResult.fileSize,
        exportId
      };

    } catch (error) {
      logger.error({ error: error }, 'Email export error:');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
        totalEmails: 0,
        fileSize: 0,
        exportId: this.generateExportId(userId)
      };
    }
  }

  /**
   * Fetch emails for export based on criteria
   */
  private static async fetchEmailsForExport(
    userId: string,
    options: ExportOptions
  ): Promise<any[]> {
    const conditions = [eq(emailMessages.createdBy, userId)];

    // Date range filter
    if (options.dateFrom) {
      conditions.push(gte(emailMessages.sentAt, options.dateFrom));
    }
    if (options.dateTo) {
      conditions.push(lte(emailMessages.sentAt, options.dateTo));
    }

    // Account filter
    if (options.accountIds && options.accountIds.length > 0) {
      conditions.push(inArray(emailMessages.emailAccountId, options.accountIds));
    }

    // Limit emails
    const limit = Math.min(options.maxEmails || this.MAX_EMAILS_PER_EXPORT, this.MAX_EMAILS_PER_EXPORT);

    // Fetch emails with related data
    const emails = await db
      .select({
        // Email data
        id: emailMessages.id,
        threadId: emailMessages.threadId,
        subject: emailMessages.subject,
        fromEmail: emailMessages.fromEmail,
        toEmails: emailMessages.toEmails,
        ccEmails: emailMessages.ccEmails,
        bccEmails: emailMessages.bccEmails,
        htmlBody: emailMessages.htmlBody,
        textBody: emailMessages.textBody,
        messageType: emailMessages.messageType,
        isRead: emailMessages.isRead,
        isStarred: emailMessages.isStarred,
        sentAt: emailMessages.sentAt,
        createdAt: emailMessages.createdAt,
        
        // Account data
        accountName: emailAccounts.accountName,
        accountEmail: emailAccounts.emailAddress,
        
        // Thread data
        threadSubject: emailThreads.subject,
        participantEmails: emailThreads.participantEmails
      })
      .from(emailMessages)
      .leftJoin(emailAccounts, eq(emailMessages.emailAccountId, emailAccounts.id))
      .leftJoin(emailThreads, eq(emailMessages.threadId, emailThreads.id))
      .where(and(...conditions))
      .limit(limit)
      .orderBy(emailMessages.sentAt);

    // Fetch attachments if requested
    if (options.includeAttachments) {
      for (const email of emails) {
        const attachments = await db
          .select()
          .from(emailAttachments)
          .where(eq(emailAttachments.messageId, email.id));
        
        (email as any).attachments = attachments;
      }
    }

    return emails;
  }

  /**
   * Generate export file in specified format
   */
  private static async generateExportFile(
    emails: any[],
    options: ExportOptions,
    exportId: string
  ): Promise<{ filePath: string; fileName: string; fileSize: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `email-export-${exportId}-${timestamp}.${options.format}`;
    const filePath = join(this.EXPORT_DIR, fileName);

    let fileSize = 0;

    switch (options.format) {
      case 'json':
        fileSize = await this.exportToJSON(emails, filePath);
        break;
      case 'csv':
        fileSize = await this.exportToCSV(emails, filePath);
        break;
      case 'mbox':
        fileSize = await this.exportToMBOX(emails, filePath);
        break;
      case 'eml':
        fileSize = await this.exportToEML(emails, filePath);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    return { filePath, fileName, fileSize };
  }

  /**
   * Export to JSON format
   */
  private static async exportToJSON(emails: any[], filePath: string): Promise<number> {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalEmails: emails.length,
        format: 'json'
      },
      emails: emails.map(email => ({
        ...email,
        // Convert dates to ISO strings for JSON
        sentAt: email.sentAt?.toISOString(),
        createdAt: email.createdAt?.toISOString()
      }))
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf8');
    
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Export to CSV format
   */
  private static async exportToCSV(emails: any[], filePath: string): Promise<number> {
    const headers = [
      'ID', 'Subject', 'From', 'To', 'CC', 'BCC', 'Type', 'Read', 'Starred',
      'Sent Date', 'Account', 'Thread ID', 'Has Attachments'
    ];

    const csvRows = [headers.join(',')];

    emails.forEach(email => {
      const row = [
        this.escapeCsvField(email.id),
        this.escapeCsvField(email.subject),
        this.escapeCsvField(email.fromEmail),
        this.escapeCsvField(email.toEmails?.join('; ') || ''),
        this.escapeCsvField(email.ccEmails?.join('; ') || ''),
        this.escapeCsvField(email.bccEmails?.join('; ') || ''),
        this.escapeCsvField(email.messageType),
        email.isRead ? 'Yes' : 'No',
        email.isStarred ? 'Yes' : 'No',
        email.sentAt?.toISOString() || '',
        this.escapeCsvField(email.accountName || ''),
        this.escapeCsvField(email.threadId),
        email.attachments && email.attachments.length > 0 ? 'Yes' : 'No'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    await fs.writeFile(filePath, csvContent, 'utf8');
    
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Export to MBOX format (standard email archive format)
   */
  private static async exportToMBOX(emails: any[], filePath: string): Promise<number> {
    const writeStream = createWriteStream(filePath);
    
    for (const email of emails) {
      // MBOX format starts each message with "From " line
      const fromLine = `From ${email.fromEmail} ${email.sentAt?.toUTCString() || new Date().toUTCString()}\n`;
      writeStream.write(fromLine);
      
      // Email headers
      writeStream.write(`Message-ID: <${email.id}@resume-customizer.local>\n`);
      writeStream.write(`Date: ${email.sentAt?.toUTCString() || new Date().toUTCString()}\n`);
      writeStream.write(`From: ${email.fromEmail}\n`);
      writeStream.write(`To: ${email.toEmails?.join(', ') || ''}\n`);
      
      if (email.ccEmails && email.ccEmails.length > 0) {
        writeStream.write(`Cc: ${email.ccEmails.join(', ')}\n`);
      }
      
      writeStream.write(`Subject: ${email.subject || '(No Subject)'}\n`);
      writeStream.write(`Content-Type: text/html; charset=utf-8\n`);
      writeStream.write('\n'); // Empty line separates headers from body
      
      // Email body
      const body = email.htmlBody || email.textBody || '';
      writeStream.write(body);
      writeStream.write('\n\n'); // Two newlines separate messages
    }
    
    writeStream.end();
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', async () => {
        try {
          const stats = await fs.stat(filePath);
          resolve(stats.size);
        } catch (error) {
          reject(error);
        }
      });
      writeStream.on('error', reject);
    });
  }

  /**
   * Export to EML format (individual email files in a zip)
   */
  private static async exportToEML(emails: any[], filePath: string): Promise<number> {
    // For EML export, we'd typically create individual .eml files and zip them
    // For now, we'll create a single file with all emails in EML format
    const writeStream = createWriteStream(filePath);
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      // EML format headers
      writeStream.write(`Message-ID: <${email.id}@resume-customizer.local>\n`);
      writeStream.write(`Date: ${email.sentAt?.toUTCString() || new Date().toUTCString()}\n`);
      writeStream.write(`From: ${email.fromEmail}\n`);
      writeStream.write(`To: ${email.toEmails?.join(', ') || ''}\n`);
      writeStream.write(`Subject: ${email.subject || '(No Subject)'}\n`);
      writeStream.write(`MIME-Version: 1.0\n`);
      writeStream.write(`Content-Type: text/html; charset=utf-8\n`);
      writeStream.write('\n');
      
      // Email body
      const body = email.htmlBody || email.textBody || '';
      writeStream.write(body);
      
      if (i < emails.length - 1) {
        writeStream.write('\n\n---EMAIL-SEPARATOR---\n\n');
      }
    }
    
    writeStream.end();
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', async () => {
        try {
          const stats = await fs.stat(filePath);
          resolve(stats.size);
        } catch (error) {
          reject(error);
        }
      });
      writeStream.on('error', reject);
    });
  }

  /**
   * Validate export options
   */
  private static validateExportOptions(options: ExportOptions): { isValid: boolean; error?: string } {
    if (!['json', 'csv', 'mbox', 'eml'].includes(options.format)) {
      return { isValid: false, error: 'Invalid export format' };
    }

    if (options.maxEmails && options.maxEmails > this.MAX_EMAILS_PER_EXPORT) {
      return { isValid: false, error: `Maximum ${this.MAX_EMAILS_PER_EXPORT} emails per export` };
    }

    if (options.dateFrom && options.dateTo && options.dateFrom > options.dateTo) {
      return { isValid: false, error: 'Start date must be before end date' };
    }

    return { isValid: true };
  }

  /**
   * Generate unique export ID
   */
  private static generateExportId(userId: string): string {
    const timestamp = Date.now().toString();
    const hash = createHash('md5').update(userId + timestamp).digest('hex');
    return hash.substring(0, 8);
  }

  /**
   * Ensure export directory exists
   */
  private static async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.EXPORT_DIR);
    } catch {
      await fs.mkdir(this.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Escape CSV field content
   */
  private static escapeCsvField(field: string): string {
    if (!field) return '';
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }

  /**
   * Get export history for user
   */
  static async getExportHistory(userId: string): Promise<Array<{
    exportId: string;
    format: string;
    totalEmails: number;
    fileSize: number;
    createdAt: Date;
    status: 'completed' | 'failed' | 'expired';
  }>> {
    // This would query a database table for export history
    // For now, return mock data
    return [
      {
        exportId: 'abc12345',
        format: 'json',
        totalEmails: 150,
        fileSize: 2048576,
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        status: 'completed'
      }
    ];
  }

  /**
   * Clean up old export files
   */
  static async cleanupOldExports(maxAgeHours = 24): Promise<number> {
    try {
      const files = await fs.readdir(this.EXPORT_DIR);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = join(this.EXPORT_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error({ error: error }, 'Error cleaning up export files:');
      return 0;
    }
  }
}
