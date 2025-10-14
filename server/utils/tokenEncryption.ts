import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { logger } from './logger';

/**
 * Token Encryption Utility
 * Provides secure encryption/decryption for sensitive OAuth tokens
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment variable
 * Throws error if not configured in production
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY must be set in production environment');
    }
    // Use a default key for development (NOT SECURE - for dev only)
    logger.warn('⚠️  WARNING: Using default encryption key. Set TOKEN_ENCRYPTION_KEY in production!');
    return crypto.scryptSync('development-key-not-secure', 'salt', 32);
  }
  
  // Derive key from the provided secret
  return crypto.scryptSync(key, 'gmail-token-salt', 32);
}

/**
 * Encrypt a token string
 * @param token - The token to encrypt
 * @returns Encrypted token in format: iv:authTag:encryptedData (all hex encoded)
 */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error({ error: error }, 'Token encryption failed:');
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token string
 * @param encryptedToken - The encrypted token in format: iv:authTag:encryptedData
 * @returns Decrypted token string
 */
export function decryptToken(encryptedToken: string | null | undefined): string | null {
  if (!encryptedToken) return null;
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedToken.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error({ error: error }, 'Token decryption failed:');
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Generate a secure encryption key for TOKEN_ENCRYPTION_KEY
 * Use this to generate a key for your .env file
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage verification (one-way)
 * Useful for session tokens or verification tokens
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against a hash
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}

/**
 * Generate a secure random token
 * @param length - Length in bytes (default 32)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// If this file is executed directly (rather than imported), print a generated key.
// In ESM environments `require.main` is not available, so compare the executed
// script path to this module's URL.
const isExecutedDirectly = (() => {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch (err) {
    return false;
  }
})();

if (isExecutedDirectly) {
  logger.info('\n🔐 Generated TOKEN_ENCRYPTION_KEY:');
  logger.info(generateEncryptionKey());
  logger.info('\nAdd this to your .env file as:');
  logger.info('TOKEN_ENCRYPTION_KEY=<generated_key>');
  logger.info('\n⚠️  Keep this key secure and never commit it to version control!\n');
}
