import { Readable, Transform, pipeline } from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { enhancedRedisService } from './enhanced-redis-service';
import zlib from 'zlib';

const pipelineAsync = promisify(pipeline);

interface StreamProcessingOptions {
  chunkSize?: number;
  maxSize?: number;
  validateHash?: boolean;
  compress?: boolean;
  cacheResult?: boolean;
  cacheTTL?: number;
}

interface FileMetadata {
  filename: string;
  size: number;
  mimeType: string;
  hash: string;
  compressed: boolean;
  uploadedAt: Date;
  userId?: string;
}

class StreamFileService {
  private readonly tempDir: string;
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly defaultChunkSize = 64 * 1024; // 64KB

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.promises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Process file stream with validation and optional compression
   */
  async processFileStream(
    inputStream: Readable,
    filename: string,
    options: StreamProcessingOptions = {}
  ): Promise<{ buffer: Buffer; metadata: FileMetadata }> {
    const {
      chunkSize = this.defaultChunkSize,
      maxSize = this.maxFileSize,
      validateHash = true,
      compress = false,
      cacheResult = true,
      cacheTTL = 3600
    } = options;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const hash = createHash('sha256');
      let isCompressed = false;

      const processStream = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          totalSize += chunk.length;

          // Check size limit
          if (totalSize > maxSize) {
            return callback(new Error(`File size exceeds limit of ${maxSize} bytes`));
          }

          // Update hash
          if (validateHash) {
            hash.update(chunk);
          }

          chunks.push(chunk);
          callback(null, chunk);
        }
      });

      let finalStream: NodeJS.ReadWriteStream = processStream;

      // Add compression if requested
      if (compress) {
        const gzipStream = zlib.createGzip();
        finalStream = processStream.pipe(gzipStream);
        isCompressed = true;
      }

      inputStream.on('error', reject);
      processStream.on('error', reject);

      finalStream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const fileHash = validateHash ? hash.digest('hex') : '';

          const metadata: FileMetadata = {
            filename,
            size: totalSize,
            mimeType: this.getMimeType(filename),
            hash: fileHash,
            compressed: isCompressed,
            uploadedAt: new Date()
          };

          // Cache result if requested
          if (cacheResult && fileHash) {
            try {
              await enhancedRedisService.set(
                `file:${fileHash}`,
                { buffer: buffer.toString('base64'), metadata },
                { ttl: cacheTTL, namespace: 'files', compress: true }
              );
            } catch (error) {
              logger.warn('Failed to cache file: ' + (error instanceof Error ? error.message : String(error)));
            }
          }

          resolve({ buffer, metadata });
        } catch (error) {
          reject(error);
        }
      });

      // Start processing
      inputStream.pipe(processStream);
    });
  }

  /**
   * Stream file to response with range support
   */
  async streamFileToResponse(
    filePath: string,
    response: any,
    options: { 
      range?: string;
      contentType?: string;
      filename?: string;
      inline?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      const { range, contentType, filename, inline = false } = options;

      let start = 0;
      let end = stats.size - 1;
      let statusCode = 200;

      // Handle range requests
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        statusCode = 206;

        response.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        response.setHeader('Accept-Ranges', 'bytes');
      }

      const contentLength = end - start + 1;

      // Set headers
      response.setHeader('Content-Length', contentLength);
      if (contentType) {
        response.setHeader('Content-Type', contentType);
      }
      if (filename) {
        const disposition = inline ? 'inline' : 'attachment';
        response.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      }

      response.status(statusCode);

      // Create read stream
      const readStream = fs.createReadStream(filePath, { start, end });
      
      readStream.on('error', (error: Error) => {
        logger.error('Stream read error: ' + error.message);
        if (!response.headersSent) {
          response.status(500).json({ error: 'File read error' });
        }
      });

      // Pipe to response
      readStream.pipe(response);

    } catch (error) {
      logger.error('Stream file error: ' + (error instanceof Error ? error.message : String(error)));
      if (!response.headersSent) {
        response.status(404).json({ error: 'File not found' });
      }
    }
  }

  /**
   * Process DOCX file stream for conversion
   */
  async processDocxStream(
    inputStream: Readable,
    filename: string,
    userId?: string
  ): Promise<{ buffer: Buffer; metadata: FileMetadata; cached: boolean }> {
    // Check cache first
    const tempBuffer = await this.streamToBuffer(inputStream);
    const hash = createHash('sha256').update(tempBuffer).digest('hex');
    
    try {
      const cached = await enhancedRedisService.get(`docx:${hash}`, 'files');
      if (cached) {
        return {
          buffer: Buffer.from(cached.buffer, 'base64'),
          metadata: cached.metadata,
          cached: true
        };
      }
    } catch (error) {
      logger.warn('Cache check failed: ' + (error instanceof Error ? error.message : String(error)));
    }

    // Process new file
    const bufferStream = Readable.from(tempBuffer);
    const result = await this.processFileStream(bufferStream, filename, {
      maxSize: 50 * 1024 * 1024, // 50MB for DOCX
      validateHash: true,
      compress: false,
      cacheResult: true,
      cacheTTL: 86400 // 24 hours
    });

    result.metadata.userId = userId;

    return { ...result, cached: false };
  }

  /**
   * Create streaming ZIP archive
   */
  async createStreamingZip(
    files: Array<{ name: string; content: Buffer | string }>,
    outputStream: NodeJS.WritableStream
  ): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Add files to ZIP
    for (const file of files) {
      zip.file(file.name, file.content);
    }

    // Generate ZIP as stream
    const zipStream = zip.generateNodeStream({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      streamFiles: true
    });

    return pipelineAsync(zipStream, outputStream);
  }

  /**
   * Batch process multiple files with progress tracking
   */
  async batchProcessFiles(
    files: Array<{ stream: Readable; filename: string }>,
    onProgress?: (processed: number, total: number, currentFile: string) => void
  ): Promise<Array<{ buffer: Buffer; metadata: FileMetadata; error?: string }>> {
    const results: Array<{ buffer: Buffer; metadata: FileMetadata; error?: string }> = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        onProgress?.(i, files.length, file.filename);
        
        const result = await this.processFileStream(file.stream, file.filename, {
          validateHash: true,
          compress: true,
          cacheResult: true
        });
        
        results.push(result);
        
      } catch (error) {
        logger.error(`Failed to process file ${file.filename}: ` + (error instanceof Error ? error.message : String(error)));
        results.push({
          buffer: Buffer.alloc(0),
          metadata: {
            filename: file.filename,
            size: 0,
            mimeType: '',
            hash: '',
            compressed: false,
            uploadedAt: new Date()
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    onProgress?.(files.length, files.length, 'Complete');
    return results;
  }

  /**
   * Stream large file upload with chunked processing
   */
  async handleChunkedUpload(
    chunks: Array<{ data: Buffer; index: number; total: number }>,
    filename: string,
    uploadId: string
  ): Promise<{ buffer: Buffer; metadata: FileMetadata } | null> {
    const tempFile = path.join(this.tempDir, `${uploadId}_${filename}`);
    
    try {
      // Sort chunks by index
      chunks.sort((a, b) => a.index - b.index);
      
      // Write chunks to temp file
      const writeStream = fs.createWriteStream(tempFile);
      
      for (const chunk of chunks) {
        await new Promise<void>((resolve, reject) => {
          writeStream.write(chunk.data, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
      
      await new Promise<void>((resolve, reject) => {
        writeStream.end((error: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      // Process the complete file
      const readStream = fs.createReadStream(tempFile);
      const result = await this.processFileStream(readStream, filename, {
        validateHash: true,
        compress: false,
        cacheResult: true
      });
      
      // Clean up temp file
      await fs.promises.unlink(tempFile);
      
      return result;
      
    } catch (error) {
      logger.error('Chunked upload error: ' + (error instanceof Error ? error.message : String(error)));
      
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempFile);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp file: ' + (cleanupError instanceof Error ? cleanupError.message : String(cleanupError)));
      }
      
      return null;
    }
  }

  /**
   * Get file from cache or storage
   */
  async getFile(hash: string): Promise<{ buffer: Buffer; metadata: FileMetadata } | null> {
    try {
      const cached = await enhancedRedisService.get(`file:${hash}`, 'files');
      if (cached) {
        return {
          buffer: Buffer.from(cached.buffer, 'base64'),
          metadata: cached.metadata
        };
      }
    } catch (error) {
      logger.warn('Failed to get file from cache: ' + (error instanceof Error ? error.message : String(error)));
    }
    
    return null;
  }

  /**
   * Clean up old temp files
   */
  async cleanupTempFiles(maxAge: number = 3600000): Promise<number> {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      let cleaned = 0;
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (Date.now() - stats.mtime.getTime() > maxAge) {
          await fs.promises.unlink(filePath);
          cleaned++;
        }
      }
      
      logger.info(`Cleaned up ${cleaned} temp files`);
      return cleaned;
      
    } catch (error) {
      logger.error('Temp file cleanup error: ' + (error instanceof Error ? error.message : String(error)));
      return 0;
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.pdf': 'application/pdf',
      '.html': 'text/html',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.json': 'application/json'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      tempDir: this.tempDir,
      maxFileSize: this.maxFileSize,
      defaultChunkSize: this.defaultChunkSize
    };
  }
}

export const streamFileService = new StreamFileService();
