import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { EMAIL_SETTINGS_SECRET, JWT_SECRET, JWT_EXPIRES_IN_SECONDS, JWT_ISSUER, JWT_AUDIENCE } from '../config';
import type { AuthUser } from '../types';

export function getEmailSettingsCipherKey() {
  return createHash('sha256').update(EMAIL_SETTINGS_SECRET).digest();
}

export function encryptEmailSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEmailSettingsCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptEmailSecret(value: string): string | null {
  try {
    const [version, ivBase64, tagBase64, encryptedBase64] = value.split(':');
    if (version !== 'v1' || !ivBase64 || !tagBase64 || !encryptedBase64) return null;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(tagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', getEmailSettingsCipherKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function signTokenForUser(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: Number.isFinite(JWT_EXPIRES_IN_SECONDS) ? JWT_EXPIRES_IN_SECONDS : 60 * 60 * 24 * 7,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}
