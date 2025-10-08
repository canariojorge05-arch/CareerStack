import { db } from '../db';
import { sql } from 'drizzle-orm';

// Email templates table schema (add to schema.ts)
export interface EmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[]; // Array of variable names like ['firstName', 'company']
  category: 'job_application' | 'follow_up' | 'networking' | 'general';
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailTemplateService {
  /**
   * Built-in professional email templates
   */
  private static readonly BUILT_IN_TEMPLATES = [
    {
      name: 'Job Application Follow-up',
      subject: 'Following up on {{position}} application',
      category: 'job_application',
      htmlBody: `
        <p>Dear {{hiringManager}},</p>
        <p>I hope this email finds you well. I wanted to follow up on my application for the {{position}} position at {{company}} that I submitted on {{applicationDate}}.</p>
        <p>I remain very interested in this opportunity and would welcome the chance to discuss how my {{skills}} experience can contribute to your team.</p>
        <p>Thank you for your time and consideration. I look forward to hearing from you.</p>
        <p>Best regards,<br>{{candidateName}}</p>
      `,
      variables: ['hiringManager', 'position', 'company', 'applicationDate', 'skills', 'candidateName']
    },
    {
      name: 'Interview Thank You',
      subject: 'Thank you for the {{position}} interview',
      category: 'job_application',
      htmlBody: `
        <p>Dear {{interviewer}},</p>
        <p>Thank you for taking the time to meet with me today to discuss the {{position}} role at {{company}}.</p>
        <p>I enjoyed our conversation about {{topicDiscussed}} and am even more excited about the opportunity to join your team.</p>
        <p>Please don't hesitate to reach out if you need any additional information from me.</p>
        <p>I look forward to the next steps in the process.</p>
        <p>Best regards,<br>{{candidateName}}</p>
      `,
      variables: ['interviewer', 'position', 'company', 'topicDiscussed', 'candidateName']
    },
    {
      name: 'Networking Introduction',
      subject: 'Introduction and networking opportunity',
      category: 'networking',
      htmlBody: `
        <p>Hello {{contactName}},</p>
        <p>I hope you're doing well. {{mutualConnection}} suggested I reach out to you regarding {{topic}}.</p>
        <p>I'm currently {{currentRole}} and am particularly interested in {{areaOfInterest}}. I would love to learn more about your experience at {{company}}.</p>
        <p>Would you be available for a brief 15-20 minute call in the coming weeks? I'm happy to work around your schedule.</p>
        <p>Thank you for your time.</p>
        <p>Best regards,<br>{{senderName}}</p>
      `,
      variables: ['contactName', 'mutualConnection', 'topic', 'currentRole', 'areaOfInterest', 'company', 'senderName']
    }
  ];

  /**
   * Process template with variables
   */
  static processTemplate(
    template: string,
    variables: Record<string, string>
  ): string {
    let processed = template;
    
    // Replace variables in format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, value || `[${key}]`);
    });

    // Highlight any remaining unprocessed variables
    processed = processed.replace(/{{(\w+)}}/g, '<span style="background-color: yellow; color: red;">[Missing: $1]</span>');

    return processed;
  }

  /**
   * Generate personalized email content using AI/templates
   */
  static async generatePersonalizedEmail(
    templateId: string,
    recipientData: {
      name?: string;
      company?: string;
      position?: string;
      email: string;
    },
    customVariables: Record<string, string> = {}
  ): Promise<{
    subject: string;
    htmlBody: string;
    textBody: string;
    variables: Record<string, string>;
  }> {
    // Get template (this would fetch from database in real implementation)
    const template = this.BUILT_IN_TEMPLATES.find(t => t.name === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Auto-generate some variables based on recipient data
    const autoVariables = {
      recipientName: recipientData.name || recipientData.email.split('@')[0],
      company: recipientData.company || 'your company',
      position: recipientData.position || 'the position',
      currentDate: new Date().toLocaleDateString(),
      ...customVariables
    };

    // Process template
    const subject = this.processTemplate(template.subject, autoVariables);
    const htmlBody = this.processTemplate(template.htmlBody, autoVariables);
    const textBody = htmlBody.replace(/<[^>]*>/g, ''); // Strip HTML for text version

    return {
      subject,
      htmlBody,
      textBody,
      variables: autoVariables
    };
  }

  /**
   * Smart email suggestions based on context
   */
  static suggestEmailContent(
    context: {
      type: 'job_application' | 'follow_up' | 'networking';
      recipientInfo?: any;
      previousEmails?: any[];
    }
  ): {
    suggestedSubjects: string[];
    suggestedOpeners: string[];
    suggestedClosings: string[];
  } {
    const suggestions = {
      job_application: {
        subjects: [
          'Application for {{position}} - {{candidateName}}',
          'Interest in {{position}} role at {{company}}',
          'Following up on {{position}} application'
        ],
        openers: [
          'I am writing to express my strong interest in the {{position}} position at {{company}}.',
          'I was excited to see the {{position}} opening at {{company}} and believe my background makes me an ideal candidate.',
          'I hope this email finds you well. I wanted to follow up on my application for the {{position}} role.'
        ],
        closings: [
          'Thank you for your time and consideration. I look forward to hearing from you.',
          'I would welcome the opportunity to discuss how I can contribute to your team.',
          'Please feel free to contact me if you need any additional information.'
        ]
      },
      networking: {
        subjects: [
          'Introduction from {{mutualConnection}}',
          'Networking opportunity - {{topic}}',
          'Learning about opportunities at {{company}}'
        ],
        openers: [
          '{{mutualConnection}} suggested I reach out to you regarding {{topic}}.',
          'I hope you\'re doing well. I\'m reaching out to learn more about your experience at {{company}}.',
          'I was impressed by your background in {{field}} and would love to connect.'
        ],
        closings: [
          'Thank you for your time. I look forward to connecting.',
          'I would appreciate any insights you might be willing to share.',
          'Please let me know if you\'d be available for a brief conversation.'
        ]
      },
      follow_up: {
        subjects: [
          'Following up on our conversation',
          'Next steps regarding {{topic}}',
          'Thank you for your time'
        ],
        openers: [
          'Thank you for taking the time to speak with me about {{topic}}.',
          'I wanted to follow up on our conversation regarding {{topic}}.',
          'I hope you\'re doing well. I wanted to circle back on {{topic}}.'
        ],
        closings: [
          'Please let me know if you need any additional information.',
          'I look forward to the next steps.',
          'Thank you again for your time and consideration.'
        ]
      }
    };

    const selected = suggestions[context.type] || suggestions.networking;
    return {
      suggestedSubjects: selected.subjects,
      suggestedOpeners: selected.openers,
      suggestedClosings: selected.closings
    };
  }

  /**
   * Validate email template for common issues
   */
  static validateTemplate(template: {
    subject: string;
    htmlBody: string;
    variables: string[];
  }): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for missing variables in content
    const subjectVars = (template.subject.match(/{{(\w+)}}/g) || []).map(v => v.slice(2, -2));
    const bodyVars = (template.htmlBody.match(/{{(\w+)}}/g) || []).map(v => v.slice(2, -2));
    const allUsedVars = [...new Set([...subjectVars, ...bodyVars])];

    const missingVars = allUsedVars.filter(v => !template.variables.includes(v));
    if (missingVars.length > 0) {
      warnings.push(`Missing variable definitions: ${missingVars.join(', ')}`);
    }

    // Check for unused variables
    const unusedVars = template.variables.filter(v => !allUsedVars.includes(v));
    if (unusedVars.length > 0) {
      suggestions.push(`Consider removing unused variables: ${unusedVars.join(', ')}`);
    }

    // Check subject length
    if (template.subject.length > 50) {
      warnings.push('Subject line is quite long and may be truncated in email clients');
    }

    // Check for personalization
    if (!template.subject.includes('{{') && !template.htmlBody.includes('{{')) {
      suggestions.push('Consider adding personalization variables to make emails more engaging');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }

  /**
   * Get template usage analytics
   */
  static getTemplateAnalytics(userId: string): Promise<{
    mostUsedTemplates: Array<{ name: string; usageCount: number }>;
    categoryBreakdown: Record<string, number>;
    successRate: number;
  }> {
    // This would query the database for actual usage statistics
    // For now, return mock data
    return Promise.resolve({
      mostUsedTemplates: [
        { name: 'Job Application Follow-up', usageCount: 25 },
        { name: 'Interview Thank You', usageCount: 18 },
        { name: 'Networking Introduction', usageCount: 12 }
      ],
      categoryBreakdown: {
        job_application: 60,
        networking: 25,
        follow_up: 15
      },
      successRate: 78.5
    });
  }
}
