#!/bin/bash

# Script to replace console.log statements with structured logger
# This is a semi-automated approach - review changes before committing

echo "🔧 Replacing console statements with structured logger..."

# Find all TypeScript files in server directory
find server -name "*.ts" -type f | while read file; do
  # Skip if file doesn't contain console statements
  if ! grep -q "console\." "$file"; then
    continue
  fi
  
  echo "Processing: $file"
  
  # Check if logger is already imported
  if ! grep -q "import.*logger.*from.*'.*utils/logger'" "$file"; then
    # Add logger import at the top after other imports
    sed -i '1i import { logger } from '\''../utils/logger'\'';' "$file" 2>/dev/null || \
    sed -i '1i import { logger } from '\''./utils/logger'\'';' "$file" 2>/dev/null
  fi
  
  # Replace console.log with logger.info
  sed -i "s/console\.log(/logger.info(/g" "$file"
  
  # Replace console.error with logger.error
  sed -i "s/console\.error(/logger.error(/g" "$file"
  
  # Replace console.warn with logger.warn
  sed -i "s/console\.warn(/logger.warn(/g" "$file"
  
  # Replace console.debug with logger.debug
  sed -i "s/console\.debug(/logger.debug(/g" "$file"
done

echo "✅ Console statements replaced!"
echo "⚠️  Please review the changes and test thoroughly before committing"
echo ""
echo "Next steps:"
echo "1. Review git diff"
echo "2. Fix any import path issues"
echo "3. Test the application"
echo "4. Commit changes"
