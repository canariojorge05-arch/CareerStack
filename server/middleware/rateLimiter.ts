/**
 * Comprehensive Rate Limiting Middleware
 * Multi-layered rate limiting for API protection and fair usage
 */

import { Request, Response, NextFunction } from 'express';
import { RedisRateLimiter, CACHE_PREFIXES } from '../config/redis';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip || 'unknown',
  } = config;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const windowSeconds = Math.ceil(windowMs / 1000);
      
      const { allowed, remaining, resetAt } = await RedisRateLimiter.checkLimit(
        key,
        max,
        windowSeconds
      );
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetAt.toISOString());
      
      if (!allowed) {
        logger.warn({ key, ip: req.ip, path: req.path }, 'Rate limit exceeded');
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter: resetAt,
        });
      }
      
      // Track response status if configured
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.json;
        res.json = function(data: any) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400);
          
          if (shouldSkip) {
            // Decrement counter
            RedisRateLimiter.checkLimit(key, max, windowSeconds).catch(() => {});
          }
          
          return originalSend.call(this, data);
        };
      }
      
      next();
    } catch (error) {
      logger.error({ error }, 'Rate limiter error');
      // Fail open - allow request if rate limiter fails
      next();
    }
  };
}

/**
 * Global API rate limiter (100 requests per 15 minutes per IP)
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes.',
});

/**
 * Authentication rate limiter (5 attempts per 15 minutes)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again after 15 minutes.',
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || 'unknown'}`,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Email send rate limiter (10 emails per hour per user)
 */
export const emailSendRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: 'Email sending limit reached, please try again later.',
  keyGenerator: (req) => `email:send:${(req as any).user?.id || req.ip}`,
});

/**
 * Email sync rate limiter (5 syncs per 5 minutes per account)
 */
export const emailSyncRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Email sync limit reached, please try again in a few minutes.',
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || req.ip;
    const accountId = req.body?.accountId || req.query?.accountId || 'default';
    return `email:sync:${userId}:${accountId}`;
  },
});

/**
 * Account creation rate limiter (3 accounts per day per IP)
 */
export const accountCreationRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3,
  message: 'Account creation limit reached, please try again tomorrow.',
  keyGenerator: (req) => `account:create:${req.ip}`,
  skipFailedRequests: true, // Don't count failed attempts
});

/**
 * Email account connection rate limiter (10 per hour per user)
 */
export const emailAccountConnectionRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Email account connection limit reached.',
  keyGenerator: (req) => `email:account:connect:${(req as any).user?.id || req.ip}`,
});

/**
 * Search rate limiter (30 searches per minute per user)
 */
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Search limit reached, please slow down.',
  keyGenerator: (req) => `search:${(req as any).user?.id || req.ip}`,
});

/**
 * API route rate limiter (60 requests per minute per user)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'API rate limit exceeded.',
  keyGenerator: (req) => `api:${(req as any).user?.id || req.ip}:${req.path}`,
});

/**
 * File upload rate limiter (10 uploads per hour)
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Upload limit reached.',
  keyGenerator: (req) => `upload:${(req as any).user?.id || req.ip}`,
});

/**
 * Bulk operations rate limiter (5 per 10 minutes)
 */
export const bulkOperationsRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: 'Bulk operations limit reached.',
  keyGenerator: (req) => `bulk:${(req as any).user?.id || req.ip}`,
});

/**
 * Per-account email operations rate limiter
 * Prevents abuse of individual email accounts
 */
export function createAccountRateLimiter(accountId: string) {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 operations per minute per account
    message: 'Account operation limit reached.',
    keyGenerator: (req) => `${CACHE_PREFIXES.RATE_LIMIT_ACCOUNT}${accountId}`,
  });
}

/**
 * Dynamic rate limiter based on user tier/subscription
 */
export function createTieredRateLimiter(
  getTierLimits: (user: any) => { windowMs: number; max: number }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const limits = getTierLimits(user);
      
      const rateLimiter = createRateLimiter({
        ...limits,
        keyGenerator: (req) => `tiered:${user?.id || req.ip}`,
      });
      
      return rateLimiter(req, res, next);
    } catch (error) {
      logger.error({ error }, 'Tiered rate limiter error');
      next();
    }
  };
}

/**
 * Sliding window rate limiter for more precise rate limiting
 */
export class SlidingWindowRateLimiter {
  private windowMs: number;
  private max: number;
  
  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;
  }
  
  async check(key: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const now = Date.now();
      const windowKey = `sliding:${key}`;
      
      // Use Redis sorted set for sliding window
      const redis = (await import('../config/redis')).redisClient;
      
      // Remove old entries
      await redis.zremrangebyscore(windowKey, 0, now - this.windowMs);
      
      // Count entries in current window
      const count = await redis.zcard(windowKey);
      
      if (count >= this.max) {
        return { allowed: false, remaining: 0 };
      }
      
      // Add current request
      await redis.zadd(windowKey, now, `${now}-${Math.random()}`);
      await redis.expire(windowKey, Math.ceil(this.windowMs / 1000) + 1);
      
      return { allowed: true, remaining: this.max - count - 1 };
    } catch (error) {
      logger.error({ error, key }, 'Sliding window rate limiter error');
      return { allowed: true, remaining: this.max };
    }
  }
}

/**
 * Distributed rate limiter coordinator
 * Ensures rate limits work across multiple server instances
 */
export class DistributedRateLimiter {
  private limiters: Map<string, SlidingWindowRateLimiter> = new Map();
  
  getLimiter(name: string, windowMs: number, max: number): SlidingWindowRateLimiter {
    const key = `${name}:${windowMs}:${max}`;
    if (!this.limiters.has(key)) {
      this.limiters.set(key, new SlidingWindowRateLimiter(windowMs, max));
    }
    return this.limiters.get(key)!;
  }
  
  async checkGlobalLimit(userId: string): Promise<boolean> {
    const limiter = this.getLimiter('global', 60000, 100); // 100 req/min
    const result = await limiter.check(userId);
    return result.allowed;
  }
  
  async checkEmailOperationLimit(accountId: string): Promise<boolean> {
    const limiter = this.getLimiter('email-ops', 60000, 50); // 50 ops/min per account
    const result = await limiter.check(accountId);
    return result.allowed;
  }
}

export const distributedRateLimiter = new DistributedRateLimiter();
