import { Express, Request, Response, NextFunction } from "express";
import passport from 'passport';
import session from 'express-session';
import MemoryStore from 'memorystore';
import ConnectPgSimple from 'connect-pg-simple';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { configurePassport } from './config/passport';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { redisService, sessionCache } from './services/redis';
import { config } from './config';
import { logger } from './utils/logger';

declare module 'express-session' {
  interface SessionData {
    passport: {
      user: {
        id: string;
      };
    };
    returnTo?: string;
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role?: string;
    }
  }
}

// Define interfaces for type safety
interface LoginAttempt {
  count: number;
  lastAttempt: Date;
  lockedUntil?: Date; // When the account is locked until
  firstAttempt: Date; // First failed attempt
}

interface UserSession {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;
  expires: Date; // Session expiration timestamp
}

// Rate limiting store with type safety and max size to prevent memory leaks
const MAX_LOGIN_ATTEMPTS_STORE_SIZE = 1000;
const loginAttempts = new Map<string, LoginAttempt>();

// Track active sessions for cleanup
const activeSessions = new Map<string, UserSession>();

// Initialize session store
const MemoryStoreSession = MemoryStore(session);
const PgSession = ConnectPgSimple(session);

// Redis Session Store Implementation
class RedisSessionStore extends session.Store {
  private readonly redis: any;
  private readonly prefix: string;
  private readonly serializer: any;

  constructor(options: { client?: any; prefix?: string } = {}) {
    super();
    this.redis = options.client || redisService.getClient();
    this.prefix = options.prefix || 'sess:';
    this.serializer = {
      stringify: JSON.stringify,
      parse: JSON.parse,
    };
  }

  // Get session data
  get(sid: string, callback: (err?: any, session?: session.SessionData) => void): void {
    const key = this.prefix + sid;
    
    redisService.executeCommand(
      () => this.redis.get(key),
      'session_store_get'
    )
    .then(data => {
      if (!data) {
        return callback();
      }
      try {
        const session = this.serializer.parse(data);
        callback(null, session);
      } catch (err) {
        logger.error({ error: err, sid }, 'Session parse error');
        callback(err);
      }
    })
    .catch(err => {
      logger.error({ error: err, sid }, 'Session get error');
      callback(err);
    });
  }

  // Set session data
  set(sid: string, session: session.SessionData, callback?: (err?: any) => void): void {
    const key = this.prefix + sid;
    const maxAge = session.cookie?.maxAge;
    const ttl = maxAge ? Math.ceil(maxAge / 1000) : config.redis.cacheTTL.session;

    try {
      const data = this.serializer.stringify(session);
      
      redisService.executeCommand(
        () => this.redis.setex(key, ttl, data),
        'session_store_set'
      )
      .then(() => {
        callback?.();
      })
      .catch(err => {
        logger.error({ error: err, sid }, 'Session set error');
        callback?.(err);
      });
    } catch (err) {
      logger.error({ error: err, sid }, 'Session stringify error');
      callback?.(err);
    }
  }

  // Destroy session
  destroy(sid: string, callback?: (err?: any) => void): void {
    const key = this.prefix + sid;
    
    redisService.executeCommand(
      () => this.redis.del(key),
      'session_store_destroy'
    )
    .then(() => {
      callback?.();
    })
    .catch(err => {
      logger.error({ error: err, sid }, 'Session destroy error');
      callback?.(err);
    });
  }

  // Touch session (update expiration)
  touch(sid: string, session: session.SessionData, callback?: (err?: any) => void): void {
    const key = this.prefix + sid;
    const maxAge = session.cookie?.maxAge;
    const ttl = maxAge ? Math.ceil(maxAge / 1000) : config.redis.cacheTTL.session;

    redisService.executeCommand(
      () => this.redis.expire(key, ttl),
      'session_store_touch'
    )
    .then(() => {
      callback?.();
    })
    .catch(err => {
      logger.error({ error: err, sid }, 'Session touch error');
      callback?.(err);
    });
  }

  // Get all session IDs (optional)
  all(callback: (err?: any, obj?: { [sid: string]: session.SessionData } | null) => void): void {
    const pattern = this.prefix + '*';
    
    redisService.executeCommand(
      async () => {
        const keys = await this.redis.keys(pattern);
        const sessions: { [sid: string]: session.SessionData } = {};
        
        for (const key of keys) {
          try {
            const data = await this.redis.get(key);
            if (data) {
              const sid = key.slice(this.prefix.length);
              sessions[sid] = this.serializer.parse(data);
            }
          } catch (err) {
            logger.error({ error: err, key }, 'Error parsing session in all()');
          }
        }
        
        return sessions;
      },
      'session_store_all'
    )
    .then(sessions => {
      callback(null, sessions);
    })
    .catch(err => {
      logger.error({ error: err }, 'Session all error');
      callback(err);
    });
  }

  // Get session count (optional)
  length(callback: (err?: any, length?: number) => void): void {
    const pattern = this.prefix + '*';
    
    redisService.executeCommand(
      () => this.redis.keys(pattern),
      'session_store_length'
    )
    .then(keys => {
      callback(null, (keys as string[]).length);
    })
    .catch(err => {
      logger.error({ error: err }, 'Session length error');
      callback(err);
    });
  }

  // Clear all sessions (optional)
  clear(callback?: (err?: any) => void): void {
    const pattern = this.prefix + '*';
    
    redisService.executeCommand(
      async () => {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return keys.length;
      },
      'session_store_clear'
    )
    .then(deletedCount => {
      logger.info({ deletedCount }, 'Sessions cleared');
      callback?.();
    })
    .catch(err => {
      logger.error({ error: err }, 'Session clear error');
      callback?.(err);
    });
  }
}

// Constants for security settings
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

export async function setupAuth(app: Express) {
  // Validate session secret
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret === "your-secret-key") {
    throw new Error("SESSION_SECRET environment variable must be set to a secure random string");
  }

  // Set up session store with intelligent fallback strategy
  let sessionStore;
  let storeType = 'memory'; // Default fallback
  
  // Try Redis first if configured and available
  if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
    try {
      await redisService.isHealthy();
      sessionStore = new RedisSessionStore({
        client: redisService.getClient(),
        prefix: 'sess:'
      });
      storeType = 'redis';
      logger.info('Using Redis session store');
    } catch (error) {
      logger.warn({ error }, 'Redis not available, falling back to alternative session store');
    }
  }
  
  // Fallback to PostgreSQL in production if Redis not available
  if (!sessionStore && process.env.NODE_ENV === "production") {
    try {
      sessionStore = new PgSession({
        pool: db as any,
        tableName: 'sessions',
        createTableIfMissing: true,
        errorLog: logger.error.bind(logger, 'PostgreSQL session store error:'),
      });
      storeType = 'postgresql';
      logger.info('Using PostgreSQL session store');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize PostgreSQL session store');
      throw new Error('Failed to initialize PostgreSQL session store in production');
    }
  }
  
  // Use memory store for development or as last resort
  if (!sessionStore) {
    sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
      max: 1000, // Limit memory usage
    });
    storeType = 'memory';
    if (process.env.NODE_ENV === "production") {
      logger.warn('Using memory session store in production - not recommended for scaling');
    } else {
      logger.info('Using memory session store for development');
    }
  }
  
  // Log final session store configuration
  logger.info({ 
    sessionStore: storeType, 
    redisAvailable: config.redis.host ? 'configured' : 'not configured',
    environment: process.env.NODE_ENV 
  }, 'Session store initialized');

    // Session setup with enhanced security
  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret,
      resave: false, // Changed back to false to prevent unnecessary saves
      saveUninitialized: false,
      name: 'sid', // Custom session name
      rolling: true, // Refresh session with each request
      cookie: {
        maxAge: 60 * 60 * 1000, // 1 hour - matches client timeout
        secure: process.env.NODE_ENV === "production", // Only send secure cookies in production
        httpOnly: true, // Prevent XSS attacks
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // stricter in production
        path: '/',
      },
      proxy: process.env.NODE_ENV === "production", // Only trust proxy in production
    })
  );
  
  // Configure and initialize Passport
  configurePassport(passport);
  
  // Initialize Passport and restore authentication state from session
  app.use(passport.initialize());
  app.use(passport.session());

  // CSRF token generation (set readable cookie for SPAs to echo back as header)
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      // lazily create CSRF token per session
      // @ts-ignore - extend session type dynamically
      if ((req as any).session && !(req as any).session.csrfToken) {
        (req as any).session.csrfToken = randomBytes(24).toString('hex');
      }
      const token = (req as any).session?.csrfToken;
      if (token) {
        res.cookie('csrf_token', token, {
          httpOnly: false,
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 1000,
        });
      }
    } catch {}
    next();
  });

  // CSRF enforcement for state-changing API requests (double-submit via header)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const method = req.method;
    const path = req.path || '';
    const isStateChanging = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    if (!isStateChanging || !path.startsWith('/api/')) return next();

    // Exempt a few auth endpoints to avoid breaking login/register flows
    const exempt = new Set<string>([
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/verify-2fa',
      '/api/auth/request-password-reset',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email',
      '/api/auth/csrf'
    ]);
    if (exempt.has(path)) return next();

    const headerToken = (req.headers['x-csrf-token'] as string) || (req.headers['csrf-token'] as string) || '';
    const sessionToken = (req as any).session?.csrfToken as string | undefined;

    if (!sessionToken || !headerToken || headerToken !== sessionToken) {
      return res.status(403).json({ message: 'CSRF token invalid or missing' });
    }
    next();
  });

  // Session management middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.id) {
      // Update last active time
      if (req.user) {
        activeSessions.set(req.session.id, {
          ...(activeSessions.get(req.session.id) || {}),
          lastActive: new Date(),
          expires: new Date(Date.now() + (req.session.cookie.maxAge || 86400000))
        } as UserSession);
      }

      // Clean up expired sessions periodically
      if (Math.random() < 0.01) { // 1% chance to run cleanup on each request
        const now = new Date();
        for (const [sessionId, session] of activeSessions.entries()) {
          if (session.expires < now) {
            activeSessions.delete(sessionId);
          }
        }
      }
    }

    // Debug logging in development (disabled for performance)
    // if (process.env.NODE_ENV === 'development') {
    //   logger.info('Session ID:', req.sessionID);
    //   logger.info('Is authenticated:', req.isAuthenticated());
    //   logger.info('User:', req.user);
    // }
    
    next();
  });

  // Add security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Content Security Policy - Comprehensive protection against XSS
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for React dev
      "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for styled components
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ];
    
    // In production, use stricter CSP
    if (process.env.NODE_ENV === "production") {
      res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    } else {
      // In development, use report-only mode
      res.setHeader('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
    }
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    
    next();
  });
  
  // Session cleanup on server start
  cleanupLoginAttempts();
  setInterval(cleanupLoginAttempts, CLEANUP_INTERVAL);

  // Helper function to get user by email
  async function getUserByEmail(email: string) {
    return await db.query.users.findFirst({
      where: eq(users.email, email)
    });
  }

  // Helper function to update user last login
  async function updateUserLastLogin(userId: string) {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Helper function to update user password
  async function updateUserPassword(userId: string, newHash: string) {
    await db.update(users)
      .set({ 
        password: newHash,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Serialize user into the session
  passport.serializeUser((user: Express.User, done) => {
    done(null, { id: user.id });
  });

  passport.deserializeUser(async (serialized: { id: string }, done) => {
    try {
      if (!serialized?.id) {
        return done(new Error('Invalid session data'));
      }

      // Find the user in the database
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, serialized.id)
      });

      if (!user) {
        return done(null, false);
      }

      // Remove sensitive information before storing in session
      const safeUser = {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || 'user' // Include role in session
      };

      return done(null, safeUser);
    } catch (error) {
      logger.error({ error: error }, 'Deserialize user error:');
      done(error);
    }
  });
}

// Helper function to hash passwords with stronger salt
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12); // Increased from 10 to 12
  return bcrypt.hash(password, salt);
}


export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // Check if it's a public route that doesn't need authentication
  const publicRoutes = ['/login', '/register', '/forgot-password', '/', '/health'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // Check for static assets
  if (req.path.startsWith('/assets/') || req.path.startsWith('/public/')) {
    return next();
  }

  if (req.isAuthenticated()) {
    return next();
  }
  
  // Return more specific error for API endpoints
  if (req.path.startsWith('/api/')) {
    // Debug logging to aid diagnosing repeated 401s from clients
    try {
      logger.warn({
        context: {
          path: req.path,
          method: req.method,
          sessionID: req.sessionID,
          cookies: req.headers.cookie,
          isAuthenticated: req.isAuthenticated()
        }
      }, '[auth] Rejecting API request - unauthenticated');
    } catch (e) {
      logger.error({ error: e }, 'Failed to record auth rejection details:');
    }

    return res.status(401).json({ 
      message: "Authentication required",
      code: "UNAUTHORIZED" 
    });
  }

  // Save the requested URL for redirect after login
  req.session.returnTo = req.originalUrl;
  
  // Redirect to login for web pages
  res.redirect('/login');
}

// Password validation helper
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/(?=.*[@$!%*?&])/.test(password)) {
    errors.push("Password must contain at least one special character (@$!%*?&)");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Rate limiting helper with exponential backoff and request tracking
function recordFailedAttempt(attemptKey: string): void {
  try {
    const now = new Date();
    const existing = loginAttempts.get(attemptKey);
    const attempts: LoginAttempt = existing
      ? { ...existing }
      : {
          count: 0,
          lastAttempt: now,
          lockedUntil: undefined,
          firstAttempt: now,
        };

    // Reset counter if last attempt was long ago
    if (attempts.lastAttempt < new Date(now.getTime() - LOCK_DURATION * 4)) {
      attempts.count = 0;
      attempts.firstAttempt = now;
    }

    attempts.count += 1;
    attempts.lastAttempt = now;

    // Implement exponential backoff for lockout duration
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const timeSinceFirstAttempt = now.getTime() - attempts.firstAttempt.getTime();
      const baseMultiplier = Math.min(
        Math.ceil(attempts.count / MAX_LOGIN_ATTEMPTS),
        4 // Cap at 4x
      );

      // More aggressive lockout if many attempts in short time
      const lockoutMultiplier =
        timeSinceFirstAttempt < LOCK_DURATION ? baseMultiplier * 2 : baseMultiplier;

      const lockDuration = LOCK_DURATION * lockoutMultiplier;
      attempts.lockedUntil = new Date(now.getTime() + lockDuration);

      logger.warn(
        `[SECURITY] Account lockout triggered for ${attemptKey}\n` +
          `Attempts: ${attempts.count}\n` +
          `Lock Duration: ${Math.round(lockDuration / 60000)} minutes\n` +
          `First Attempt: ${attempts.firstAttempt.toISOString()}\n` +
          `Unlock Time: ${attempts.lockedUntil.toISOString()}`
      );
    }

    // Ensure we don't exceed our memory limit
    if (loginAttempts.size >= MAX_LOGIN_ATTEMPTS_STORE_SIZE) {
      // Remove the oldest entries
      const entriesToDelete = [...loginAttempts.entries()]
        .sort((a, b) => a[1].lastAttempt.getTime() - b[1].lastAttempt.getTime())
        .slice(0, Math.floor(MAX_LOGIN_ATTEMPTS_STORE_SIZE * 0.2)); // Remove oldest 20%

      for (const [key] of entriesToDelete) {
        loginAttempts.delete(key);
      }
    }

    loginAttempts.set(attemptKey, attempts);

    // Clean up old entries if we're approaching the limit
    if (loginAttempts.size > MAX_LOGIN_ATTEMPTS_STORE_SIZE * 0.9) {
      cleanupLoginAttempts();
    }
  } catch (error) {
    logger.error({ error: error }, 'Error recording failed login attempt:');
  }
}

// Separate cleanup function for better organization
function cleanupLoginAttempts(): void {
  const now = new Date();
  const cleanupTime = new Date(now.getTime() - CLEANUP_INTERVAL);
  
  try {
    // Clean up login attempts
    for (const [key, attempt] of loginAttempts.entries()) {
      const isExpired = attempt.lastAttempt < cleanupTime;
      const isUnlocked = !attempt.lockedUntil || attempt.lockedUntil < now;
      
      if (isExpired && isUnlocked) {
        loginAttempts.delete(key);
      }
    }
    
    // Clean up expired sessions
    for (const [sessionId, session] of activeSessions.entries()) {
      if (!session || !session.expires || now > new Date(session.expires)) {
        activeSessions.delete(sessionId);
      } else if (session.lastActive) {
        // Update last active time for active sessions
        session.lastActive = now;
      }
    }
    
    // Enforce maximum size limits
    if (loginAttempts.size > MAX_LOGIN_ATTEMPTS_STORE_SIZE) {
      // Get all entries sorted by last attempt time (oldest first)
      const entries = Array.from(loginAttempts.entries())
        .sort((a, b) => a[1].lastAttempt.getTime() - b[1].lastAttempt.getTime());
      
      // Remove oldest entries (10% of the max size, but at least 1)
      const entriesToRemove = Math.max(1, Math.floor(MAX_LOGIN_ATTEMPTS_STORE_SIZE * 0.1));
      entries.slice(0, entriesToRemove)
        .forEach(([key]) => loginAttempts.delete(key));
    }
  } catch (error) {
    logger.error({ error: error }, 'Error in cleanupLoginAttempts:');
  }
  
  logger.info(`[Auth] Active sessions: ${activeSessions.size}, Login attempts tracked: ${loginAttempts.size}`);
}