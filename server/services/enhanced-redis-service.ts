import Redis from 'ioredis';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { Readable } from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
}

interface CacheMetadata {
  hash: string;
  size: number;
  compressed: boolean;
  timestamp: number;
  contentType?: string;
}

class EnhancedRedisService {
  private client: Redis;
  private isReady = false;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      reconnectOnError: (err: Error) => err.message.includes('READONLY'),
      // Performance optimizations
      connectTimeout: 5000,
      commandTimeout: 2000,
      lazyConnect: true,
      keepAlive: 30000,
      // Connection pool settings
      family: 4, // Force IPv4
      db: 0,
    });

    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    this.client
      .on('ready', () => {
        this.isReady = true;
        logger.info('Enhanced Redis service ready');
      })
      .on('error', (err) => {
        logger.error('Enhanced Redis error: ' + (err instanceof Error ? err.message : String(err)));
      })
      .on('close', () => {
        this.isReady = false;
        logger.warn('Enhanced Redis connection closed');
      });
  }

  /**
   * Generate SHA256 hash for cache key
   */
  generateHash(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate cache key with namespace and hash
   */
  generateCacheKey(data: string | Buffer, namespace: string = 'default', options: any = {}): string {
    const hash = this.generateHash(Buffer.concat([
      Buffer.isBuffer(data) ? data : Buffer.from(data),
      Buffer.from(JSON.stringify(options))
    ]));
    return `${namespace}:${hash}`;
  }

  /**
   * Set data in cache with compression and metadata
   */
  async set(key: string, data: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const {
        ttl = 3600, // 1 hour default
        compress = true,
        namespace = 'cache'
      } = options;

      let serializedData = JSON.stringify(data);
      let finalData = Buffer.from(serializedData);
      let isCompressed = false;

      // Compress large data
      if (compress && finalData.length > 1024) { // Compress if > 1KB
        finalData = Buffer.from(await gzip(finalData));
        isCompressed = true;
      }

      const metadata: CacheMetadata = {
        hash: this.generateHash(serializedData),
        size: finalData.length,
        compressed: isCompressed,
        timestamp: Date.now(),
        contentType: typeof data === 'string' ? 'text' : 'json'
      };

      const cacheKey = namespace ? `${namespace}:${key}` : key;
      const metaKey = `${cacheKey}:meta`;

      // Use pipeline for atomic operations
      const pipeline = this.client.pipeline();
      pipeline.setex(cacheKey, ttl, finalData);
      pipeline.setex(metaKey, ttl, JSON.stringify(metadata));
      
      
      logger.debug(`Cached data: ${cacheKey} (${finalData.length} bytes, compressed: ${isCompressed})`);
      return true;

    } catch (error) {
      logger.error('Enhanced Redis error: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * Get data from cache with decompression
{{ ... }}
   */
  async get(key: string, namespace: string = 'cache'): Promise<any> {
    try {
      const cacheKey = namespace ? `${namespace}:${key}` : key;
      const metaKey = `${cacheKey}:meta`;

      const [data, metaData] = await Promise.all([
        this.client.getBuffer(cacheKey),
        this.client.get(metaKey)
      ]);

      if (!data || !metaData) {
        return null;
      }

      const metadata: CacheMetadata = JSON.parse(metaData);
      let finalData = data;

      // Decompress if needed
      if (metadata.compressed) {
        finalData = await gunzip(data);
      }

      const result = JSON.parse(finalData.toString());
      
      logger.debug(`Cache hit: ${cacheKey} (${data.length} bytes, compressed: ${metadata.compressed})`);
      return result;

    } catch (error) {
      logger.error('Cache get error: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  /**
   * Check if cached data exists and is valid
   */
  async exists(key: string, namespace: string = 'cache'): Promise<boolean> {
    try {
      const cacheKey = namespace ? `${namespace}:${key}` : key;
      const exists = await this.client.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists check error: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async del(key: string, namespace: string = 'cache'): Promise<boolean> {
    try {
      const cacheKey = namespace ? `${namespace}:${key}` : key;
      const metaKey = `${cacheKey}:meta`;
      
      const pipeline = this.client.pipeline();
      pipeline.del(cacheKey);
      pipeline.del(metaKey);
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache delete error: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * Set with expiration time
   */
  async setex(key: string, ttl: number, data: any, options: Omit<CacheOptions, 'ttl'> = {}): Promise<boolean> {
    return this.set(key, data, { ...options, ttl });
  }

  /**
   * Get cache metadata
   */
  async getMeta(key: string, namespace: string = 'cache'): Promise<CacheMetadata | null> {
    try {
      const cacheKey = namespace ? `${namespace}:${key}` : key;
      const metaKey = `${cacheKey}:meta`;
      
      const metaData = await this.client.get(metaKey);
      return metaData ? JSON.parse(metaData) : null;
    } catch (error) {
      logger.error('Cache metadata get error: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        connected: this.isReady
      };
    } catch (error) {
      logger.error('Cache stats error: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.del(key));
      
      await pipeline.exec();
      return keys.length;
    } catch (error) {
      logger.error('Cache clear by pattern error: ' + (error instanceof Error ? error.message : String(error)));
      return 0;
    }
  }

  /**
   * Stream large data to cache
   */
  async setStream(key: string, stream: Readable, options: CacheOptions = {}): Promise<boolean> {
    try {
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks);
      return this.set(key, data.toString('base64'), options);
    } catch (error) {
      logger.error('Cache stream set error: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * Get stream from cache
   */
  async getStream(key: string, namespace: string = 'cache'): Promise<Readable | null> {
    try {
      const data = await this.get(key, namespace);
      if (!data) return null;
      
      const buffer = Buffer.from(data, 'base64');
      return Readable.from(buffer);
    } catch (error) {
      logger.error('Cache stream get error: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  private parseRedisInfo(info: string): any {
    const result: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      logger.error('Redis cleanup error: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  getClient() {
    return this.client;
  }
}

// Specialized cache services
// ConversionCache removed - no longer needed with SuperDoc direct editing

class DocumentCache {
  constructor(private redis: EnhancedRedisService) {}

  async cacheDocument(userId: string, documentId: string, content: any, ttl: number = 86400): Promise<boolean> {
    const key = `doc:${userId}:${documentId}`;
    return this.redis.set(key, content, {
      ttl,
      namespace: 'documents',
      compress: true
    });
  }

  async getDocument(userId: string, documentId: string): Promise<any> {
    const key = `doc:${userId}:${documentId}`;
    return this.redis.get(key, 'documents');
  }

  async deleteDocument(userId: string, documentId: string): Promise<boolean> {
    const key = `doc:${userId}:${documentId}`;
    return this.redis.del(key, 'documents');
  }

  async getUserDocuments(userId: string): Promise<string[]> {
    try {
      const pattern = `documents:doc:${userId}:*`;
      return await this.redis.getClient().keys(pattern);
    } catch (error) {
      logger.error('Get user documents error: ' + (error instanceof Error ? error.message : String(error)));
      return [];
    }
  }
}

// Export enhanced Redis service and specialized caches
export const enhancedRedisService = new EnhancedRedisService();
// conversionCache removed - no longer needed with SuperDoc
export const documentCache = new DocumentCache(enhancedRedisService);

// Backward compatibility
export const redisService = {
  get: (key: string) => enhancedRedisService.get(key),
  set: (key: string, value: any) => enhancedRedisService.set(key, value),
  setex: (key: string, ttl: number, value: any) => enhancedRedisService.setex(key, ttl, value),
  del: (key: string) => enhancedRedisService.del(key),
  exists: (key: string) => enhancedRedisService.exists(key),
  isHealthy: () => enhancedRedisService.isHealthy(),
  cleanup: () => enhancedRedisService.cleanup()
};
