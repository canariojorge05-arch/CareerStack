#!/usr/bin/env tsx
import { generateEncryptionKey } from '../server/utils/tokenEncryption.js';

console.log('\n🔐 Generated TOKEN_ENCRYPTION_KEY:');
console.log(generateEncryptionKey());
console.log('\nAdd this to your .env file as:');
console.log('TOKEN_ENCRYPTION_KEY=<generated_key>');
console.log('\n⚠️  Keep this key secure and never commit it to version control!\n');
