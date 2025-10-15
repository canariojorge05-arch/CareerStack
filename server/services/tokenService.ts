import jwt from 'jsonwebtoken';
import { UserRoleType } from '@shared/schema';
import { logger } from '../utils/logger';

// Enforce JWT_SECRET from environment
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRoleType;
}

/**
 * Generate a JWT token with role information
 */
export const generateToken = (
  userId: string,
  email: string,
  role: UserRoleType
): string => {
  try {
    const payload: TokenPayload = {
      userId,
      email,
      role
    };

    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: '1h',
      algorithm: 'HS256'
    });
  } catch (error) {
    logger.error({ error, userId }, 'Token generation failed');
    throw error;
  }
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    logger.error({ error }, 'Token verification failed');
    return null;
  }
};

/**
 * Generate a refresh token
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || JWT_SECRET,
    { expiresIn: '7d' }
  );
};