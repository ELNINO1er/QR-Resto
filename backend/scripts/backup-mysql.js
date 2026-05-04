import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getMysqlDatabase } from './mysql-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backupDir = process.env.BACKUP_DIR || join(__dirname, '..', 'backups');
if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const database = getMysqlDatabase();
const file = join(backupDir, `${database}-${timestamp}.sql`);

function resolveMysqlDump() {
  const candidates = [
    process.env.MYSQLDUMP_PATH,
    'C:\\wamp64\\bin\\mysql\\mysql8.3.0\\bin\\mysqldump.exe',
    'C:\\wamp64\\bin\\mariadb\\mariadb11.3.2\\bin\\mysqldump.exe',
    'mysqldump',
  ].filter(Boolean);
  return candidates.find(candidate => candidate === 'mysqldump' || existsSync(candidate));
}

const args = [
  `--host=${process.env.MYSQL_HOST || '127.0.0.1'}`,
  `--port=${process.env.MYSQL_PORT || '3306'}`,
  `--user=${process.env.MYSQL_USER || 'root'}`,
  '--single-transaction',
  '--routines',
  '--triggers',
  database,
];

const childEnv = { ...process.env };
if (process.env.MYSQL_PASSWORD) childEnv.MYSQL_PWD = process.env.MYSQL_PASSWORD;

const mysqldump = resolveMysqlDump();
const dump = spawn(mysqldump, args, { env: childEnv, windowsHide: true });
const output = createWriteStream(file);
dump.stdout.pipe(output);
dump.stderr.on('data', chunk => process.stderr.write(chunk));

const code = await new Promise(resolve => dump.on('close', resolve));
if (code !== 0) {
  throw new Error(`mysqldump failed with code ${code}`);
}

console.log(`[MYSQL] Backup created: ${file}`);
