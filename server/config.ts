import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

// Validate required environment variables (email fields are conditional)
const baseRequired = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'APP_URL',
];

// Email can be provided via generic SMTP vars (or provider-specific SMTP credentials).
const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
const hasGenericEmail = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

const missingBase = baseRequired.filter(varName => !process.env[varName]);
if (missingBase.length > 0) {
  throw new Error(`Missing required environment variables: ${missingBase.join(', ')}`);
}

if (!hasGenericEmail) {
  logger.warn('⚠️ Warning: No email configuration detected. Password reset and verification emails will not work until you configure EMAIL_* environment variables.');
}

// Application configuration
export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Database
  database: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_SSL === 'true',
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
      max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
    },
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m', // 15 minutes
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // 7 days
  },
  
  // Email
  email: {
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: process.env.GMAIL_ACCESS_TOKEN,
    },
    service: process.env.EMAIL_SERVICE || 'gmail',
    from: process.env.EMAIL_FROM || `"Resume Customizer Pro" <${process.env.EMAIL_USER}>`,
  },
  
  // Application
  app: {
    url: process.env.APP_URL!,
    name: 'Resume Customizer Pro',
    supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER!,
  },
  
  // Security
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
    accountLockout: {
      maxAttempts: 5,
      lockoutTime: 15 * 60 * 1000, // 15 minutes
    },
  },
  
  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxReconnectionAttempts: parseInt(process.env.REDIS_MAX_RECONNECTIONS || '10'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    enableReadyCheck: process.env.REDIS_READY_CHECK !== 'false',
    // Connection pool settings
    pool: {
      min: parseInt(process.env.REDIS_POOL_MIN || '2'),
      max: parseInt(process.env.REDIS_POOL_MAX || '10'),
    },
    // Persistence settings for production
    persistence: {
      rdbEnabled: process.env.REDIS_RDB_ENABLED === 'true',
      aofEnabled: process.env.REDIS_AOF_ENABLED === 'true',
      rdbSaveInterval: parseInt(process.env.REDIS_RDB_SAVE_INTERVAL || '900'), // 15 minutes
      aofSyncPolicy: process.env.REDIS_AOF_SYNC_POLICY || 'everysec',
    },
    // Cache TTL settings
    cacheTTL: {
      session: parseInt(process.env.REDIS_SESSION_TTL || '3600'), // 1 hour
      api: parseInt(process.env.REDIS_API_TTL || '300'), // 5 minutes  
      docx: parseInt(process.env.REDIS_DOCX_TTL || '86400'), // 24 hours
      rateLimit: parseInt(process.env.REDIS_RATE_LIMIT_TTL || '900'), // 15 minutes
      analytics: parseInt(process.env.REDIS_ANALYTICS_TTL || '2592000'), // 30 days
    },
    // Health monitoring
    monitoring: {
      enabled: process.env.REDIS_MONITORING_ENABLED !== 'false',
      checkInterval: parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
      latencyWarningThreshold: parseInt(process.env.REDIS_LATENCY_WARNING || '1000'), // 1000ms for dev
      latencyCriticalThreshold: parseInt(process.env.REDIS_LATENCY_CRITICAL || '2000'), // 2000ms for dev
    },
    // Cluster settings (for future scaling)
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES ? process.env.REDIS_CLUSTER_NODES.split(',') : [],
      enableReadyCheck: process.env.REDIS_CLUSTER_READY_CHECK !== 'false',
      maxRedirections: parseInt(process.env.REDIS_CLUSTER_MAX_REDIRECTIONS || '16'),
    },
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    file: process.env.LOG_FILE,
    errorFile: process.env.ERROR_LOG_FILE,
  },
} as const;

export type Config = typeof config;
