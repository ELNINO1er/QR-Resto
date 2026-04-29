import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'resto.db');

let db;

export async function initDb() {
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
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      name TEXT NOT NULL,
      default_password_changed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      image TEXT DEFAULT '🍽️',
      stock INTEGER DEFAULT 0,
      available INTEGER DEFAULT 1,
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
      table_number INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT DEFAULT '',
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

  migrateColumn('users', 'default_password_changed', 'INTEGER DEFAULT 0');
  migrateColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'");
  migrateColumn('orders', 'payment_method', "TEXT DEFAULT ''");
  migrateColumn('orders', 'paid_at', 'DATETIME');

  // Seed data
  const userCount = queryOne('SELECT COUNT(*) as count FROM users').count;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)',
      ['admin@resto.ci', hash, 'admin', 'Administrateur']);
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

function migrateColumn(table, column, definition) {
  const columns = queryAll(`PRAGMA table_info(${table})`);
  if (!columns.some(c => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Helper: save database to file
export function save() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

// Helper: query all rows
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: query one row
export function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

// Helper: run (insert/update/delete) and save
export function run(sql, params = []) {
  db.run(sql, params);
  save();
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
    changes: db.getRowsModified(),
  };
}

// Helper: run without saving (for transactions)
export function runNoSave(sql, params = []) {
  db.run(sql, params);
}

// Helper: run multiple statements then save
export function transaction(fn) {
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
