import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getMysqlConfig } from './mysql-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'schema.mysql.sql');

const connection = await mysql.createConnection(getMysqlConfig({ withDatabase: false }));
try {
  const schema = readFileSync(schemaPath, 'utf8');
  await connection.query(schema);
  console.log('[MYSQL] Schema initialized');
} finally {
  await connection.end();
}
