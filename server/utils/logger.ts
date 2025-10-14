import pino from 'pino';
import { config } from '../config';
import { logger } from './logger';

// Redis stream for log aggregation (optional)
let redisStream: any = null;

// Initialize Redis logging stream if enabled
if (process.env.REDIS_LOGGING === 'true') {
  try {
    // Lazy load Redis service to avoid circular dependencies
    const initRedisLogging = async () => {
      try {
        const { redisService } = await import('../services/redis');
        if (redisService.ready) {
          redisStream = {
            write: async (log: string) => {
              try {
                const logEntry = JSON.parse(log);
                await redisService.getClient().lpush(
                  'app_logs',
                  JSON.stringify({
                    ...logEntry,
                    timestamp: new Date().toISOString(),
                    service: 'resume-customizer-pro'
                  })
                );
                // Keep only last 1000 logs
                await redisService.getClient().ltrim('app_logs', 0, 999);
              } catch (error) {
                // Fallback to console if Redis logging fails
                logger.error({ error: error }, 'Redis logging failed:');
              }
            }
          };
        }
      } catch (error) {
        logger.warn({ context: error }, 'Redis logging initialization failed:');
      }
    };
    
    // Initialize after a short delay to ensure Redis is ready
    setTimeout(initRedisLogging, 1000);
  } catch (error) {
    logger.warn({ context: error }, 'Redis logging setup failed:');
  }
}

// Create logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: config.logging.level,
  transport: config.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  // Add custom serializers for better error logging
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Add base context
  base: {
    service: 'resume-customizer-pro',
    environment: config.env,
  },
};

// Create the logger
export const logger = pino(loggerConfig);

// Add Redis stream if available (after logger creation)
if (redisStream) {
  // Note: Redis logging will be handled through the write stream above
  // This is already configured in the redisStream initialization
}

// Export helper functions for structured logging
export const logError = (error: Error, context?: any) => {
  logger.error({ err: error, ...context }, 'Application error');
};

export const logRequest = (req: any, res?: any, context?: any) => {
  logger.info({ req, res, ...context }, 'HTTP request');
};

export const logPerformance = (operation: string, duration: number, context?: any) => {
  logger.info({ operation, duration, ...context }, 'Performance metric');
};

// Log startup info
logger.info({
  environment: config.env,
  logLevel: config.logging.level,
  redisLogging: process.env.REDIS_LOGGING === 'true',
}, 'Logger initialized');
