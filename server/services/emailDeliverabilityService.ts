/**
 * Email Deliverability Service
 * Ensures emails don't land in spam/junk folders
 */

export interface SpamCheckResult {
  score: number; // 0-10, higher is worse
  issues: string[];
  recommendations: string[];
  isSafe: boolean; // true if likely to be delivered
}

export interface EmailAuthConfig {
  domain: string;
  spfRecord?: string;
  dkimPublicKey?: string;
  dmarcPolicy?: string;
}

export class EmailDeliverabilityService {
  /**
   * Check email content for spam triggers
   */
  static checkSpamScore(
    subject: string,
    htmlBody: string,
    textBody: string,
    fromEmail: string
  ): SpamCheckResult {
    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check subject line
    if (!subject || subject.trim().length === 0) {
      score += 3;
      issues.push('No subject line');
      recommendations.push('Add a clear, descriptive subject line');
    }

    if (subject.length > 0) {
      // Check for spam trigger words in subject
      const spamWords = [
        'free', 'winner', 'cash', 'prize', 'urgent', '!!!', 
        'click here', 'act now', 'limited time', 'guarantee',
        'no obligation', 'risk-free', 'miracle', 'amazing'
      ];
      
      const subjectLower = subject.toLowerCase();
      const foundSpamWords = spamWords.filter(word => subjectLower.includes(word));
      
      if (foundSpamWords.length > 0) {
        score += foundSpamWords.length * 0.5;
        issues.push(`Spam trigger words in subject: ${foundSpamWords.join(', ')}`);
        recommendations.push('Avoid using spam trigger words like "free", "winner", "urgent", etc.');
      }

      // Check for all caps subject
      if (subject === subject.toUpperCase() && subject.length > 3) {
        score += 2;
        issues.push('Subject is all caps');
        recommendations.push('Use normal capitalization in subject line');
      }

      // Check for excessive punctuation
      const exclamationCount = (subject.match(/!/g) || []).length;
      if (exclamationCount > 1) {
        score += exclamationCount;
        issues.push('Excessive exclamation marks in subject');
        recommendations.push('Use at most one exclamation mark');
      }
    }

    // Check body content
    const combinedText = (textBody + ' ' + htmlBody.replace(/<[^>]*>/g, '')).toLowerCase();

    // Check for spam phrases in body
    const bodySpamPhrases = [
      'click here now', 'buy now', 'order now', 'subscribe now',
      'get it now', 'apply now', 'limited time offer', 'act immediately',
      'once in lifetime', 'what are you waiting for', 'money back guarantee'
    ];

    bodySpamPhrases.forEach(phrase => {
      if (combinedText.includes(phrase)) {
        score += 0.5;
        issues.push(`Spam phrase found: "${phrase}"`);
      }
    });

    if (bodySpamPhrases.some(phrase => combinedText.includes(phrase))) {
      recommendations.push('Reduce use of high-pressure sales language');
    }

    // Check for excessive links
    const linkMatches = htmlBody.match(/<a\s+href=/gi) || [];
    if (linkMatches.length > 10) {
      score += 1;
      issues.push('Too many links in email');
      recommendations.push('Reduce number of links (keep under 10)');
    }

    // Check for link-to-text ratio
    if (htmlBody.length > 0) {
      const textLength = textBody.length || htmlBody.replace(/<[^>]*>/g, '').length;
      const linkCount = linkMatches.length;
      
      if (textLength < 100 && linkCount > 2) {
        score += 2;
        issues.push('Too many links for short content');
        recommendations.push('Add more text content or reduce links');
      }
    }

    // Check for image-only emails
    const imageMatches = htmlBody.match(/<img\s+/gi) || [];
    const textLength = textBody.length || htmlBody.replace(/<[^>]*>/g, '').length;
    
    if (imageMatches.length > 0 && textLength < 50) {
      score += 2;
      issues.push('Email is mostly images with little text');
      recommendations.push('Include more text content alongside images');
    }

    // Check for suspicious URLs
    const urlMatches = htmlBody.match(/https?:\/\/[^\s<>"]+/gi) || [];
    const suspiciousPatterns = ['.tk', '.ml', '.ga', '.cf', 'bit.ly', 'tinyurl'];
    
    urlMatches.forEach(url => {
      if (suspiciousPatterns.some(pattern => url.includes(pattern))) {
        score += 1;
        issues.push('Suspicious or shortened URL detected');
      }
    });

    if (urlMatches.some(url => suspiciousPatterns.some(pattern => url.includes(pattern)))) {
      recommendations.push('Use full URLs instead of URL shorteners');
    }

    // Check for proper plain text version
    if (htmlBody.length > 0 && textBody.length === 0) {
      score += 1;
      issues.push('No plain text version provided');
      recommendations.push('Always include a plain text version of your email');
    }

    // Check from address
    const fromDomain = fromEmail.split('@')[1];
    const commonFreeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    
    if (commonFreeProviders.includes(fromDomain?.toLowerCase())) {
      score += 0.5;
      issues.push('Sending from free email provider');
      recommendations.push('Consider using a custom domain for better deliverability');
    }

    // Check for HTML issues
    if (htmlBody.includes('<form')) {
      score += 2;
      issues.push('HTML forms in email');
      recommendations.push('Remove HTML forms (use links instead)');
    }

    if (htmlBody.includes('<script')) {
      score += 3;
      issues.push('JavaScript in email');
      recommendations.push('Remove all JavaScript (not supported in most email clients)');
    }

    // Check for all caps in body
    const capsWords = combinedText.split(' ').filter(word => 
      word.length > 3 && word === word.toUpperCase()
    );
    
    if (capsWords.length > 5) {
      score += 1;
      issues.push('Too many words in all caps');
      recommendations.push('Use normal capitalization in email body');
    }

    // Check content length
    if (textLength < 50) {
      score += 1;
      issues.push('Email content is too short');
      recommendations.push('Include at least 50 characters of content');
    }

    // Add general recommendations if score is high
    if (score > 3) {
      recommendations.push('Consider reviewing email content best practices');
      recommendations.push('Test email with spam checkers before sending');
    }

    return {
      score: Math.min(score, 10),
      issues,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      isSafe: score < 5
    };
  }

  /**
   * Get recommended email headers for better deliverability
   */
  static getRecommendedHeaders(
    fromEmail: string,
    toEmail: string,
    subject: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      // Authentication headers
      'X-Mailer': 'Resume Customizer Pro v1.0',
      'X-Priority': '3', // Normal priority
      'Importance': 'Normal',
      
      // Help prevent being marked as spam
      'List-Unsubscribe': `<mailto:unsubscribe@${fromEmail.split('@')[1]}>`,
      'Precedence': 'bulk',
      
      // Message identification
      'Message-ID': `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${fromEmail.split('@')[1]}>`,
      'Date': new Date().toUTCString(),
      
      // Proper MIME type
      'MIME-Version': '1.0',
      'Content-Type': 'multipart/alternative',
      
      // Anti-spam headers
      'X-Content-Type-Options': 'nosniff',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    };

    return headers;
  }

  /**
   * Validate email configuration for deliverability
   */
  static async validateEmailConfiguration(domain: string): Promise<{
    spf: { configured: boolean; record?: string; recommendation: string };
    dkim: { configured: boolean; recommendation: string };
    dmarc: { configured: boolean; record?: string; recommendation: string };
    mx: { configured: boolean; records?: string[]; recommendation: string };
  }> {
    // Note: In production, you would use DNS lookup libraries
    // For now, we'll return recommendations
    
    return {
      spf: {
        configured: false,
        recommendation: `Add SPF record to your DNS:\nv=spf1 include:_spf.google.com ~all\n(Adjust based on your email provider)`
      },
      dkim: {
        configured: false,
        recommendation: 'Configure DKIM signing with your email provider. This adds a digital signature to verify your emails.'
      },
      dmarc: {
        configured: false,
        recommendation: `Add DMARC record to your DNS:\nv=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}\nThis helps protect against email spoofing.`
      },
      mx: {
        configured: false,
        recommendation: 'Ensure MX records are properly configured for your domain'
      }
    };
  }

  /**
   * Get deliverability tips based on email provider
   */
  static getProviderSpecificTips(provider: 'gmail' | 'outlook' | 'smtp'): string[] {
    const commonTips = [
      'Authenticate your domain with SPF, DKIM, and DMARC',
      'Maintain a clean sender reputation',
      'Avoid spam trigger words and phrases',
      'Include a clear unsubscribe link',
      'Use a consistent "From" address',
      'Keep your email list clean and engaged',
      'Avoid sending too many emails too quickly'
    ];

    const providerTips: Record<string, string[]> = {
      gmail: [
        ...commonTips,
        'Gmail requires proper authentication for bulk sending',
        'Use Gmail\'s Postmaster Tools to monitor reputation',
        'Avoid sending more than 500 emails per day from free Gmail accounts'
      ],
      outlook: [
        ...commonTips,
        'Microsoft uses SmartScreen filter - maintain good sender reputation',
        'Outlook is stricter with HTML emails - test thoroughly',
        'Use Microsoft\'s SNDS (Smart Network Data Services) to monitor'
      ],
      smtp: [
        ...commonTips,
        'Warm up your IP address gradually when starting',
        'Monitor bounce rates and remove invalid addresses',
        'Implement feedback loops with major ISPs',
        'Consider using a dedicated IP for high-volume sending'
      ]
    };

    return providerTips[provider] || commonTips;
  }

  /**
   * Generate deliverability report
   */
  static generateDeliverabilityReport(
    spamCheck: SpamCheckResult,
    fromDomain: string,
    provider: 'gmail' | 'outlook' | 'smtp'
  ): {
    overallScore: 'excellent' | 'good' | 'fair' | 'poor';
    summary: string;
    criticalIssues: string[];
    recommendations: string[];
    providerTips: string[];
  } {
    let overallScore: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (spamCheck.score < 2) {
      overallScore = 'excellent';
    } else if (spamCheck.score < 4) {
      overallScore = 'good';
    } else if (spamCheck.score < 6) {
      overallScore = 'fair';
    } else {
      overallScore = 'poor';
    }

    const criticalIssues = spamCheck.issues.filter(issue => 
      issue.includes('JavaScript') || 
      issue.includes('all caps') || 
      issue.includes('No subject')
    );

    const summary = overallScore === 'excellent' 
      ? 'Your email has excellent deliverability. It\'s unlikely to be marked as spam.'
      : overallScore === 'good'
      ? 'Your email has good deliverability. Minor improvements could help.'
      : overallScore === 'fair'
      ? 'Your email may have deliverability issues. Please review recommendations.'
      : 'Your email is likely to be marked as spam. Please address critical issues.';

    return {
      overallScore,
      summary,
      criticalIssues,
      recommendations: spamCheck.recommendations,
      providerTips: this.getProviderSpecificTips(provider)
    };
  }

  /**
   * Sanitize HTML to prevent spam issues
   */
  static sanitizeHtmlForEmail(html: string): string {
    let sanitized = html;

    // Remove scripts
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove forms
    sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    // Remove iframes
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove on* event handlers
    sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove potentially dangerous attributes
    sanitized = sanitized.replace(/\s(onerror|onload|onclick)\s*=/gi, '');

    return sanitized;
  }

  /**
   * Automatically optimize email content to reduce spam score
   */
  static optimizeEmailContent(subject: string, body: string): {
    optimizedSubject: string;
    optimizedBody: string;
    changes: string[];
  } {
    const changes: string[] = [];
    let optimizedSubject = subject;
    let optimizedBody = body;

    // Fix subject line
    if (optimizedSubject) {
      // Remove excessive exclamation marks (keep max 1)
      const exclamationCount = (optimizedSubject.match(/!/g) || []).length;
      if (exclamationCount > 1) {
        optimizedSubject = optimizedSubject.replace(/!+/g, '!');
        changes.push('Reduced excessive exclamation marks in subject');
      }

      // Convert all caps to title case
      if (optimizedSubject === optimizedSubject.toUpperCase() && optimizedSubject.length > 3) {
        optimizedSubject = optimizedSubject
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        changes.push('Converted all-caps subject to title case');
      }

      // Remove spam trigger words with alternatives
      const replacements: Record<string, string> = {
        'FREE!!!': 'Complimentary',
        'FREE!!': 'Complimentary',
        'FREE!': 'Complimentary',
        'FREE': 'No cost',
        'WINNER': 'Selected',
        'CLICK HERE': 'Learn more',
        'ACT NOW': 'Available today',
        'LIMITED TIME': 'Available soon',
        'URGENT': 'Important'
      };

      for (const [spam, alternative] of Object.entries(replacements)) {
        if (optimizedSubject.toUpperCase().includes(spam)) {
          optimizedSubject = optimizedSubject.replace(new RegExp(spam, 'gi'), alternative);
          changes.push(`Replaced "${spam}" with "${alternative}"`);
        }
      }
    }

    // Fix body content
    if (optimizedBody) {
      // Remove excessive punctuation
      optimizedBody = optimizedBody.replace(/!!!+/g, '!');
      optimizedBody = optimizedBody.replace(/\?\?\?+/g, '?');
      
      if (optimizedBody !== body) {
        changes.push('Removed excessive punctuation from body');
      }
    }

    return {
      optimizedSubject,
      optimizedBody,
      changes
    };
  }

  /**
   * Validate recipient email address
   */
  static validateRecipientEmail(email: string): {
    isValid: boolean;
    reason?: string;
    suggestions?: string[];
  } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        reason: 'Invalid email format',
        suggestions: ['Check for typos', 'Ensure proper format (user@domain.com)']
      };
    }

    const [localPart, domain] = email.split('@');
    
    // Check for common typos
    const commonDomainTypos: Record<string, string> = {
      'gmial.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'outlok.com': 'outlook.com',
      'hotmial.com': 'hotmail.com'
    };

    if (commonDomainTypos[domain.toLowerCase()]) {
      return {
        isValid: true,
        reason: 'Possible typo in domain',
        suggestions: [`Did you mean ${commonDomainTypos[domain.toLowerCase()]}?`]
      };
    }

    // Check for disposable email domains
    const disposableDomains = [
      'tempmail.com', 'throwaway.email', '10minutemail.com',
      'guerrillamail.com', 'mailinator.com'
    ];

    if (disposableDomains.includes(domain.toLowerCase())) {
      return {
        isValid: true,
        reason: 'Disposable email address detected',
        suggestions: ['Consider asking for a permanent email address']
      };
    }

    return { isValid: true };
  }
}
