/**
 * Redis Integration Examples for Resume Customizer Pro
 * 
 * This file demonstrates how to properly use Redis throughout the application
 * for caching, session management, and performance optimization.
 */

import { redisService, sessionCache, apiCache, docxCache } from './redis';
import { circuitBreaker } from './circuit-breaker';
import { redisHealthMonitor } from './redis-health';
import { logger } from '../utils/logger';

/**
 * Example 1: Basic Caching with Error Handling
 */
export class UserProfileCache {
  private readonly CACHE_TTL = 300; // 5 minutes

  async getUserProfile(userId: string) {
    const cacheKey = `user_profile:${userId}`;
    
    try {
      // Try cache first
      const cached = await apiCache.get(cacheKey);
      if (cached) {
        logger.debug({ userId }, 'User profile cache hit');
        return cached;
      }

      // Fetch from database (mock)
      const profile = await this.fetchUserFromDB(userId);
      
      // Cache the result
      await apiCache.set(cacheKey, profile, this.CACHE_TTL);
      logger.debug({ userId }, 'User profile cached');
      
      return profile;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user profile from cache');
      // Fallback to database
      return await this.fetchUserFromDB(userId);
    }
  }

  private async fetchUserFromDB(userId: string) {
    // Mock database call
    return {
      id: userId,
      name: 'User Name',
      email: 'user@example.com',
      preferences: {}
    };
  }

  async invalidateUserProfile(userId: string) {
    await apiCache.del(`user_profile:${userId}`);
    logger.info({ userId }, 'User profile cache invalidated');
  }
}

/**
 * Example 2: Session Management with Redis
 */
export class SessionManager {
  async createSession(userId: string, sessionData: any) {
    const sessionId = this.generateSessionId();
    
    await sessionCache.set(sessionId, {
      userId,
      ...sessionData,
      createdAt: new Date().toISOString()
    });
    
    logger.info({ userId, sessionId }, 'Session created');
    return sessionId;
  }

  async getSession(sessionId: string) {
    try {
      const session = await sessionCache.get(sessionId);
      if (session) {
        logger.debug({ sessionId }, 'Session found');
        return session;
      }
      logger.warn({ sessionId }, 'Session not found');
      return null;
    } catch (error) {
      logger.error({ error, sessionId }, 'Session retrieval failed');
      return null;
    }
  }

  async destroySession(sessionId: string) {
    await sessionCache.del(sessionId);
    logger.info({ sessionId }, 'Session destroyed');
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Example 3: Circuit Breaker with Redis Persistence
 */
export class ExternalApiService {
  private readonly SERVICE_NAME = 'external-api';

  constructor() {
    this.initializeCircuitBreaker();
  }

  private async initializeCircuitBreaker() {
    await circuitBreaker.createBreaker(
      this.SERVICE_NAME,
      this.callExternalAPI.bind(this),
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        persistState: true,
        fallback: async () => {
          logger.warn('Using fallback response for external API');
          return { fallback: true, data: null };
        }
      }
    );
  }

  async makeAPICall(endpoint: string, data: any) {
    try {
      const result = await circuitBreaker.executeWithBreaker(
        this.SERVICE_NAME,
        this.callExternalAPI.bind(this),
        endpoint,
        data
      );
      return result;
    } catch (error) {
      logger.error({ error, endpoint }, 'External API call failed');
      throw error;
    }
  }

  private async callExternalAPI(endpoint: string, data: any) {
    // Mock external API call
    if (Math.random() < 0.1) { // 10% failure rate for demo
      throw new Error('External API error');
    }
    
    return {
      success: true,
      endpoint,
      data,
      timestamp: new Date().toISOString()
    };
  }

  getStats() {
    return circuitBreaker.getStats(this.SERVICE_NAME);
  }
}

/**
 * Example 4: Performance-Optimized Document Processing
 */
export class DocumentProcessor {
  async processDocument(buffer: Buffer, processingOptions: any) {
    const startTime = Date.now();
    
    try {
      // Use Redis-backed circuit breaker for external processing service
      const result = await circuitBreaker.executeWithBreaker(
        'document-processing',
        async () => {
          // This would integrate with your actual document processing
          return await this.performHeavyProcessing(buffer, processingOptions);
        }
      );

      const duration = Date.now() - startTime;
      logger.info({ duration, size: buffer.length }, 'Document processing completed');
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error, duration, size: buffer.length }, 'Document processing failed');
      throw error;
    }
  }

  private async performHeavyProcessing(buffer: Buffer, options: any) {
    // Simulate heavy processing
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      processed: true,
      size: buffer.length,
      options
    };
  }
}

/**
 * Example 5: Real-time Analytics with Redis
 */
export class AnalyticsService {
  async trackEvent(userId: string, event: string, properties: any = {}) {
    const timestamp = Date.now();
    const key = `analytics:${event}:${new Date().toISOString().split('T')[0]}`; // Daily buckets
    
    try {
      // Increment event counter
      await redisService.getClient().hincrby(key, 'count', 1);
      
      // Store event details
      await redisService.getClient().lpush(
        `analytics:events:${userId}`,
        JSON.stringify({
          event,
          properties,
          timestamp,
          userId
        })
      );
      
      // Keep only last 1000 events per user
      await redisService.getClient().ltrim(`analytics:events:${userId}`, 0, 999);
      
      // Set expiry for analytics data (30 days)
      await redisService.getClient().expire(key, 30 * 24 * 60 * 60);
      
      logger.debug({ userId, event }, 'Event tracked');
    } catch (error) {
      logger.error({ error, userId, event }, 'Event tracking failed');
    }
  }

  async getEventStats(event: string, days = 7): Promise<any[]> {
    const stats = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = `analytics:${event}:${date.toISOString().split('T')[0]}`;
      
      try {
        const count = await redisService.getClient().hget(key, 'count');
        stats.push({
          date: date.toISOString().split('T')[0],
          count: parseInt(count || '0')
        });
      } catch (error) {
        logger.error({ error, event, date }, 'Failed to get event stats');
        stats.push({
          date: date.toISOString().split('T')[0],
          count: 0
        });
      }
    }
    
    return stats.reverse();
  }
}

/**
 * Example 6: Rate Limiting with Redis
 */
export class RateLimiter {
  async isAllowed(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    
    try {
      const pipe = redisService.getClient().pipeline();
      
      // Remove old entries
      pipe.zremrangebyscore(`rate_limit:${key}`, 0, windowStart);
      
      // Count current entries
      pipe.zcard(`rate_limit:${key}`);
      
      // Add current request
      pipe.zadd(`rate_limit:${key}`, now, now);
      
      // Set expiry
      pipe.expire(`rate_limit:${key}`, windowSeconds);
      
      const results = await pipe.exec();
      
      if (!results) {
        logger.error({ key }, 'Rate limiter pipeline failed');
        return false;
      }
      
      const count = results[1][1] as number;
      const allowed = count < limit;
      
      if (!allowed) {
        logger.warn({ key, count, limit }, 'Rate limit exceeded');
      }
      
      return allowed;
    } catch (error) {
      logger.error({ error, key }, 'Rate limiter error');
      // Fail open - allow request if Redis is down
      return true;
    }
  }
}

/**
 * Example 7: Health Monitoring Integration
 */
export class ApplicationHealthService {
  async getSystemHealth() {
    try {
      const redisHealth = await redisHealthMonitor.getDetailedMetrics();
      
      return {
        timestamp: new Date().toISOString(),
        redis: redisHealth,
        overall: redisHealth.health.isConnected ? 'healthy' : 'degraded'
      };
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return {
        timestamp: new Date().toISOString(),
        redis: null,
        overall: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async clearCaches(pattern?: string) {
    if (pattern) {
      const cleared = await redisHealthMonitor.clearCacheByPattern(pattern);
      logger.info({ pattern, cleared }, 'Cache pattern cleared');
      return { cleared, pattern };
    } else {
      await redisHealthMonitor.clearAllCaches();
      logger.info('All caches cleared');
      return { cleared: 'all' };
    }
  }
}

/**
 * Export service instances for use in your application
 */
export const userProfileCache = new UserProfileCache();
export const sessionManager = new SessionManager();
export const externalApiService = new ExternalApiService();
export const documentProcessor = new DocumentProcessor();
export const analyticsService = new AnalyticsService();
export const rateLimiter = new RateLimiter();
export const applicationHealthService = new ApplicationHealthService();