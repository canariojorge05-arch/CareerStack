import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";
import { config } from 'dotenv';

// Ensure environment variables are loaded before accessing them
config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use HTTP adapter for better stability (no WebSocket issues)
console.log('Connecting to Neon database via HTTP...');

// Configure Neon connection
const sql = neon(process.env.DATABASE_URL);

export { sql };
export const db = drizzle(sql, { schema });

// Test database connection on startup
export async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection successful');
    console.log(`📅 Connected at: ${result[0].current_time}`);
    return true;
  } catch (error: any) {
    console.error('❌ Database connection failed:', error?.message || error);
    
    // Don't throw error, just warn - let the app continue in degraded mode
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('fetch failed')) {
      console.warn('⚠️ Database appears to be unreachable. Some features may not work.');
      console.warn('💡 Check if your Neon database is active at https://console.neon.tech/');
    }
    
    return false;
  }
}
