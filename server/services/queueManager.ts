/**
 * Queue Management System using BullMQ
 * Handles background jobs for email operations, ensuring reliability and scalability
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Parse Redis connection for BullMQ
const connection: ConnectionOptions = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Required for BullMQ
};

// Queue names
export enum QueueName {
  EMAIL_SEND = 'email:send',
  EMAIL_SYNC = 'email:sync',
  EMAIL_PROCESS = 'email:process',
  EMAIL_BULK = 'email:bulk',
  NOTIFICATION = 'notification',
  CLEANUP = 'cleanup',
  ANALYTICS = 'analytics',
}

// Job types
export interface EmailSendJob {
  accountId: string;
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailSyncJob {
  accountId: string;
  userId: string;
  fullSync?: boolean;
  since?: Date;
}

export interface EmailProcessJob {
  messageId: string;
  accountId: string;
  operation: 'spam-check' | 'attachment-scan' | 'index' | 'archive';
}

export interface BulkEmailJob {
  accountId: string;
  userId: string;
  threadIds: string[];
  operation: 'archive' | 'delete' | 'mark-read' | 'mark-unread';
}

export interface NotificationJob {
  userId: string;
  type: 'email' | 'push' | 'sms';
  template: string;
  data: Record<string, any>;
}

export interface CleanupJob {
  type: 'old-emails' | 'temp-files' | 'expired-tokens' | 'session-cleanup';
  olderThan?: Date;
}

// Queue options
const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000, // 2 seconds base delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Queue Manager for all background jobs
 */
export class QueueManager {
  private static queues: Map<QueueName, Queue> = new Map();
  private static workers: Map<QueueName, Worker> = new Map();
  private static events: Map<QueueName, QueueEvents> = new Map();
  
  /**
   * Initialize queue manager
   */
  static async initialize(): Promise<void> {
    logger.info('Initializing queue manager...');
    
    // Create all queues
    for (const queueName of Object.values(QueueName)) {
      this.createQueue(queueName);
    }
    
    // Start workers
    this.startEmailSendWorker();
    this.startEmailSyncWorker();
    this.startEmailProcessWorker();
    this.startBulkOperationsWorker();
    this.startNotificationWorker();
    this.startCleanupWorker();
    
    logger.info('Queue manager initialized successfully');
  }
  
  /**
   * Create a queue
   */
  private static createQueue(queueName: QueueName): Queue {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }
    
    const queue = new Queue(queueName, {
      connection,
      ...defaultQueueOptions,
    });
    
    // Queue events
    const queueEvents = new QueueEvents(queueName, { connection });
    
    queueEvents.on('completed', ({ jobId }) => {
      logger.debug({ queue: queueName, jobId }, 'Job completed');
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error({ queue: queueName, jobId, failedReason }, 'Job failed');
    });
    
    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn({ queue: queueName, jobId }, 'Job stalled');
    });
    
    this.queues.set(queueName, queue);
    this.events.set(queueName, queueEvents);
    
    return queue;
  }
  
  /**
   * Get queue by name
   */
  static getQueue(queueName: QueueName): Queue {
    return this.queues.get(queueName) || this.createQueue(queueName);
  }
  
  /**
   * Add email send job
   */
  static async addEmailSendJob(
    data: EmailSendJob,
    options: { priority?: number; delay?: number } = {}
  ): Promise<Job> {
    const queue = this.getQueue(QueueName.EMAIL_SEND);
    
    const priorityMap = { high: 1, normal: 5, low: 10 };
    const priority = data.priority ? priorityMap[data.priority] : priorityMap.normal;
    
    return queue.add('send-email', data, {
      priority,
      delay: options.delay,
      jobId: `email-send-${data.accountId}-${Date.now()}`,
    });
  }
  
  /**
   * Add email sync job
   */
  static async addEmailSyncJob(
    data: EmailSyncJob,
    options: { priority?: number } = {}
  ): Promise<Job> {
    const queue = this.getQueue(QueueName.EMAIL_SYNC);
    
    // Prevent duplicate sync jobs for the same account
    const jobId = `email-sync-${data.accountId}`;
    
    return queue.add('sync-emails', data, {
      priority: options.priority || 5,
      jobId,
      removeOnComplete: true,
      // Don't add if already exists
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
  
  /**
   * Add bulk operation job
   */
  static async addBulkOperationJob(data: BulkEmailJob): Promise<Job> {
    const queue = this.getQueue(QueueName.EMAIL_BULK);
    
    return queue.add('bulk-operation', data, {
      priority: 3,
      timeout: 120000, // 2 minutes timeout
    });
  }
  
  /**
   * Add notification job
   */
  static async addNotificationJob(data: NotificationJob): Promise<Job> {
    const queue = this.getQueue(QueueName.NOTIFICATION);
    
    return queue.add('send-notification', data, {
      priority: 2,
      attempts: 5,
    });
  }
  
  /**
   * Email send worker
   */
  private static startEmailSendWorker(): void {
    const worker = new Worker(
      QueueName.EMAIL_SEND,
      async (job: Job<EmailSendJob>) => {
        const { accountId, userId, to, subject, htmlBody, textBody, attachments, cc, bcc } = job.data;
        
        logger.info({ jobId: job.id, accountId, to }, 'Processing email send job');
        
        try {
          // Import email service dynamically to avoid circular dependencies
          const { sendEmailViaAccount } = await import('./emailAccountService');
          
          await sendEmailViaAccount(accountId, {
            to,
            cc,
            bcc,
            subject,
            htmlBody,
            textBody,
            attachments,
          });
          
          // Update rate limits
          await CacheService.incr(`email:sent:${accountId}:${Date.now()}`, 3600);
          
          logger.info({ jobId: job.id, accountId }, 'Email sent successfully');
          
          return { success: true };
        } catch (error) {
          logger.error({ error, jobId: job.id, accountId }, 'Failed to send email');
          throw error;
        }
      },
      {
        connection,
        concurrency: 5, // Process 5 emails concurrently
        limiter: {
          max: 10, // Max 10 emails
          duration: 1000, // per second
        },
      }
    );
    
    this.workers.set(QueueName.EMAIL_SEND, worker);
  }
  
  /**
   * Email sync worker
   */
  private static startEmailSyncWorker(): void {
    const worker = new Worker(
      QueueName.EMAIL_SYNC,
      async (job: Job<EmailSyncJob>) => {
        const { accountId, userId, fullSync, since } = job.data;
        
        logger.info({ jobId: job.id, accountId, fullSync }, 'Processing email sync job');
        
        try {
          // Import sync service dynamically
          const { EmailSyncService } = await import('./emailSyncService');
          
          const result = await EmailSyncService.syncAccount(accountId, {
            fullSync,
            since,
          });
          
          logger.info({ 
            jobId: job.id, 
            accountId, 
            synced: result.syncedCount 
          }, 'Email sync completed');
          
          return result;
        } catch (error) {
          logger.error({ error, jobId: job.id, accountId }, 'Email sync failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 3, // Sync 3 accounts concurrently
        limiter: {
          max: 5,
          duration: 60000, // Max 5 syncs per minute
        },
      }
    );
    
    this.workers.set(QueueName.EMAIL_SYNC, worker);
  }
  
  /**
   * Email process worker (spam checking, indexing, etc.)
   */
  private static startEmailProcessWorker(): void {
    const worker = new Worker(
      QueueName.EMAIL_PROCESS,
      async (job: Job<EmailProcessJob>) => {
        const { messageId, accountId, operation } = job.data;
        
        logger.info({ jobId: job.id, messageId, operation }, 'Processing email operation');
        
        try {
          switch (operation) {
            case 'spam-check':
              const { EmailSpamFilter } = await import('./emailSpamFilter');
              // Implement spam check
              break;
            
            case 'attachment-scan':
              const { EmailSecurityService } = await import('./emailSecurityService');
              // Implement attachment scan
              break;
            
            case 'index':
              const { EmailSearchService } = await import('./emailSearchService');
              // Index email for search
              break;
            
            case 'archive':
              // Archive old email
              break;
          }
          
          return { success: true };
        } catch (error) {
          logger.error({ error, jobId: job.id }, 'Email processing failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 10, // Process 10 operations concurrently
      }
    );
    
    this.workers.set(QueueName.EMAIL_PROCESS, worker);
  }
  
  /**
   * Bulk operations worker
   */
  private static startBulkOperationsWorker(): void {
    const worker = new Worker(
      QueueName.EMAIL_BULK,
      async (job: Job<BulkEmailJob>) => {
        const { accountId, userId, threadIds, operation } = job.data;
        
        logger.info({ 
          jobId: job.id, 
          accountId, 
          operation, 
          count: threadIds.length 
        }, 'Processing bulk operation');
        
        try {
          // Import database
          const { db } = await import('../config/database');
          const { emailThreads } = await import('@shared/schema');
          const { inArray, eq } = await import('drizzle-orm');
          
          // Process in batches
          const batchSize = 50;
          for (let i = 0; i < threadIds.length; i += batchSize) {
            const batch = threadIds.slice(i, i + batchSize);
            
            switch (operation) {
              case 'archive':
                await db.update(emailThreads)
                  .set({ isArchived: true })
                  .where(inArray(emailThreads.id, batch));
                break;
              
              case 'delete':
                await db.delete(emailThreads)
                  .where(inArray(emailThreads.id, batch));
                break;
              
              case 'mark-read':
              case 'mark-unread':
                // Update messages
                const { emailMessages } = await import('@shared/schema');
                await db.update(emailMessages)
                  .set({ isRead: operation === 'mark-read' })
                  .where(inArray(emailMessages.threadId, batch));
                break;
            }
            
            // Update progress
            await job.updateProgress(((i + batch.length) / threadIds.length) * 100);
          }
          
          logger.info({ jobId: job.id, count: threadIds.length }, 'Bulk operation completed');
          
          return { success: true, processed: threadIds.length };
        } catch (error) {
          logger.error({ error, jobId: job.id }, 'Bulk operation failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 2, // Limit concurrent bulk operations
      }
    );
    
    this.workers.set(QueueName.EMAIL_BULK, worker);
  }
  
  /**
   * Notification worker
   */
  private static startNotificationWorker(): void {
    const worker = new Worker(
      QueueName.NOTIFICATION,
      async (job: Job<NotificationJob>) => {
        const { userId, type, template, data } = job.data;
        
        logger.info({ jobId: job.id, userId, type, template }, 'Sending notification');
        
        try {
          // Implement notification sending logic
          // This could integrate with email, push notifications, SMS, etc.
          
          return { success: true };
        } catch (error) {
          logger.error({ error, jobId: job.id }, 'Notification failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 10,
      }
    );
    
    this.workers.set(QueueName.NOTIFICATION, worker);
  }
  
  /**
   * Cleanup worker (runs periodically)
   */
  private static startCleanupWorker(): void {
    const worker = new Worker(
      QueueName.CLEANUP,
      async (job: Job<CleanupJob>) => {
        const { type, olderThan } = job.data;
        
        logger.info({ jobId: job.id, type }, 'Running cleanup job');
        
        try {
          const { db } = await import('../config/database');
          
          switch (type) {
            case 'expired-tokens':
              // Clean up expired tokens
              const { users } = await import('@shared/schema');
              const { lt } = await import('drizzle-orm');
              
              await db.update(users)
                .set({
                  emailVerificationToken: null,
                  emailVerificationExpires: null,
                })
                .where(lt(users.emailVerificationExpires, new Date()));
              break;
            
            case 'session-cleanup':
              // Clean up expired sessions
              break;
            
            case 'temp-files':
              // Clean up temporary files
              break;
            
            case 'old-emails':
              // Archive or delete very old emails
              break;
          }
          
          return { success: true };
        } catch (error) {
          logger.error({ error, jobId: job.id }, 'Cleanup job failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 1,
      }
    );
    
    this.workers.set(QueueName.CLEANUP, worker);
    
    // Schedule daily cleanup
    const cleanupQueue = this.getQueue(QueueName.CLEANUP);
    cleanupQueue.add(
      'daily-cleanup',
      { type: 'expired-tokens' as const },
      {
        repeat: {
          pattern: '0 2 * * *', // Run at 2 AM every day
        },
      }
    );
  }
  
  /**
   * Get queue statistics
   */
  static async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    
    return { waiting, active, completed, failed, delayed };
  }
  
  /**
   * Get all queue statistics
   */
  static async getAllStats(): Promise<Record<QueueName, any>> {
    const stats: any = {};
    
    for (const queueName of Object.values(QueueName)) {
      stats[queueName] = await this.getQueueStats(queueName);
    }
    
    return stats;
  }
  
  /**
   * Pause queue
   */
  static async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info({ queue: queueName }, 'Queue paused');
  }
  
  /**
   * Resume queue
   */
  static async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info({ queue: queueName }, 'Queue resumed');
  }
  
  /**
   * Close all queues and workers
   */
  static async closeAll(): Promise<void> {
    logger.info('Closing queue manager...');
    
    // Close all workers
    await Promise.all(
      Array.from(this.workers.values()).map(worker => worker.close())
    );
    
    // Close all queue events
    await Promise.all(
      Array.from(this.events.values()).map(events => events.close())
    );
    
    // Close all queues
    await Promise.all(
      Array.from(this.queues.values()).map(queue => queue.close())
    );
    
    logger.info('Queue manager closed');
  }
}

// Initialize on module load if not in test environment
if (process.env.NODE_ENV !== 'test') {
  QueueManager.initialize().catch(err =>
    logger.error({ err }, 'Failed to initialize queue manager')
  );
}

export default QueueManager;
