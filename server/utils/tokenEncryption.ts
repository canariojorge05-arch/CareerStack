import crypto from 'crypto';

const KEY_ENV = process.env.TOKEN_ENCRYPTION_KEY || '';
let key: Buffer | null = null;

if (KEY_ENV) {
  // Accept hex or base64 encoded key; prefer 32 bytes (256-bit)
  try {
    if (/^[0-9a-fA-F]+$/.test(KEY_ENV) && KEY_ENV.length === 64) {
      key = Buffer.from(KEY_ENV, 'hex');
    } else {
      key = Buffer.from(KEY_ENV, 'base64');
    }
  } catch (e) {
    console.warn('Invalid TOKEN_ENCRYPTION_KEY format — token encryption disabled');
    key = null;
  }
} else {
  console.warn('TOKEN_ENCRYPTION_KEY not set — token encryption disabled');
}

// Enforce presence in production environments
if (!key && process.env.NODE_ENV === 'production') {
  throw new Error('TOKEN_ENCRYPTION_KEY is required in production. Set a 32-byte key (hex or base64).');
}

export function encryptToken(plaintext: string | null): string | null {
  if (!plaintext) return null;
  if (!key) return plaintext; // fallback to plaintext if key missing

  const iv = crypto.randomBytes(12); // recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // store as base64(iv|tag|ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(encrypted: string | null): string | null {
  if (!encrypted) return null;
  if (!key) return encrypted as string;

  try {
    const data = Buffer.from(encrypted, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const ciphertext = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    console.warn('Failed to decrypt token, returning null');
    return null;
  }
}
