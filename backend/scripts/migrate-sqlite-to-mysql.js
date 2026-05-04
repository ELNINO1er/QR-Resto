import mysql from 'mysql2/promise';
import initSqlJs from 'sql.js';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getMysqlConfig } from './mysql-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlitePath = process.env.DB_PATH || join(__dirname, '..', 'resto.db');

if (!existsSync(sqlitePath)) {
  throw new Error(`SQLite database not found: ${sqlitePath}`);
}

const SQL = await initSqlJs();
const sqlite = new SQL.Database(readFileSync(sqlitePath));
const mysqlDb = await mysql.createConnection(getMysqlConfig());

function sqliteAll(sql, params = []) {
  const stmt = sqlite.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function clearMysql() {
  await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['order_items', 'orders', 'dishes', 'settings', 'users', 'restaurants']) {
    await mysqlDb.query(`TRUNCATE TABLE ${table}`);
  }
  await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function insertRows(table, columns, rows) {
  if (!rows.length) return;
  const placeholders = columns.map(() => '?').join(',');
  const sql = `INSERT INTO ${table} (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${placeholders})`;
  for (const row of rows) {
    await mysqlDb.execute(sql, columns.map(column => row[column] ?? null));
  }
}

try {
  await mysqlDb.beginTransaction();
  await clearMysql();

  const restaurants = sqliteAll('SELECT id, name, slug, status, created_at FROM restaurants');
  await insertRows('restaurants', ['id', 'name', 'slug', 'status', 'created_at'], restaurants);

  const users = sqliteAll('SELECT id, restaurant_id, email, password, role, name, default_password_changed, created_at FROM users');
  await insertRows('users', ['id', 'restaurant_id', 'email', 'password', 'role', 'name', 'default_password_changed', 'created_at'], users);

  const dishes = sqliteAll('SELECT id, restaurant_id, name, description, price, category, image, stock, available, visible, veg, gluten_free, spicy, prep_time, rating, created_at FROM dishes');
  await insertRows('dishes', ['id', 'restaurant_id', 'name', 'description', 'price', 'category', 'image', 'stock', 'available', 'visible', 'veg', 'gluten_free', 'spicy', 'prep_time', 'rating', 'created_at'], dishes);

  const orders = sqliteAll('SELECT id, restaurant_id, table_number, total, status, payment_status, payment_method, amount_paid, change_due, paid_at, notes, created_at FROM orders');
  await insertRows('orders', ['id', 'restaurant_id', 'table_number', 'total', 'status', 'payment_status', 'payment_method', 'amount_paid', 'change_due', 'paid_at', 'notes', 'created_at'], orders);

  const orderItems = sqliteAll('SELECT id, order_id, dish_id, name, quantity, price FROM order_items');
  await insertRows('order_items', ['id', 'order_id', 'dish_id', 'name', 'quantity', 'price'], orderItems);

  const settings = sqliteAll('SELECT key, value FROM settings').map(row => ({
    restaurant_id: 1,
    key: row.key,
    value: row.value,
  }));
  await insertRows('settings', ['restaurant_id', 'key', 'value'], settings);

  await mysqlDb.commit();
  console.log('[MYSQL] SQLite data migrated to MySQL');
} catch (error) {
  await mysqlDb.rollback();
  throw error;
} finally {
  await mysqlDb.end();
  sqlite.close();
}
