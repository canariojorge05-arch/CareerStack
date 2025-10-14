import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";
import { config } from 'dotenv';
import { logger } from './utils/logger';

// Ensure environment variables are loaded before accessing them
config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use HTTP adapter for better stability (no WebSocket issues)
logger.info('Connecting to Neon database via HTTP...');

// Configure Neon connection with pooling and performance options
const sql = neon(process.env.DATABASE_URL, {
  fetchOptions: {
    cache: 'no-store', // Disable caching for consistent reads
  },
  fullResults: false, // Reduce payload size
  arrayMode: false,
});

// Enable query logging in development
const enableQueryLogging = process.env.NODE_ENV === 'development' || process.env.ENABLE_QUERY_LOGGING === 'true';

export { sql };
export const db = drizzle(sql, { 
  schema,
  logger: enableQueryLogging // Log queries in development
});

// Query timeout wrapper for preventing long-running queries
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 10000 // 10 second default timeout
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Transaction helper with timeout
export async function executeTransaction<T>(
  callback: (tx: any) => Promise<T>,
  timeoutMs: number = 15000 // 15 second default for transactions
): Promise<T> {
  return queryWithTimeout(
    () => db.transaction(callback),
    timeoutMs
  );
}

// Test database connection on startup
export async function testDatabaseConnection() {
  try {
    logger.info('🔍 Testing database connection...');
    const result = await sql`SELECT NOW() as current_time`;
    logger.info('✅ Database connection successful');
    logger.info(`📅 Connected at: ${result[0].current_time}`);
    return true;
  } catch (error: any) {
    logger.error({ error: error?.message || error }, '❌ Database connection failed:');
    
    // Don't throw error, just warn - let the app continue in degraded mode
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('fetch failed')) {
      logger.warn('⚠️ Database appears to be unreachable. Some features may not work.');
      logger.warn('💡 Check if your Neon database is active at https://console.neon.tech/');
    }
    
    return false;
  }
}
