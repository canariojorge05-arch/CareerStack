import { sendEmail } from '../utils/email';
import { EmailValidator } from '../utils/emailValidator';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  suggestions?: string[];
}

export class EmailService {
  /**
   * Send email with comprehensive validation and deliverability optimization
   */
  static async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Validate recipient email
      const validation = EmailValidator.validateEmailQuick(options.to);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.reason,
          suggestions: validation.suggestions
        };
      }

      // Normalize email
      const normalizedTo = EmailValidator.normalizeEmail(options.to);

      // Log email attempt
      logger.info(`📧 Attempting to send email to: ${normalizedTo}`);
      logger.info(`📧 Category: ${options.category || 'general'}`);
      logger.info(`📧 Priority: ${options.priority || 'normal'}`);

      // Send email with enhanced options
      const success = await sendEmail(
        normalizedTo,
        options.subject,
        options.html,
        options.attachments,
        {
          category: options.category,
          priority: options.priority,
          replyTo: options.replyTo
        }
      );

      if (success) {
        logger.info(`✅ Email sent successfully to: ${normalizedTo}`);
        return {
          success: true,
          messageId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        logger.error(`❌ Failed to send email to: ${normalizedTo}`);
        return {
          success: false,
          error: 'Failed to send email'
        };
      }
    } catch (error) {
      logger.error({ error: error }, 'EmailService error:');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send transactional email (high priority, immediate delivery)
   */
  static async sendTransactionalEmail(
    to: string,
    subject: string,
    html: string,
    category: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      category,
      priority: 'high',
      replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
    });
  }

  /**
   * Send notification email (normal priority)
   */
  static async sendNotificationEmail(
    to: string,
    subject: string,
    html: string,
    category: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      category,
      priority: 'normal'
    });
  }

  /**
   * Send marketing email (low priority, can be delayed)
   */
  static async sendMarketingEmail(
    to: string,
    subject: string,
    html: string,
    category: string
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      category,
      priority: 'low'
    });
  }

  /**
   * Validate email before sending (useful for forms)
   */
  static async validateEmailForSending(email: string): Promise<{
    isValid: boolean;
    normalizedEmail?: string;
    reason?: string;
    suggestions?: string[];
  }> {
    const validation = await EmailValidator.validateEmail(email);
    
    if (validation.isValid) {
      return {
        isValid: true,
        normalizedEmail: EmailValidator.normalizeEmail(email)
      };
    } else {
      return {
        isValid: false,
        reason: validation.reason,
        suggestions: validation.suggestions
      };
    }
  }

  /**
   * Check if email domain is likely to have good deliverability
   */
  static checkDeliverabilityRisk(email: string): {
    risk: 'low' | 'medium' | 'high';
    reasons: string[];
    recommendations: string[];
  } {
    const domain = email.split('@')[1]?.toLowerCase();
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let risk: 'low' | 'medium' | 'high' = 'low';

    if (!domain) {
      return {
        risk: 'high',
        reasons: ['Invalid email format'],
        recommendations: ['Use a valid email address']
      };
    }

    // Check if it's a major provider
    if (EmailValidator.isMajorProvider(email)) {
      reasons.push('Major email provider (good deliverability)');
    } else {
      risk = 'medium';
      reasons.push('Custom domain (may require additional setup)');
      recommendations.push('Ensure SPF, DKIM, and DMARC records are configured');
    }

    // Check for common issues
    if (domain.includes('-')) {
      reasons.push('Domain contains hyphens');
    }

    if (domain.length > 20) {
      risk = 'medium';
      reasons.push('Long domain name');
    }

    // Check for new TLDs
    const tld = domain.split('.').pop();
    const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil'];
    if (tld && !commonTlds.includes(tld)) {
      risk = 'medium';
      reasons.push('Uncommon top-level domain');
      recommendations.push('Monitor delivery rates carefully');
    }

    return { risk, reasons, recommendations };
  }

  /**
   * Get email statistics and recommendations
   */
  static getEmailStats(): {
    totalSent: number;
    successRate: number;
    recommendations: string[];
  } {
    // In a real implementation, this would pull from a database
    return {
      totalSent: 0,
      successRate: 100,
      recommendations: [
        'Monitor bounce rates and spam complaints',
        'Use consistent sender information',
        'Implement proper authentication (SPF, DKIM, DMARC)',
        'Maintain good sender reputation'
      ]
    };
  }
}
