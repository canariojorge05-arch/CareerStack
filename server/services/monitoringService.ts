/**
 * Resource Monitoring and Health Checking Service
 * Tracks system resources, performance metrics, and health status
 */

import os from 'os';
import { logger } from '../utils/logger';
import { checkDatabaseHealth, getPoolStats } from '../config/database';
import { CacheService } from '../config/redis';
import QueueManager, { QueueName } from './queueManager';

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total?: number;
    free?: number;
    used?: number;
    usagePercent?: number;
  };
  process: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    pid: number;
  };
  timestamp: Date;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: {
      healthy: boolean;
      latency?: number;
      connections?: any;
      error?: string;
    };
    redis: {
      healthy: boolean;
      latency?: number;
      stats?: any;
      error?: string;
    };
    queues: {
      healthy: boolean;
      stats?: Record<string, any>;
      error?: string;
    };
    memory: {
      healthy: boolean;
      usagePercent: number;
    };
    cpu: {
      healthy: boolean;
      loadAverage: number;
    };
  };
  uptime: number;
}

/**
 * Monitoring Service for tracking system health and performance
 */
export class MonitoringService {
  private static metrics: SystemMetrics[] = [];
  private static maxMetricsHistory = 1000;
  private static alertThresholds = {
    cpuUsage: 80, // percentage
    memoryUsage: 85, // percentage
    diskUsage: 90, // percentage
    databaseConnections: 0.9, // 90% of max connections
    queueBacklog: 1000, // number of jobs
  };
  
  /**
   * Get current system metrics
   */
  static async getSystemMetrics(): Promise<SystemMetrics> {
    const cpuUsage = await this.getCpuUsage();
    const memInfo = this.getMemoryInfo();
    const diskInfo = await this.getDiskInfo();
    
    const metrics: SystemMetrics = {
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: memInfo,
      disk: diskInfo,
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
      timestamp: new Date(),
    };
    
    // Store metrics for historical tracking
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }
    
    // Check for alerts
    await this.checkAlerts(metrics);
    
    return metrics;
  }
  
  /**
   * Calculate CPU usage
   */
  private static async getCpuUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    const startTime = Date.now();
    
    // Wait 100ms to calculate usage
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endUsage = process.cpuUsage(startUsage);
    const endTime = Date.now();
    
    const elapsedTime = (endTime - startTime) * 1000; // Convert to microseconds
    const totalUsage = endUsage.user + endUsage.system;
    
    return Math.min(100, (totalUsage / elapsedTime) * 100);
  }
  
  /**
   * Get memory information
   */
  private static getMemoryInfo(): SystemMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total) * 100;
    
    return {
      total,
      free,
      used,
      usagePercent,
    };
  }
  
  /**
   * Get disk information
   */
  private static async getDiskInfo(): Promise<SystemMetrics['disk']> {
    try {
      // This is a simplified version - in production, use a proper disk monitoring library
      // For now, we'll return empty values
      return {};
    } catch (error) {
      logger.error({ error }, 'Failed to get disk info');
      return {};
    }
  }
  
  /**
   * Perform comprehensive health check
   */
  static async performHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {
      database: await this.checkDatabaseHealth(),
      redis: await this.checkRedisHealth(),
      queues: await this.checkQueuesHealth(),
      memory: this.checkMemoryHealth(),
      cpu: this.checkCpuHealth(),
    };
    
    // Determine overall status
    const allHealthy = Object.values(checks).every(check => check.healthy);
    const anyUnhealthy = Object.values(checks).some(check => !check.healthy);
    
    const status: HealthCheckResult['status'] = allHealthy
      ? 'healthy'
      : anyUnhealthy
      ? 'unhealthy'
      : 'degraded';
    
    return {
      status,
      timestamp: new Date(),
      checks,
      uptime: process.uptime(),
    };
  }
  
  /**
   * Check database health
   */
  private static async checkDatabaseHealth(): Promise<HealthCheckResult['checks']['database']> {
    try {
      const startTime = Date.now();
      const health = await checkDatabaseHealth();
      const latency = Date.now() - startTime;
      
      const poolStats = getPoolStats();
      const connectionUsage = poolStats.total / poolStats.maxConnections;
      
      return {
        healthy: health.healthy && connectionUsage < this.alertThresholds.databaseConnections,
        latency,
        connections: poolStats,
        error: health.error,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Check Redis health
   */
  private static async checkRedisHealth(): Promise<HealthCheckResult['checks']['redis']> {
    try {
      const startTime = Date.now();
      const stats = await CacheService.getStats();
      const latency = Date.now() - startTime;
      
      return {
        healthy: stats.connected,
        latency,
        stats,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Check queues health
   */
  private static async checkQueuesHealth(): Promise<HealthCheckResult['checks']['queues']> {
    try {
      const stats = await QueueManager.getAllStats();
      
      // Check if any queue has excessive backlog
      const hasBacklog = Object.values(stats).some((queueStats: any) => {
        const total = queueStats.waiting + queueStats.delayed;
        return total > this.alertThresholds.queueBacklog;
      });
      
      return {
        healthy: !hasBacklog,
        stats,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Check memory health
   */
  private static checkMemoryHealth(): HealthCheckResult['checks']['memory'] {
    const memInfo = this.getMemoryInfo();
    return {
      healthy: memInfo.usagePercent < this.alertThresholds.memoryUsage,
      usagePercent: memInfo.usagePercent,
    };
  }
  
  /**
   * Check CPU health
   */
  private static checkCpuHealth(): HealthCheckResult['checks']['cpu'] {
    const loadAverage = os.loadavg()[0]; // 1-minute load average
    const cpuCount = os.cpus().length;
    const normalizedLoad = (loadAverage / cpuCount) * 100;
    
    return {
      healthy: normalizedLoad < this.alertThresholds.cpuUsage,
      loadAverage,
    };
  }
  
  /**
   * Check for alerts based on metrics
   */
  private static async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts: string[] = [];
    
    // CPU alerts
    if (metrics.cpu.usage > this.alertThresholds.cpuUsage) {
      alerts.push(`High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
    }
    
    // Memory alerts
    if (metrics.memory.usagePercent > this.alertThresholds.memoryUsage) {
      alerts.push(`High memory usage: ${metrics.memory.usagePercent.toFixed(2)}%`);
    }
    
    // Disk alerts
    if (metrics.disk.usagePercent && metrics.disk.usagePercent > this.alertThresholds.diskUsage) {
      alerts.push(`High disk usage: ${metrics.disk.usagePercent.toFixed(2)}%`);
    }
    
    // Log alerts
    if (alerts.length > 0) {
      logger.warn({ alerts, metrics }, 'Resource alerts triggered');
      
      // Store alert in cache for dashboard
      await CacheService.set(
        'monitoring:last-alert',
        { alerts, timestamp: new Date() },
        300 // 5 minutes
      );
    }
  }
  
  /**
   * Get metrics history
   */
  static getMetricsHistory(minutes: number = 60): SystemMetrics[] {
    const since = Date.now() - minutes * 60 * 1000;
    return this.metrics.filter(m => m.timestamp.getTime() > since);
  }
  
  /**
   * Get metrics summary
   */
  static getMetricsSummary(): {
    current: SystemMetrics;
    average: {
      cpuUsage: number;
      memoryUsage: number;
      loadAverage: number;
    };
    peak: {
      cpuUsage: number;
      memoryUsage: number;
      loadAverage: number;
    };
  } {
    const recent = this.getMetricsHistory(60); // Last hour
    
    if (recent.length === 0) {
      const current = this.metrics[this.metrics.length - 1];
      return {
        current: current || {} as SystemMetrics,
        average: { cpuUsage: 0, memoryUsage: 0, loadAverage: 0 },
        peak: { cpuUsage: 0, memoryUsage: 0, loadAverage: 0 },
      };
    }
    
    const avgCpu = recent.reduce((sum, m) => sum + m.cpu.usage, 0) / recent.length;
    const avgMem = recent.reduce((sum, m) => sum + m.memory.usagePercent, 0) / recent.length;
    const avgLoad = recent.reduce((sum, m) => sum + m.cpu.loadAverage[0], 0) / recent.length;
    
    const peakCpu = Math.max(...recent.map(m => m.cpu.usage));
    const peakMem = Math.max(...recent.map(m => m.memory.usagePercent));
    const peakLoad = Math.max(...recent.map(m => m.cpu.loadAverage[0]));
    
    return {
      current: recent[recent.length - 1],
      average: {
        cpuUsage: avgCpu,
        memoryUsage: avgMem,
        loadAverage: avgLoad,
      },
      peak: {
        cpuUsage: peakCpu,
        memoryUsage: peakMem,
        loadAverage: peakLoad,
      },
    };
  }
  
  /**
   * Start periodic monitoring
   */
  static startMonitoring(intervalSeconds: number = 30): void {
    logger.info({ intervalSeconds }, 'Starting resource monitoring');
    
    // Collect metrics immediately
    this.getSystemMetrics().catch(err =>
      logger.error({ err }, 'Failed to get initial metrics')
    );
    
    // Set up periodic collection
    setInterval(async () => {
      try {
        await this.getSystemMetrics();
      } catch (error) {
        logger.error({ error }, 'Failed to collect metrics');
      }
    }, intervalSeconds * 1000);
  }
  
  /**
   * Cleanup old metrics
   */
  static cleanup(): void {
    const retentionHours = 24;
    const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
    
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
    
    logger.info(
      { retained: this.metrics.length, retentionHours },
      'Cleaned up old metrics'
    );
  }
}

/**
 * Resource Manager for automatic cleanup and optimization
 */
export class ResourceManager {
  /**
   * Perform automatic cleanup of resources
   */
  static async performCleanup(): Promise<void> {
    logger.info('Starting resource cleanup...');
    
    try {
      // Clean up old metrics
      MonitoringService.cleanup();
      
      // Clean up expired cache entries
      // Redis handles this automatically with TTL
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }
      
      logger.info('Resource cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Resource cleanup failed');
    }
  }
  
  /**
   * Optimize memory usage
   */
  static async optimizeMemory(): Promise<void> {
    try {
      const before = process.memoryUsage();
      
      // Clear internal caches
      MonitoringService.cleanup();
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const after = process.memoryUsage();
      const freed = before.heapUsed - after.heapUsed;
      
      logger.info(
        { freedBytes: freed, before, after },
        'Memory optimization completed'
      );
    } catch (error) {
      logger.error({ error }, 'Memory optimization failed');
    }
  }
  
  /**
   * Start periodic cleanup
   */
  static startPeriodicCleanup(intervalHours: number = 6): void {
    logger.info({ intervalHours }, 'Starting periodic cleanup');
    
    setInterval(() => {
      this.performCleanup().catch(err =>
        logger.error({ err }, 'Periodic cleanup failed')
      );
    }, intervalHours * 60 * 60 * 1000);
  }
}

// Start monitoring and cleanup if not in test environment
if (process.env.NODE_ENV !== 'test') {
  MonitoringService.startMonitoring(30); // Every 30 seconds
  ResourceManager.startPeriodicCleanup(6); // Every 6 hours
}

export default MonitoringService;
