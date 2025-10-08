#!/usr/bin/env node
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const required = ['DATABASE_URL', 'SESSION_SECRET', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'PORT'];

const missing = required.filter(
  (key) => !process.env[key] || String(process.env[key]).trim() === ''
);

if (missing.length > 0) {
  console.error('\n✖ Missing required environment variables:');
  missing.forEach((m) => console.error('  -', m));
  console.error('\nTip: copy `.env.example` to `.env` and fill the values.');
  console.error(
    'You can also run `npm run env:init` to generate secure session secrets (if available).\n'
  );
  process.exitCode = 2;
} else {
  console.log('\n✔ All required environment variables are set.');
}
