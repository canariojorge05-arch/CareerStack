/**
 * Enhanced JWT Authentication with Token Refresh
 * Secure token management with automatic refresh and session tracking
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CacheService, CACHE_TTL, CACHE_PREFIXES } from '../config/redis';
import { logger } from '../utils/logger';
import { db } from '../config/database';
import { users, userDevices } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY = '7d'; // Long-lived refresh tokens

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  deviceId?: string;
  sessionId?: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  tokenVersion: number;
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'email-app',
    audience: 'email-app-users',
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'email-app',
    audience: 'email-app-users',
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'email-app',
      audience: 'email-app-users',
    }) as JWTPayload;
    
    return payload;
  } catch (error) {
    logger.debug({ error }, 'Access token verification failed');
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'email-app',
      audience: 'email-app-users',
    }) as RefreshTokenPayload;
    
    return payload;
  } catch (error) {
    logger.debug({ error }, 'Refresh token verification failed');
    return null;
  }
}

/**
 * Check if token is blacklisted
 */
async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = `${CACHE_PREFIXES.SESSION}blacklist:${token}`;
  return await CacheService.exists(key);
}

/**
 * Blacklist token (for logout)
 */
export async function blacklistToken(token: string, expiresIn: number = CACHE_TTL.HOUR): Promise<void> {
  const key = `${CACHE_PREFIXES.SESSION}blacklist:${token}`;
  await CacheService.set(key, true, expiresIn);
}

/**
 * JWT Authentication Middleware
 */
export async function jwtAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.accessToken;
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }
    
    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has been revoked',
      });
    }
    
    // Verify token
    const payload = verifyAccessToken(token);
    
    if (!payload) {
      // Token is invalid or expired - check if we can refresh
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        code: 'TOKEN_EXPIRED',
      });
    }
    
    // Check if user still exists and is active
    const cacheKey = `${CACHE_PREFIXES.USER}${payload.userId}`;
    let user = await CacheService.get(cacheKey);
    
    if (!user) {
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      
      if (!dbUser) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }
      
      user = dbUser;
      await CacheService.set(cacheKey, user, CACHE_TTL.LONG);
    }
    
    // Attach user to request
    (req as any).user = {
      ...payload,
      ...user,
    };
    
    // Track last activity
    if (payload.deviceId) {
      await trackDeviceActivity(payload.deviceId).catch(err =>
        logger.error({ err, deviceId: payload.deviceId }, 'Failed to track device activity')
      );
    }
    
    next();
  } catch (error) {
    logger.error({ error }, 'JWT authentication error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional JWT Authentication (doesn't fail if no token)
 */
export async function optionalJwtAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies?.accessToken;
  
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload && !(await isTokenBlacklisted(token))) {
      (req as any).user = payload;
    }
  }
  
  next();
}

/**
 * Refresh token endpoint handler
 */
export async function refreshTokenHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    if (!refreshToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
      return;
    }
    
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    
    if (!payload) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token',
      });
      return;
    }
    
    // Check if device exists and is not revoked
    if (payload.deviceId) {
      const [device] = await db
        .select()
        .from(userDevices)
        .where(
          and(
            eq(userDevices.id, payload.deviceId),
            eq(userDevices.isRevoked, false),
            gt(userDevices.expiresAt, new Date())
          )
        )
        .limit(1);
      
      if (!device) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Device session expired or revoked',
        });
        return;
      }
      
      // Update device refresh token if it matches
      if (device.refreshToken !== refreshToken) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Refresh token mismatch',
        });
        return;
      }
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      deviceId: payload.deviceId,
      sessionId: payload.sessionId,
    });
    
    const newRefreshToken = generateRefreshToken({
      ...payload,
      tokenVersion: payload.tokenVersion + 1,
    });
    
    // Update refresh token in database
    if (payload.deviceId) {
      await db
        .update(userDevices)
        .set({
          refreshToken: newRefreshToken,
          lastActive: new Date(),
        })
        .where(eq(userDevices.id, payload.deviceId));
    }
    
    // Blacklist old refresh token
    await blacklistToken(refreshToken, CACHE_TTL.WEEK);
    
    // Set new tokens in cookies
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error) {
    logger.error({ error }, 'Token refresh error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token',
    });
  }
}

/**
 * Logout handler - revokes all tokens
 */
export async function logoutHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as any).user;
    const deviceId = user?.deviceId;
    
    // Blacklist current tokens
    const accessToken = req.cookies?.accessToken || req.headers.authorization?.substring(7);
    const refreshToken = req.cookies?.refreshToken;
    
    if (accessToken) {
      await blacklistToken(accessToken, CACHE_TTL.HOUR);
    }
    
    if (refreshToken) {
      await blacklistToken(refreshToken, CACHE_TTL.WEEK);
    }
    
    // Revoke device session if exists
    if (deviceId) {
      await db
        .update(userDevices)
        .set({ isRevoked: true })
        .where(eq(userDevices.id, deviceId));
    }
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    // Clear user cache
    if (user?.userId) {
      await CacheService.del(`${CACHE_PREFIXES.USER}${user.userId}`);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Logout error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to logout',
    });
  }
}

/**
 * Logout from all devices
 */
export async function logoutAllDevicesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as any).user;
    
    if (!user?.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }
    
    // Revoke all user devices
    await db
      .update(userDevices)
      .set({ isRevoked: true })
      .where(eq(userDevices.userId, user.userId));
    
    // Clear user cache
    await CacheService.del(`${CACHE_PREFIXES.USER}${user.userId}`);
    
    // Clear current session cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    logger.error({ error }, 'Logout all devices error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to logout from all devices',
    });
  }
}

/**
 * Track device activity
 */
async function trackDeviceActivity(deviceId: string): Promise<void> {
  try {
    await db
      .update(userDevices)
      .set({ lastActive: new Date() })
      .where(eq(userDevices.id, deviceId));
  } catch (error) {
    logger.error({ error, deviceId }, 'Failed to track device activity');
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }
    
    next();
  };
}

/**
 * Check if user owns resource
 */
export function requireOwnership(getUserIdFromResource: (req: Request) => string | Promise<string>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }
      
      const resourceUserId = await getUserIdFromResource(req);
      
      if (resourceUserId !== user.userId && user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this resource',
        });
      }
      
      next();
    } catch (error) {
      logger.error({ error }, 'Ownership check error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify ownership',
      });
    }
  };
}

export default {
  jwtAuthMiddleware,
  optionalJwtAuth,
  refreshTokenHandler,
  logoutHandler,
  logoutAllDevicesHandler,
  requireRole,
  requireOwnership,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistToken,
};
