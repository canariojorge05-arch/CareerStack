import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { users } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { sessionCache, apiCache } from '../services/redis';
import { rateLimiter } from '../services/redis-examples';
import { logger } from '../utils/logger';

// Enforce JWT_SECRET from environment - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.');
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      // Add other user properties as needed
    }
    
    interface Request {
      user?: User;
    }
  }
}

// Enhanced JWT Authentication with Redis Session Cache
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  try {
    // First check Redis cache for session
    const cachedUser = await sessionCache.get(`jwt:${token}`);
    if (cachedUser) {
      req.user = cachedUser;
      logger.debug({ userId: cachedUser.id }, 'User session cache hit');
      return next();
    }

    // Verify JWT if not in cache
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        logger.warn({ error: err.message }, 'JWT verification failed');
        return res.status(403).json({ message: 'Invalid token' });
      }
      
      try {
        // Check if user exists and is active
        const user = await db.query.users.findFirst({
          where: (users, { eq, and, isNull, or, lt }) => 
            and(
              eq(users.id, (decoded as any).userId),
              or(
                isNull(users.accountLockedUntil),
                lt(users.accountLockedUntil as any, new Date())
              )
            ),
          columns: {
            id: true,
            email: true,
            emailVerified: true,
            twoFactorEnabled: true,
          },
        });
        
        if (!user) {
          logger.warn({ userId: (decoded as any).userId }, 'User not found or account is locked');
          return res.status(401).json({ message: 'User not found or account is locked' });
        }
        
        // Cache user session for 15 minutes
        await sessionCache.set(`jwt:${token}`, user);
        logger.debug({ userId: user.id }, 'User session cached');
        
        // Attach user to request
        req.user = user;
        next();
      } catch (error) {
        logger.error({ error }, 'Authentication database error');
        res.status(500).json({ message: 'Authentication failed' });
      }
    });
  } catch (error) {
    logger.error({ error }, 'Authentication error');
    res.status(500).json({ message: 'Authentication failed' });
  }
};

// Role-based access control middleware
export const requireRole = (allowedRoles: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user?.id) {
        logger.warn({ path: req.path }, 'Unauthorized access attempt - no user');
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      // Get user with role from database
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.id),
        columns: {
          id: true,
          email: true,
          role: true
        }
      });

      if (!user) {
        logger.warn({ userId: req.user.id }, 'User not found for role check');
        return res.status(401).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Normalize allowed roles to array
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Check if user's role is in allowed roles
      if (!user.role || !roles.includes(user.role)) {
        logger.warn({ 
          userId: user.id, 
          userRole: user.role, 
          allowedRoles: roles,
          path: req.path 
        }, 'Access denied - insufficient permissions');
        
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
          requiredRole: roles,
          currentRole: user.role || 'none'
        });
      }

      // Attach role to request for use in handlers
      (req.user as any).role = user.role;

      logger.debug({ 
        userId: user.id, 
        role: user.role, 
        path: req.path 
      }, 'Role check passed');

      next();
    } catch (error) {
      logger.error({ error, path: req.path }, 'Role check error');
      res.status(500).json({ 
        message: 'Authorization check failed',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Check if user is authenticated using session-based auth
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated via session
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // If no session auth, return 401
  res.status(401).json({ 
    message: 'Authentication required',
    category: 'auth',
    recoverable: true,
    details: 'Please log in to access this resource'
  });
};

// Check if user has verified email
export const requireVerifiedEmail = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      columns: {
        emailVerified: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.emailVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email address',
        requiresVerification: true,
      });
    }
    
    next();
  } catch (error) {
    logger.error({ error }, 'Email verification check error');
    res.status(500).json({ message: 'Failed to verify email status' });
  }
};

// Redis-backed rate limiting middleware
export const rateLimit = (options: { windowMs?: number; max?: number; keyGenerator?: (req: Request) => string }) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const windowSeconds = Math.floor((options.windowMs || 15 * 60 * 1000) / 1000); // Convert to seconds
    const max = options.max || 100;
    const keyGenerator = options.keyGenerator || ((req: Request) => req.ip || 'unknown');
    const key = keyGenerator(req);
    
    try {
      const allowed = await rateLimiter.isAllowed(key, max, windowSeconds);
      
      // Set rate limit headers (approximate - Redis doesn't give us exact remaining count easily)
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Window': windowSeconds.toString(),
      });
      
      if (!allowed) {
        res.set('Retry-After', windowSeconds.toString());
        logger.warn({ key, max, windowSeconds }, 'Rate limit exceeded');
        return res.status(429).json({
          message: 'Too many requests, please try again later',
          retryAfter: windowSeconds,
        });
      }
      
      next();
    } catch (error) {
      // If Redis fails, log but don't block requests (fail open)
      logger.error({ error, key }, 'Rate limiting error - allowing request');
      next();
    }
  };
};

// Session invalidation helper
export const invalidateSession = async (token: string): Promise<void> => {
  try {
    await sessionCache.del(`jwt:${token}`);
    logger.info('Session invalidated');
  } catch (error) {
    logger.error({ error }, 'Failed to invalidate session');
  }
};

// API response caching middleware
export const cacheApiResponse = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `api:${req.originalUrl}:${req.user?.id || 'anonymous'}`;
    
    try {
      const cachedResponse = await apiCache.get(cacheKey);
      if (cachedResponse) {
        logger.debug({ cacheKey }, 'API response cache hit');
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }

      // Capture response to cache it
      const originalSend = res.json;
      res.json = function(data: any) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          apiCache.set(cacheKey, data, ttl).catch(error => {
            logger.error({ error, cacheKey }, 'Failed to cache API response');
          });
        }
        res.set('X-Cache', 'MISS');
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error({ error, cacheKey }, 'API cache error');
      next();
    }
  };
};
