/**
 * Script to systematically replace console.log statements with structured logger
 * 
 * Run with: npx tsx scripts/fix-console-logs.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '../server');

interface Replacement {
  from: RegExp;
  to: string;
  needsContext?: boolean;
}

// Mapping of console methods to logger methods with context extraction
const replacements: Replacement[] = [
  // Error logging - extract error context
  {
    from: /console\.error\(['"]([^'"]+)['"],\s*([^)]+)\)/g,
    to: 'logger.error({ error: $2 }, \'$1\')',
    needsContext: true
  },
  {
    from: /console\.error\(([^)]+)\)/g,
    to: 'logger.error($1)',
    needsContext: false
  },
  
  // Warning logging
  {
    from: /console\.warn\(['"]([^'"]+)['"],\s*([^)]+)\)/g,
    to: 'logger.warn({ context: $2 }, \'$1\')',
    needsContext: true
  },
  {
    from: /console\.warn\(([^)]+)\)/g,
    to: 'logger.warn($1)',
    needsContext: false
  },
  
  // Info logging (console.log)
  {
    from: /console\.log\(([^)]+)\)/g,
    to: 'logger.info($1)',
    needsContext: false
  },
  
  // Debug logging
  {
    from: /console\.debug\(([^)]+)\)/g,
    to: 'logger.debug($1)',
    needsContext: false
  },
];

function processFile(filePath: string): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Check if file has console statements
    if (!content.includes('console.')) {
      return false;
    }
    
    console.log(`📝 Processing: ${path.relative(serverDir, filePath)}`);
    
    // Check if logger is already imported
    const hasLoggerImport = /import\s+{[^}]*logger[^}]*}\s+from\s+['"][^'"]*utils\/logger['"]/.test(content);
    
    if (!hasLoggerImport) {
      // Calculate relative path to logger
      const fileDir = path.dirname(filePath);
      const loggerPath = path.relative(fileDir, path.join(serverDir, 'utils/logger'));
      const importPath = loggerPath.startsWith('.') ? loggerPath : `./${loggerPath}`;
      
      // Add logger import after the last import or at the top
      const lastImportMatch = content.match(/^import\s+.+;$/gm);
      if (lastImportMatch && lastImportMatch.length > 0) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        content = content.replace(lastImport, `${lastImport}\nimport { logger } from '${importPath.replace(/\\/g, '/')}';`);
      } else {
        content = `import { logger } from '${importPath.replace(/\\/g, '/')}';\n${content}`;
      }
    }
    
    // Apply replacements
    for (const replacement of replacements) {
      content = content.replace(replacement.from, replacement.to);
    }
    
    // Only write if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and dist
        if (entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        files.push(...findTypeScriptFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

function main() {
  console.log('🚀 Starting console.log replacement...\n');
  console.log(`📂 Server directory: ${serverDir}\n`);
  
  const files = findTypeScriptFiles(serverDir);
  console.log(`📊 Found ${files.length} TypeScript files\n`);
  
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const file of files) {
    if (processFile(file)) {
      processedCount++;
    } else {
      skippedCount++;
    }
  }
  
  console.log('\n✅ Replacement complete!');
  console.log(`📈 Processed: ${processedCount} files`);
  console.log(`⏭️  Skipped: ${skippedCount} files (no console statements)`);
  console.log('\n⚠️  Next steps:');
  console.log('1. Review changes: git diff');
  console.log('2. Fix any syntax errors');
  console.log('3. Test the application');
  console.log('4. Commit changes');
}

main();
