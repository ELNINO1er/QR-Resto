import { Router } from 'express';
import { spawn } from 'child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { authMiddleware, superAdminOnly } from '../middleware/auth.js';
import { getDbPath, initDb, isMysql, replaceDbFile, save } from '../db.js';
import { ensureBackupDir } from '../config.js';

const router = Router();

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createBackup() {
  if (isMysql()) return createMysqlBackup();
  save();
  const dir = ensureBackupDir();
  const file = join(dir, `resto-backup-${timestamp()}.db`);
  copyFileSync(getDbPath(), file);
  return file;
}

function resolveMysqlDump() {
  const candidates = [
    process.env.MYSQLDUMP_PATH,
    'C:\\wamp64\\bin\\mysql\\mysql8.3.0\\bin\\mysqldump.exe',
    'C:\\wamp64\\bin\\mariadb\\mariadb11.3.2\\bin\\mysqldump.exe',
    'mysqldump',
  ].filter(Boolean);
  return candidates.find(candidate => candidate === 'mysqldump' || existsSync(candidate));
}

function createMysqlBackup() {
  const dir = ensureBackupDir();
  const database = process.env.MYSQL_DATABASE || 'qr_resto';
  const file = join(dir, `${database}-${timestamp()}.sql`);
  const args = [
    `--host=${process.env.MYSQL_HOST || '127.0.0.1'}`,
    `--port=${process.env.MYSQL_PORT || '3306'}`,
    `--user=${process.env.MYSQL_USER || 'root'}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    database,
  ];
  const env = { ...process.env };
  if (process.env.MYSQL_PASSWORD) env.MYSQL_PWD = process.env.MYSQL_PASSWORD;
  const mysqldump = resolveMysqlDump();

  return new Promise((resolve, reject) => {
    const dump = spawn(mysqldump, args, { env, windowsHide: true });
    const chunks = [];
    const errors = [];
    dump.stdout.on('data', chunk => chunks.push(chunk));
    dump.stderr.on('data', chunk => errors.push(chunk));
    dump.on('error', reject);
    dump.on('close', code => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString() || `mysqldump failed with code ${code}`));
        return;
      }
      writeFileSync(file, Buffer.concat(chunks));
      resolve(file);
    });
  });
}

router.use(authMiddleware, superAdminOnly);

router.get('/backups', (_req, res) => {
  const dir = ensureBackupDir();
  const backups = readdirSync(dir)
    .filter(name => name.endsWith('.db'))
    .sort()
    .reverse()
    .map(name => ({ name }));
  res.json(backups);
});

router.post('/backups', async (_req, res) => {
  const file = await createBackup();
  res.status(201).json({ name: basename(file), path: file });
});

router.get('/export.db', async (_req, res) => {
  const file = await createBackup();
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${basename(file)}"`);
  res.send(readFileSync(file));
});

router.post('/restore', async (req, res) => {
  const { backupName, databaseBase64 } = req.body;
  let buffer;

  if (databaseBase64) {
    buffer = Buffer.from(String(databaseBase64), 'base64');
  } else if (backupName) {
    const safeName = basename(String(backupName));
    const file = join(ensureBackupDir(), safeName);
    if (!existsSync(file)) return res.status(404).json({ error: 'Sauvegarde introuvable' });
    if (isMysql() || safeName.endsWith('.sql')) {
      return res.status(400).json({ error: 'Restauration MySQL via fichier SQL a executer avec mysql client pour eviter une restauration accidentelle en service' });
    }
    buffer = readFileSync(file);
  } else {
    return res.status(400).json({ error: 'Sauvegarde requise' });
  }

  await createBackup();
  replaceDbFile(buffer);
  await initDb();
  res.json({ success: true });
});

export function scheduleAutomaticBackups() {
  const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) return;

  setInterval(() => {
    try {
      createBackup();
      const marker = join(ensureBackupDir(), 'last-backup.txt');
      writeFileSync(marker, new Date().toISOString());
    } catch (error) {
      console.error('[BACKUP] Automatic backup failed:', error.message);
    }
  }, intervalHours * 60 * 60 * 1000);
}

export default router;
