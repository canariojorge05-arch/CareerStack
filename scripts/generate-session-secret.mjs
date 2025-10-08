// ESM script to generate and set SESSION_SECRET in .env without printing the secret
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const FORCE = process.argv.includes('--force');
const ENV_PATH = path.resolve(process.cwd(), '.env');

function generateSecret(bytes = 48) {
  return randomBytes(bytes).toString('hex'); // 96 hex chars
}

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  return lines;
}

function setOrUpdateEnvKey(lines, key, value, options = { force: false }) {
  const idx = lines.findIndex((l) => l.trim().startsWith(`${key}=`));
  const placeholderValues = new Set(['', 'your-secret-key', 'changeme', 'secret']);

  if (idx === -1) {
    // Not present, append
    lines.push(`${key}=${value}`);
    return { updated: true, lines };
  }

  // Extract existing value (do not print)
  const existingLine = lines[idx];
  const existingValue = existingLine.slice(existingLine.indexOf('=') + 1).trim();

  // If force or placeholder/weak, replace
  const isPlaceholder = placeholderValues.has(existingValue.toLowerCase?.() || existingValue) || existingValue.length < 24;
  if (options.force || isPlaceholder) {
    lines[idx] = `${key}=${value}`;
    return { updated: true, lines };
  }

  return { updated: false, lines };
}

try {
  const newSession = generateSecret(48);
  const newJwt = generateSecret(48);
  const newJwtRefresh = generateSecret(64);
  let lines = [];

  if (fs.existsSync(ENV_PATH)) {
    const current = fs.readFileSync(ENV_PATH, 'utf8');
    lines = parseEnv(current);
  } else {
    lines = [];
  }

  // SESSION_SECRET
  let updatedAny = false;
  let result = setOrUpdateEnvKey(lines, 'SESSION_SECRET', newSession, { force: FORCE });
  lines = result.lines; updatedAny = updatedAny || result.updated;

  // JWT_SECRET
  result = setOrUpdateEnvKey(lines, 'JWT_SECRET', newJwt, { force: FORCE });
  lines = result.lines; updatedAny = updatedAny || result.updated;

  // JWT_REFRESH_SECRET
  result = setOrUpdateEnvKey(lines, 'JWT_REFRESH_SECRET', newJwtRefresh, { force: FORCE });
  lines = result.lines; updatedAny = updatedAny || result.updated;

  if (updatedAny) {
    fs.writeFileSync(ENV_PATH, lines.join('\n'), { encoding: 'utf8' });
    console.log('[env] Secrets have been set/updated in .env (SESSION_SECRET, JWT_SECRET, JWT_REFRESH_SECRET)');
  } else {
    console.log('[env] Secrets already present and appear strong. Use --force to overwrite.');
  }
} catch (err) {
  console.error('[env] Failed to set secrets:', err?.message || err);
  process.exit(1);
}
