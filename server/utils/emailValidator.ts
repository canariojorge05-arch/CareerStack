import dns from 'dns';
import { promisify } from 'util';
import { logger } from './logger';

const resolveMx = promisify(dns.resolveMx);

export interface EmailValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

export class EmailValidator {
  // Common email domains and their correct spellings
  private static commonDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'live.com', 'msn.com', 'ymail.com', 'protonmail.com'
  ];

  // Common typos in email domains
  private static domainTypos: Record<string, string> = {
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
  };

  // Disposable email domains to block
  private static disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
    'throwaway.email', 'temp-mail.org', 'fakemailgenerator.com'
  ];

  /**
   * Comprehensive email validation
   */
  static async validateEmail(email: string): Promise<EmailValidationResult> {
    // Basic format validation
    const formatResult = this.validateFormat(email);
    if (!formatResult.isValid) {
      return formatResult;
    }

    // Extract domain
    const domain = email.split('@')[1].toLowerCase();

    // Check for disposable email
    if (this.disposableDomains.includes(domain)) {
      return {
        isValid: false,
        reason: 'Disposable email addresses are not allowed'
      };
    }

    // Check for common typos
    const typoResult = this.checkTypos(email);
    if (typoResult.suggestions && typoResult.suggestions.length > 0) {
      return typoResult;
    }

    // DNS MX record validation (optional, can be slow)
    try {
      const mxResult = await this.validateMXRecord(domain);
      if (!mxResult.isValid) {
        return mxResult;
      }
    } catch (error) {
      // If DNS check fails, we'll still allow the email
      logger.warn(`DNS check failed for ${domain}:`, error);
    }

    return { isValid: true };
  }

  /**
   * Basic email format validation
   */
  private static validateFormat(email: string): EmailValidationResult {
    if (!email || typeof email !== 'string') {
      return { isValid: false, reason: 'Email is required' };
    }

    // Remove whitespace
    email = email.trim();

    // Basic regex validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, reason: 'Invalid email format' };
    }

    // Check length
    if (email.length > 254) {
      return { isValid: false, reason: 'Email address is too long' };
    }

    // Check local part length (before @)
    const localPart = email.split('@')[0];
    if (localPart.length > 64) {
      return { isValid: false, reason: 'Email local part is too long' };
    }

    // Check for consecutive dots
    if (email.includes('..')) {
      return { isValid: false, reason: 'Email cannot contain consecutive dots' };
    }

    // Check for leading/trailing dots in local part
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return { isValid: false, reason: 'Email local part cannot start or end with a dot' };
    }

    return { isValid: true };
  }

  /**
   * Check for common typos and suggest corrections
   */
  private static checkTypos(email: string): EmailValidationResult {
    const [localPart, domain] = email.split('@');
    const lowerDomain = domain.toLowerCase();

    // Check for exact typo matches
    if (this.domainTypos[lowerDomain]) {
      return {
        isValid: false,
        reason: 'Possible typo in email domain',
        suggestions: [`${localPart}@${this.domainTypos[lowerDomain]}`]
      };
    }

    // Only check for typos if domain is NOT in common domains
    if (this.commonDomains.includes(lowerDomain)) {
      return { isValid: true };
    }

    // Check for similar domains using Levenshtein distance
    const suggestions: string[] = [];
    for (const commonDomain of this.commonDomains) {
      const distance = this.levenshteinDistance(lowerDomain, commonDomain);
      // Only suggest if distance is exactly 1 (single character difference)
      if (distance === 1) {
        suggestions.push(`${localPart}@${commonDomain}`);
      }
    }

    if (suggestions.length > 0) {
      return {
        isValid: false,
        reason: 'Possible typo in email domain',
        suggestions: suggestions.slice(0, 3) // Limit to 3 suggestions
      };
    }

    return { isValid: true };
  }

  /**
   * Validate MX record exists for domain
   */
  private static async validateMXRecord(domain: string): Promise<EmailValidationResult> {
    try {
      const mxRecords = await resolveMx(domain);
      if (mxRecords && mxRecords.length > 0) {
        return { isValid: true };
      } else {
        return {
          isValid: false,
          reason: 'Domain does not have valid mail servers'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        reason: 'Unable to verify domain mail servers'
      };
    }
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Quick validation for API endpoints (without DNS check)
   */
  static validateEmailQuick(email: string): EmailValidationResult {
    const formatResult = this.validateFormat(email);
    if (!formatResult.isValid) {
      return formatResult;
    }

    const domain = email.split('@')[1].toLowerCase();

    // Check for disposable email
    if (this.disposableDomains.includes(domain)) {
      return {
        isValid: false,
        reason: 'Disposable email addresses are not allowed'
      };
    }

    // Check for typos
    return this.checkTypos(email);
  }

  /**
   * Normalize email address
   */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Check if email domain is from a major provider
   */
  static isMajorProvider(email: string): boolean {
    const domain = email.split('@')[1].toLowerCase();
    return this.commonDomains.includes(domain);
  }
}
