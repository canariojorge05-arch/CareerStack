import Redis from 'ioredis';
import pino from 'pino';

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Redis configuration
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  maxReconnectionAttempts?: number;
}

const config: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  maxReconnectionAttempts: 10,
};

class RedisService {
  private readonly client: Redis;
  private readonly subscriber: Redis | null = null;
  private readonly connectionPool: Redis[] = [];
  private readonly POOL_SIZE = 5;
  private isReady = false;

  constructor(config: RedisConfig) {
    this.client = this.createClient(config);
    this.initializeEventHandlers(this.client);
    this.createConnectionPool(config);
  }

  private createClient(config: RedisConfig): Redis {
    return new Redis({
      ...config,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      enableReadyCheck: config.enableReadyCheck !== false,
    });
  }

  private initializeEventHandlers(client: Redis): void {
    client
      .on('connect', () => {
        logger.info('Redis client connecting');
      })
      .on('ready', () => {
        this.isReady = true;
        logger.info('Redis client ready');
      })
      .on('error', (err: Error) => {
        logger.error({ err }, 'Redis client error');
      })
      .on('close', () => {
        this.isReady = false;
        logger.warn('Redis client closed');
      })
      .on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      })
      .on('end', () => {
        this.isReady = false;
        logger.warn('Redis client ended');
      });
  }

  private createConnectionPool(config: RedisConfig): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const client = this.createClient(config);
      this.connectionPool.push(client);
    }
  }

  private getPoolConnection(): Redis {
    return this.connectionPool[Math.floor(Math.random() * this.POOL_SIZE)];
  }

  public getClient(): Redis {
    return this.getPoolConnection();
  }

  public async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      await Promise.all([
        ...this.connectionPool.map(client => client.quit()),
        this.client.quit(),
        this.subscriber?.quit(),
      ]);
    } catch (error) {
      logger.error({ error }, 'Error during Redis cleanup');
    }
  }
}

// Create Redis service instance
const redis = new RedisService(config);

// Session cache - 1 hour TTL
export const sessionCache = {
  async get(key: string): Promise<any> {
    try {
      const data = await redis.getClient().get(`session:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, key }, 'Error getting session from cache');
      return null;
    }
  },
  async set(key: string, value: any): Promise<void> {
    try {
      await redis.getClient().set(
        `session:${key}`,
        JSON.stringify(value),
        'EX',
        3600 // 1 hour
      );
    } catch (error) {
      logger.error({ error, key }, 'Error setting session in cache');
    }
  },
  async del(key: string): Promise<void> {
    try {
      await redis.getClient().del(`session:${key}`);
    } catch (error) {
      logger.error({ error, key }, 'Error deleting session from cache');
    }
  }
};

// API response cache - 5 minutes TTL
export const apiCache = {
  async get(key: string): Promise<any> {
    try {
      const data = await redis.getClient().get(`api:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, key }, 'Error getting API response from cache');
      return null;
    }
  },
  async set(key: string, value: any, ttl = 300): Promise<void> { // 5 minutes default
    try {
      await redis.getClient().set(
        `api:${key}`,
        JSON.stringify(value),
        'EX',
        ttl
      );
    } catch (error) {
      logger.error({ error, key }, 'Error setting API response in cache');
    }
  },
  async del(key: string): Promise<void> {
    try {
      await redis.getClient().del(`api:${key}`);
    } catch (error) {
      logger.error({ error, key }, 'Error deleting API response from cache');
    }
  }
};

// DOCX processing cache - 1 day TTL
export const docxCache = {
  async get(key: string): Promise<any> {
    try {
      const data = await redis.getClient().get(`docx:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, key }, 'Error getting DOCX from cache');
      return null;
    }
  },
  async set(key: string, value: any): Promise<void> {
    try {
      await redis.getClient().set(
        `docx:${key}`,
        JSON.stringify(value),
        'EX',
        86400 // 24 hours
      );
    } catch (error) {
      logger.error({ error, key }, 'Error setting DOCX in cache');
    }
  }
};

export { redis };