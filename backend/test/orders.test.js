import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_PATH = join(tmpdir(), `qr-resto-test-${process.pid}-${Date.now()}.db`);

let server;
let queryOne;
let baseUrl;
let token;
let createdOrder;
let createdDishId;
let createdQuantity;

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { res, body };
}

test.before(async () => {
  const dbModule = await import('../db.js');
  const serverModule = await import('../server.js');
  queryOne = dbModule.queryOne;
  server = serverModule.server;

  await dbModule.initDb();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (existsSync(process.env.DB_PATH)) rmSync(process.env.DB_PATH);
});

test('auth returns a JWT for valid admin credentials', async () => {
  const { res, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@resto.ci', password: 'admin123' }),
  });

  assert.equal(res.status, 200);
  assert.equal(body.user.email, 'admin@resto.ci');
  assert.equal(body.user.role, 'admin');
  assert.ok(body.token);
  token = body.token;
});

test('order creation recalculates price and name from the database', async () => {
  const dish = queryOne("SELECT * FROM dishes WHERE name = 'Bissap Glace'");

  const { res, body } = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({
      table: 1,
      items: [{ dishId: dish.id, name: 'Fake item', quantity: 2, price: 1 }],
    }),
  });

  assert.equal(res.status, 201);
  assert.equal(body.total, dish.price * 2);
  assert.equal(body.items[0].name, dish.name);
  assert.equal(body.items[0].price, dish.price);
  createdOrder = body;
  createdDishId = dish.id;
  createdQuantity = 2;
});

test('public order tracking returns only the matching table order', async () => {
  assert.ok(createdOrder);

  const { res, body } = await request(`/orders/${createdOrder.id}/public?table=${createdOrder.table}`);

  assert.equal(res.status, 200);
  assert.equal(body.id, createdOrder.id);
  assert.equal(body.table, createdOrder.table);
  assert.equal(body.status, 'pending');
});

test('order creation rejects quantities above stock', async () => {
  const dish = queryOne("SELECT * FROM dishes WHERE name = 'Bissap Glace'");

  const { res, body } = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({
      table: 1,
      items: [{ dishId: dish.id, quantity: dish.stock + 1 }],
    }),
  });

  assert.equal(res.status, 409);
  assert.match(body.error, /Stock insuffisant/);
});

test('admin stats are computed from real orders', async () => {
  assert.ok(token);

  const { res, body } = await request('/orders/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(body.todayOrders, 1);
  assert.ok(body.todayRevenue > 0);
  assert.ok(Array.isArray(body.topDishes));
  assert.ok(Array.isArray(body.peakHours));
  assert.equal(body.topDishes[0].name, 'Bissap Glace');
});

test('cancelling an order restores dish stock', async () => {
  assert.ok(token);
  assert.ok(createdOrder);

  const before = queryOne('SELECT stock FROM dishes WHERE id = ?', [createdDishId]);
  const { res, body } = await request(`/orders/${createdOrder.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const after = queryOne('SELECT stock FROM dishes WHERE id = ?', [createdDishId]);

  assert.equal(res.status, 200);
  assert.equal(body.status, 'cancelled');
  assert.equal(after.stock, before.stock + createdQuantity);
});
