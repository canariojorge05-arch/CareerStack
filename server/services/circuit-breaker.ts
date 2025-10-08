import CircuitBreaker from 'opossum';
import type { Options, Stats } from 'opossum';
import { logger } from '../utils/logger';
import { redisService } from './redis';

export interface CircuitBreakerOptions extends Partial<Options> {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  fallback?: (...args: any[]) => Promise<any>;
  persistState?: boolean;
}

export type BreakerState = 'OPEN' | 'CLOSED' | 'HALF-OPEN';

export interface BreakerStats {
  state: BreakerState;
  failures: number;
  fallbacks: number;
  successes: number;
  rejects: number;
  timeouts: number;
  errorPercentage: number;
  latencyMean: number;
}

export interface PersistedBreakerState {
  name: string;
  state: BreakerState;
  failures: number;
  lastFailure?: number;
  resetAt?: number;
}

class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private readonly REDIS_KEY_PREFIX = 'circuit_breaker:';

  constructor() {
    // Initialize persisted states on startup
    this.loadPersistedStates();
  }

  private async loadPersistedStates(): Promise<void> {
    try {
      if (!redisService.ready) {
        logger.warn('Redis not ready, skipping circuit breaker state loading');
        return;
      }

      const pattern = `${this.REDIS_KEY_PREFIX}*`;
      const keys = await redisService.getClient().keys(pattern);
      
      for (const key of keys) {
        const stateData = await redisService.getClient().get(key);
        if (stateData) {
          const state: PersistedBreakerState = JSON.parse(stateData);
          logger.info({ state }, `Loaded circuit breaker state for ${state.name}`);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to load persisted circuit breaker states');
    }
  }

  private async persistState(name: string, breaker: CircuitBreaker): Promise<void> {
    try {
      if (!redisService.ready) return;

      const state: PersistedBreakerState = {
        name,
        state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED'),
        failures: breaker.stats.failures,
        lastFailure: Date.now(),
        resetAt: breaker.opened ? Date.now() + 30000 : undefined, // Default 30s reset
      };

      await redisService.getClient().set(
        `${this.REDIS_KEY_PREFIX}${name}`,
        JSON.stringify(state),
        'EX',
        3600 // 1 hour TTL
      );
    } catch (error) {
      logger.error({ error, name }, 'Failed to persist circuit breaker state');
    }
  }

  async createBreaker(
    name: string,
    fn: (...args: any[]) => Promise<any>,
    options: CircuitBreakerOptions = {}
  ): Promise<CircuitBreaker> {
    const breaker = new CircuitBreaker(fn, {
      timeout: options.timeout || 3000,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      resetTimeout: options.resetTimeout || 30000,
    });

    if (options.fallback) {
      breaker.fallback(options.fallback);
    }

    // Enhanced event handlers with Redis persistence
    breaker.on('open', async () => {
      logger.warn(`Circuit Breaker [${name}] is now OPEN`);
      if (options.persistState) {
        await this.persistState(name, breaker);
      }
    });

    breaker.on('halfOpen', async () => {
      logger.info(`Circuit Breaker [${name}] is now HALF-OPEN`);
      if (options.persistState) {
        await this.persistState(name, breaker);
      }
    });

    breaker.on('close', async () => {
      logger.info(`Circuit Breaker [${name}] is now CLOSED`);
      if (options.persistState) {
        await this.persistState(name, breaker);
      }
    });

    breaker.on('fallback', (result: any, err: any) => {
      logger.error({ err }, `Circuit Breaker [${name}] fallback executed`);
    });

    breaker.on('failure', async (err: any) => {
      logger.error({ err }, `Circuit Breaker [${name}] registered failure`);
      if (options.persistState) {
        await this.persistState(name, breaker);
      }
    });

    breaker.on('success', async () => {
      logger.debug(`Circuit Breaker [${name}] registered success`);
      if (options.persistState && breaker.opened) {
        // Clear persisted state on successful recovery
        await this.clearPersistedState(name);
      }
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  private async clearPersistedState(name: string): Promise<void> {
    try {
      if (!redisService.ready) return;
      await redisService.getClient().del(`${this.REDIS_KEY_PREFIX}${name}`);
    } catch (error) {
      logger.error({ error, name }, 'Failed to clear persisted circuit breaker state');
    }
  }

  getBreaker(name: string) {
    return this.breakers.get(name);
  }

  async executeWithBreaker(name: string, fn: (...args: any[]) => Promise<any>, ...args: any[]) {
    let breaker = this.getBreaker(name);
    if (!breaker) {
      breaker = await this.createBreaker(name, fn);
    }
    return breaker.fire(...args);
  }

  getStats(name: string) {
    const breaker = this.getBreaker(name);
    if (!breaker) return null;
    
    return {
      state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED'),
      failures: breaker.stats.failures,
      fallbacks: breaker.stats.fallbacks,
      successes: breaker.stats.successes,
      rejects: breaker.stats.rejects,
      timeouts: breaker.stats.timeouts,
    };
  }

  // Aggregate stats for all breakers
  getAllStats() {
    const result: Record<string, { state: 'open' | 'closed' | 'half-open'; failures: number; fallbacks: number; successes: number; rejects: number; timeouts: number; }> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      const state = breaker.opened ? 'open' : (breaker.halfOpen ? 'half-open' : 'closed');
      result[name] = {
        state,
        failures: breaker.stats.failures,
        fallbacks: breaker.stats.fallbacks,
        successes: breaker.stats.successes,
        rejects: breaker.stats.rejects,
        timeouts: breaker.stats.timeouts,
      };
    }
    return result;
  }
}

export const circuitBreaker = new CircuitBreakerService();
