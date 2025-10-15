import { redis as redisClient } from './redis-service';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export class EmailCacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes default cache
  private static readonly THREAD_LIST_TTL = 60; // 1 minute for thread lists
  private static readonly MESSAGE_TTL = 600; // 10 minutes for individual messages
  private static readonly PREFIX = 'email:';

  /**
   * Generate cache key
   */
  private static getCacheKey(type: string, ...parts: string[]): string {
    return `${this.PREFIX}${type}:${parts.join(':')}`;
  }

  /**
   * Cache email thread list for a user/folder
   */
  static async cacheThreadList(
    userId: string,
    folder: string,
    threads: any[],
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = this.getCacheKey('threads', userId, folder);
      const ttl = options.ttl || this.THREAD_LIST_TTL;
      
      await redisClient.set(
        key,
        JSON.stringify(threads),
        'EX',
        ttl
      );
      
      logger.debug(`✅ Cached ${threads.length} threads for ${userId}/${folder}`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to cache thread list:');
    }
  }

  /**
   * Get cached thread list
   */
  static async getThreadList(userId: string, folder: string): Promise<any[] | null> {
    try {
      const key = this.getCacheKey('threads', userId, folder);
      const cached = await redisClient.get(key);
      
      if (cached) {
        logger.debug(`📊 Cache hit for threads ${userId}/${folder}`);
        return JSON.parse(cached);
      }
      
      logger.debug(`❌ Cache miss for threads ${userId}/${folder}`);
      return null;
    } catch (error) {
      logger.error({ error: error }, 'Failed to get cached thread list:');
      return null;
    }
  }

  /**
   * Cache individual email message
   */
  static async cacheMessage(
    messageId: string,
    message: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = this.getCacheKey('message', messageId);
      const ttl = options.ttl || this.MESSAGE_TTL;
      
      await redisClient.set(
        key,
        JSON.stringify(message),
        'EX',
        ttl
      );
      
      logger.debug(`✅ Cached message ${messageId}`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to cache message:');
    }
  }

  /**
   * Get cached message
   */
  static async getMessage(messageId: string): Promise<any | null> {
    try {
      const key = this.getCacheKey('message', messageId);
      const cached = await redisClient.get(key);
      
      if (cached) {
        logger.debug(`📊 Cache hit for message ${messageId}`);
        return JSON.parse(cached);
      }
      
      logger.debug(`❌ Cache miss for message ${messageId}`);
      return null;
    } catch (error) {
      logger.error({ error: error }, 'Failed to get cached message:');
      return null;
    }
  }

  /**
   * Cache email thread with all messages
   */
  static async cacheThread(
    threadId: string,
    thread: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = this.getCacheKey('thread', threadId);
      const ttl = options.ttl || this.DEFAULT_TTL;
      
      await redisClient.set(
        key,
        JSON.stringify(thread),
        'EX',
        ttl
      );
      
      logger.debug(`✅ Cached thread ${threadId}`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to cache thread:');
    }
  }

  /**
   * Get cached thread
   */
  static async getThread(threadId: string): Promise<any | null> {
    try {
      const key = this.getCacheKey('thread', threadId);
      const cached = await redisClient.get(key);
      
      if (cached) {
        logger.debug(`📊 Cache hit for thread ${threadId}`);
        return JSON.parse(cached);
      }
      
      logger.debug(`❌ Cache miss for thread ${threadId}`);
      return null;
    } catch (error) {
      logger.error({ error: error }, 'Failed to get cached thread:');
      return null;
    }
  }

  /**
   * Cache account sync status
   */
  static async cacheAccountSyncStatus(
    accountId: string,
    status: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = this.getCacheKey('sync', accountId);
      const ttl = options.ttl || 30; // 30 seconds for sync status
      
      await redisClient.set(
        key,
        JSON.stringify(status),
        'EX',
        ttl
      );
      
      logger.debug(`✅ Cached sync status for ${accountId}`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to cache sync status:');
    }
  }

  /**
   * Get cached sync status
   */
  static async getAccountSyncStatus(accountId: string): Promise<any | null> {
    try {
      const key = this.getCacheKey('sync', accountId);
      const cached = await redisClient.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error({ error: error }, 'Failed to get cached sync status:');
      return null;
    }
  }

  /**
   * Invalidate cache for a user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = this.getCacheKey('threads', userId, '*');
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.debug(`🗑️  Invalidated ${keys.length} cache entries for user ${userId}`);
      }
    } catch (error) {
      logger.error({ error: error }, 'Failed to invalidate user cache:');
    }
  }

  /**
   * Invalidate specific thread cache
   */
  static async invalidateThread(threadId: string): Promise<void> {
    try {
      const key = this.getCacheKey('thread', threadId);
      await redisClient.del(key);
      logger.debug(`🗑️  Invalidated cache for thread ${threadId}`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to invalidate thread cache:');
    }
  }

  /**
   * Invalidate message cache
   */
  static async invalidateMessage(messageId: string): Promise<void> {
    try {
      const key = this.getCacheKey('message', messageId);
      await redisClient.del(key);
      logger.debug(`🗑️  Invalidated cache for message ${messageId}`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to invalidate message cache:');
    }
  }

  /**
   * Clear all email caches
   */
  static async clearAll(): Promise<void> {
    try {
      const pattern = `${this.PREFIX}*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info(`🗑️  Cleared ${keys.length} email cache entries`);
      }
    } catch (error) {
      logger.error({ error: error }, 'Failed to clear email cache:');
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalKeys: number;
    threadKeys: number;
    messageKeys: number;
    syncKeys: number;
  }> {
    try {
      const allKeys = await redisClient.keys(`${this.PREFIX}*`);
      const threadKeys = allKeys.filter(k => k.includes(':threads:')).length;
      const messageKeys = allKeys.filter(k => k.includes(':message:')).length;
      const syncKeys = allKeys.filter(k => k.includes(':sync:')).length;
      
      return {
        totalKeys: allKeys.length,
        threadKeys,
        messageKeys,
        syncKeys
      };
    } catch (error) {
      logger.error({ error: error }, 'Failed to get cache stats:');
      return { totalKeys: 0, threadKeys: 0, messageKeys: 0, syncKeys: 0 };
    }
  }

  /**
   * Warm cache with prefetched data
   */
  static async warmCache(userId: string, threads: any[]): Promise<void> {
    try {
      // Cache thread list
      await this.cacheThreadList(userId, 'inbox', threads, { ttl: this.THREAD_LIST_TTL });
      
      // Cache individual threads (first 10 for prefetch)
      const prefetchThreads = threads.slice(0, 10);
      await Promise.all(
        prefetchThreads.map(thread => 
          this.cacheThread(thread.id, thread, { ttl: this.DEFAULT_TTL })
        )
      );
      
      logger.info(`🔥 Warmed cache for user ${userId} with ${prefetchThreads.length} threads`);
    } catch (error) {
      logger.error({ error: error }, 'Failed to warm cache:');
    }
  }
}
