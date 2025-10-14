import { logger } from './logger';
import { redisService } from '../services/redis';
import { withRetry } from './error-recovery';
import { performance } from 'perf_hooks';
import { logger } from './logger';

// Helper to extract a safe error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};
export interface JobData {
  id: string;
  type: string;
  payload: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: string;
  processAfter?: string;
  userId?: string;
}

export interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
}

export interface JobProcessor {
  (jobData: JobData): Promise<JobResult>;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export class BackgroundJobProcessor {
  private static instance: BackgroundJobProcessor;
  private processors = new Map<string, JobProcessor>();
  private activeJobs = new Map<string, NodeJS.Timeout>();
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private readonly queueKey = 'job_queue';
  private readonly processingKey = 'processing_jobs';
  private readonly completedKey = 'completed_jobs';
  private readonly failedKey = 'failed_jobs';
  private readonly delayedKey = 'delayed_jobs';

  static getInstance(): BackgroundJobProcessor {
    if (!BackgroundJobProcessor.instance) {
      BackgroundJobProcessor.instance = new BackgroundJobProcessor();
    }
    return BackgroundJobProcessor.instance;
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(jobType: string, processor: JobProcessor): void {
    this.processors.set(jobType, processor);
    logger.info({ jobType }, 'Job processor registered');
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    type: string,
    payload: any,
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
      userId?: string;
    } = {}
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const job: JobData = {
      id: jobId,
      type,
      payload,
      priority: options.priority ?? 0,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      delay: options.delay ?? 0,
      createdAt: now,
      processAfter: options.delay ? new Date(Date.now() + options.delay).toISOString() : now,
      userId: options.userId
    };

    try {
      if (options.delay && options.delay > 0) {
        // Add to delayed jobs
        await redisService.getClient().zadd(this.delayedKey, Date.now() + options.delay, JSON.stringify(job));
        logger.info({ jobId, type, delay: options.delay }, 'Job scheduled for delayed processing');
      } else {
        // Add to main queue with priority
        await redisService.getClient().zadd(this.queueKey, -job.priority, JSON.stringify(job));
        logger.info({ jobId, type, priority: job.priority }, 'Job added to queue');
      }

      return jobId;
    } catch (error) {
      logger.error({ error: getErrorMessage(error), jobId, type }, 'Failed to add job to queue');
      throw error;
    }
  }

  /**
   * Start processing jobs
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Job processing is already started');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting background job processor');

    // Process delayed jobs every 10 seconds
    this.processingInterval = setInterval(async () => {
      try {
        await this.processDelayedJobs();
        await this.processQueuedJobs();
      } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Error in job processing loop');
      }
    }, 5000);

    // Initial processing
    await this.processDelayedJobs();
    await this.processQueuedJobs();
  }

  /**
   * Stop processing jobs
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for active jobs to complete
    const activeJobIds = Array.from(this.activeJobs.keys());
    if (activeJobIds.length > 0) {
      logger.info({ activeJobs: activeJobIds.length }, 'Waiting for active jobs to complete');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.activeJobs.size === 0) {
            clearInterval(checkInterval);
            resolve(void 0);
          }
        }, 100);
      });
    }

    logger.info('Background job processor stopped');
  }

  /**
   * Process delayed jobs that are ready
   */
  private async processDelayedJobs(): Promise<void> {
    try {
      const now = Date.now();
      const readyJobs = await redisService.getClient().zrangebyscore(
        this.delayedKey,
        '-inf',
        now.toString(),
        'LIMIT',
        0,
        10
      );

      for (const jobStr of readyJobs) {
        const job: JobData = JSON.parse(jobStr);
        
        // Move to main queue
        await Promise.all([
          redisService.getClient().zrem(this.delayedKey, jobStr),
          redisService.getClient().zadd(this.queueKey, -job.priority, jobStr)
        ]);
        
        logger.info({ jobId: job.id }, 'Moved delayed job to processing queue');
      }
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Error processing delayed jobs');
    }
  }

  /**
   * Process jobs from the main queue
   */
  private async processQueuedJobs(): Promise<void> {
    try {
      // Get jobs with highest priority (lowest score due to negative priority)
      const jobStrs = await redisService.getClient().zrange(this.queueKey, 0, 4); // Process up to 5 jobs at once
      
      for (const jobStr of jobStrs) {
        const job: JobData = JSON.parse(jobStr);
        
        // Skip if job is already being processed
        if (this.activeJobs.has(job.id)) {
          continue;
        }

        // Remove from queue and add to processing
        await Promise.all([
          redisService.getClient().zrem(this.queueKey, jobStr),
          redisService.getClient().hset(this.processingKey, job.id, jobStr)
        ]);

        // Process job asynchronously
        this.processJob(job);
      }
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Error processing queued jobs');
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: JobData): Promise<void> {
    const startTime = performance.now();
    
    // Mark as active
    const timeout = setTimeout(() => {
      logger.error({ jobId: job.id }, 'Job processing timeout');
      this.activeJobs.delete(job.id);
    }, 300000); // 5 minute timeout
    
    this.activeJobs.set(job.id, timeout);

    try {
      logger.info({
        jobId: job.id,
        type: job.type,
        attempt: job.attempts + 1,
        maxAttempts: job.maxAttempts
      }, 'Processing job');

      const processor = this.processors.get(job.type);
      if (!processor) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      // Increment attempt counter
      job.attempts++;

      // Process job with retry logic
      const result = await withRetry(
        () => processor(job),
        {
          maxAttempts: 1, // Don't retry here, we handle retries at job level
          baseDelay: 0
        },
        {
          operation: `process_job_${job.type}`,
          userId: job.userId,
          metadata: { jobId: job.id }
        }
      );

      const processingTime = performance.now() - startTime;
      
      if (result.success) {
        // Job completed successfully
        await this.markJobCompleted(job, result, processingTime);
        logger.info({
          jobId: job.id,
          type: job.type,
          processingTime: Math.round(processingTime)
        }, 'Job completed successfully');
      } else {
        throw new Error(result.error || 'Job failed without error message');
      }
    } catch (error) {
      const processingTime = performance.now() - startTime;
      await this.handleJobFailure(job, error, processingTime);
    } finally {
      // Clean up
      clearTimeout(timeout);
      this.activeJobs.delete(job.id);
      await redisService.getClient().hdel(this.processingKey, job.id);
    }
  }

  /**
   * Handle job failure and potential retry
   */
  private async handleJobFailure(job: JobData, error: unknown, processingTime: number): Promise<void> {
    logger.error({
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      error: getErrorMessage(error),
      processingTime: Math.round(processingTime)
    }, 'Job failed');

    if (job.attempts < job.maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000);
      job.processAfter = new Date(Date.now() + delay).toISOString();
      
      await redisService.getClient().zadd(this.delayedKey, Date.now() + delay, JSON.stringify(job));
      
      logger.info({
        jobId: job.id,
        nextAttempt: job.attempts + 1,
        retryDelay: delay
      }, 'Job scheduled for retry');
    } else {
      // Job failed permanently
      const failureData = {
        ...job,
        failedAt: new Date().toISOString(),
        finalError: getErrorMessage(error),
        processingTime
      };
      
      await redisService.getClient().hset(this.failedKey, job.id, JSON.stringify(failureData));
      
      logger.error({
        jobId: job.id,
        type: job.type,
        finalError: getErrorMessage(error)
      }, 'Job failed permanently');
    }
  }

  /**
   * Mark job as completed
   */
  private async markJobCompleted(job: JobData, result: JobResult, processingTime: number): Promise<void> {
    const completionData = {
      ...job,
      completedAt: new Date().toISOString(),
      result: result.result,
      processingTime
    };

    await redisService.getClient().hset(this.completedKey, job.id, JSON.stringify(completionData));
    
    // Clean up old completed jobs (keep last 1000)
    const completedCount = await redisService.getClient().hlen(this.completedKey);
    if (completedCount > 1000) {
      const oldestJobs = await redisService.getClient().hkeys(this.completedKey);
      const toDelete = oldestJobs.slice(0, completedCount - 1000);
      if (toDelete.length > 0) {
        await redisService.getClient().hdel(this.completedKey, ...toDelete);
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        redisService.getClient().zcard(this.queueKey),
        redisService.getClient().hlen(this.processingKey),
        redisService.getClient().hlen(this.completedKey),
        redisService.getClient().hlen(this.failedKey),
        redisService.getClient().zcard(this.delayedKey)
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Error getting queue stats');
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'delayed' | 'processing' | 'completed' | 'failed' | 'not_found';
    data?: any;
  }> {
    try {
      // Check processing
      const processingData = await redisService.getClient().hget(this.processingKey, jobId);
      if (processingData) {
        return { status: 'processing', data: JSON.parse(processingData) };
      }

      // Check completed
      const completedData = await redisService.getClient().hget(this.completedKey, jobId);
      if (completedData) {
        return { status: 'completed', data: JSON.parse(completedData) };
      }

      // Check failed
      const failedData = await redisService.getClient().hget(this.failedKey, jobId);
      if (failedData) {
        return { status: 'failed', data: JSON.parse(failedData) };
      }

      // Check waiting queue
      const queueJobs = await redisService.getClient().zrange(this.queueKey, 0, -1);
      for (const jobStr of queueJobs) {
        const job = JSON.parse(jobStr);
        if (job.id === jobId) {
          return { status: 'waiting', data: job };
        }
      }

      // Check delayed queue
      const delayedJobs = await redisService.getClient().zrange(this.delayedKey, 0, -1);
      for (const jobStr of delayedJobs) {
        const job = JSON.parse(jobStr);
        if (job.id === jobId) {
          return { status: 'delayed', data: job };
        }
      }

      return { status: 'not_found' };
    } catch (error) {
      logger.error({ error: getErrorMessage(error), jobId }, 'Error getting job status');
      return { status: 'not_found' };
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Remove from queue
      const queueJobs = await redisService.getClient().zrange(this.queueKey, 0, -1);
      for (const jobStr of queueJobs) {
        const job = JSON.parse(jobStr);
        if (job.id === jobId) {
          await redisService.getClient().zrem(this.queueKey, jobStr);
          logger.info({ jobId }, 'Job cancelled from queue');
          return true;
        }
      }

      // Remove from delayed queue
      const delayedJobs = await redisService.getClient().zrange(this.delayedKey, 0, -1);
      for (const jobStr of delayedJobs) {
        const job = JSON.parse(jobStr);
        if (job.id === jobId) {
          await redisService.getClient().zrem(this.delayedKey, jobStr);
          logger.info({ jobId }, 'Job cancelled from delayed queue');
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error({ error: getErrorMessage(error), jobId }, 'Error cancelling job');
      return false;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<void> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      // Clean up old completed jobs
      const completedJobs = await redisService.getClient().hgetall(this.completedKey) as Record<string, string>;
      let cleanedCompleted = 0;
      
      for (const [jobId, jobStr] of Object.entries(completedJobs) as [string, string][]) {
        const job = JSON.parse(jobStr);
        if (new Date(job.completedAt).getTime() < cutoffTime) {
          await redisService.getClient().hdel(this.completedKey, jobId);
          cleanedCompleted++;
        }
      }

      // Clean up old failed jobs
      const failedJobs = await redisService.getClient().hgetall(this.failedKey) as Record<string, string>;
      let cleanedFailed = 0;
      
      for (const [jobId, jobStr] of Object.entries(failedJobs) as [string, string][]) {
        const job = JSON.parse(jobStr);
        if (new Date(job.failedAt).getTime() < cutoffTime) {
          await redisService.getClient().hdel(this.failedKey, jobId);
          cleanedFailed++;
        }
      }

      logger.info({
        cleanedCompleted,
        cleanedFailed,
        olderThanDays
      }, 'Old jobs cleaned up');
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Error cleaning up old jobs');
    }
  }
}

// Export singleton instance
export const jobProcessor = BackgroundJobProcessor.getInstance();

// Built-in job processors for common tasks
export const registerBuiltInProcessors = () => {
  // DOCX processing job for SuperDoc editor (no conversion needed)
  jobProcessor.registerProcessor('process_docx', async (job: JobData): Promise<JobResult> => {
    const startTime = performance.now();
    
    try {
      const { resumeId, userId } = job.payload;
      
      logger.info(`Processing DOCX for SuperDoc editor - resume ${resumeId} (user ${userId})`);
      
      // Get resume data to access the file
      const { storage } = await import('../storage');
      const resume = await storage.getResumeById(resumeId);
      
      if (!resume) {
        throw new Error(`Resume not found: ${resumeId}`);
      }
      
      if (!resume.originalPath) {
        throw new Error(`No file path found for resume: ${resumeId}`);
      }
      
      // Read the DOCX file
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), resume.originalPath);
      
      try {
        const fileBuffer = await fs.readFile(filePath);
        // Mark ready
        await storage.updateResumeStatus(resumeId, "ready");
        // Precompute first-page thumbnail placeholder (defer heavy image ops to client)
        try {
          const crypto = await import('crypto');
          const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          const { enhancedRedisService } = await import('../services/enhanced-redis-service');
          // If not already present, store a marker so client knows server expects thumbnails
          const existing = await enhancedRedisService.get(`thumbs:${hash}`, 'files');
          if (!existing) {
            await enhancedRedisService.set(`thumbs:${hash}`, { ready: false, pages: 0 }, { ttl: 86400, namespace: 'files' });
          }
        } catch {}
        logger.info(`✅ Resume ${resumeId} marked as ready for SuperDoc editing`);
        return {
          success: true,
          result: { message: 'Resume ready for SuperDoc editing', resumeId, userId, fileSize: fileBuffer.length },
          processingTime: performance.now() - startTime
        };
      } catch (fileError) {
        logger.error(`Failed to read DOCX file for resume ${resumeId}:`, fileError);
        throw new Error(`Failed to read DOCX file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
      }
      
    } catch (error) {
      logger.error(`DOCX processing failed for job ${job.id}:`, error);
      
      // Update resume status to indicate failure
      try {
        const { storage } = await import('../storage');
        await storage.updateResumeStatus(job.payload.resumeId, "error");
      } catch (statusError) {
        logger.error({ error: statusError }, 'Failed to update resume status to error:');
      }
      
      return {
        success: false,
        error: getErrorMessage(error),
        processingTime: performance.now() - startTime
      };
    }
  });

  // Email notification job
  jobProcessor.registerProcessor('send_email', async (job: JobData): Promise<JobResult> => {
    const startTime = performance.now();
    
    try {
      const { to, subject, body, template } = job.payload;
      void body; void template;
      
      // This would call your email service
      // For now, we'll simulate sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info({ to, subject, jobId: job.id }, 'Email sent successfully');
      
      return {
        success: true,
        result: { messageId: `msg_${Date.now()}` },
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        processingTime: performance.now() - startTime
      };
    }
  });

  // File cleanup job
  jobProcessor.registerProcessor('cleanup_temp_files', async (job: JobData): Promise<JobResult> => {
    const startTime = performance.now();
    
    try {
      const { filePaths, olderThanHours } = job.payload;
      void olderThanHours;
      
      // This would clean up temporary files
      // For now, we'll simulate cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        result: { cleanedFiles: filePaths?.length || 0 },
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        processingTime: performance.now() - startTime
      };
    }
  });

  logger.info('Built-in job processors registered');
};