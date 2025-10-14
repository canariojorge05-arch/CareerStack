import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

export class EmailAccountRateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private windowMs: number = 60000,
    private maxRequests: number = 60
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetAt < now) {
        delete this.store[key];
      }
    });
  }

  checkLimit(accountId: string, userId: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const key = `${userId}:${accountId}`;
    const now = Date.now();

    if (!this.store[key] || this.store[key].resetAt < now) {
      this.store[key] = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: this.store[key].resetAt,
      };
    }

    this.store[key].count++;

    if (this.store[key].count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: this.store[key].resetAt,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - this.store[key].count,
      resetAt: this.store[key].resetAt,
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const accountId = req.body?.accountId || req.params?.accountId || req.query?.accountId;

      if (!user || !accountId) {
        return next();
      }

      const result = this.checkLimit(accountId as string, user.id);

      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

      if (!result.allowed) {
        logger.warn(`Rate limit exceeded for account ${accountId} by user ${user.id}`);
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for this email account',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        });
      }

      next();
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

export const emailAccountRateLimiter = new EmailAccountRateLimiter(
  60000,
  60
);
