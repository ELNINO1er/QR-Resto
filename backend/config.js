import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Africa/Abidjan';
export const DEFAULT_RESTAURANT_ID = Number(process.env.DEFAULT_RESTAURANT_ID || 1);
export const BACKUP_DIR = process.env.BACKUP_DIR || join(__dirname, 'backups');

export function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

export function getQrBaseUrl(fallbackOrigin = '') {
  return (process.env.QR_BASE_URL || fallbackOrigin || '').replace(/\/+$/, '');
}

export function generateInstallationSecret() {
  return randomBytes(48).toString('base64url');
}
