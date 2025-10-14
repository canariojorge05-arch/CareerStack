import crypto from 'crypto';
import { logger } from './logger';

// Use a strong encryption key from environment variable
// In production, this should be a 32-byte (256-bit) key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  try {
    // Generate random IV for each encryption (security best practice)
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)), // Ensure 32 bytes
      iv
    );
    
    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag (prevents tampering)
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error({ error: error }, 'Encryption error:');
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param encryptedData - Encrypted string in format: iv:authTag:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  
  try {
    // Split the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error({ error: error }, 'Decryption error:');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data (one-way, for comparison only)
 * Useful for fields that need to be compared but never displayed
 */
export function hash(text: string): string {
  if (!text) return '';
  
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
}

/**
 * Mask sensitive data for display (e.g., SSN: 123-45-6789 -> ***-**-6789)
 * @param ssn - SSN in any format
 * @returns Masked SSN showing only last 4 digits
 */
export function maskSSN(ssn: string): string {
  if (!ssn) return '';
  
  // Remove all non-digits
  const digits = ssn.replace(/\D/g, '');
  
  if (digits.length < 4) return '***';
  
  const last4 = digits.slice(-4);
  return `***-**-${last4}`;
}

/**
 * Validate SSN format
 * @param ssn - SSN to validate
 * @returns true if valid format
 */
export function isValidSSN(ssn: string): boolean {
  if (!ssn) return false;
  
  // Remove all non-digits
  const digits = ssn.replace(/\D/g, '');
  
  // SSN must be exactly 9 digits
  if (digits.length !== 9) return false;
  
  // SSN cannot be all zeros or all the same digit
  if (/^0+$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  
  // First 3 digits cannot be 000, 666, or 900-999
  const area = parseInt(digits.slice(0, 3));
  if (area === 0 || area === 666 || area >= 900) return false;
  
  // Middle 2 digits cannot be 00
  const group = parseInt(digits.slice(3, 5));
  if (group === 0) return false;
  
  // Last 4 digits cannot be 0000
  const serial = parseInt(digits.slice(5, 9));
  if (serial === 0) return false;
  
  return true;
}
