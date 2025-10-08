import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { enhancedRedisService } from './enhanced-redis-service';
import { docxFallbackService } from './docx-fallback-service';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});
import { Readable } from 'stream';

export interface ConversionJob {
  id: string;
  type: 'docx-to-html' | 'html-to-docx' | 'batch-convert';
  input: Buffer | string;
  options?: {
    template?: string;
    preserveStyles?: boolean;
    filename?: string;
  };
  priority?: 'low' | 'normal' | 'high';
}

export interface ConversionResult {
  success: boolean;
  data?: Buffer | string;
  hash?: string;
  error?: string;
  metadata?: {
    originalSize: number;
    convertedSize: number;
    processingTime: number;
  };
}

class ConversionService extends EventEmitter {
  private workers: Worker[] = [];
  private jobQueue: ConversionJob[] = [];
  private activeJobs = new Map<string, ConversionJob>();
  private maxWorkers = 4;
  private libreOfficeUrl: string;
  private isInitialized = false;
  private useFallback = false;

  constructor() {
    super();
    this.libreOfficeUrl = process.env.LIBREOFFICE_SERVICE_URL || 'http://localhost:8081';
    this.initialize();
  }

  private async initialize() {
    try {
      // Skip HTTP health check - LibreOffice UNO doesn't provide HTTP endpoints
      // Instead, we'll use direct command-line LibreOffice conversion
      logger.info('Initializing conversion service with direct LibreOffice support');
      
      // Check if LibreOffice is available on the system
      const libreOfficeAvailable = await this.checkLibreOfficeInstallation();
      
      if (libreOfficeAvailable) {
        this.isInitialized = true;
        logger.info('Conversion service initialized with LibreOffice command-line backend');
      } else {
        throw new Error('LibreOffice not found on system');
      }
    } catch (error) {
      logger.warn('LibreOffice not available, using fallback mode: ' + (error instanceof Error ? error.message : String(error)));
      this.useFallback = true;
      this.isInitialized = true;
      logger.info('Conversion service initialized with fallback backend');
    }
  }

  private async waitForLibreOfficeService(maxRetries = 30, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${this.libreOfficeUrl}/health`);
        if (response.ok) {
          logger.info('LibreOffice service is ready');
          return;
        }
      } catch (error) {
        logger.warn(`LibreOffice service not ready, attempt ${i + 1}/${maxRetries}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error('LibreOffice service failed to start');
  }

  private async createWorker(): Promise<Worker> {
    const workerPath = path.join(__dirname, 'conversion-worker.cjs');
    const worker = new Worker(workerPath, {
      workerData: {
        libreOfficeUrl: this.libreOfficeUrl
      }
    });

    worker.on('message', (result) => {
      this.handleWorkerMessage(result);
    });

    worker.on('error', (error) => {
      logger.error('Worker error: ' + (error instanceof Error ? error.message : String(error)));
      this.handleWorkerError(worker, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Worker stopped with exit code ${code}`);
        this.replaceWorker(worker);
      }
    });

    this.workers.push(worker);
    return worker;
  }

  private handleWorkerMessage(result: any) {
    const { jobId, success, data, error, metadata } = result;
    const job = this.activeJobs.get(jobId);
    
    if (job) {
      this.activeJobs.delete(jobId);
      this.emit('jobComplete', {
        job,
        result: { success, data, error, metadata }
      });
    }
    
    // Process next job in queue
    this.processNextJob();
  }

  private handleWorkerError(worker: Worker, error: Error) {
    // Find and retry jobs assigned to this worker
    for (const [jobId, job] of this.activeJobs.entries()) {
      this.emit('jobComplete', {
        job,
        result: {
          success: false,
          error: `Worker error: ${error.message}`
        }
      });
      this.activeJobs.delete(jobId);
    }
    
    this.replaceWorker(worker);
  }

  private async replaceWorker(failedWorker: Worker) {
    const index = this.workers.indexOf(failedWorker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      try {
        await failedWorker.terminate();
      } catch (error) {
        logger.error('Error terminating failed worker: ' + (error instanceof Error ? error.message : String(error)));
      }
      
      // Create replacement worker
      await this.createWorker();
    }
  }

  private processNextJob() {
    if (this.jobQueue.length === 0) return;
    
    const availableWorker = this.workers.find(worker => 
      !Array.from(this.activeJobs.values()).some(job => 
        (job as any).workerId === worker.threadId
      )
    );
    
    if (availableWorker) {
      const job = this.jobQueue.shift()!;
      this.activeJobs.set(job.id, job);
      
      availableWorker.postMessage({
        jobId: job.id,
        type: job.type,
        input: job.input,
        options: job.options
      });
    }
  }

  async convertDocxToHtml(
    docxBuffer: Buffer, 
    options: { preserveStyles?: boolean; filename?: string } = {}
  ): Promise<ConversionResult> {
    if (!this.isInitialized) {
      throw new Error('Conversion service not initialized');
    }

    const jobId = this.generateJobId();
    const cacheKey = this.generateCacheKey(docxBuffer, 'docx-to-html', options);
    
    // Check cache first
    try {
      const cached = await enhancedRedisService.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for conversion job ${jobId}`);
        return cached;
      }
    } catch (error) {
      logger.warn('Cache check failed: ' + (error instanceof Error ? error.message : String(error)));
    }

    // Try direct LibreOffice command-line conversion first
    try {
      logger.info(`Attempting direct LibreOffice conversion for job ${jobId}`);
      const startTime = Date.now();
      
      const result = await this.convertDocxToHtmlDirect(docxBuffer, options);
      
      if (result.success && result.html) {
        const conversionResult: ConversionResult = {
          success: true,
          data: result.html,
          hash: this.generateHash(docxBuffer),
          metadata: {
            originalSize: docxBuffer.length,
            convertedSize: result.html.length,
            processingTime: Date.now() - startTime
          }
        };

        // Cache the result
        try {
          await enhancedRedisService.setex(cacheKey, 3600, conversionResult);
        } catch (error) {
          logger.warn('Failed to cache LibreOffice result: ' + (error instanceof Error ? error.message : String(error)));
        }

        logger.info(`Direct LibreOffice conversion successful for job ${jobId}`);
        return conversionResult;
      }
    } catch (error) {
      logger.warn(`Direct LibreOffice conversion failed, falling back to JSZip: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Use fallback service if LibreOffice direct conversion fails
    logger.info(`Using fallback DOCX extraction for job ${jobId}`);
    const fallbackStartTime = Date.now();
    
    try {
      const result = await docxFallbackService.extractDocxContentEnhanced(docxBuffer);
      
      if (result.success && result.html) {
        const conversionResult: ConversionResult = {
          success: true,
          data: result.html,
          hash: this.generateHash(docxBuffer),
          metadata: {
            originalSize: docxBuffer.length,
            convertedSize: result.html.length,
            processingTime: Date.now() - fallbackStartTime
          }
        };

        // Cache the result
        try {
          await enhancedRedisService.setex(cacheKey, 3600, conversionResult);
        } catch (error) {
          logger.warn('Failed to cache fallback result: ' + (error instanceof Error ? error.message : String(error)));
        }

        return conversionResult;
      } else {
        return {
          success: false,
          error: result.error || 'Fallback extraction failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fallback extraction error'
      };
    }
  }

  async convertHtmlToDocx(
    htmlContent: string,
    options: { template?: string; filename?: string } = {}
  ): Promise<ConversionResult> {
    if (!this.isInitialized) {
      throw new Error('Conversion service not initialized');
    }

    const jobId = this.generateJobId();
    const cacheKey = this.generateCacheKey(Buffer.from(htmlContent), 'html-to-docx', options);
    
    // Check cache first
    try {
      const cached = await enhancedRedisService.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for conversion job ${jobId}`);
        // Convert base64 back to buffer for DOCX data
        if (cached.data) {
          cached.data = Buffer.from(cached.data, 'base64');
        }
        return cached;
      }
    } catch (error) {
      logger.warn('Cache check failed: ' + (error instanceof Error ? error.message : String(error)));
    }

    return new Promise((resolve, reject) => {
      const job: ConversionJob = {
        id: jobId,
        type: 'html-to-docx',
        input: htmlContent,
        options,
        priority: 'normal'
      };

      const timeout = setTimeout(() => {
        this.activeJobs.delete(jobId);
        reject(new Error('Conversion timeout'));
      }, 60000);

      this.once('jobComplete', async ({ job: completedJob, result }) => {
        if (completedJob.id === jobId) {
          clearTimeout(timeout);
          
          // Cache successful results (convert buffer to base64 for storage)
          if (result.success && result.data) {
            try {
              const cacheResult = {
                ...result,
                data: Buffer.isBuffer(result.data) ? result.data.toString('base64') : result.data
              };
              await enhancedRedisService.setex(cacheKey, 3600, cacheResult);
            } catch (error) {
              logger.warn('Failed to cache result: ' + (error instanceof Error ? error.message : String(error)));
            }
          }
          
          resolve(result);
        }
      });

      this.jobQueue.push(job);
      this.processNextJob();
    });
  }

  async batchConvert(
    files: { buffer: Buffer; filename: string }[],
    options: { preserveStyles?: boolean } = {}
  ): Promise<ConversionResult[]> {
    const results = await Promise.all(
      files.map(file => 
        this.convertDocxToHtml(file.buffer, {
          ...options,
          filename: file.filename
        })
      )
    );
    
    return results;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(input: Buffer, type: string, options: any): string {
    const hash = createHash('sha256');
    hash.update(input);
    hash.update(type);
    hash.update(JSON.stringify(options || {}));
    return `conversion:${hash.digest('hex')}`;
  }

  private generateHash(data: Buffer | string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async checkLibreOfficeInstallation(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      const libreOfficePath = process.platform === 'win32' 
        ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
        : 'soffice';
      
      return new Promise((resolve) => {
        const process = spawn(libreOfficePath, ['--version'], { 
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true 
        });
        
        process.on('close', (code) => {
          resolve(code === 0);
        });
        
        process.on('error', () => {
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          process.kill();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      return false;
    }
  }

  private async convertDocxToHtmlDirect(docxBuffer: Buffer, options: { preserveStyles?: boolean; filename?: string } = {}): Promise<{ success: boolean; html?: string; error?: string }> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { spawn } = await import('child_process');
    
    // Create temporary files
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'libreoffice-'));
    const docxPath = path.join(tempDir, `input_${Date.now()}.docx`);
    
    try {
      // Write DOCX buffer to temporary file
      await fs.writeFile(docxPath, docxBuffer);
      
      // LibreOffice command-line conversion
      const libreOfficePath = process.platform === 'win32' 
        ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
        : 'soffice';
      
      const args = [
        '--headless',
        '--convert-to', 'html',
        '--outdir', tempDir,
        docxPath
      ];
      
      return new Promise((resolve) => {
        const process = spawn(libreOfficePath, args, { 
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true 
        });
        
        let stderr = '';
        
        process.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', async (code) => {
          try {
            if (code === 0) {
              // LibreOffice creates output with same name but .html extension
              const possibleOutputs = await fs.readdir(tempDir);
              const htmlFile = possibleOutputs.find(f => f.endsWith('.html'));
              
              if (htmlFile) {
                const htmlContent = await fs.readFile(path.join(tempDir, htmlFile), 'utf-8');
                
                // Clean up temporary files
                await fs.rm(tempDir, { recursive: true, force: true });
                
                resolve({
                  success: true,
                  html: htmlContent
                });
              } else {
                await fs.rm(tempDir, { recursive: true, force: true });
                resolve({
                  success: false,
                  error: 'HTML output file not found'
                });
              }
            } else {
              await fs.rm(tempDir, { recursive: true, force: true });
              resolve({
                success: false,
                error: `LibreOffice conversion failed with code ${code}: ${stderr}`
              });
            }
          } catch (cleanupError) {
            resolve({
              success: false,
              error: `Conversion cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`
            });
          }
        });
        
        process.on('error', async (error) => {
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch {}
          resolve({
            success: false,
            error: `LibreOffice process error: ${error.message}`
          });
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          process.kill();
          resolve({
            success: false,
            error: 'LibreOffice conversion timeout'
          });
        }, 30000);
      });
      
    } catch (error) {
      // Clean up on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getQueueStatus() {
    return {
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      availableWorkers: this.workers.length - this.activeJobs.size,
      totalWorkers: this.workers.length
    };
  }

  async shutdown() {
    logger.info('Shutting down conversion service...');
    
    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Terminate all workers
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    
    this.workers = [];
    this.activeJobs.clear();
    this.jobQueue = [];
    
    logger.info('Conversion service shutdown complete');
  }
}

export const conversionService = new ConversionService();
