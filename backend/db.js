import initSqlJs from 'sql.js';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DEFAULT_RESTAURANT_ID } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'resto.db');
const DB_CLIENT = process.env.DB_CLIENT || 'sqlite';

let db;
let mysqlPool;
let txConnection;

export function isMysql() {
  return DB_CLIENT === 'mysql';
}

export async function closeDb() {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
  }
  if (db) {
    db.close?.();
    db = null;
  }
}

export async function initDb() {
  if (isMysql()) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'qr_resto',
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      charset: 'utf8mb4',
    });
    await seedMysql();
    console.log('[DB] MySQL initialized');
    return mysqlPool;
  }

  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      name TEXT NOT NULL,
      default_password_changed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      image TEXT DEFAULT '🍽️',
      stock INTEGER DEFAULT 0,
      available INTEGER DEFAULT 1,
      visible INTEGER DEFAULT 1,
      veg INTEGER DEFAULT 0,
      gluten_free INTEGER DEFAULT 0,
      spicy INTEGER DEFAULT 0,
      prep_time INTEGER DEFAULT 15,
      rating REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      table_number INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT DEFAULT '',
      amount_paid INTEGER DEFAULT 0,
      change_due INTEGER DEFAULT 0,
      paid_at DATETIME,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      dish_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  migrateColumn('users', 'restaurant_id', `INTEGER DEFAULT ${DEFAULT_RESTAURANT_ID}`);
  migrateColumn('users', 'default_password_changed', 'INTEGER DEFAULT 0');
  migrateColumn('dishes', 'restaurant_id', `INTEGER DEFAULT ${DEFAULT_RESTAURANT_ID}`);
  migrateColumn('orders', 'restaurant_id', `INTEGER DEFAULT ${DEFAULT_RESTAURANT_ID}`);
  migrateColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'");
  migrateColumn('orders', 'payment_method', "TEXT DEFAULT ''");
  migrateColumn('orders', 'amount_paid', 'INTEGER DEFAULT 0');
  migrateColumn('orders', 'change_due', 'INTEGER DEFAULT 0');
  migrateColumn('orders', 'paid_at', 'DATETIME');
  migrateColumn('dishes', 'visible', 'INTEGER DEFAULT 1');

  // Seed data
  const restaurantCount = queryOne('SELECT COUNT(*) as count FROM restaurants').count;
  if (restaurantCount === 0) {
    run('INSERT INTO restaurants (id, name, slug, status) VALUES (?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'Restaurant Principal', 'restaurant-principal', 'active']);
  }

  const userCount = queryOne('SELECT COUNT(*) as count FROM users').count;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (restaurant_id, email, password, role, name) VALUES (?, ?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'admin@resto.ci', hash, 'admin', 'Administrateur']);
    run('INSERT INTO users (restaurant_id, email, password, role, name) VALUES (?, ?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'superadmin@resto.ci', hash, 'superadmin', 'Super Administrateur']);
  }
  const superAdmin = queryOne("SELECT id FROM users WHERE role = 'superadmin'");
  if (!superAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (restaurant_id, email, password, role, name) VALUES (?, ?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'superadmin@resto.ci', hash, 'superadmin', 'Super Administrateur']);
  }

  const dishCount = queryOne('SELECT COUNT(*) as count FROM dishes').count;
  if (dishCount === 0) {
    const dishes = [
      ['Attieke Poisson Braise', 'Attieke traditionnel avec poisson braise, sauce tomate et legumes frais', 4500, 'plats', '🐟', 15, 1, 0, 1, 1, 20, 4.8],
      ['Foutou Sauce Graine', 'Foutou banane plantain avec sauce graine de palme et viande', 5000, 'plats', '🍲', 8, 1, 0, 1, 1, 25, 4.9],
      ['Salade Cesar', 'Salade fraiche avec poulet grille, parmesan et croutons maison', 3500, 'entrees', '🥗', 20, 1, 0, 0, 0, 10, 4.5],
      ['Alloco', 'Bananes plantain frites avec sauce piment maison', 2000, 'entrees', '🍌', 25, 1, 1, 1, 1, 8, 4.7],
      ['Tiramisu', 'Tiramisu italien traditionnel au mascarpone et cafe', 2500, 'desserts', '🍰', 12, 1, 1, 0, 0, 5, 4.6],
      ['Bissap Glace', "Boisson rafraichissante a base de fleurs d'hibiscus", 1500, 'boissons', '🥤', 20, 1, 1, 1, 0, 3, 4.4],
      ['Jus de Gingembre', 'Jus de gingembre frais maison, legerement sucre', 1500, 'boissons', '🍹', 18, 1, 1, 1, 1, 3, 4.5],
      ['Poulet Yassa', 'Poulet marine aux oignons et citron, riz blanc', 4800, 'plats', '🍗', 10, 1, 0, 1, 0, 22, 4.7],
    ];
    for (const d of dishes) {
      run('INSERT INTO dishes (name, description, price, category, image, stock, available, veg, gluten_free, spicy, prep_time, rating) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', d);
    }
  }

  const settingsCount = queryOne('SELECT COUNT(*) as count FROM settings').count;
  if (settingsCount === 0) {
    const defaults = [
      ['restaurant_name', 'Le Bistrot Royal'],
      ['address', 'Cocody, Abidjan'],
      ['phone', '+225 07 00 00 00 00'],
      ['currency', 'FCFA'],
      ['tables_count', '12'],
      ['qr_base_url', process.env.QR_BASE_URL || ''],
      ['timezone', process.env.APP_TIME_ZONE || 'Africa/Abidjan'],
    ];
    for (const [key, value] of defaults) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  const bissapPatch = queryOne("SELECT value FROM settings WHERE key = 'migration_bissap_stock_v1'");
  if (!bissapPatch) {
    run("UPDATE dishes SET stock = 20, available = 1, image = '🥤' WHERE name = 'Bissap Glace' AND stock = 0");
    run("INSERT INTO settings (key, value) VALUES ('migration_bissap_stock_v1', 'done')");
  }

  save();
  console.log('[DB] Database initialized');
  return db;
}

async function seedMysql() {
  const restaurantCount = (await queryOne('SELECT COUNT(*) as count FROM restaurants')).count;
  if (restaurantCount === 0) {
    await run('INSERT INTO restaurants (id, name, slug, status) VALUES (?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'Restaurant Principal', 'restaurant-principal', 'active']);
  }

  const userCount = (await queryOne('SELECT COUNT(*) as count FROM users')).count;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run('INSERT INTO users (restaurant_id, email, password, role, name) VALUES (?, ?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'admin@resto.ci', hash, 'admin', 'Administrateur']);
    await run('INSERT INTO users (restaurant_id, email, password, role, name) VALUES (?, ?, ?, ?, ?)',
      [DEFAULT_RESTAURANT_ID, 'superadmin@resto.ci', hash, 'superadmin', 'Super Administrateur']);
  }
}

function migrateColumn(table, column, definition) {
  const columns = queryAll(`PRAGMA table_info(${table})`);
  if (!columns.some(c => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Helper: save database to file
export function save() {
  if (isMysql()) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

export function getDbPath() {
  return DB_PATH;
}

export function replaceDbFile(buffer) {
  writeFileSync(DB_PATH, buffer);
}

// Helper: query all rows
export function queryAll(sql, params = []) {
  if (isMysql()) return queryAllMysql(sql, params);
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: query one row
export function queryOne(sql, params = []) {
  if (isMysql()) return queryAllMysql(sql, params).then(rows => rows[0] || null);
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

// Helper: run (insert/update/delete) and save
export function run(sql, params = []) {
  if (isMysql()) return runMysql(sql, params);
  db.run(sql, params);
  save();
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
    changes: db.getRowsModified(),
  };
}

// Helper: run without saving (for transactions)
export function runNoSave(sql, params = []) {
  if (isMysql()) return runMysql(sql, params);
  db.run(sql, params);
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
    changes: db.getRowsModified(),
  };
}

// Helper: run multiple statements then save
export function transaction(fn) {
  if (isMysql()) return transactionMysql(fn);
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    save();
    return result;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

function mysqlConnection() {
  return txConnection || mysqlPool;
}

function normalizeMysqlSql(sql) {
  return sql
    .replace(/COALESCE\(visible, 1\)/g, 'COALESCE(visible, 1)')
    .replace(/date\(/gi, 'DATE(')
    .replace(/WHERE key IN/g, 'WHERE restaurant_id = 1 AND `key` IN')
    .replace(/WHERE key =/g, 'WHERE restaurant_id = 1 AND `key` =')
    .replace(/SELECT \* FROM settings$/i, 'SELECT `key`, value FROM settings WHERE restaurant_id = 1')
    .replace(/SELECT \* FROM settings WHERE/i, 'SELECT `key`, value FROM settings WHERE');
}

async function queryAllMysql(sql, params = []) {
  const [rows] = await mysqlConnection().execute(normalizeMysqlSql(sql), params);
  return rows;
}

async function runMysql(sql, params = []) {
  const [result] = await mysqlConnection().execute(normalizeMysqlSql(sql), params);
  return {
    lastInsertRowid: result.insertId,
    changes: result.affectedRows,
  };
}

async function transactionMysql(fn) {
  const connection = await mysqlPool.getConnection();
  txConnection = connection;
  try {
    await connection.beginTransaction();
    const result = await fn();
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    txConnection = null;
    connection.release();
  }
}
