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
    await migrateMysql();
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
      restaurant_id INTEGER DEFAULT 1,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (restaurant_id, key)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      order_id INTEGER NOT NULL,
      dish_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      table_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      image TEXT DEFAULT '🍽️',
      available INTEGER DEFAULT 1,
      available_from TEXT DEFAULT NULL,
      available_until TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS formula_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formula_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      dish_id INTEGER DEFAULT NULL,
      label TEXT DEFAULT '',
      FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE,
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS table_layout (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      table_number INTEGER NOT NULL,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      seats INTEGER DEFAULT 4,
      shape TEXT DEFAULT 'round',
      UNIQUE(restaurant_id, table_number)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER DEFAULT 1,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      customer_email TEXT DEFAULT '',
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      party_size INTEGER NOT NULL DEFAULT 2,
      table_number INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  migrateColumn('dishes', 'allergens', "TEXT DEFAULT '[]'");
  migrateColumn('dishes', 'available_from', 'TEXT DEFAULT NULL');
  migrateColumn('dishes', 'available_until', 'TEXT DEFAULT NULL');
  migrateColumn('dishes', 'order_count', 'INTEGER DEFAULT 0');

  migrateColumn('orders', 'order_type', "TEXT DEFAULT 'dine_in'");
  migrateColumn('orders', 'delivery_address', "TEXT DEFAULT ''");
  migrateColumn('orders', 'delivery_phone', "TEXT DEFAULT ''");
  migrateColumn('orders', 'customer_name', "TEXT DEFAULT ''");
  migrateColumn('orders', 'ready_at', 'DATETIME');

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
  migrateSettingsTable();

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

  const settingsCount = queryOne('SELECT COUNT(*) as count FROM settings WHERE restaurant_id = ?', [DEFAULT_RESTAURANT_ID]).count;
  if (settingsCount === 0) {
    const defaults = [
      ['restaurant_name', 'Le Bistrot Royal'],
      ['address', 'Cocody, Abidjan'],
      ['phone', '+225 07 00 00 00 00'],
      ['currency', 'FCFA'],
      ['tables_count', '12'],
      ['qr_base_url', process.env.QR_BASE_URL || ''],
      ['timezone', process.env.APP_TIME_ZONE || 'Africa/Abidjan'],
      ['receipt_thank_you', 'Merci pour votre visite et a bientot.'],
    ];
    for (const [key, value] of defaults) {
      run('INSERT INTO settings (restaurant_id, key, value) VALUES (?, ?, ?)', [DEFAULT_RESTAURANT_ID, key, value]);
    }
  }

  const bissapPatch = queryOne("SELECT value FROM settings WHERE restaurant_id = ? AND key = 'migration_bissap_stock_v1'", [DEFAULT_RESTAURANT_ID]);
  if (!bissapPatch) {
    run("UPDATE dishes SET stock = 20, available = 1, image = '🥤' WHERE name = 'Bissap Glace' AND stock = 0");
    run("INSERT INTO settings (restaurant_id, key, value) VALUES (?, 'migration_bissap_stock_v1', 'done')", [DEFAULT_RESTAURANT_ID]);
  }

  const restaurantsForSettings = queryAll('SELECT id, name FROM restaurants');
  for (const restaurant of restaurantsForSettings) {
    await seedRestaurantSettings(restaurant.id, restaurant.name);
  }

  save();
  console.log('[DB] Database initialized');
  return db;
}

async function migrateMysqlColumn(table, column, definition) {
  const [cols] = await mysqlPool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (cols.length === 0) {
    // Convert SQLite syntax to MySQL
    let mysqlDef = definition
      .replace(/\bINTEGER\b/g, 'INT')
      .replace(/\bTEXT\b/g, 'VARCHAR(500)')
      .replace(/\bREAL\b/g, 'DOUBLE');
    await mysqlPool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${mysqlDef}`);
    console.log(`[DB] Migration: added ${table}.${column}`);
  }
}

async function migrateMysql() {
  // Create missing tables
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT DEFAULT 1,
      order_id INT NOT NULL,
      dish_id INT NOT NULL,
      rating INT NOT NULL,
      comment TEXT DEFAULT NULL,
      table_number INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT DEFAULT 1,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      price INT NOT NULL,
      image VARCHAR(50) DEFAULT '🍽️',
      available TINYINT DEFAULT 1,
      available_from VARCHAR(10) DEFAULT NULL,
      available_until VARCHAR(10) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS formula_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formula_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      dish_id INT DEFAULT NULL,
      label VARCHAR(255) DEFAULT '',
      FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE,
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS table_layout (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT DEFAULT 1,
      table_number INT NOT NULL,
      x DOUBLE DEFAULT 0,
      y DOUBLE DEFAULT 0,
      seats INT DEFAULT 4,
      shape VARCHAR(20) DEFAULT 'round',
      UNIQUE KEY uq_table (restaurant_id, table_number)
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT DEFAULT 1,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) DEFAULT '',
      customer_email VARCHAR(255) DEFAULT '',
      date VARCHAR(20) NOT NULL,
      time_slot VARCHAR(10) NOT NULL,
      party_size INT NOT NULL DEFAULT 2,
      table_number INT DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
      notes TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate missing columns on dishes
  await migrateMysqlColumn('dishes', 'allergens', "VARCHAR(500) DEFAULT '[]'");
  await migrateMysqlColumn('dishes', 'available_from', 'VARCHAR(10) DEFAULT NULL');
  await migrateMysqlColumn('dishes', 'available_until', 'VARCHAR(10) DEFAULT NULL');
  await migrateMysqlColumn('dishes', 'order_count', 'INT DEFAULT 0');

  // Migrate missing columns on orders
  await migrateMysqlColumn('orders', 'order_type', "VARCHAR(20) DEFAULT 'dine_in'");
  await migrateMysqlColumn('orders', 'delivery_address', "VARCHAR(500) DEFAULT ''");
  await migrateMysqlColumn('orders', 'delivery_phone', "VARCHAR(50) DEFAULT ''");
  await migrateMysqlColumn('orders', 'customer_name', "VARCHAR(255) DEFAULT ''");
  await migrateMysqlColumn('orders', 'ready_at', 'DATETIME');
  await migrateMysqlColumn('reviews', 'restaurant_id', 'INT DEFAULT 1');
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

  const settingsCount = (await queryOne('SELECT COUNT(*) as count FROM settings WHERE restaurant_id = ?', [DEFAULT_RESTAURANT_ID])).count;
  if (settingsCount === 0) {
    await seedRestaurantSettings(DEFAULT_RESTAURANT_ID, 'Le Bistrot Royal');
  }

  const restaurants = await queryAll('SELECT id, name FROM restaurants');
  for (const restaurant of restaurants) {
    await seedRestaurantSettings(restaurant.id, restaurant.name);
  }
}

async function seedRestaurantSettings(restaurantId, restaurantName) {
  const defaults = [
    ['restaurant_name', restaurantName || 'Restaurant'],
    ['address', ''],
    ['phone', ''],
    ['currency', 'FCFA'],
    ['tables_count', '12'],
    ['qr_base_url', process.env.QR_BASE_URL || ''],
    ['timezone', process.env.APP_TIME_ZONE || 'Africa/Abidjan'],
    ['receipt_thank_you', 'Merci pour votre visite et a bientot.'],
  ];
  for (const [key, value] of defaults) {
    if (isMysql()) {
      await run('INSERT IGNORE INTO settings (restaurant_id, `key`, value) VALUES (?, ?, ?)', [restaurantId, key, value]);
    } else {
      run(
        'INSERT INTO settings (restaurant_id, key, value) VALUES (?, ?, ?) ON CONFLICT(restaurant_id, key) DO NOTHING',
        [restaurantId, key, value]
      );
    }
  }
}

function migrateColumn(table, column, definition) {
  const columns = queryAll(`PRAGMA table_info(${table})`);
  if (!columns.some(c => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateSettingsTable() {
  const columns = queryAll('PRAGMA table_info(settings)');
  if (columns.some(c => c.name === 'restaurant_id')) return;

  const rows = queryAll('SELECT key, value FROM settings');
  db.run('ALTER TABLE settings RENAME TO settings_legacy');
  db.run(`
    CREATE TABLE settings (
      restaurant_id INTEGER DEFAULT 1,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (restaurant_id, key)
    )
  `);
  for (const row of rows) {
    db.run('INSERT INTO settings (restaurant_id, key, value) VALUES (?, ?, ?)', [DEFAULT_RESTAURANT_ID, row.key, row.value]);
  }
  db.run('DROP TABLE settings_legacy');
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
    .replace(/date\(/gi, 'DATE(');
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
