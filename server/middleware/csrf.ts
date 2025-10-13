import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redisService } from '../services/redis';
import { logger } from '../utils/logger';

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 * Uses Redis for distributed token storage (fallback to memory)
 */

// Fallback in-memory store if Redis is unavailable
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

// Token expiry: 1 hour
const TOKEN_EXPIRY = 60 * 60 * 1000;
const TOKEN_EXPIRY_SECONDS = 3600; // For Redis

// Check if Redis is available
let useRedis = false;
(async () => {
  try {
    await redisService.isHealthy();
    useRedis = true;
    logger.info('CSRF tokens will use Redis storage');
  } catch (error) {
    logger.warn('Redis not available for CSRF tokens, using in-memory fallback');
  }
})();

// Clean up expired tokens every 5 minutes (only for memory fallback)
setInterval(() => {
  if (!useRedis) {
    const now = Date.now();
    for (const [sessionId, data] of csrfTokens.entries()) {
      if (data.expiresAt < now) {
        csrfTokens.delete(sessionId);
      }
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a CSRF token for the session
 */
export async function generateCSRFToken(req: Request): Promise<string> {
  const sessionId = req.session?.id || req.sessionID;
  
  if (!sessionId) {
    throw new Error('Session not found - CSRF protection requires sessions');
  }
  
  const redisKey = `csrf:${sessionId}`;
  
  try {
    if (useRedis) {
      // Try to get existing token from Redis
      const existingToken = await redisService.executeCommand(
        () => redisService.getClient().get(redisKey),
        'csrf_get_token'
      );
      
      if (existingToken && typeof existingToken === 'string') {
        return existingToken;
      }
      
      // Generate new token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Store in Redis with expiry
      await redisService.executeCommand(
        () => redisService.getClient().setex(redisKey, TOKEN_EXPIRY_SECONDS, token),
        'csrf_set_token'
      );
      
      logger.debug({ sessionId }, 'CSRF token generated and stored in Redis');
      return token;
    }
  } catch (error) {
    logger.warn({ error, sessionId }, 'Redis operation failed for CSRF token, using memory fallback');
    useRedis = false; // Fallback to memory for this instance
  }
  
  // Fallback to in-memory storage
  const existing = csrfTokens.get(sessionId);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.token;
  }
  
  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  
  csrfTokens.set(sessionId, { token, expiresAt });
  
  return token;
}

/**
 * Validate CSRF token from request
 */
export async function validateCSRFToken(req: Request, token: string): Promise<boolean> {
  const sessionId = req.session?.id || req.sessionID;
  
  logger.debug({ sessionId, tokenProvided: !!token, tokenLength: token?.length }, 'Starting CSRF validation');
  
  if (!sessionId) {
    logger.warn('No session ID found for CSRF validation');
    return false;
  }
  
  if (!token) {
    logger.warn({ sessionId }, 'No token provided for CSRF validation');
    return false;
  }
  
  const redisKey = `csrf:${sessionId}`;
  
  try {
    if (useRedis) {
      logger.debug({ sessionId, redisKey }, 'Attempting Redis CSRF validation');
      
      // Get token from Redis
      const storedToken = await redisService.executeCommand(
        () => redisService.getClient().get(redisKey),
        'csrf_validate_token'
      );
      
      logger.debug({ sessionId, hasStoredToken: !!storedToken, storedTokenType: typeof storedToken }, 'Redis token lookup result');
      
      if (!storedToken || typeof storedToken !== 'string') {
        logger.debug({ sessionId }, 'CSRF token not found in Redis');
        return false;
      }
      
      // Constant-time comparison to prevent timing attacks
      // Ensure both tokens are the same length to avoid crypto.timingSafeEqual errors
      if (token.length !== storedToken.length) {
        logger.debug({ sessionId, tokenLength: token.length, storedLength: storedToken.length }, 'CSRF token length mismatch');
        return false;
      }
      
      try {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(token),
          Buffer.from(storedToken)
        );
        
        logger.debug({ sessionId, isValid }, 'CSRF token validated from Redis');
        return isValid;
      } catch (compareError) {
        logger.error({ error: compareError, sessionId }, 'Error in crypto.timingSafeEqual');
        return false;
      }
    }
  } catch (error) {
    logger.warn({ error, sessionId }, 'Redis validation failed for CSRF token, using memory fallback');
    useRedis = false; // Fallback to memory
  }
  
  // Fallback to in-memory storage
  logger.debug({ sessionId }, 'Using memory fallback for CSRF validation');
  
  const stored = csrfTokens.get(sessionId);
  
  if (!stored) {
    logger.debug({ sessionId, availableKeys: Array.from(csrfTokens.keys()) }, 'CSRF token not found in memory');
    return false;
  }
  
  // Check if token is expired
  if (stored.expiresAt < Date.now()) {
    logger.debug({ sessionId }, 'CSRF token expired in memory');
    csrfTokens.delete(sessionId);
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  // Ensure both tokens are the same length to avoid crypto.timingSafeEqual errors
  if (token.length !== stored.token.length) {
    logger.debug({ sessionId, tokenLength: token.length, storedLength: stored.token.length }, 'CSRF token length mismatch (memory)');
    return false;
  }
  
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(stored.token)
    );
    
    logger.debug({ sessionId, isValid }, 'CSRF token validated from memory');
    return isValid;
  } catch (compareError) {
    logger.error({ error: compareError, sessionId }, 'Error in crypto.timingSafeEqual (memory)');
    return false;
  }
}

/**
 * Middleware to add CSRF token to response
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  generateCSRFToken(req)
    .then((token) => {
      // Add to response locals so views can access it
      res.locals.csrfToken = token;
      
      // Add to response header for SPA consumption
      res.setHeader('X-CSRF-Token', token);
      
      // Set as cookie so frontend JavaScript can access it
      res.cookie('csrf_token', token, {
        httpOnly: false, // Must be false so JavaScript can read it
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // Prevent CSRF attacks
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/', // Available across entire site
      });
      
      next();
    })
    .catch((error) => {
      logger.error({ error }, 'CSRF token generation error');
      next(); // Continue even if CSRF token generation fails
    });
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  
  // Get token from request
  const token = 
    req.headers['x-csrf-token'] as string ||
    req.headers['csrf-token'] as string ||
    req.body?._csrf ||
    req.query._csrf as string;
  
  // Debug logging
  logger.debug({ 
    path: req.path, 
    method: req.method,
    hasXCSRFToken: !!req.headers['x-csrf-token'],
    hasCSRFToken: !!req.headers['csrf-token'],
    tokenLength: token?.length,
    sessionId: req.session?.id || req.sessionID
  }, 'CSRF validation attempt');
  
  if (!token) {
    logger.warn({ path: req.path }, 'CSRF token missing');
    return res.status(403).json({ 
      message: 'CSRF token missing',
      error: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // Validate token (async)
  validateCSRFToken(req, token)
    .then((isValid) => {
      if (!isValid) {
        logger.warn({ path: req.path }, 'Invalid CSRF token');
        return res.status(403).json({ 
          message: 'Invalid CSRF token',
          error: 'CSRF_TOKEN_INVALID'
        });
      }
      next();
    })
    .catch((error) => {
      logger.error({ error, path: req.path }, 'CSRF validation error');
      return res.status(500).json({ 
        message: 'CSRF validation failed',
        error: 'CSRF_VALIDATION_ERROR'
      });
    });
}

/**
 * Get CSRF token for current session
 */
export async function getCSRFToken(req: Request): Promise<string> {
  return generateCSRFToken(req);
}
