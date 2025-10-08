#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.js', '.css', '.html', '.json', '.svg', '.xml', '.txt'].includes(ext)) return;

  const file = fs.readFileSync(filePath);
  const originalSize = file.length;
  
  // Skip files that are too small to benefit from compression
  if (originalSize < 1024) return;

  // gzip compression
  const gz = zlib.gzipSync(file, { 
    level: zlib.constants.Z_BEST_COMPRESSION,
    windowBits: 15,
    memLevel: 9
  });
  fs.writeFileSync(filePath + '.gz', gz);

  // brotli compression (better compression ratio)
  if (typeof zlib.brotliCompressSync === 'function') {
    const br = zlib.brotliCompressSync(file, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: originalSize,
      },
    });
    fs.writeFileSync(filePath + '.br', br);
    
    // Log compression stats for large files
    if (originalSize > 100000) {
      const gzRatio = ((originalSize - gz.length) / originalSize * 100).toFixed(1);
      const brRatio = ((originalSize - br.length) / originalSize * 100).toFixed(1);
      console.log(`${path.basename(filePath)}: ${originalSize}b → gz: ${gz.length}b (${gzRatio}%), br: ${br.length}b (${brRatio}%)`);
    }
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else compressFile(full);
  }
}

// Resolve dist/public relative to the current working directory to support running from project root
const dist = path.resolve(process.cwd(), 'dist', 'public');
if (!fs.existsSync(dist)) {
  console.error('dist/public not found. Run build first.');
  process.exit(1);
}
walk(dist);
console.log('Compression complete');
