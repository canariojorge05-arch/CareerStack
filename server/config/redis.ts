/**
 * Redis Configuration for Caching and Session Management
 * Production-ready Redis setup with clustering support
 */

import Redis, { RedisOptions, Cluster } from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CLUSTER = process.env.REDIS_CLUSTER === 'true';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Redis configuration optimized for high throughput
const redisConfig: RedisOptions = {
  // Connection settings
  lazyConnect: false,
  keepAlive: 30000,
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  
  // Reconnection strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.warn({ times, delay }, 'Redis reconnecting...');
    return delay;
  },
  
  // Connection pool
  enableOfflineQueue: true,
  enableReadyCheck: true,
  
  // Performance optimizations
  commandTimeout: 5000,
  
  // Authentication
  password: REDIS_PASSWORD,
};

// Create Redis clients
let redisClient: Redis | Cluster;
let redisPubClient: Redis | Cluster;
let redisSubClient: Redis | Cluster;

if (REDIS_CLUSTER) {
  // Redis Cluster mode for high availability
  const clusterNodes = process.env.REDIS_CLUSTER_NODES?.split(',').map(node => {
    const [host, port] = node.split(':');
    return { host, port: parseInt(port) };
  }) || [{ host: 'localhost', port: 6379 }];
  
  redisClient = new Redis.Cluster(clusterNodes, {
    redisOptions: redisConfig,
    clusterRetryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });
  
  redisPubClient = new Redis.Cluster(clusterNodes, { redisOptions: redisConfig });
  redisSubClient = new Redis.Cluster(clusterNodes, { redisOptions: redisConfig });
} else {
  // Single Redis instance (for development or small scale)
  redisClient = new Redis(REDIS_URL, redisConfig);
  redisPubClient = new Redis(REDIS_URL, redisConfig);
  redisSubClient = new Redis(REDIS_URL, redisConfig);
}

// Event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});

redisClient.on('close', () => {
  logger.warn('Redis client connection closed');
});

redisClient.on('reconnecting', (ms) => {
  logger.info({ reconnectDelay: ms }, 'Redis client reconnecting');
});

// Cache key prefixes for organization
export const CACHE_PREFIXES = {
  EMAIL: 'email:',
  EMAIL_THREAD: 'email:thread:',
  EMAIL_MESSAGE: 'email:message:',
  EMAIL_ACCOUNT: 'email:account:',
  USER: 'user:',
  SESSION: 'session:',
  RATE_LIMIT: 'ratelimit:',
  RATE_LIMIT_ACCOUNT: 'ratelimit:account:',
  OAUTH_TOKEN: 'oauth:token:',
  OAUTH_STATE: 'oauth:state:',
  QUEUE: 'queue:',
  LOCK: 'lock:',
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
  WEEK: 604800, // 7 days
  OAUTH_TOKEN: 3300, // 55 minutes (tokens expire in 1 hour)
  OAUTH_STATE: 600, // 10 minutes
} as const;

/**
 * Cache Service with automatic JSON serialization
 */
export class CacheService {
  /**
   * Get value from cache
   */
  static async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value as any;
      }
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }
  
  /**
   * Set value in cache with TTL
   */
  static async set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<boolean> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await redisClient.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Cache set error');
      return false;
    }
  }
  
  /**
   * Delete key from cache
   */
  static async del(key: string | string[]): Promise<boolean> {
    try {
      await redisClient.del(...(Array.isArray(key) ? key : [key]));
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
      return false;
    }
  }
  
  /**
   * Delete keys matching pattern
   */
  static async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;
      await redisClient.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error({ error, pattern }, 'Cache delete pattern error');
      return 0;
    }
  }
  
  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Cache exists error');
      return false;
    }
  }
  
  /**
   * Increment counter
   */
  static async incr(key: string, ttl?: number): Promise<number> {
    try {
      const value = await redisClient.incr(key);
      if (ttl && value === 1) {
        await redisClient.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error({ error, key }, 'Cache incr error');
      return 0;
    }
  }
  
  /**
   * Get multiple keys
   */
  static async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];
      const values = await redisClient.mget(...keys);
      return values.map(val => {
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch {
          return val as any;
        }
      });
    } catch (error) {
      logger.error({ error, keys }, 'Cache mget error');
      return keys.map(() => null);
    }
  }
  
  /**
   * Set multiple keys
   */
  static async mset(items: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      const pipeline = redisClient.pipeline();
      
      for (const [key, value] of Object.entries(items)) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttl) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error({ error, items }, 'Cache mset error');
      return false;
    }
  }
  
  /**
   * Get or set with callback (cache-aside pattern)
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    
    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }
  
  /**
   * Distributed lock for preventing race conditions
   */
  static async acquireLock(
    lockKey: string,
    ttl: number = 10,
    retries: number = 3
  ): Promise<string | null> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    for (let i = 0; i < retries; i++) {
      try {
        const result = await redisClient.set(
          `${CACHE_PREFIXES.LOCK}${lockKey}`,
          lockValue,
          'EX',
          ttl,
          'NX'
        );
        
        if (result === 'OK') return lockValue;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      } catch (error) {
        logger.error({ error, lockKey }, 'Lock acquire error');
      }
    }
    
    return null;
  }
  
  /**
   * Release distributed lock
   */
  static async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    try {
      // Lua script to ensure atomic release
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await redisClient.eval(
        script,
        1,
        `${CACHE_PREFIXES.LOCK}${lockKey}`,
        lockValue
      );
      
      return result === 1;
    } catch (error) {
      logger.error({ error, lockKey }, 'Lock release error');
      return false;
    }
  }
  
  /**
   * Flush all cache (use with caution!)
   */
  static async flushAll(): Promise<boolean> {
    try {
      if (NODE_ENV === 'production') {
        logger.warn('Attempted to flush cache in production');
        return false;
      }
      await redisClient.flushall();
      return true;
    } catch (error) {
      logger.error({ error }, 'Cache flush error');
      return false;
    }
  }
  
  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    keysCount: number;
    memoryUsed: string;
    hits: number;
    misses: number;
    connected: boolean;
  }> {
    try {
      const info = await redisClient.info('stats');
      const memory = await redisClient.info('memory');
      const dbsize = await redisClient.dbsize();
      
      const parseInfo = (infoStr: string, key: string): string => {
        const match = infoStr.match(new RegExp(`${key}:(.+)`));
        return match ? match[1] : '0';
      };
      
      return {
        keysCount: dbsize,
        memoryUsed: parseInfo(memory, 'used_memory_human'),
        hits: parseInt(parseInfo(info, 'keyspace_hits')),
        misses: parseInt(parseInfo(info, 'keyspace_misses')),
        connected: redisClient.status === 'ready',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get cache stats');
      return {
        keysCount: 0,
        memoryUsed: '0B',
        hits: 0,
        misses: 0,
        connected: false,
      };
    }
  }
}

/**
 * Rate Limiter using Redis
 */
export class RedisRateLimiter {
  /**
   * Check and increment rate limit
   */
  static async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const now = Date.now();
      const windowKey = `${CACHE_PREFIXES.RATE_LIMIT}${key}:${Math.floor(now / (windowSeconds * 1000))}`;
      
      const current = await CacheService.incr(windowKey, windowSeconds + 5);
      
      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const resetAt = new Date(Math.ceil(now / (windowSeconds * 1000)) * windowSeconds * 1000);
      
      return { allowed, remaining, resetAt };
    } catch (error) {
      logger.error({ error, key }, 'Rate limit check error');
      // Fail open in case of Redis error
      return { allowed: true, remaining: limit, resetAt: new Date() };
    }
  }
  
  /**
   * Reset rate limit for a key
   */
  static async reset(key: string): Promise<void> {
    await CacheService.delPattern(`${CACHE_PREFIXES.RATE_LIMIT}${key}:*`);
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  try {
    logger.info('Closing Redis connections...');
    await Promise.all([
      redisClient.quit(),
      redisPubClient.quit(),
      redisSubClient.quit(),
    ]);
    logger.info('Redis connections closed successfully');
  } catch (error) {
    logger.error({ error }, 'Error closing Redis connections');
  }
}

// Export Redis clients
export { redisClient, redisPubClient, redisSubClient };
export default CacheService;
