import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Global rate limiter for all marketing routes
export const marketingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per window
  message: { 
    message: 'Too many requests from this user, please try again later',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use user ID for authenticated rate limiting
  keyGenerator: (req: any) => {
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting in test/development if needed
    return process.env.NODE_ENV === 'test';
  },
  handler: (req, res) => {
    logger.warn(`⚠️ Rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json({
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(15 * 60), // seconds
    });
  },
});

// Stricter rate limit for create/update/delete operations
export const writeOperationsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Max 50 write operations per 5 minutes per user
  message: { 
    message: 'Too many write operations, please slow down',
    retryAfter: 5 * 60 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn(`⚠️ Write rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json({
      message: 'Too many write operations. Please wait before creating more records.',
      retryAfter: Math.ceil(5 * 60),
    });
  },
});

// Very strict rate limit for bulk operations
export const bulkOperationsRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Max 10 bulk operations per 10 minutes
  message: { 
    message: 'Too many bulk operations, please wait',
    retryAfter: 10 * 60 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn(`⚠️ Bulk operations rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json({
      message: 'Too many bulk operations. Please wait before performing more bulk actions.',
      retryAfter: Math.ceil(10 * 60),
    });
  },
});

// Email sending rate limiter (if not already handled elsewhere)
export const emailRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Max 100 emails per hour
  message: { 
    message: 'Email rate limit exceeded',
    retryAfter: 60 * 60 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn(`⚠️ Email rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json({
      message: 'Email sending limit exceeded. Please try again later.',
      retryAfter: Math.ceil(60 * 60),
    });
  },
});
