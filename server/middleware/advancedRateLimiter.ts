/**
 * Advanced Rate Limiting Middleware
 * Multi-tier, per-user, per-account rate limiting with Redis backing
 */

import { Request, Response, NextFunction } from 'express';
import { RedisCache } from '../config/redis';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
}

export class AdvancedRateLimiter {
  private config: RateLimitConfig;
  private prefix: string;

  constructor(config: RateLimitConfig, prefix: string = 'ratelimit') {
    this.config = config;
    this.prefix = prefix;
  }

  /**
   * Rate limit middleware
   */
  middleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const key = this.getKey(req);
      const limit = await this.checkLimit(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.max - limit.current));
      res.setHeader('X-RateLimit-Reset', limit.resetAt);

      if (limit.exceeded) {
        const message = this.config.message || 'Too many requests, please try again later';
        
        if (this.config.handler) {
          this.config.handler(req, res);
        } else {
          res.status(429).json({
            error: 'Too Many Requests',
            message,
            retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000),
          });
        }
        return;
      }

      // Intercept response to update counter
      const originalSend = res.send;
      res.send = function (data: any) {
        const statusCode = res.statusCode;
        const shouldSkip =
          (this.config.skipSuccessfulRequests && statusCode < 400) ||
          (this.config.skipFailedRequests && statusCode >= 400);

        if (!shouldSkip) {
          // Don't await - let it run in background
          RedisCache.incr(key).catch((error) =>
            logger.error({ error }, 'Failed to update rate limit')
          );
        }

        return originalSend.call(res, data);
      }.bind(this);

      next();
    } catch (error) {
      logger.error({ error }, 'Rate limiter error');
      // Fail open - allow request if rate limiter fails
      next();
    }
  };

  /**
   * Check if limit is exceeded
   */
  private async checkLimit(
    key: string
  ): Promise<{ exceeded: boolean; current: number; resetAt: number }> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const resetAt = now + this.config.windowMs;

    // Get current count
    const current = await RedisCache.incr(key);

    // Set expiry on first request
    if (current === 1) {
      await RedisCache.set(key, current, Math.ceil(this.config.windowMs / 1000));
    }

    return {
      exceeded: current > this.config.max,
      current,
      resetAt,
    };
  }

  /**
   * Generate cache key
   */
  private getKey(req: Request): string {
    if (this.config.keyGenerator) {
      return `${this.prefix}:${this.config.keyGenerator(req)}`;
    }

    // Default: use user ID or IP
    const userId = (req as any).user?.id;
    const identifier = userId || req.ip || 'anonymous';
    return `${this.prefix}:${identifier}:${req.path}`;
  }

  /**
   * Reset limit for specific key
   */
  async resetLimit(identifier: string): Promise<void> {
    const key = `${this.prefix}:${identifier}`;
    await RedisCache.del(key);
  }
}

/**
 * Pre-configured rate limiters for different endpoints
 */

// Global API rate limiter
export const globalRateLimiter = new AdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: 'Too many requests from this IP',
});

// Authentication rate limiter (stricter)
export const authRateLimiter = new AdvancedRateLimiter(
  {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per 15 minutes
    message: 'Too many login attempts, please try again later',
    keyGenerator: (req) => {
      const email = req.body?.email || 'unknown';
      return `auth:${email}:${req.ip}`;
    },
  },
  'auth'
);

// Email sending rate limiter (per account)
export const emailSendRateLimiter = new AdvancedRateLimiter(
  {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 emails per hour per account
    message: 'Email sending limit reached for this account',
    keyGenerator: (req) => {
      const accountId = req.body?.accountId || req.params?.accountId || 'unknown';
      return `email:send:${accountId}`;
    },
  },
  'email'
);

// Email sync rate limiter (per account)
export const emailSyncRateLimiter = new AdvancedRateLimiter(
  {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 syncs per 5 minutes per account
    message: 'Email sync limit reached, please wait',
    keyGenerator: (req) => {
      const accountId = req.body?.accountId || req.params?.accountId || 'unknown';
      return `email:sync:${accountId}`;
    },
  },
  'sync'
);

// API key rate limiter (for API access)
export const apiKeyRateLimiter = new AdvancedRateLimiter(
  {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5000, // 5000 requests per hour
    message: 'API rate limit exceeded',
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'] as string;
      return `api:${apiKey || 'anonymous'}`;
    },
  },
  'api'
);

// Upload rate limiter
export const uploadRateLimiter = new AdvancedRateLimiter(
  {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 uploads per 15 minutes
    message: 'Upload limit reached, please wait',
  },
  'upload'
);

/**
 * Account-specific rate limiter factory
 */
export function createAccountRateLimiter(
  accountId: string,
  max: number,
  windowMs: number
): AdvancedRateLimiter {
  return new AdvancedRateLimiter(
    {
      windowMs,
      max,
      message: `Rate limit exceeded for account ${accountId}`,
      keyGenerator: () => accountId,
    },
    `account:${accountId}`
  );
}

/**
 * Dynamic rate limiter based on user tier/subscription
 */
export function tieredRateLimiter(
  baseLimits: Record<string, number>
) {
  return new AdvancedRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // Default max
    keyGenerator: (req) => {
      const userId = (req as any).user?.id || 'anonymous';
      const userTier = (req as any).user?.tier || 'free';
      return `tier:${userTier}:${userId}`;
    },
  });
}

/**
 * Burst protection rate limiter
 */
export const burstProtectionLimiter = new AdvancedRateLimiter({
  windowMs: 1000, // 1 second
  max: 10, // 10 requests per second
  message: 'Request burst detected, please slow down',
});

/**
 * Per-user comprehensive rate limiter
 */
export function createUserRateLimiter(userId: string) {
  return {
    // Email operations
    emailSend: new AdvancedRateLimiter(
      {
        windowMs: 60 * 60 * 1000,
        max: 100,
        keyGenerator: () => `user:${userId}:email:send`,
      },
      'user'
    ),
    
    // Email sync
    emailSync: new AdvancedRateLimiter(
      {
        windowMs: 5 * 60 * 1000,
        max: 10,
        keyGenerator: () => `user:${userId}:email:sync`,
      },
      'user'
    ),
    
    // Email search
    emailSearch: new AdvancedRateLimiter(
      {
        windowMs: 60 * 1000,
        max: 30,
        keyGenerator: () => `user:${userId}:email:search`,
      },
      'user'
    ),
    
    // API calls
    api: new AdvancedRateLimiter(
      {
        windowMs: 60 * 60 * 1000,
        max: 1000,
        keyGenerator: () => `user:${userId}:api`,
      },
      'user'
    ),
  };
}

/**
 * Middleware to apply multiple rate limiters in sequence
 */
export function multiRateLimiter(...limiters: AdvancedRateLimiter[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const limiter of limiters) {
      await new Promise<void>((resolve, reject) => {
        limiter.middleware(req, res, (error) => {
          if (error) reject(error);
          else if (res.headersSent) reject(new Error('Rate limit exceeded'));
          else resolve();
        });
      }).catch(() => {
        // Rate limit exceeded, response already sent
        return;
      });
      
      if (res.headersSent) return;
    }
    
    next();
  };
}
