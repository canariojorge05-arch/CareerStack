/**
 * Database Configuration with Connection Pooling and Performance Optimizations
 * Production-ready PostgreSQL configuration for 100+ concurrent users
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from '@shared/schema';
import { logger } from '../utils/logger';

// Calculate optimal pool size based on CPU cores and expected load
const CPU_CORES = parseInt(process.env.CPU_CORES || '4');
const MAX_CONNECTIONS = parseInt(process.env.DB_MAX_CONNECTIONS || `${CPU_CORES * 2 + 1}`);
const MIN_CONNECTIONS = parseInt(process.env.DB_MIN_CONNECTIONS || `${Math.max(2, Math.floor(MAX_CONNECTIONS / 4))}`);

// Connection pool configuration for high concurrency
const poolConfig: PoolConfig = {
  // Connection string
  connectionString: process.env.DATABASE_URL,
  
  // Connection pooling settings optimized for 100+ users
  max: MAX_CONNECTIONS, // Maximum number of clients in the pool (default: CPU_CORES * 2 + 1)
  min: MIN_CONNECTIONS, // Minimum number of clients to keep in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Error if connection takes more than 10 seconds
  
  // Statement timeout to prevent long-running queries
  statement_timeout: 30000, // 30 seconds max per query
  query_timeout: 30000,
  
  // Connection retry settings
  allowExitOnIdle: false, // Keep the pool alive
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false, // Set to true with proper certs in production
  } : false,
};

// Create connection pool
export const pool = new Pool(poolConfig);

// Pool event handlers for monitoring
pool.on('connect', (client) => {
  logger.debug('New database client connected');
  
  // Set optimal PostgreSQL settings for this connection
  client.query(`
    SET search_path TO public;
    SET timezone TO 'UTC';
    SET statement_timeout TO 30000;
    SET lock_timeout TO 10000;
    SET idle_in_transaction_session_timeout TO 60000;
  `).catch(err => logger.error({ err }, 'Failed to set connection parameters'));
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('release', (client) => {
  logger.debug('Client released back to pool');
});

pool.on('error', (err, client) => {
  logger.error({ err }, 'Unexpected database pool error');
});

pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

// Drizzle instance with connection pool
export const db = drizzle(pool, { schema, logger: false });

// Health check function
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  totalConnections: number;
  idleConnections: number;
  waitingConnections: number;
  error?: string;
}> {
  try {
    await pool.query('SELECT 1');
    return {
      healthy: true,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount,
    };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return {
      healthy: false,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get pool statistics
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    maxConnections: MAX_CONNECTIONS,
    minConnections: MIN_CONNECTIONS,
  };
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  try {
    logger.info('Closing database connections...');
    await pool.end();
    logger.info('Database connections closed successfully');
  } catch (error) {
    logger.error({ error }, 'Error closing database connections');
    throw error;
  }
}

// Transaction helper with automatic retry for deadlocks
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        return await callback(tx as typeof db);
      });
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a deadlock or serialization failure
      const isRetryable = 
        lastError.message.includes('deadlock') ||
        lastError.message.includes('could not serialize') ||
        lastError.message.includes('concurrent update');
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff before retry
      const delay = Math.pow(2, attempt) * 100;
      logger.warn(
        { attempt, error: lastError.message, retryIn: delay },
        'Transaction failed, retrying...'
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Transaction failed after retries');
}

// Execute raw query with connection pooling
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Batch insert helper for better performance
export async function batchInsert<T extends Record<string, any>>(
  table: string,
  records: T[],
  batchSize = 500
): Promise<void> {
  if (records.length === 0) return;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const columns = Object.keys(batch[0]);
    const values = batch.flatMap(record => 
      columns.map(col => record[col])
    );
    
    const placeholders = batch.map((_, idx) => 
      `(${columns.map((_, colIdx) => 
        `$${idx * columns.length + colIdx + 1}`
      ).join(', ')})`
    ).join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;
    
    await executeQuery(query, values);
  }
}

// Initialize database indexes for optimal performance
export async function initializeIndexes(): Promise<void> {
  const indexes = [
    // Email accounts indexes
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_accounts_user_id 
     ON email_accounts(user_id)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_accounts_email 
     ON email_accounts(email_address)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_accounts_provider 
     ON email_accounts(provider)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_accounts_active 
     ON email_accounts(is_active) WHERE is_active = true`,
    
    // Email messages indexes for fast queries
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_thread_id 
     ON email_messages(thread_id)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_account_id 
     ON email_messages(email_account_id)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_sent_at 
     ON email_messages(sent_at DESC)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_is_read 
     ON email_messages(is_read) WHERE is_read = false`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_is_starred 
     ON email_messages(is_starred) WHERE is_starred = true`,
    
    // Composite indexes for common queries
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_account_sent 
     ON email_messages(email_account_id, sent_at DESC)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_account_unread 
     ON email_messages(email_account_id, is_read) WHERE is_read = false`,
    
    // Email threads indexes
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_threads_user_id 
     ON email_threads(created_by)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_threads_last_message 
     ON email_threads(last_message_at DESC)`,
    
    // Full-text search index for email search
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_search 
     ON email_messages USING gin(to_tsvector('english', 
       COALESCE(subject, '') || ' ' || COALESCE(text_body, '')))`,
    
    // Users indexes
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
     ON users(email)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
     ON users(role)`,
    
    // Session indexes
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire 
     ON sessions(expire)`,
  ];
  
  for (const indexQuery of indexes) {
    try {
      await executeQuery(indexQuery);
      logger.info({ index: indexQuery.split('IF NOT EXISTS ')[1]?.split(' ON ')[0] }, 'Index created/verified');
    } catch (error) {
      logger.error({ error, query: indexQuery }, 'Failed to create index');
    }
  }
}

// Database maintenance tasks (run periodically)
export async function performMaintenance(): Promise<void> {
  try {
    logger.info('Starting database maintenance...');
    
    // Analyze tables for query planner
    await executeQuery('ANALYZE');
    
    // Clean up old sessions (older than 30 days)
    await executeQuery(`
      DELETE FROM sessions 
      WHERE expire < NOW() - INTERVAL '30 days'
    `);
    
    // Clean up expired email verification tokens
    await executeQuery(`
      UPDATE users 
      SET email_verification_token = NULL, 
          email_verification_expires = NULL
      WHERE email_verification_expires < NOW()
    `);
    
    // Clean up expired password reset tokens
    await executeQuery(`
      UPDATE users 
      SET password_reset_token = NULL, 
          password_reset_expires = NULL
      WHERE password_reset_expires < NOW()
    `);
    
    logger.info('Database maintenance completed');
  } catch (error) {
    logger.error({ error }, 'Database maintenance failed');
  }
}

// Initialize database on startup
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database...');
    
    // Check connection
    const health = await checkDatabaseHealth();
    if (!health.healthy) {
      throw new Error(`Database unhealthy: ${health.error}`);
    }
    
    // Create indexes
    await initializeIndexes();
    
    logger.info({
      maxConnections: MAX_CONNECTIONS,
      minConnections: MIN_CONNECTIONS,
      ...getPoolStats()
    }, 'Database initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Database initialization failed');
    throw error;
  }
}

// Schedule periodic maintenance (every 6 hours)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    performMaintenance().catch(err => 
      logger.error({ err }, 'Scheduled maintenance failed')
    );
  }, 6 * 60 * 60 * 1000);
}
