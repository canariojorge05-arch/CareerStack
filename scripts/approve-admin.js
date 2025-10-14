import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function approveAdmin() {
  try {
    await db.execute(`
      UPDATE users 
      SET 
          is_verified = true,
          is_approved = true,
          role = 'admin',
          email_verified_at = NOW(),
          approved_at = NOW(),
          updated_at = NOW()
      WHERE email = '12shivamtiwari219@gmail.com';
    `);
    
    console.log('Admin user has been approved and verified successfully!');
  } catch (error) {
    console.error('Error approving admin:', error);
  } finally {
    process.exit(0);
  }
}

approveAdmin();