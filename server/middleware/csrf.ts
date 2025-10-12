import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

// Store CSRF tokens in memory (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

// Token expiry: 1 hour
const TOKEN_EXPIRY = 60 * 60 * 1000;

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (data.expiresAt < now) {
      csrfTokens.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a CSRF token for the session
 */
export function generateCSRFToken(req: Request): string {
  const sessionId = req.session?.id || req.sessionID;
  
  if (!sessionId) {
    throw new Error('Session not found - CSRF protection requires sessions');
  }
  
  // Check if token already exists and is valid
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
export function validateCSRFToken(req: Request, token: string): boolean {
  const sessionId = req.session?.id || req.sessionID;
  
  if (!sessionId) {
    return false;
  }
  
  const stored = csrfTokens.get(sessionId);
  
  if (!stored) {
    return false;
  }
  
  // Check if token is expired
  if (stored.expiresAt < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(stored.token)
  );
}

/**
 * Middleware to add CSRF token to response
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Generate token for this session
    const token = generateCSRFToken(req);
    
    // Add to response locals so views can access it
    res.locals.csrfToken = token;
    
    // Add to response header for SPA consumption
    res.setHeader('X-CSRF-Token', token);
    
    next();
  } catch (error) {
    console.error('CSRF token generation error:', error);
    next();
  }
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
  
  if (!token) {
    return res.status(403).json({ 
      message: 'CSRF token missing',
      error: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // Validate token
  if (!validateCSRFToken(req, token)) {
    return res.status(403).json({ 
      message: 'Invalid CSRF token',
      error: 'CSRF_TOKEN_INVALID'
    });
  }
  
  next();
}

/**
 * Get CSRF token for current session
 */
export function getCSRFToken(req: Request): string {
  return generateCSRFToken(req);
}
