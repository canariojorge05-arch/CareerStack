import { EmailSecurityService } from './emailSecurityService';
import { logger } from '../utils/logger';

export interface SpamFilterResult {
  isSpam: boolean;
  spamScore: number; // 0-100, higher = more likely spam
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  action: 'allow' | 'quarantine' | 'block';
  category?: 'phishing' | 'scam' | 'promotional' | 'malware' | 'other';
}

export class EmailSpamFilter {
  private static readonly SPAM_THRESHOLD = 60; // Score above this = spam
  private static readonly QUARANTINE_THRESHOLD = 40; // Score above this = quarantine

  /**
   * Comprehensive spam analysis
   */
  static analyzeEmail(
    subject: string,
    htmlBody: string,
    textBody: string,
    fromEmail: string,
    attachments?: Array<{ filename: string; contentType?: string }>
  ): SpamFilterResult {
    let spamScore = 0;
    const reasons: string[] = [];
    let category: SpamFilterResult['category'] = 'other';

    // Use security service for basic analysis
    const securityAnalysis = EmailSecurityService.analyzeEmailSecurity(
      subject, htmlBody, textBody, fromEmail
    );

    // Convert security risk to spam score
    switch (securityAnalysis.riskLevel) {
      case 'high':
        spamScore += 40;
        category = 'phishing';
        break;
      case 'medium':
        spamScore += 20;
        break;
      case 'low':
        spamScore += 5;
        break;
    }

    reasons.push(...securityAnalysis.flags);

    // Additional spam indicators
    spamScore += this.analyzeSubjectLine(subject, reasons);
    spamScore += this.analyzeContent(htmlBody, textBody, reasons);
    spamScore += this.analyzeSender(fromEmail, reasons);
    spamScore += this.analyzeAttachments(attachments || [], reasons);

    // Determine category if not already set
    if (category === 'other') {
      category = this.categorizeSpam(subject, htmlBody, textBody);
    }

    // Determine action
    let action: SpamFilterResult['action'] = 'allow';
    if (spamScore >= this.SPAM_THRESHOLD) {
      action = 'block';
    } else if (spamScore >= this.QUARANTINE_THRESHOLD) {
      action = 'quarantine';
    }

    // Determine confidence
    let confidence: SpamFilterResult['confidence'] = 'low';
    if (spamScore >= 80 || spamScore <= 10) {
      confidence = 'high';
    } else if (spamScore >= 60 || spamScore <= 30) {
      confidence = 'medium';
    }

    return {
      isSpam: spamScore >= this.SPAM_THRESHOLD,
      spamScore: Math.min(100, Math.max(0, spamScore)),
      confidence,
      reasons,
      action,
      category
    };
  }

  /**
   * Analyze subject line for spam indicators
   */
  private static analyzeSubjectLine(subject: string, reasons: string[]): number {
    let score = 0;
    const lowerSubject = subject.toLowerCase();

    // Excessive punctuation
    const exclamationCount = (subject.match(/!/g) || []).length;
    if (exclamationCount > 2) {
      score += exclamationCount * 5;
      reasons.push('Excessive exclamation marks in subject');
    }

    // All caps
    if (subject.length > 5 && subject === subject.toUpperCase()) {
      score += 15;
      reasons.push('Subject line in all capitals');
    }

    // Suspicious words in subject
    const suspiciousSubjectWords = [
      'free', 'urgent', 'winner', 'congratulations', 'act now',
      'limited time', 'expires', 'click here', 'guarantee'
    ];

    const foundWords = suspiciousSubjectWords.filter(word => 
      lowerSubject.includes(word)
    );

    if (foundWords.length > 0) {
      score += foundWords.length * 8;
      reasons.push(`Suspicious words in subject: ${foundWords.join(', ')}`);
    }

    // Empty or very short subject
    if (subject.trim().length === 0) {
      score += 10;
      reasons.push('Empty subject line');
    } else if (subject.trim().length < 3) {
      score += 5;
      reasons.push('Very short subject line');
    }

    // Numbers and symbols pattern (like "RE: 12345!!!")
    if (/^(re:|fwd:)?\s*\d+[!@#$%^&*()]+$/i.test(subject.trim())) {
      score += 20;
      reasons.push('Subject appears to be random numbers and symbols');
    }

    return score;
  }

  /**
   * Analyze email content for spam indicators
   */
  private static analyzeContent(htmlBody: string, textBody: string, reasons: string[]): number {
    let score = 0;
    const content = `${htmlBody} ${textBody}`.toLowerCase();

    // Content length analysis
    if (content.trim().length < 50) {
      score += 10;
      reasons.push('Very short email content');
    }

    // Excessive links
    const linkCount = (htmlBody.match(/href=/gi) || []).length;
    if (linkCount > 10) {
      score += linkCount * 2;
      reasons.push(`Excessive number of links (${linkCount})`);
    }

    // Image to text ratio (if mostly images)
    const imageCount = (htmlBody.match(/<img/gi) || []).length;
    const textLength = textBody.length;
    if (imageCount > 5 && textLength < 100) {
      score += 15;
      reasons.push('Email is mostly images with little text');
    }

    // Suspicious formatting
    const capsPercentage = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsPercentage > 0.3) {
      score += 10;
      reasons.push('Excessive use of capital letters');
    }

    // Multiple currencies or money symbols
    const moneySymbols = (content.match(/[\$€£¥₹]/g) || []).length;
    if (moneySymbols > 5) {
      score += moneySymbols * 2;
      reasons.push('Multiple money symbols detected');
    }

    // Suspicious phone number patterns
    const phonePatterns = [
      /1-?800-?\d{3}-?\d{4}/g,  // 1-800 numbers
      /\+\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g  // International
    ];

    phonePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches.length > 2) {
        score += 8;
        reasons.push('Multiple suspicious phone numbers');
      }
    });

    return score;
  }

  /**
   * Analyze sender for spam indicators
   */
  private static analyzeSender(fromEmail: string, reasons: string[]): number {
    let score = 0;

    // Invalid email format
    if (!fromEmail || !fromEmail.includes('@')) {
      score += 30;
      reasons.push('Invalid sender email format');
      return score;
    }

    const [localPart, domain] = fromEmail.toLowerCase().split('@');

    // Suspicious local part patterns
    if (localPart.length > 20) {
      score += 5;
      reasons.push('Very long email username');
    }

    if (/^\d+$/.test(localPart)) {
      score += 10;
      reasons.push('Email username is only numbers');
    }

    if (localPart.includes('noreply') || localPart.includes('donotreply')) {
      score -= 5; // Actually less suspicious for legitimate emails
    }

    // Random character patterns
    if (/^[a-z]{1,3}\d{5,}$/.test(localPart)) {
      score += 15;
      reasons.push('Sender email appears to be randomly generated');
    }

    // Suspicious domains
    const suspiciousDomainPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP address
      /[a-z]{10,}\.com$/,  // Very long domain names
      /\.(tk|ml|ga|cf)$/,  // Free domains often used for spam
    ];

    suspiciousDomainPatterns.forEach(pattern => {
      if (pattern.test(domain)) {
        score += 12;
        reasons.push('Suspicious sender domain');
      }
    });

    return score;
  }

  /**
   * Analyze attachments for spam indicators
   */
  private static analyzeAttachments(
    attachments: Array<{ filename: string; contentType?: string }>,
    reasons: string[]
  ): number {
    let score = 0;

    if (attachments.length === 0) return 0;

    // Too many attachments
    if (attachments.length > 10) {
      score += 15;
      reasons.push(`Excessive number of attachments (${attachments.length})`);
    }

    // Check for suspicious file types
    const dangerousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.vbs', '.js'];
    const suspiciousExtensions = ['.zip', '.rar', '.7z'];

    attachments.forEach(attachment => {
      const filename = attachment.filename.toLowerCase();
      const extension = filename.substring(filename.lastIndexOf('.'));

      if (dangerousExtensions.includes(extension)) {
        score += 25;
        reasons.push(`Dangerous attachment type: ${attachment.filename}`);
      } else if (suspiciousExtensions.includes(extension)) {
        score += 8;
        reasons.push(`Potentially suspicious attachment: ${attachment.filename}`);
      }

      // Random filename patterns
      if (/^[a-z0-9]{8,}\.(zip|exe|pdf)$/.test(filename)) {
        score += 10;
        reasons.push('Attachment has randomly generated filename');
      }
    });

    return score;
  }

  /**
   * Categorize the type of spam
   */
  private static categorizeSpam(subject: string, htmlBody: string, textBody: string): SpamFilterResult['category'] {
    const content = `${subject} ${htmlBody} ${textBody}`.toLowerCase();

    if (content.includes('phishing') || content.includes('verify account') || content.includes('suspended')) {
      return 'phishing';
    }

    if (content.includes('lottery') || content.includes('inheritance') || content.includes('million dollars')) {
      return 'scam';
    }

    if (content.includes('sale') || content.includes('discount') || content.includes('offer')) {
      return 'promotional';
    }

    if (content.includes('download') || content.includes('install') || content.includes('update')) {
      return 'malware';
    }

    return 'other';
  }

  /**
   * Get spam filter statistics
   */
  static getFilterStats(): {
    totalProcessed: number;
    spamBlocked: number;
    quarantined: number;
    falsePositives: number;
    accuracy: number;
  } {
    // This would be implemented with actual database queries
    return {
      totalProcessed: 1000,
      spamBlocked: 150,
      quarantined: 75,
      falsePositives: 5,
      accuracy: 97.5
    };
  }

  /**
   * Update spam filter based on user feedback
   */
  static updateFilter(emailId: string, isSpam: boolean, userFeedback?: string): void {
    // This would update the filter's machine learning model or rules
    logger.info(`Updating spam filter: Email ${emailId} marked as ${isSpam ? 'spam' : 'not spam'}`);
    if (userFeedback) {
      logger.info(`User feedback: ${userFeedback}`);
    }
  }
}
