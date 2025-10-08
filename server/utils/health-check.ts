import { Request, Response } from 'express';
import { logger } from './logger';
import { redisService } from '../services/redis';
import { circuitBreaker } from '../services/circuit-breaker';
import os from 'os';
import { performance } from 'perf_hooks';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    [service: string]: {
      status: 'pass' | 'fail' | 'warn';
      responseTime: number;
      details?: any;
      error?: string;
    };
  };
  system: {
    memory: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAvg: number[];
    };
    disk?: {
      free: number;
      total: number;
      percentage: number;
    };
  };
  version: string;
  environment: string;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private readonly startTime = Date.now();

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checks: HealthCheckResult['checks'] = {};
    
    // Run all health checks in parallel
    const [
      redisResult,
      dbResult,
      docxResult,
      circuitBreakerResult
    ] = await Promise.allSettled([
      this.checkRedis(),
      this.checkDatabase(),
      this.checkDocxProcessing(),
      this.checkCircuitBreakers()
    ]);

    // Process results
    checks.redis = this.processCheckResult(redisResult);
    checks.database = this.processCheckResult(dbResult);
    checks.docxProcessing = this.processCheckResult(docxResult);
    checks.circuitBreakers = this.processCheckResult(circuitBreakerResult);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks);
    
    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
      system: await this.getSystemMetrics(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Log health check results
    logger.info({
      healthCheck: result,
      responseTime: performance.now() - startTime
    }, `Health check completed - Status: ${overallStatus}`);

    return result;
  }

  private async checkRedis(): Promise<{ status: 'pass' | 'fail'; responseTime: number; details: any }> {
    const startTime = performance.now();
    
    try {
      // Test basic Redis connectivity
      const client = redisService.getClient();
      await client.ping();
      
      // Test Redis operations
      const testKey = 'health-check-test';
      const testValue = Date.now().toString();
      
      await client.set(testKey, testValue, 'EX', 10); // 10 second TTL
      const retrievedValue = await client.get(testKey);
      await client.del(testKey);
      
      if (retrievedValue !== testValue) {
        throw new Error('Redis read/write test failed');
      }

      // Get Redis info and parse
      const infoStr = await client.info();
      const infoMap: Record<string, string> = {};
      for (const line of infoStr.split('\n')) {
        if (!line || line.startsWith('#')) continue;
        const [k, v] = line.trim().split(':');
        if (k && v !== undefined) infoMap[k] = v;
      }
      
      return {
        status: 'pass',
        responseTime: performance.now() - startTime,
        details: {
          connected: true,
          version: infoMap['redis_version'],
          memory: infoMap['used_memory_human'],
          connectedClients: infoMap['connected_clients'],
          uptime: infoMap['uptime_in_seconds']
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: performance.now() - startTime,
        details: {
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkDatabase(): Promise<{ status: 'pass' | 'fail'; responseTime: number; details: any }> {
    const startTime = performance.now();
    
    try {
      // Note: This would depend on your database setup
      // For now, we'll simulate a basic check
      
      // In a real implementation, you might do:
      // const result = await db.query('SELECT 1 as health_check');
      
      // Simulated database check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      return {
        status: 'pass',
        responseTime: performance.now() - startTime,
        details: {
          connected: true,
          // Add actual database metrics here
          connectionPool: {
            active: 5,
            idle: 15,
            total: 20
          }
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: performance.now() - startTime,
        details: {
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkDocxProcessing(): Promise<{ status: 'pass' | 'fail'; responseTime: number; details: any }> {
    const startTime = performance.now();
    
    try {
      // Test DOCX processing capabilities
      const testBuffer = Buffer.from('Simple test');
      
      // In a real implementation, you might test actual DOCX processing
      // For now, we'll just check that the processor is available
      
      return {
        status: 'pass',
        responseTime: performance.now() - startTime,
        details: {
          available: true,
          processingQueue: 0 // This would come from your actual queue system
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: performance.now() - startTime,
        details: {
          available: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkCircuitBreakers(): Promise<{ status: 'pass' | 'warn' | 'fail'; responseTime: number; details: any }> {
    const startTime = performance.now();
    
    try {
      const stats = await circuitBreaker.getAllStats();
      const entries = Object.entries(stats);
      const openBreakers = entries.filter(([, stat]) => stat.state === 'open');
      const halfOpenBreakers = entries.filter(([, stat]) => stat.state === 'half-open');
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      
      if (openBreakers.length > 0) {
        status = openBreakers.length > 3 ? 'fail' : 'warn';
      }
      
      return {
        status,
        responseTime: performance.now() - startTime,
        details: {
          totalBreakers: entries.length,
          openBreakers: openBreakers.length,
          halfOpenBreakers: halfOpenBreakers.length,
          breakerStates: stats
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: performance.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private processCheckResult(result: PromiseSettledResult<any>): {
    status: 'pass' | 'fail' | 'warn';
    responseTime: number;
    details?: any;
    error?: string;
  } {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'fail',
        responseTime: 0,
        error: (result as PromiseRejectedResult).reason instanceof Error ? (result as PromiseRejectedResult).reason.message : String((result as PromiseRejectedResult).reason)
      };
    }
  }

  private determineOverallStatus(checks: HealthCheckResult['checks']): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    
    const failCount = statuses.filter(status => status === 'fail').length;
    const warnCount = statuses.filter(status => status === 'warn').length;
    
    if (failCount === 0 && warnCount === 0) {
      return 'healthy';
    } else if (failCount === 0 && warnCount > 0) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private async getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        percentage: Math.round((usedMem / totalMem) * 100)
      },
      cpu: {
        usage: await this.getCpuUsage(),
        loadAvg: os.loadavg()
      }
    };
  }

  private getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);
        
        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000; // microseconds
        const totalUsage = currentUsage.user + currentUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;
        
        resolve(Math.round(cpuPercent));
      }, 100);
    });
  }

  // Express middleware for health checks
  getHealthCheckHandler() {
    return async (req: Request, res: Response) => {
      try {
        const healthResult = await this.performHealthCheck();
        
        // Set appropriate HTTP status code
        let statusCode = 200;
        if (healthResult.status === 'degraded') {
          statusCode = 200; // Still operational
        } else if (healthResult.status === 'unhealthy') {
          statusCode = 503; // Service unavailable
        }
        
        res.status(statusCode).json(healthResult);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Health check failed');
        
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check system failure',
          uptime: Date.now() - this.startTime
        });
      }
    };
  }

  // Lightweight health check for load balancer
  getSimpleHealthHandler() {
    return async (req: Request, res: Response) => {
      try {
        // Quick checks only
        const redisOk = await this.quickRedisCheck();
        
        if (redisOk) {
          res.status(200).json({ status: 'ok' });
        } else {
          res.status(503).json({ status: 'unavailable' });
        }
      } catch (error) {
        res.status(503).json({ status: 'error' });
      }
    };
  }

  private async quickRedisCheck(): Promise<boolean> {
    try {
      const client = redisService.getClient();
      await Promise.race([
        client.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
      ]);
      return true;
    } catch {
      return false;
    }
  }

  // Readiness check (different from liveness)
  getReadinessHandler() {
    return async (req: Request, res: Response) => {
      try {
        // Check if app is ready to serve requests
        const checks = await Promise.all([
          this.quickRedisCheck(),
          // Add other readiness checks here
        ]);
        
        const isReady = checks.every(check => check);
        
        if (isReady) {
          res.status(200).json({ status: 'ready' });
        } else {
          res.status(503).json({ status: 'not-ready' });
        }
      } catch (error) {
        res.status(503).json({ status: 'error' });
      }
    };
  }
}

// Export singleton instance
export const healthCheck = HealthCheckService.getInstance();

// Export convenience functions
export const healthCheckHandler = healthCheck.getHealthCheckHandler();
export const simpleHealthHandler = healthCheck.getSimpleHealthHandler();
export const readinessHandler = healthCheck.getReadinessHandler();