import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

// Email signatures table schema (add to schema.ts)
export interface EmailSignature {
  id: string;
  userId: string;
  name: string;
  htmlContent: string;
  textContent: string;
  isDefault: boolean;
  isActive: boolean;
  category: 'professional' | 'personal' | 'marketing' | 'custom';
  variables: Record<string, string>; // Dynamic variables like name, title, etc.
  createdAt: Date;
  updatedAt: Date;
}

export interface SignatureTemplate {
  id: string;
  name: string;
  category: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
  preview: string;
}

export class EmailSignatureService {
  /**
   * Built-in professional signature templates
   */
  private static readonly SIGNATURE_TEMPLATES: SignatureTemplate[] = [
    {
      id: 'professional-1',
      name: 'Professional Standard',
      category: 'professional',
      htmlTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          <div style="margin-bottom: 8px;">
            <strong>{{fullName}}</strong><br>
            {{jobTitle}}<br>
            {{company}}
          </div>
          <div style="margin-bottom: 8px;">
            <span style="color: #666;">📧</span> {{email}}<br>
            <span style="color: #666;">📱</span> {{phone}}<br>
            {{#website}}<span style="color: #666;">🌐</span> <a href="{{website}}" style="color: #0066cc;">{{website}}</a><br>{{/website}}
          </div>
          {{#disclaimer}}<div style="font-size: 12px; color: #999; margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px;">{{disclaimer}}</div>{{/disclaimer}}
        </div>
      `,
      textTemplate: `
{{fullName}}
{{jobTitle}}
{{company}}

📧 {{email}}
📱 {{phone}}
{{#website}}🌐 {{website}}{{/website}}

{{#disclaimer}}{{disclaimer}}{{/disclaimer}}
      `,
      variables: ['fullName', 'jobTitle', 'company', 'email', 'phone', 'website', 'disclaimer'],
      preview: 'Clean professional signature with contact details'
    },
    {
      id: 'professional-2',
      name: 'Executive Style',
      category: 'professional',
      htmlTemplate: `
        <table style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #2c3e50;">
          <tr>
            <td style="padding-right: 20px; border-right: 3px solid #3498db; vertical-align: top;">
              {{#profileImage}}<img src="{{profileImage}}" alt="{{fullName}}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">{{/profileImage}}
            </td>
            <td style="padding-left: 20px; vertical-align: top;">
              <div style="margin-bottom: 5px;">
                <span style="font-size: 18px; font-weight: bold; color: #2c3e50;">{{fullName}}</span>
              </div>
              <div style="margin-bottom: 3px; color: #3498db; font-weight: 600;">{{jobTitle}}</div>
              <div style="margin-bottom: 8px; color: #7f8c8d;">{{company}}</div>
              <div style="font-size: 13px;">
                <div>📧 <a href="mailto:{{email}}" style="color: #2c3e50; text-decoration: none;">{{email}}</a></div>
                <div>📱 {{phone}}</div>
                {{#linkedin}}<div>💼 <a href="{{linkedin}}" style="color: #0077b5; text-decoration: none;">LinkedIn</a></div>{{/linkedin}}
              </div>
            </td>
          </tr>
        </table>
      `,
      textTemplate: `
{{fullName}}
{{jobTitle}}
{{company}}

📧 {{email}}
📱 {{phone}}
{{#linkedin}}💼 {{linkedin}}{{/linkedin}}
      `,
      variables: ['fullName', 'jobTitle', 'company', 'email', 'phone', 'linkedin', 'profileImage'],
      preview: 'Executive-style signature with photo and LinkedIn'
    },
    {
      id: 'marketing-1',
      name: 'Marketing Professional',
      category: 'marketing',
      htmlTemplate: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px 8px 0 0;">
            <div style="font-size: 18px; font-weight: bold;">{{fullName}}</div>
            <div style="font-size: 14px; opacity: 0.9;">{{jobTitle}} at {{company}}</div>
          </div>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <div style="margin-bottom: 10px;">
              <span style="display: inline-block; width: 20px;">📧</span> <a href="mailto:{{email}}" style="color: #495057; text-decoration: none;">{{email}}</a><br>
              <span style="display: inline-block; width: 20px;">📱</span> {{phone}}<br>
              {{#website}}<span style="display: inline-block; width: 20px;">🌐</span> <a href="{{website}}" style="color: #007bff;">{{website}}</a>{{/website}}
            </div>
            {{#socialLinks}}
            <div style="margin-top: 12px;">
              {{#twitter}}<a href="{{twitter}}" style="margin-right: 10px; color: #1da1f2; text-decoration: none;">Twitter</a>{{/twitter}}
              {{#linkedin}}<a href="{{linkedin}}" style="margin-right: 10px; color: #0077b5; text-decoration: none;">LinkedIn</a>{{/linkedin}}
              {{#instagram}}<a href="{{instagram}}" style="color: #e4405f; text-decoration: none;">Instagram</a>{{/instagram}}
            </div>
            {{/socialLinks}}
          </div>
        </div>
      `,
      textTemplate: `
{{fullName}}
{{jobTitle}} at {{company}}

📧 {{email}}
📱 {{phone}}
{{#website}}🌐 {{website}}{{/website}}

{{#twitter}}Twitter: {{twitter}}{{/twitter}}
{{#linkedin}}LinkedIn: {{linkedin}}{{/linkedin}}
{{#instagram}}Instagram: {{instagram}}{{/instagram}}
      `,
      variables: ['fullName', 'jobTitle', 'company', 'email', 'phone', 'website', 'twitter', 'linkedin', 'instagram'],
      preview: 'Colorful marketing signature with social media links'
    },
    {
      id: 'minimal-1',
      name: 'Minimal Clean',
      category: 'personal',
      htmlTemplate: `
        <div style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.4; color: #1d1d1f;">
          <div style="font-weight: 600; margin-bottom: 4px;">{{fullName}}</div>
          <div style="color: #86868b; margin-bottom: 8px;">{{jobTitle}}</div>
          <div style="font-size: 13px;">
            <a href="mailto:{{email}}" style="color: #007aff; text-decoration: none;">{{email}}</a>
            {{#phone}} • {{phone}}{{/phone}}
          </div>
        </div>
      `,
      textTemplate: `
{{fullName}}
{{jobTitle}}
{{email}}{{#phone}} • {{phone}}{{/phone}}
      `,
      variables: ['fullName', 'jobTitle', 'email', 'phone'],
      preview: 'Clean minimal signature inspired by Apple design'
    }
  ];

  /**
   * Create a new email signature
   */
  static async createSignature(
    userId: string,
    signatureData: {
      name: string;
      htmlContent: string;
      textContent: string;
      category: EmailSignature['category'];
      variables?: Record<string, string>;
      isDefault?: boolean;
    }
  ): Promise<{ success: boolean; signatureId?: string; error?: string }> {
    try {
      // If this is set as default, unset other default signatures
      if (signatureData.isDefault) {
        // This would update existing signatures to set isDefault = false
        logger.info('Setting other signatures as non-default');
      }

      // In a real implementation, this would insert into the database
      const signatureId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Creating signature:', {
        id: signatureId,
        userId,
        ...signatureData
      });

      return {
        success: true,
        signatureId
      };
    } catch (error) {
      logger.error({ error: error }, 'Error creating signature:');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create signature'
      };
    }
  }

  /**
   * Generate signature from template
   */
  static generateSignatureFromTemplate(
    templateId: string,
    variables: Record<string, string>
  ): { htmlContent: string; textContent: string; error?: string } {
    const template = this.SIGNATURE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return {
        htmlContent: '',
        textContent: '',
        error: 'Template not found'
      };
    }

    try {
      // Simple template processing (replace {{variable}} with values)
      let htmlContent = template.htmlTemplate;
      let textContent = template.textTemplate;

      // Process variables
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        htmlContent = htmlContent.replace(regex, value || '');
        textContent = textContent.replace(regex, value || '');
      });

      // Handle conditional blocks {{#variable}}...{{/variable}}
      htmlContent = this.processConditionalBlocks(htmlContent, variables);
      textContent = this.processConditionalBlocks(textContent, variables);

      // Clean up empty lines and extra spaces
      htmlContent = htmlContent.replace(/\n\s*\n/g, '\n').trim();
      textContent = textContent.replace(/\n\s*\n/g, '\n').trim();

      return { htmlContent, textContent };
    } catch (error) {
      return {
        htmlContent: '',
        textContent: '',
        error: 'Failed to process template'
      };
    }
  }

  /**
   * Process conditional blocks in templates
   */
  private static processConditionalBlocks(content: string, variables: Record<string, string>): string {
    // Handle {{#variable}}...{{/variable}} blocks
    const conditionalRegex = /{{#(\w+)}}(.*?){{\/\1}}/gs;
    
    return content.replace(conditionalRegex, (match, varName, blockContent) => {
      const value = variables[varName];
      return value && value.trim() ? blockContent : '';
    });
  }

  /**
   * Get signature templates
   */
  static getSignatureTemplates(category?: string): SignatureTemplate[] {
    if (category) {
      return this.SIGNATURE_TEMPLATES.filter(t => t.category === category);
    }
    return this.SIGNATURE_TEMPLATES;
  }

  /**
   * Get user's signatures
   */
  static async getUserSignatures(userId: string): Promise<EmailSignature[]> {
    // This would query the database for user's signatures
    // For now, return mock data
    return [
      {
        id: 'sig_1',
        userId,
        name: 'Default Professional',
        htmlContent: '<div>John Doe<br>Software Engineer</div>',
        textContent: 'John Doe\nSoftware Engineer',
        isDefault: true,
        isActive: true,
        category: 'professional',
        variables: {
          fullName: 'John Doe',
          jobTitle: 'Software Engineer'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Update signature
   */
  static async updateSignature(
    signatureId: string,
    userId: string,
    updates: Partial<EmailSignature>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would update the signature in the database
      logger.info('Updating signature:', signatureId, updates);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update signature'
      };
    }
  }

  /**
   * Delete signature
   */
  static async deleteSignature(
    signatureId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would delete the signature from the database
      logger.info('Deleting signature:', signatureId);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete signature'
      };
    }
  }

  /**
   * Get default signature for user
   */
  static async getDefaultSignature(userId: string): Promise<EmailSignature | null> {
    const signatures = await this.getUserSignatures(userId);
    return signatures.find(s => s.isDefault && s.isActive) || null;
  }

  /**
   * Auto-detect signature variables from user profile
   */
  static async autoDetectVariables(userId: string): Promise<Record<string, string>> {
    // This would query user profile data from the database
    // For now, return mock data
    return {
      fullName: 'John Doe',
      jobTitle: 'Software Engineer',
      company: 'Tech Corp',
      email: 'john.doe@techcorp.com',
      phone: '+1 (555) 123-4567',
      website: 'https://johndoe.dev',
      linkedin: 'https://linkedin.com/in/johndoe',
      twitter: 'https://twitter.com/johndoe'
    };
  }

  /**
   * Validate signature content
   */
  static validateSignature(htmlContent: string, textContent: string): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check content length
    if (htmlContent.length > 2000) {
      warnings.push('Signature is quite long and may be truncated in some email clients');
    }

    if (textContent.length > 500) {
      warnings.push('Text signature is long and may not display well on mobile devices');
    }

    // Check for common issues
    if (htmlContent.includes('<script')) {
      warnings.push('JavaScript is not allowed in email signatures');
    }

    if (htmlContent.includes('position: fixed') || htmlContent.includes('position: absolute')) {
      warnings.push('Fixed or absolute positioning may not work in email clients');
    }

    // Check for missing text version
    if (htmlContent && !textContent.trim()) {
      suggestions.push('Consider adding a text version for better compatibility');
    }

    // Check for accessibility
    if (htmlContent.includes('<img') && !htmlContent.includes('alt=')) {
      suggestions.push('Add alt text to images for better accessibility');
    }

    // Check for responsive design
    if (htmlContent.includes('width:') && !htmlContent.includes('max-width:')) {
      suggestions.push('Consider using max-width instead of fixed width for better mobile compatibility');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }

  /**
   * Preview signature with sample data
   */
  static previewSignature(
    htmlContent: string,
    textContent: string,
    variables?: Record<string, string>
  ): { htmlPreview: string; textPreview: string } {
    const sampleVariables = {
      fullName: 'John Doe',
      jobTitle: 'Software Engineer',
      company: 'Tech Corp',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      website: 'https://example.com',
      ...variables
    };

    let htmlPreview = htmlContent;
    let textPreview = textContent;

    // Replace variables with sample data
    Object.entries(sampleVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      htmlPreview = htmlPreview.replace(regex, value);
      textPreview = textPreview.replace(regex, value);
    });

    // Process conditional blocks
    htmlPreview = this.processConditionalBlocks(htmlPreview, sampleVariables);
    textPreview = this.processConditionalBlocks(textPreview, sampleVariables);

    return { htmlPreview, textPreview };
  }

  /**
   * Get signature usage statistics
   */
  static async getSignatureStats(userId: string): Promise<{
    totalSignatures: number;
    activeSignatures: number;
    mostUsedSignature: { name: string; usageCount: number } | null;
    categoryBreakdown: Record<string, number>;
  }> {
    // This would query actual usage statistics from the database
    return {
      totalSignatures: 3,
      activeSignatures: 2,
      mostUsedSignature: { name: 'Professional Standard', usageCount: 45 },
      categoryBreakdown: {
        professional: 2,
        personal: 1,
        marketing: 0,
        custom: 0
      }
    };
  }
}
