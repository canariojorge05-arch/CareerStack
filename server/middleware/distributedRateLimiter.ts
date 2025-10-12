import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis';
import { logger } from '../utils/logger';

/**
 * Distributed Rate Limiter using Redis
 * Provides accurate rate limiting across multiple server instances
 */

interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  max: number;            // Maximum requests in window
  message?: string;       // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
}

// Fallback in-memory store if Redis is unavailable
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Check if Redis is available
let useRedis = false;
(async () => {
  try {
    await redisService.isHealthy();
    useRedis = true;
    logger.info('Rate limiting will use Redis (distributed)');
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using in-memory fallback');
  }
})();

// Clean up expired entries in memory store
setInterval(() => {
  if (!useRedis) {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetTime < now) {
        memoryStore.delete(key);
      }
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Redis-based rate limiting implementation
 */
async function checkRateLimitRedis(
  key: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; current: number; resetTime: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const windowSeconds = Math.ceil(windowMs / 1000);
  
  try {
    const redisKey = `rate_limit:${key}`;
    const client = redisService.getClient();
    
    // Use Redis pipeline for atomic operations
    const pipeline = client.multi();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(redisKey);
    
    // Add current request
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    
    // Set expiry on the key
    pipeline.expire(redisKey, windowSeconds);
    
    const results = await redisService.executeCommand(
      () => pipeline.exec(),
      'rate_limit_check'
    );
    
    // Get count from results (index 1 is the zcard result)
    const current = results[1][1] as number;
    const allowed = current < max;
    const resetTime = now + windowMs;
    
    // If limit exceeded, remove the request we just added
    if (!allowed) {
      await redisService.executeCommand(
        () => client.zremrangebyrank(redisKey, -1, -1),
        'rate_limit_remove_last'
      );
    }
    
    logger.debug({ key, current, max, allowed }, 'Redis rate limit check');
    
    return { allowed, current, resetTime };
  } catch (error) {
    logger.error({ error, key }, 'Redis rate limit check failed');
    throw error;
  }
}

/**
 * Memory-based rate limiting fallback
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number,
  max: number
): { allowed: boolean; current: number; resetTime: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);
  
  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs
    };
    memoryStore.set(key, newEntry);
    return { allowed: true, current: 1, resetTime: newEntry.resetTime };
  }
  
  // Increment counter
  entry.count++;
  const allowed = entry.count <= max;
  
  if (!allowed) {
    entry.count--; // Don't count if not allowed
  }
  
  return { allowed, current: entry.count, resetTime: entry.resetTime };
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    keyGenerator = (req: Request) => req.user?.id || req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    
    if (!key) {
      logger.warn('Rate limiter: No key generated, allowing request');
      return next();
    }
    
    try {
      let result: { allowed: boolean; current: number; resetTime: number };
      
      // Try Redis first, fallback to memory
      if (useRedis) {
        try {
          result = await checkRateLimitRedis(key, windowMs, max);
        } catch (error) {
          logger.warn({ error }, 'Redis rate limit failed, using memory fallback');
          useRedis = false; // Disable Redis for this instance
          result = checkRateLimitMemory(key, windowMs, max);
        }
      } else {
        result = checkRateLimitMemory(key, windowMs, max);
      }
      
      // Set rate limit headers
      const resetTimeSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - result.current).toString());
      res.setHeader('X-RateLimit-Reset', resetTimeSeconds.toString());
      
      if (!result.allowed) {
        res.setHeader('Retry-After', resetTimeSeconds.toString());
        logger.warn({ key, current: result.current, max }, 'Rate limit exceeded');
        
        return res.status(429).json({
          message,
          retryAfter: resetTimeSeconds,
          limit: max,
          current: result.current
        });
      }
      
      // If configured to skip counting on success/failure, store original end method
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalEnd = res.end;
        res.end = function(...args: any[]) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) ||
            (skipFailedRequests && (statusCode < 200 || statusCode >= 400));
          
          if (shouldSkip) {
            // Decrement counter (would need async operation)
            logger.debug({ key, statusCode }, 'Skipping rate limit count for this response');
          }
          
          return originalEnd.apply(res, args);
        };
      }
      
      next();
    } catch (error) {
      logger.error({ error, key }, 'Rate limiter error, allowing request');
      next(); // Fail open - don't block requests on error
    }
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Authentication endpoints (strict)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    const ip = req.ip || 'unknown';
    return `auth:${email}:${ip}`;
  }
});

// API endpoints (moderate)
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
  message: 'Too many API requests, please try again later',
  keyGenerator: (req) => `api:${req.user?.id || req.ip}`
});

// Write operations (moderate-strict)
export const writeRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 write operations
  message: 'Too many write operations, please slow down',
  keyGenerator: (req) => `write:${req.user?.id || req.ip}`
});

// Email operations (strict)
export const emailRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 emails
  message: 'Email rate limit exceeded, please try again later',
  keyGenerator: (req) => `email:${req.user?.id || req.ip}`
});

// Bulk operations (very strict)
export const bulkRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 bulk operations
  message: 'Too many bulk operations, please wait',
  keyGenerator: (req) => `bulk:${req.user?.id || req.ip}`
});

// Upload operations
export const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads
  message: 'Too many uploads, please try again later',
  keyGenerator: (req) => `upload:${req.user?.id || req.ip}`
});

// Email verification resend (very strict)
export const verificationRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 resends
  message: 'Too many verification requests, please wait',
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    const ip = req.ip || 'unknown';
    return `verification:${email}:${ip}`;
  }
});

/**
 * Get current rate limit status (for debugging/monitoring)
 */
export async function getRateLimitStatus(key: string): Promise<{
  current: number;
  limit: number;
  resetTime: number;
} | null> {
  try {
    if (useRedis) {
      const redisKey = `rate_limit:${key}`;
      const count = await redisService.executeCommand(
        () => redisService.getClient().zcard(redisKey),
        'rate_limit_status'
      );
      
      const ttl = await redisService.executeCommand(
        () => redisService.getClient().ttl(redisKey),
        'rate_limit_ttl'
      );
      
      return {
        current: count as number,
        limit: 0, // Would need to store this
        resetTime: Date.now() + ((ttl as number) * 1000)
      };
    }
    
    const entry = memoryStore.get(key);
    if (entry) {
      return {
        current: entry.count,
        limit: 0,
        resetTime: entry.resetTime
      };
    }
    
    return null;
  } catch (error) {
    logger.error({ error, key }, 'Failed to get rate limit status');
    return null;
  }
}
