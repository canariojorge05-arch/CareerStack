import { createHash } from 'crypto';

export class EmailSecurityService {
  // Enhanced spam/phishing detection patterns
  private static readonly SPAM_PATTERNS = [
    // Urgency and pressure tactics
    /urgent.{0,20}action.{0,20}required/i,
    /click.{0,20}here.{0,20}immediately/i,
    /act.{0,20}now.{0,20}or.{0,20}lose/i,
    /limited.{0,20}time.{0,20}offer/i,
    /expires.{0,20}(today|tonight|soon)/i,
    
    // Financial scams
    /congratulations.{0,20}won.{0,20}\$\d+/i,
    /nigerian.{0,20}prince/i,
    /inheritance.{0,20}\$\d+/i,
    /lottery.{0,20}winner/i,
    /million.{0,20}dollars/i,
    /transfer.{0,20}funds/i,
    
    // Account security scams
    /verify.{0,20}account.{0,20}suspended/i,
    /account.{0,20}will.{0,20}be.{0,20}closed/i,
    /confirm.{0,20}identity/i,
    /update.{0,20}payment.{0,20}information/i,
    
    // Generic spam indicators
    /free.{0,20}money/i,
    /work.{0,20}from.{0,20}home/i,
    /make.{0,20}\$\d+.{0,20}per.{0,20}day/i,
    /no.{0,20}experience.{0,20}required/i,
    /guaranteed.{0,20}income/i,
    
    // Suspicious formatting
    /[A-Z]{10,}/,  // Excessive caps
    /\$+\d+\$+/,   // Money with excessive $ symbols
  ];

  private static readonly SUSPICIOUS_DOMAINS = [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'tiny.cc',
    'is.gd', 'buff.ly', 'adf.ly', 'short.link'
  ];

  private static readonly SPAM_KEYWORDS = [
    'viagra', 'cialis', 'pharmacy', 'prescription', 'pills',
    'casino', 'gambling', 'poker', 'lottery', 'jackpot',
    'mortgage', 'refinance', 'credit', 'debt', 'loan',
    'weight loss', 'diet pills', 'lose weight fast',
    'make money fast', 'earn extra income', 'work from home',
    'free trial', 'risk free', 'no obligation',
    'act now', 'limited time', 'expires today'
  ];

  /**
   * Sanitize HTML content to prevent XSS attacks (simplified approach)
   */
  static sanitizeHtmlContent(htmlContent: string): string {
    if (!htmlContent) return '';

    // Remove dangerous tags and attributes
    let cleanHtml = htmlContent
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove dangerous event handlers
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (except for images)
      .replace(/data:(?!image\/)/gi, '')
      // Remove dangerous tags
      .replace(/<(object|embed|form|input|iframe|frame|frameset)[^>]*>/gi, '')
      .replace(/<\/(object|embed|form|input|iframe|frame|frameset)>/gi, '');

    return cleanHtml;
  }

  /**
   * Analyze email for spam/phishing indicators
   */
  static analyzeEmailSecurity(
    subject: string,
    htmlBody: string,
    textBody: string,
    fromEmail: string
  ): {
    riskLevel: 'low' | 'medium' | 'high';
    flags: string[];
    recommendations: string[];
  } {
    const flags: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    const content = `${subject} ${textBody} ${htmlBody}`.toLowerCase();

    // Check for spam patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(content)) {
        flags.push('Contains suspicious language patterns');
        riskScore += 2;
        break;
      }
    }

    // Check for spam keywords
    const spamKeywordCount = this.SPAM_KEYWORDS.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    if (spamKeywordCount > 0) {
      flags.push(`Contains ${spamKeywordCount} spam-related keyword${spamKeywordCount > 1 ? 's' : ''}`);
      riskScore += spamKeywordCount * 0.5;
    }

    // Check for suspicious links
    const linkMatches = htmlBody.match(/href=["']([^"']+)["']/gi) || [];
    for (const link of linkMatches) {
      const url = link.match(/href=["']([^"']+)["']/i)?.[1];
      if (url) {
        try {
          const domain = new URL(url).hostname;
          if (this.SUSPICIOUS_DOMAINS.includes(domain)) {
            flags.push('Contains shortened or suspicious URLs');
            riskScore += 1;
            break;
          }
        } catch (e) {
          flags.push('Contains malformed URLs');
          riskScore += 1;
        }
      }
    }

    // Check sender reputation
    const senderDomain = fromEmail.split('@')[1];
    if (!this.isKnownSafeDomain(senderDomain)) {
      riskScore += 0.5;
    }

    // Check for excessive urgency
    const urgencyWords = ['urgent', 'immediate', 'asap', 'emergency', 'critical'];
    const urgencyCount = urgencyWords.filter(word => content.includes(word)).length;
    if (urgencyCount >= 2) {
      flags.push('Excessive urgency indicators');
      riskScore += 1;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 3) {
      riskLevel = 'high';
      recommendations.push('Exercise extreme caution with this email');
      recommendations.push('Verify sender through alternative means');
    } else if (riskScore >= 1.5) {
      riskLevel = 'medium';
      recommendations.push('Be cautious with links and attachments');
    } else {
      recommendations.push('Email appears safe');
    }

    return { riskLevel, flags, recommendations };
  }

  /**
   * Check if domain is known to be safe
   */
  private static isKnownSafeDomain(domain: string): boolean {
    const safeDomains = [
      'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
      'company.com', 'organization.org' // Add your trusted domains
    ];
    return safeDomains.includes(domain.toLowerCase());
  }

  /**
   * Generate content fingerprint for duplicate detection
   */
  static generateContentFingerprint(subject: string, textBody: string): string {
    // Normalize content for fingerprinting
    const normalizedContent = `${subject} ${textBody}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

    return createHash('sha256')
      .update(normalizedContent)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for efficiency
  }

  /**
   * Validate email attachments for security
   */
  static validateAttachments(attachments: Array<{ filename: string; contentType?: string }>): {
    safe: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const dangerousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.vbs', '.js'];
    const suspiciousTypes = ['application/x-msdownload', 'application/x-executable'];

    for (const attachment of attachments) {
      const extension = attachment.filename.toLowerCase().substring(attachment.filename.lastIndexOf('.'));
      
      if (dangerousExtensions.includes(extension)) {
        warnings.push(`Potentially dangerous file: ${attachment.filename}`);
      }

      if (attachment.contentType && suspiciousTypes.includes(attachment.contentType)) {
        warnings.push(`Suspicious file type: ${attachment.filename}`);
      }
    }

    return {
      safe: warnings.length === 0,
      warnings
    };
  }
}
