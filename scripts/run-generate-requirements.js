// Simple runner script for generating test requirements
import { config } from 'dotenv';

// Load environment variables
config();

// Ensure we have required environment variables
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🔧 Environment loaded, starting test data generation...');

// Import and run the generator
import('./generate-test-requirements.ts')
  .then((module) => {
    return module.generateTestRequirements();
  })
  .then(() => {
    console.log('🎉 Test requirements generated successfully!');
    console.log('📊 You now have 70 test requirements to work with');
    console.log('🔍 Go to the marketing page to see them in action');
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
