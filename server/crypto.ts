/**
 * AES-256-GCM encryption/decryption for sensitive tokens (QBO, Square, etc.).
 *
 * The encryption key is read from the QBO_ENCRYPTION_KEY env var (hex-encoded, 32 bytes).
 * Each encrypted value is stored as: iv:authTag:ciphertext (all hex-encoded).
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.QBO_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('QBO_ENCRYPTION_KEY env var is required for token encryption');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('QBO_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return key;
}

/**
 * Encrypt a plaintext string. Returns "iv:authTag:ciphertext" (hex).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value produced by encrypt(). Expects "iv:authTag:ciphertext" (hex).
 * Returns null if decryption fails (e.g. wrong key, tampered data).
 */
export function decrypt(encoded: string): string | null {
  try {
    const key = getKey();
    const [ivHex, authTagHex, ciphertextHex] = encoded.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) return null;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Check if a value looks like it's already encrypted (iv:tag:ciphertext hex format).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every(p => /^[0-9a-f]+$/i.test(p));
}
