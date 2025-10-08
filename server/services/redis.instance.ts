// This file is deprecated - use ./redis.ts instead
// Re-export everything from the main redis service

export {
  redisService as redisInstance,
  redisService as redis,
  sessionCache,
  apiCache,
  docxCache
} from './redis';
