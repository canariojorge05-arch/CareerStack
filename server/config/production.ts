/**
 * Production Configuration
 * Complete setup for production-ready deployment with 100+ concurrent users
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from '../utils/logger';
import { initializeDatabase, closeDatabase } from './database';
import { closeRedis } from './redis';
import QueueManager from '../services/queueManager';
import { MonitoringService, ResourceManager } from '../services/monitoringService';
import {
  globalRateLimiter,
  authRateLimiter,
  emailSendRateLimiter,
  apiRateLimiter,
} from '../middleware/rateLimiter';
import jwtAuth from '../middleware/jwtAuth';

export interface ProductionConfig {
  port: number;
  environment: string;
  enableCors: boolean;
  enableCompression: boolean;
  enableMetrics: boolean;
  logLevel: string;
  database: {
    maxConnections: number;
    minConnections: number;
  };
  redis: {
    cluster: boolean;
  };
  security: {
    enableHelmet: boolean;
    enableRateLimiting: boolean;
    enableCsrf: boolean;
  };
  monitoring: {
    enabled: boolean;
    interval: number; // seconds
  };
  cleanup: {
    enabled: boolean;
    interval: number; // hours
  };
}

/**
 * Get production configuration from environment
 */
export function getProductionConfig(): ProductionConfig {
  return {
    port: parseInt(process.env.PORT || '3000'),
    environment: process.env.NODE_ENV || 'production',
    enableCors: process.env.ENABLE_CORS !== 'false',
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    logLevel: process.env.LOG_LEVEL || 'info',
    database: {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
    },
    redis: {
      cluster: process.env.REDIS_CLUSTER === 'true',
    },
    security: {
      enableHelmet: process.env.ENABLE_HELMET !== 'false',
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      enableCsrf: process.env.ENABLE_CSRF === 'true',
    },
    monitoring: {
      enabled: process.env.ENABLE_MONITORING !== 'false',
      interval: parseInt(process.env.MONITORING_INTERVAL || '30'),
    },
    cleanup: {
      enabled: process.env.ENABLE_CLEANUP !== 'false',
      interval: parseInt(process.env.CLEANUP_INTERVAL || '6'),
    },
  };
}

/**
 * Configure production middleware
 */
export function configureProductionMiddleware(app: Express, config: ProductionConfig): void {
  logger.info('Configuring production middleware...');
  
  // Security headers
  if (config.security.enableHelmet) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));
    logger.info('✓ Helmet security headers enabled');
  }
  
  // Response compression
  if (config.enableCompression) {
    app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Balanced compression level
      threshold: 1024, // Only compress responses > 1KB
    }));
    logger.info('✓ Response compression enabled');
  }
  
  // Global rate limiting
  if (config.security.enableRateLimiting) {
    app.use('/api/', globalRateLimiter);
    logger.info('✓ Global rate limiting enabled');
  }
  
  // Trust proxy (for load balancers)
  app.set('trust proxy', 1);
  logger.info('✓ Proxy trust enabled');
}

/**
 * Initialize all production services
 */
export async function initializeProductionServices(config: ProductionConfig): Promise<void> {
  logger.info('Initializing production services...');
  
  const initTasks = [];
  
  // Initialize database
  initTasks.push(
    initializeDatabase()
      .then(() => logger.info('✓ Database initialized'))
      .catch(err => {
        logger.error({ err }, '✗ Database initialization failed');
        throw err;
      })
  );
  
  // Initialize queue manager
  initTasks.push(
    QueueManager.initialize()
      .then(() => logger.info('✓ Queue manager initialized'))
      .catch(err => {
        logger.error({ err }, '✗ Queue manager initialization failed');
        throw err;
      })
  );
  
  await Promise.all(initTasks);
  
  // Start monitoring
  if (config.monitoring.enabled) {
    MonitoringService.startMonitoring(config.monitoring.interval);
    logger.info('✓ Resource monitoring started');
  }
  
  // Start periodic cleanup
  if (config.cleanup.enabled) {
    ResourceManager.startPeriodicCleanup(config.cleanup.interval);
    logger.info('✓ Periodic cleanup started');
  }
  
  logger.info('All production services initialized successfully');
}

/**
 * Setup health check endpoint
 */
export function setupHealthCheck(app: Express): void {
  app.get('/health', async (req, res) => {
    try {
      const health = await MonitoringService.performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });
  
  app.get('/health/ready', async (req, res) => {
    try {
      const health = await MonitoringService.performHealthCheck();
      if (health.status === 'healthy' || health.status === 'degraded') {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false });
      }
    } catch (error) {
      res.status(503).json({ ready: false });
    }
  });
  
  app.get('/health/live', (req, res) => {
    res.status(200).json({ alive: true });
  });
  
  logger.info('✓ Health check endpoints configured');
}

/**
 * Setup metrics endpoint
 */
export function setupMetricsEndpoint(app: Express): void {
  app.get('/metrics', jwtAuth.jwtAuthMiddleware, jwtAuth.requireRole('admin'), async (req, res) => {
    try {
      const metrics = MonitoringService.getMetricsSummary();
      const health = await MonitoringService.performHealthCheck();
      const queueStats = await QueueManager.getAllStats();
      
      res.json({
        system: metrics,
        health,
        queues: queueStats,
      });
    } catch (error) {
      logger.error({ error }, 'Metrics retrieval failed');
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });
  
  logger.info('✓ Metrics endpoint configured');
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');
  
  try {
    // Stop accepting new connections
    logger.info('Closing server...');
    
    // Close queue manager
    logger.info('Closing queue manager...');
    await QueueManager.closeAll();
    
    // Close database connections
    logger.info('Closing database connections...');
    await closeDatabase();
    
    // Close Redis connections
    logger.info('Closing Redis connections...');
    await closeRedis();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
export function setupGracefulShutdown(): void {
  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    gracefulShutdown('unhandledRejection');
  });
  
  logger.info('✓ Graceful shutdown handlers configured');
}

/**
 * Performance optimizations
 */
export function applyPerformanceOptimizations(): void {
  // Set NODE_ENV to production
  process.env.NODE_ENV = 'production';
  
  // Enable garbage collection logging in production
  if (process.env.LOG_GC === 'true') {
    // Expose GC for manual triggering
    if (global.gc) {
      logger.info('✓ Garbage collection available');
    }
  }
  
  // Set max listeners to avoid warnings
  process.setMaxListeners(20);
  
  logger.info('✓ Performance optimizations applied');
}

/**
 * Complete production setup
 */
export async function setupProduction(app: Express): Promise<void> {
  logger.info('🚀 Setting up production environment...');
  
  const config = getProductionConfig();
  logger.info({ config }, 'Production configuration loaded');
  
  // Apply performance optimizations
  applyPerformanceOptimizations();
  
  // Configure middleware
  configureProductionMiddleware(app, config);
  
  // Setup health checks and metrics
  setupHealthCheck(app);
  
  if (config.enableMetrics) {
    setupMetricsEndpoint(app);
  }
  
  // Initialize services
  await initializeProductionServices(config);
  
  // Setup graceful shutdown
  setupGracefulShutdown();
  
  logger.info('✅ Production environment setup complete');
}

export default {
  getProductionConfig,
  setupProduction,
  gracefulShutdown,
  configureProductionMiddleware,
  initializeProductionServices,
};
