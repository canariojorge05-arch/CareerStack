/**
 * Email Enhancements Configuration
 * Centralized configuration for all email enhancement features
 */

export const EMAIL_ENHANCEMENTS_CONFIG = {
  // Storage limits
  storage: {
    maxEmailSize: 10 * 1024 * 1024, // 10MB
    maxAttachmentSize: 25 * 1024 * 1024, // 25MB
    maxTotalAttachmentsSize: 50 * 1024 * 1024, // 50MB
    compressionThreshold: 1024, // 1KB
    warningSize: 5 * 1024 * 1024, // 5MB
    archiveAfterDays: 365, // Archive emails after 1 year
  },

  // Spam filtering
  spam: {
    threshold: 60, // Score above this = spam
    quarantineThreshold: 40, // Score above this = quarantine
    maxSpamScore: 100,
    confidenceThresholds: {
      high: 80,
      medium: 60,
      low: 30,
    },
  },

  // Export settings
  export: {
    maxExportSize: 500 * 1024 * 1024, // 500MB
    maxEmailsPerExport: 10000,
    supportedFormats: ['json', 'csv', 'mbox', 'eml'] as const,
    cleanupAfterHours: 24,
    exportDirectory: 'exports/emails',
  },

  // Signature settings
  signatures: {
    maxSignatureLength: 2000, // HTML content
    maxTextSignatureLength: 500,
    maxSignaturesPerUser: 10,
    categories: ['professional', 'personal', 'marketing', 'custom'] as const,
    requiredVariables: ['fullName', 'email'],
    optionalVariables: [
      'jobTitle', 'company', 'phone', 'website', 
      'linkedin', 'twitter', 'instagram', 'profileImage'
    ],
  },

  // Security settings
  security: {
    enableContentSanitization: true,
    enableSpamFiltering: true,
    enableAttachmentScanning: true,
    maxSuspiciousScore: 75,
    quarantineHighRiskEmails: true,
    logSecurityEvents: true,
  },

  // Performance settings
  performance: {
    enableCompression: true,
    enableCaching: true,
    cacheTTL: 300, // 5 minutes
    batchSize: 50,
    maxConcurrentOperations: 3,
    enableLazyLoading: true,
  },

  // Feature flags
  features: {
    enableAdvancedSearch: true,
    enableEmailAnalytics: true,
    enableTemplateEngine: true,
    enableAutoSignatures: true,
    enableSmartFiltering: true,
    enableExportScheduling: false, // Future feature
    enableAIAssistant: false, // Future feature
  },

  // Rate limiting
  rateLimits: {
    export: {
      maxPerHour: 5,
      maxPerDay: 20,
    },
    spam: {
      maxAnalysisPerMinute: 100,
    },
    signatures: {
      maxCreatedPerHour: 10,
    },
    storage: {
      maxValidationsPerMinute: 200,
    },
  },

  // Notification settings
  notifications: {
    enableStorageWarnings: true,
    enableSpamAlerts: true,
    enableExportNotifications: true,
    storageWarningThreshold: 80, // Percentage
    spamAlertThreshold: 10, // Spam emails per hour
  },

  // Integration settings
  integrations: {
    enableWebhooks: false, // Future feature
    enableAPIAccess: true,
    enableThirdPartyExports: false, // Future feature
  },
} as const;

// Type definitions for better TypeScript support
export type EmailEnhancementsConfig = typeof EMAIL_ENHANCEMENTS_CONFIG;
export type ExportFormat = typeof EMAIL_ENHANCEMENTS_CONFIG.export.supportedFormats[number];
export type SignatureCategory = typeof EMAIL_ENHANCEMENTS_CONFIG.signatures.categories[number];

// Helper functions for configuration access
export class EmailEnhancementsConfigHelper {
  /**
   * Check if a feature is enabled
   */
  static isFeatureEnabled(feature: keyof typeof EMAIL_ENHANCEMENTS_CONFIG.features): boolean {
    return EMAIL_ENHANCEMENTS_CONFIG.features[feature];
  }

  /**
   * Get storage limit for specific type
   */
  static getStorageLimit(type: 'email' | 'attachment' | 'total'): number {
    switch (type) {
      case 'email':
        return EMAIL_ENHANCEMENTS_CONFIG.storage.maxEmailSize;
      case 'attachment':
        return EMAIL_ENHANCEMENTS_CONFIG.storage.maxAttachmentSize;
      case 'total':
        return EMAIL_ENHANCEMENTS_CONFIG.storage.maxTotalAttachmentsSize;
      default:
        return EMAIL_ENHANCEMENTS_CONFIG.storage.maxEmailSize;
    }
  }

  /**
   * Get spam confidence level from score
   */
  static getSpamConfidence(score: number): 'low' | 'medium' | 'high' {
    const thresholds = EMAIL_ENHANCEMENTS_CONFIG.spam.confidenceThresholds;
    
    if (score >= thresholds.high || score <= (100 - thresholds.high)) {
      return 'high';
    } else if (score >= thresholds.medium || score <= (100 - thresholds.medium)) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Check if export format is supported
   */
  static isSupportedExportFormat(format: string): format is ExportFormat {
    return EMAIL_ENHANCEMENTS_CONFIG.export.supportedFormats.includes(format as ExportFormat);
  }

  /**
   * Get rate limit for specific operation
   */
  static getRateLimit(operation: string, period: 'minute' | 'hour' | 'day'): number {
    const limits = EMAIL_ENHANCEMENTS_CONFIG.rateLimits;
    
    switch (operation) {
      case 'export':
        return period === 'hour' ? limits.export.maxPerHour : limits.export.maxPerDay;
      case 'spam':
        return limits.spam.maxAnalysisPerMinute;
      case 'signatures':
        return limits.signatures.maxCreatedPerHour;
      case 'storage':
        return limits.storage.maxValidationsPerMinute;
      default:
        return 0;
    }
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get environment-specific configuration overrides
   */
  static getEnvironmentConfig(): Partial<EmailEnhancementsConfig> {
    const env = process.env.NODE_ENV || 'development';
    
    const overrides: Record<string, Partial<EmailEnhancementsConfig>> = {
      development: {
        performance: {
          ...EMAIL_ENHANCEMENTS_CONFIG.performance,
          enableCaching: false, // Disable caching in development
        } as any,
        security: {
          ...EMAIL_ENHANCEMENTS_CONFIG.security,
          logSecurityEvents: true,
        } as any,
      },
      production: {
        performance: {
          ...EMAIL_ENHANCEMENTS_CONFIG.performance,
          enableCaching: true,
          cacheTTL: 600, // 10 minutes in production
        } as any,
        security: {
          ...EMAIL_ENHANCEMENTS_CONFIG.security,
          enableContentSanitization: true,
          enableSpamFiltering: true,
        } as any,
      },
      test: {
        storage: {
          ...EMAIL_ENHANCEMENTS_CONFIG.storage,
          maxEmailSize: 1024 * 1024, // 1MB for testing
        } as any,
        rateLimits: {
          ...EMAIL_ENHANCEMENTS_CONFIG.rateLimits,
          export: { maxPerHour: 100, maxPerDay: 1000 }, // Higher limits for testing
        } as any,
      },
    };

    return overrides[env] || {};
  }
}

// Export default configuration with environment overrides
export const getEmailEnhancementsConfig = (): EmailEnhancementsConfig => {
  const baseConfig = EMAIL_ENHANCEMENTS_CONFIG;
  const envOverrides = EmailEnhancementsConfigHelper.getEnvironmentConfig();
  
  // Deep merge configuration (simple implementation)
  return {
    ...baseConfig,
    ...envOverrides,
    storage: { ...baseConfig.storage, ...envOverrides.storage },
    spam: { ...baseConfig.spam, ...envOverrides.spam },
    export: { ...baseConfig.export, ...envOverrides.export },
    signatures: { ...baseConfig.signatures, ...envOverrides.signatures },
    security: { ...baseConfig.security, ...envOverrides.security },
    performance: { ...baseConfig.performance, ...envOverrides.performance },
    features: { ...baseConfig.features, ...envOverrides.features },
    rateLimits: { ...baseConfig.rateLimits, ...envOverrides.rateLimits },
    notifications: { ...baseConfig.notifications, ...envOverrides.notifications },
    integrations: { ...baseConfig.integrations, ...envOverrides.integrations },
  };
};
