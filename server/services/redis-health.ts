import { redisService } from './redis';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface RedisHealthMetrics {
  isConnected: boolean;
  latency: number;
  memoryUsage: string;
  memoryUsageBytes: number;
  memoryUsagePercent: number;
  connectedClients: number;
  totalCommandsProcessed: number;
  commandsPerSecond: number;
  cacheHitRate: number;
  errorRate: number;
  uptime: number;
  version: string;
  lastCheck: Date;
  errors: string[];
  warnings: string[];
  clusterInfo?: {
    mode: 'standalone' | 'cluster';
    nodeCount?: number;
    masterCount?: number;
    slaveCount?: number;
  };
}

export interface CacheMetrics {
  totalKeys: number;
  sessionKeys: number;
  apiKeys: number;
  docxKeys: number;
  analyticsKeys: number;
  rateLimit: number;
  memoryFootprint: {
    sessions: number;
    api: number;
    docx: number;
    analytics: number;
    rateLimit: number;
  };
}

export interface AlertConfig {
  enabled: boolean;
  latencyThreshold: number;
  errorRateThreshold: number;
  memoryThreshold: number;
  connectionThreshold: number;
  onAlert?: (alert: AlertInfo) => void;
}

export interface AlertInfo {
  type: 'latency' | 'error_rate' | 'memory' | 'connection' | 'cache_performance';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class RedisHealthMonitor {
  private lastHealthCheck: RedisHealthMetrics | null = null;
  private cacheMetrics: CacheMetrics | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private metricsHistory: RedisHealthMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 100; // Keep last 100 checks
  private previousCommandCount = 0;
  private previousCheckTime = Date.now();
  private alertConfig: AlertConfig;
  private readonly HEALTH_CHECK_INTERVAL: number;
  private readonly LATENCY_WARNING_THRESHOLD: number;
  private readonly LATENCY_CRITICAL_THRESHOLD: number;
  private readonly MEMORY_WARNING_THRESHOLD = 0.8; // 80% memory usage
  private readonly MEMORY_CRITICAL_THRESHOLD = 0.9; // 90% memory usage
  private alertCooldowns = new Map<string, number>();
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 minutes

  constructor(alertConfig?: Partial<AlertConfig>) {
    this.HEALTH_CHECK_INTERVAL = config.redis.monitoring.checkInterval;
    this.LATENCY_WARNING_THRESHOLD = config.redis.monitoring.latencyWarningThreshold;
    this.LATENCY_CRITICAL_THRESHOLD = config.redis.monitoring.latencyCriticalThreshold;
    
    this.alertConfig = {
      enabled: config.redis.monitoring.enabled,
      latencyThreshold: this.LATENCY_CRITICAL_THRESHOLD,
      errorRateThreshold: 0.05, // 5% error rate
      memoryThreshold: this.MEMORY_WARNING_THRESHOLD,
      connectionThreshold: 100, // Max connections warning
      ...alertConfig,
    };
    
    if (config.redis.monitoring.enabled) {
      this.startHealthChecks();
    }
  }

  public startHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Perform initial health check
    this.performHealthCheck();
  }

  public stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public async performHealthCheck(): Promise<RedisHealthMetrics> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let isConnected = false;
    let latency = 0;
    let info: any = {};

    try {
      // Test basic connectivity with timeout
      const pong = await Promise.race([
        redisService.getClient().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Command timed out')), 2000))
      ]) as string;
      
      if (pong === 'PONG') {
        isConnected = true;
        latency = Date.now() - startTime;
      }

      // Get comprehensive Redis info
      const [infoStr, dbSize, serviceMetrics] = await Promise.all([
        redisService.getClient().info(),
        redisService.getClient().dbsize(),
        redisService.getHealthMetrics(),
      ]);
      
      info = this.parseRedisInfo(infoStr);
      
      // Calculate memory usage percentage
      const maxMemory = parseInt(info.maxmemory) || 0;
      const usedMemory = parseInt(info.used_memory) || 0;
      const memoryUsagePercent = maxMemory > 0 ? (usedMemory / maxMemory) : 0;
      
      // Calculate commands per second
      const currentTime = Date.now();
      const timeDiff = (currentTime - this.previousCheckTime) / 1000; // Convert to seconds
      const currentCommandCount = parseInt(info.total_commands_processed) || 0;
      const commandsPerSecond = timeDiff > 0 ? 
        Math.round((currentCommandCount - this.previousCommandCount) / timeDiff) : 0;
        
      this.previousCommandCount = currentCommandCount;
      this.previousCheckTime = currentTime;

      // Get cluster information if available
      let clusterInfo: RedisHealthMetrics['clusterInfo'] | undefined;
      try {
        const clusterData = redisService.getClusterInfo();
        if (clusterData && (clusterData as any).nodes && Array.isArray((clusterData as any).nodes)) {
          const nodes = (clusterData as any).nodes;
          clusterInfo = {
            mode: 'cluster',
            nodeCount: nodes.length || 0,
            masterCount: nodes.filter((n: any) => n.flags && n.flags.includes('master')).length || 0,
            slaveCount: nodes.filter((n: any) => n.flags && n.flags.includes('slave')).length || 0,
          };
        } else {
          clusterInfo = { mode: 'standalone' };
        }
      } catch {
        clusterInfo = { mode: 'standalone' };
      }

      // Check various thresholds and add warnings/errors
      if (latency > this.LATENCY_CRITICAL_THRESHOLD) {
        errors.push(`Critical latency: ${latency}ms (threshold: ${this.LATENCY_CRITICAL_THRESHOLD}ms)`);
      } else if (latency > this.LATENCY_WARNING_THRESHOLD) {
        warnings.push(`High latency: ${latency}ms (threshold: ${this.LATENCY_WARNING_THRESHOLD}ms)`);
      }
      
      if (memoryUsagePercent > this.MEMORY_CRITICAL_THRESHOLD) {
        errors.push(`Critical memory usage: ${(memoryUsagePercent * 100).toFixed(1)}%`);
      } else if (memoryUsagePercent > this.MEMORY_WARNING_THRESHOLD) {
        warnings.push(`High memory usage: ${(memoryUsagePercent * 100).toFixed(1)}%`);
      }
      
      const connectedClients = parseInt(info.connected_clients) || 0;
      if (connectedClients > this.alertConfig.connectionThreshold) {
        warnings.push(`High client connection count: ${connectedClients}`);
      }
      
      // Check error rate from service metrics
      if (serviceMetrics.errorRate > this.alertConfig.errorRateThreshold * 100) {
        warnings.push(`High error rate: ${serviceMetrics.errorRate.toFixed(2)}%`);
      }

      const healthMetrics: RedisHealthMetrics = {
        isConnected,
        latency,
        memoryUsage: info.used_memory_human || 'unknown',
        memoryUsageBytes: usedMemory,
        memoryUsagePercent: memoryUsagePercent * 100, // Convert to percentage
        connectedClients,
        totalCommandsProcessed: currentCommandCount,
        commandsPerSecond,
        cacheHitRate: serviceMetrics.cacheHitRate,
        errorRate: serviceMetrics.errorRate,
        uptime: parseInt(info.uptime_in_seconds) || 0,
        version: info.redis_version || 'unknown',
        lastCheck: new Date(),
        errors,
        warnings,
        clusterInfo,
      };

      // Store in history
      this.metricsHistory.push(healthMetrics);
      if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
        this.metricsHistory.shift();
      }
      
      this.lastHealthCheck = healthMetrics;
      
      // Update cache metrics
      await this.updateCacheMetrics();
      
      // Process alerts
      if (this.alertConfig.enabled) {
        await this.processAlerts(healthMetrics);
      }

      // Log health status with appropriate level
      if (errors.length > 0) {
        logger.error({ metrics: healthMetrics }, 'Redis health check failed');
      } else if (warnings.length > 0) {
        logger.warn({ metrics: healthMetrics }, 'Redis health check has warnings');
      } else {
        logger.debug({ metrics: healthMetrics }, 'Redis health check passed');
      }

    } catch (error) {
      isConnected = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Health check failed: ${errorMessage}`);
      
      const healthMetrics: RedisHealthMetrics = {
        isConnected: false,
        latency: Date.now() - startTime,
        memoryUsage: 'unknown',
        memoryUsageBytes: 0,
        memoryUsagePercent: 0,
        connectedClients: 0,
        totalCommandsProcessed: 0,
        commandsPerSecond: 0,
        cacheHitRate: 0,
        errorRate: 100,
        uptime: 0,
        version: 'unknown',
        lastCheck: new Date(),
        errors,
        warnings: [],
      };
      
      this.lastHealthCheck = healthMetrics;
      logger.error({ error, metrics: healthMetrics }, 'Redis health check completely failed');
      
      return healthMetrics;
    }

    return this.lastHealthCheck!;
  }

  public getLastHealthCheck(): RedisHealthMetrics | null {
    return this.lastHealthCheck;
  }

  public async isHealthy(): Promise<boolean> {
    const health = await this.performHealthCheck();
    return health.isConnected && health.errors.length === 0;
  }

  private parseRedisInfo(infoStr: string): Record<string, string> {
    const info: Record<string, string> = {};
    const lines = infoStr.split('\r\n');

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        info[key] = value;
      }
    }

    return info;
  }

  public async getDetailedMetrics(): Promise<{
    health: RedisHealthMetrics;
    cacheStats: {
      docxCacheSize: number;
      sessionCacheSize: number;
      apiCacheSize: number;
    };
  }> {
    const health = await this.performHealthCheck();
    
    // Get cache statistics
    const [docxKeys, sessionKeys, apiKeys] = await Promise.all([
      redisService.getClient().keys('docx:*').catch(() => []),
      redisService.getClient().keys('session:*').catch(() => []),
      redisService.getClient().keys('api:*').catch(() => []),
    ]);

    return {
      health,
      cacheStats: {
        docxCacheSize: docxKeys.length,
        sessionCacheSize: sessionKeys.length,
        apiCacheSize: apiKeys.length,
      }
    };
  }

  public async clearAllCaches(): Promise<void> {
    try {
      const keys = await redisService.getClient().keys('*');
      if (keys.length > 0) {
        await redisService.getClient().del(...keys);
        logger.info({ keysCleared: keys.length }, 'All Redis caches cleared');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to clear Redis caches');
      throw error;
    }
  }

  public async clearCacheByPattern(pattern: string): Promise<number> {
    try {
      const keys = await redisService.getClient().keys(pattern);
      if (keys.length > 0) {
        await redisService.getClient().del(...keys);
        logger.info({ pattern, keysCleared: keys.length }, 'Redis cache pattern cleared');
      }
      return keys.length;
    } catch (error) {
      logger.error({ error, pattern }, 'Failed to clear Redis cache pattern');
      throw error;
    }
  }

  // Update cache metrics with detailed analysis
  private async updateCacheMetrics(): Promise<void> {
    try {
      const [sessionKeys, apiKeys, docxKeys, analyticsKeys, rateLimitKeys] = await Promise.all([
        redisService.getClient().keys('sess:*'),
        redisService.getClient().keys('api:*'),
        redisService.getClient().keys('docx:*'),
        redisService.getClient().keys('analytics:*'),
        redisService.getClient().keys('rate_limit:*'),
      ]);

      // Calculate approximate memory footprint (simplified)
      const memoryFootprint = {
        sessions: sessionKeys.length * 1024, // Approximate 1KB per session
        api: apiKeys.length * 512, // Approximate 512B per API cache
        docx: docxKeys.length * 5120, // Approximate 5KB per DOCX cache
        analytics: analyticsKeys.length * 256, // Approximate 256B per analytics entry
        rateLimit: rateLimitKeys.length * 128, // Approximate 128B per rate limit entry
      };

      this.cacheMetrics = {
        totalKeys: sessionKeys.length + apiKeys.length + docxKeys.length + analyticsKeys.length + rateLimitKeys.length,
        sessionKeys: sessionKeys.length,
        apiKeys: apiKeys.length,
        docxKeys: docxKeys.length,
        analyticsKeys: analyticsKeys.length,
        rateLimit: rateLimitKeys.length,
        memoryFootprint,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to update cache metrics');
    }
  }

  // Process alerts based on health metrics
  private async processAlerts(metrics: RedisHealthMetrics): Promise<void> {
    const now = Date.now();
    const alerts: AlertInfo[] = [];

    // Latency alert
    if (metrics.latency > this.alertConfig.latencyThreshold) {
      const alertKey = 'latency';
      if (!this.alertCooldowns.has(alertKey) || now - this.alertCooldowns.get(alertKey)! > this.ALERT_COOLDOWN_MS) {
        alerts.push({
          type: 'latency',
          severity: metrics.latency > this.LATENCY_CRITICAL_THRESHOLD ? 'critical' : 'warning',
          message: `Redis latency is ${metrics.latency}ms`,
          value: metrics.latency,
          threshold: this.alertConfig.latencyThreshold,
          timestamp: new Date(),
        });
        this.alertCooldowns.set(alertKey, now);
      }
    }

    // Error rate alert
    if (metrics.errorRate > this.alertConfig.errorRateThreshold * 100) {
      const alertKey = 'error_rate';
      if (!this.alertCooldowns.has(alertKey) || now - this.alertCooldowns.get(alertKey)! > this.ALERT_COOLDOWN_MS) {
        alerts.push({
          type: 'error_rate',
          severity: metrics.errorRate > 10 ? 'critical' : 'warning',
          message: `Redis error rate is ${metrics.errorRate.toFixed(2)}%`,
          value: metrics.errorRate,
          threshold: this.alertConfig.errorRateThreshold * 100,
          timestamp: new Date(),
        });
        this.alertCooldowns.set(alertKey, now);
      }
    }

    // Memory usage alert
    if (metrics.memoryUsagePercent > this.alertConfig.memoryThreshold * 100) {
      const alertKey = 'memory';
      if (!this.alertCooldowns.has(alertKey) || now - this.alertCooldowns.get(alertKey)! > this.ALERT_COOLDOWN_MS) {
        alerts.push({
          type: 'memory',
          severity: metrics.memoryUsagePercent > this.MEMORY_CRITICAL_THRESHOLD * 100 ? 'critical' : 'warning',
          message: `Redis memory usage is ${metrics.memoryUsagePercent.toFixed(1)}%`,
          value: metrics.memoryUsagePercent,
          threshold: this.alertConfig.memoryThreshold * 100,
          timestamp: new Date(),
        });
        this.alertCooldowns.set(alertKey, now);
      }
    }

    // Connection count alert
    if (metrics.connectedClients > this.alertConfig.connectionThreshold) {
      const alertKey = 'connection';
      if (!this.alertCooldowns.has(alertKey) || now - this.alertCooldowns.get(alertKey)! > this.ALERT_COOLDOWN_MS) {
        alerts.push({
          type: 'connection',
          severity: metrics.connectedClients > this.alertConfig.connectionThreshold * 1.5 ? 'critical' : 'warning',
          message: `Redis has ${metrics.connectedClients} connected clients`,
          value: metrics.connectedClients,
          threshold: this.alertConfig.connectionThreshold,
          timestamp: new Date(),
        });
        this.alertCooldowns.set(alertKey, now);
      }
    }

    // Cache performance alert (low hit rate)
    if (metrics.cacheHitRate < 50 && metrics.cacheHitRate > 0) {
      const alertKey = 'cache_performance';
      if (!this.alertCooldowns.has(alertKey) || now - this.alertCooldowns.get(alertKey)! > this.ALERT_COOLDOWN_MS) {
        alerts.push({
          type: 'cache_performance',
          severity: 'warning',
          message: `Low Redis cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`,
          value: metrics.cacheHitRate,
          threshold: 50,
          timestamp: new Date(),
        });
        this.alertCooldowns.set(alertKey, now);
      }
    }

    // Trigger alerts
    for (const alert of alerts) {
      if (this.alertConfig.onAlert) {
        this.alertConfig.onAlert(alert);
      }
      logger.warn({ alert }, `Redis Alert: ${alert.message}`);
    }
  }

  // Get historical metrics for trending
  public getMetricsHistory(count?: number): RedisHealthMetrics[] {
    const historyCount = Math.min(count || this.metricsHistory.length, this.metricsHistory.length);
    return this.metricsHistory.slice(-historyCount);
  }

  // Get performance trends
  public getPerformanceTrends(): {
    latencyTrend: 'improving' | 'degrading' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    errorRateTrend: 'improving' | 'degrading' | 'stable';
    averageLatency: number;
    averageMemoryUsage: number;
    averageErrorRate: number;
  } {
    if (this.metricsHistory.length < 2) {
      return {
        latencyTrend: 'stable',
        memoryTrend: 'stable',
        errorRateTrend: 'stable',
        averageLatency: this.lastHealthCheck?.latency || 0,
        averageMemoryUsage: this.lastHealthCheck?.memoryUsagePercent || 0,
        averageErrorRate: this.lastHealthCheck?.errorRate || 0,
      };
    }

    const recentMetrics = this.metricsHistory.slice(-10); // Last 10 checks
    const olderMetrics = this.metricsHistory.slice(-20, -10); // Previous 10 checks

    const getAverage = (metrics: RedisHealthMetrics[], field: keyof RedisHealthMetrics) => {
      const values = metrics.map(m => Number(m[field])).filter(v => !isNaN(v));
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    };

    const recentLatency = getAverage(recentMetrics, 'latency');
    const olderLatency = getAverage(olderMetrics, 'latency');
    const recentMemory = getAverage(recentMetrics, 'memoryUsagePercent');
    const olderMemory = getAverage(olderMetrics, 'memoryUsagePercent');
    const recentErrorRate = getAverage(recentMetrics, 'errorRate');
    const olderErrorRate = getAverage(olderMetrics, 'errorRate');

    const getTrend = (recent: number, older: number, threshold = 0.1): 'improving' | 'degrading' | 'stable' => {
      const diff = (recent - older) / (older || 1);
      if (Math.abs(diff) < threshold) return 'stable';
      return diff > 0 ? 'degrading' : 'improving';
    };

    const getMemoryTrend = (recent: number, older: number, threshold = 0.1): 'increasing' | 'decreasing' | 'stable' => {
      const diff = (recent - older) / (older || 1);
      if (Math.abs(diff) < threshold) return 'stable';
      return diff > 0 ? 'increasing' : 'decreasing';
    };

    return {
      latencyTrend: getTrend(recentLatency, olderLatency),
      memoryTrend: getMemoryTrend(recentMemory, olderMemory),
      errorRateTrend: getTrend(olderErrorRate, recentErrorRate), // Reversed for error rate
      averageLatency: recentLatency,
      averageMemoryUsage: recentMemory,
      averageErrorRate: recentErrorRate,
    };
  }

  // Get current cache metrics
  public getCacheMetrics(): CacheMetrics | null {
    return this.cacheMetrics;
  }

  // Update alert configuration
  public updateAlertConfig(newConfig: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...newConfig };
    logger.info({ alertConfig: this.alertConfig }, 'Redis alert configuration updated');
  }

  // Force clear alert cooldowns (for testing or manual intervention)
  public clearAlertCooldowns(): void {
    this.alertCooldowns.clear();
    logger.info('Redis alert cooldowns cleared');
  }

  public cleanup(): void {
    this.stopHealthChecks();
    this.metricsHistory = [];
    this.alertCooldowns.clear();
  }
}

// Create singleton instance
export const redisHealthMonitor = new RedisHealthMonitor();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  redisHealthMonitor.cleanup();
});

process.on('SIGINT', () => {
  redisHealthMonitor.cleanup();
});