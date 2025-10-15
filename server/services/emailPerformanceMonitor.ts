import { logger } from '../utils/logger';
import { EmailCacheService } from './emailCacheService';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
}

export class EmailPerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 metrics
  private static syncTimes: number[] = [];
  private static cacheHits = 0;
  private static cacheMisses = 0;

  /**
   * Track an operation with timing
   */
  static async track<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let error: any;

    try {
      const result = await fn();
      return result;
    } catch (err) {
      success = false;
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date(),
        success,
        metadata: {
          ...metadata,
          error: error?.message
        }
      });

      // Log slow operations
      if (duration > 5000) {
        logger.warn(`⚠️  Slow operation detected: ${operation} took ${duration}ms`);
      }
    }
  }

  /**
   * Record a metric
   */
  private static recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Track sync times separately
    if (metric.operation === 'email_sync' && metric.success) {
      this.syncTimes.push(metric.duration);
      if (this.syncTimes.length > 100) {
        this.syncTimes.shift();
      }
    }
  }

  /**
   * Record cache hit/miss
   */
  static recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  /**
   * Get performance statistics
   */
  static async getStats(): Promise<{
    overall: {
      totalOperations: number;
      successRate: number;
      averageDuration: number;
      slowOperations: number;
    };
    sync: {
      averageSyncTime: number;
      minSyncTime: number;
      maxSyncTime: number;
      recentSyncs: number;
    };
    cache: {
      hitRate: number;
      hits: number;
      misses: number;
      totalKeys: number;
    };
    byOperation: Record<string, {
      count: number;
      averageDuration: number;
      successRate: number;
    }>;
  }> {
    const totalOps = this.metrics.length;
    const successfulOps = this.metrics.filter(m => m.success).length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const slowOps = this.metrics.filter(m => m.duration > 5000).length;

    // Calculate sync stats
    const avgSync = this.syncTimes.length > 0
      ? this.syncTimes.reduce((a, b) => a + b, 0) / this.syncTimes.length
      : 0;
    const minSync = this.syncTimes.length > 0 ? Math.min(...this.syncTimes) : 0;
    const maxSync = this.syncTimes.length > 0 ? Math.max(...this.syncTimes) : 0;

    // Calculate cache stats
    const totalCacheOps = this.cacheHits + this.cacheMisses;
    const hitRate = totalCacheOps > 0 ? (this.cacheHits / totalCacheOps) * 100 : 0;
    const cacheStats = await EmailCacheService.getCacheStats();

    // Group by operation
    const byOperation: Record<string, {
      count: number;
      averageDuration: number;
      successRate: number;
    }> = {};

    this.metrics.forEach(metric => {
      if (!byOperation[metric.operation]) {
        byOperation[metric.operation] = {
          count: 0,
          averageDuration: 0,
          successRate: 0
        };
      }
      byOperation[metric.operation].count++;
    });

    Object.keys(byOperation).forEach(op => {
      const opMetrics = this.metrics.filter(m => m.operation === op);
      const opDurations = opMetrics.map(m => m.duration);
      const opSuccesses = opMetrics.filter(m => m.success).length;
      
      byOperation[op].averageDuration = 
        opDurations.reduce((a, b) => a + b, 0) / opDurations.length;
      byOperation[op].successRate = (opSuccesses / opMetrics.length) * 100;
    });

    return {
      overall: {
        totalOperations: totalOps,
        successRate: totalOps > 0 ? (successfulOps / totalOps) * 100 : 0,
        averageDuration: totalOps > 0 ? totalDuration / totalOps : 0,
        slowOperations: slowOps
      },
      sync: {
        averageSyncTime: avgSync,
        minSyncTime: minSync,
        maxSyncTime: maxSync,
        recentSyncs: this.syncTimes.length
      },
      cache: {
        hitRate,
        hits: this.cacheHits,
        misses: this.cacheMisses,
        totalKeys: cacheStats.totalKeys
      },
      byOperation
    };
  }

  /**
   * Get recent metrics
   */
  static getRecentMetrics(limit: number = 50): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
    this.syncTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('🗑️  Cleared performance metrics');
  }

  /**
   * Log performance summary
   */
  static async logSummary(): Promise<void> {
    const stats = await this.getStats();
    
    logger.info('📊 Email Performance Summary:');
    logger.info(`   Total Operations: ${stats.overall.totalOperations}`);
    logger.info(`   Success Rate: ${stats.overall.successRate.toFixed(2)}%`);
    logger.info(`   Avg Duration: ${stats.overall.averageDuration.toFixed(2)}ms`);
    logger.info(`   Slow Operations: ${stats.overall.slowOperations}`);
    logger.info(`   Avg Sync Time: ${stats.sync.averageSyncTime.toFixed(2)}ms`);
    logger.info(`   Cache Hit Rate: ${stats.cache.hitRate.toFixed(2)}%`);
    logger.info(`   Cache Keys: ${stats.cache.totalKeys}`);
  }

  /**
   * Start periodic monitoring
   */
  static startPeriodicMonitoring(intervalMinutes: number = 30): NodeJS.Timeout {
    logger.info(`📊 Starting periodic performance monitoring (every ${intervalMinutes} minutes)`);
    
    return setInterval(async () => {
      await this.logSummary();
    }, intervalMinutes * 60 * 1000);
  }
}
