import { Router } from 'express';
import { isMysql, queryAll, queryOne, run, runNoSave, transaction } from '../db.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';

const router = Router();

let broadcast = () => {};
export function setBroadcast(fn) { broadcast = fn; }

async function getOrderById(id) {
  const o = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
  if (!o) return null;
  const items = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
  return formatOrder(o, items);
}

function scopeForUser(req, alias = '') {
  if (req.user?.role === 'superadmin') return { clause: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { clause: ` AND ${prefix}restaurant_id = ?`, params: [req.user?.restaurantId || 1] };
}

// Fix 12: Manual time formatting (not locale-dependent)
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'Z');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}h${m}`;
}

function formatOrder(o, items) {
  return {
    id: o.id,
    table: o.table_number,
    items: items.map(i => ({ dishId: i.dish_id, name: i.name, qty: i.quantity, price: i.price })),
    total: o.total,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    amountPaid: o.amount_paid || 0,
    changeDue: o.change_due || 0,
    paidAt: o.paid_at,
    notes: o.notes,
    time: formatTime(o.created_at),
    createdAt: o.created_at,
  };
}

function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function buildOrderItems(rawItems) {
  const merged = new Map();

  for (const item of rawItems) {
    const dishId = toPositiveInt(item.dishId);
    const quantity = toPositiveInt(item.quantity);

    if (!dishId || !quantity) {
      const error = new Error('Articles invalides');
      error.status = 400;
      throw error;
    }

    merged.set(dishId, (merged.get(dishId) || 0) + quantity);
  }

  return [...merged.entries()].map(([dishId, quantity]) => ({ dishId, quantity }));
}

// Fix 5: Validate table number against tables_count setting
function getTablesCount() {
  return queryOne("SELECT value FROM settings WHERE key = 'tables_count'")
    .then?.(row => row ? parseInt(row.value, 10) || 100 : 100)
    || (() => {
      const row = queryOne("SELECT value FROM settings WHERE key = 'tables_count'");
      return row ? parseInt(row.value, 10) || 100 : 100;
    })();
}

async function validateOrder(table, items, restaurantId = 1) {
  const tableNumber = toPositiveInt(table);
  if (!tableNumber || !Array.isArray(items) || items.length === 0) {
    const error = new Error('Table et articles requis');
    error.status = 400;
    throw error;
  }

  const maxTables = await getTablesCount();
  if (tableNumber > maxTables) {
    const error = new Error(`Table invalide (max ${maxTables})`);
    error.status = 400;
    throw error;
  }

  const cleanItems = buildOrderItems(items);
  const orderItems = [];
  let total = 0;

  for (const item of cleanItems) {
    const dish = await queryOne('SELECT * FROM dishes WHERE id = ? AND restaurant_id = ?', [item.dishId, restaurantId]);
    if (!dish) {
      const error = new Error('Plat introuvable');
      error.status = 404;
      throw error;
    }
    const visible = dish.visible == null ? 1 : dish.visible;
    if (!visible || !dish.available || dish.stock <= 0) {
      const error = new Error(`${dish.name} est indisponible`);
      error.status = 409;
      throw error;
    }
    if (dish.stock < item.quantity) {
      const error = new Error(`Stock insuffisant pour ${dish.name}`);
      error.status = 409;
      throw error;
    }

    orderItems.push({
      dishId: dish.id,
      name: dish.name,
      quantity: item.quantity,
      price: dish.price,
    });
    total += dish.price * item.quantity;
  }

  return { tableNumber, orderItems, total };
}

// Fix 3: Stock restoration checks stock > 0 before setting available
function restoreStock(orderId) {
  const maybeItems = queryAll('SELECT dish_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
  if (maybeItems.then) return maybeItems.then(items => restoreStockItems(items));
  return restoreStockItems(maybeItems);
}

function restoreStockItems(items) {
  for (const item of items) {
    if (item.dish_id) {
      runNoSave(
        'UPDATE dishes SET stock = stock + ?, available = CASE WHEN COALESCE(visible, 1) = 1 AND (stock + ?) > 0 THEN 1 ELSE 0 END WHERE id = ?',
        [item.quantity, item.quantity, item.dish_id]
      );
    }
  }
}

// Fix 1+6+14: cashAmount is optional (declaration), payment_status coherent, accept decimals
router.post('/', async (req, res) => {
  const { table, items, notes, cashAmount } = req.body;
  const restaurantId = Number(req.body.restaurantId) || 1;
  let validated;
  try {
    validated = await validateOrder(table, items, restaurantId);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  let declaredCash = 0;
  let expectedChange = 0;
  let paymentMethod = '';
  let paymentStatus = 'unpaid';

  if (cashAmount != null && cashAmount !== '') {
    declaredCash = Math.floor(Number(cashAmount));
    if (isNaN(declaredCash) || declaredCash < 0) {
      return res.status(400).json({ error: 'Montant espece invalide' });
    }
    if (declaredCash >= validated.total) {
      expectedChange = declaredCash - validated.total;
      paymentMethod = 'cash';
    }
  }

  const orderId = await transaction(async () => {
    const inserted = await runNoSave(
      'INSERT INTO orders (restaurant_id, table_number, total, status, payment_status, payment_method, amount_paid, change_due, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [restaurantId, validated.tableNumber, validated.total, 'pending', paymentStatus, paymentMethod, declaredCash, expectedChange, notes || '']
    );

    const oid = inserted?.lastInsertRowid || (await queryOne('SELECT last_insert_rowid() as id')).id;

    for (const item of validated.orderItems) {
      await runNoSave('INSERT INTO order_items (order_id, dish_id, name, quantity, price) VALUES (?,?,?,?,?)',
        [oid, item.dishId, item.name, item.quantity, item.price]);

      await runNoSave(
        'UPDATE dishes SET stock = stock - ?, available = CASE WHEN stock - ? > 0 THEN available ELSE 0 END WHERE id = ?',
        [item.quantity, item.quantity, item.dishId]
      );
    }
    return oid;
  });

  const order = await getOrderById(orderId);
  broadcast({ type: 'NEW_ORDER', order });
  res.status(201).json(order);
});

// Fix 4: Static routes BEFORE parameterized routes

// Admin: stats
router.get('/stats', authMiddleware, requireRoles('admin', 'caisse'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const scope = scopeForUser(req);
  const todayOrders = await queryOne(
    `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE date(created_at) = date(?) AND status != 'cancelled'${scope.clause}`, [today, ...scope.params]
  );
  const lowStock = await queryOne(
    req.user.role === 'superadmin'
      ? 'SELECT COUNT(*) as count FROM dishes WHERE stock < 10 AND stock > 0'
      : 'SELECT COUNT(*) as count FROM dishes WHERE stock < 10 AND stock > 0 AND restaurant_id = ?',
    req.user.role === 'superadmin' ? [] : [req.user.restaurantId || 1]
  );
  const topDishes = await queryAll(`
    SELECT
      oi.dish_id as dishId,
      oi.name,
      COALESCE(d.image, '') as image,
      SUM(oi.quantity) as quantity,
      SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'${req.user.role === 'superadmin' ? '' : ' AND o.restaurant_id = ?'}
    LEFT JOIN dishes d ON d.id = oi.dish_id
    GROUP BY oi.dish_id, oi.name, d.image
    ORDER BY quantity DESC, revenue DESC
    LIMIT 5
  `, req.user.role === 'superadmin' ? [] : [req.user.restaurantId || 1]);
  const hours = await queryAll(isMysql() ? `
    SELECT DATE_FORMAT(created_at, '%H') as hour, COUNT(*) as count
    FROM orders
    WHERE status != 'cancelled'${scope.clause}
    GROUP BY hour
    ORDER BY hour
  ` : `
    SELECT strftime('%H', created_at) as hour, COUNT(*) as count
    FROM orders
    WHERE status != 'cancelled'${scope.clause}
    GROUP BY hour
    ORDER BY hour
  `, scope.params);
  const maxHourCount = Math.max(1, ...hours.map(h => h.count));
  const peakHours = hours.map(h => ({
    hour: `${h.hour}h-${String(Number(h.hour) + 1).padStart(2, '0')}h`,
    count: h.count,
    val: Math.round((h.count / maxHourCount) * 100),
  }));

  res.json({
    todayRevenue: todayOrders.revenue,
    todayOrders: todayOrders.count,
    avgOrder: todayOrders.count > 0 ? Math.round(todayOrders.revenue / todayOrders.count) : 0,
    lowStock: lowStock.count,
    topDishes,
    peakHours,
  });
});

router.get('/reports', authMiddleware, requireRoles('admin', 'caisse'), async (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day';
  const format = period === 'day' ? '%Y-%m-%d' : period === 'week' ? '%Y-W%W' : '%Y-%m';
  const mysqlFormat = period === 'day' ? '%Y-%m-%d' : period === 'week' ? '%x-W%v' : '%Y-%m';
  const sales = await queryAll(isMysql() ? `
    SELECT DATE_FORMAT(created_at, '${mysqlFormat}') as label,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as paidRevenue
    FROM orders
    WHERE status != 'cancelled'${scope.clause}
    GROUP BY label
    ORDER BY label DESC
    LIMIT 30
  ` : `
    SELECT strftime('${format}', created_at) as label,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as paidRevenue
    FROM orders
    WHERE status != 'cancelled'${scope.clause}
    GROUP BY label
    ORDER BY label DESC
    LIMIT 30
  `, scope.params);
  const topDishes = await queryAll(`
    SELECT oi.name, COALESCE(d.image, '') as image, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'${req.user.role === 'superadmin' ? '' : ' AND o.restaurant_id = ?'}
    LEFT JOIN dishes d ON d.id = oi.dish_id
    GROUP BY oi.dish_id, oi.name, d.image
    ORDER BY quantity DESC, revenue DESC
    LIMIT 10
  `, req.user.role === 'superadmin' ? [] : [req.user.restaurantId || 1]);
  res.json({ period, sales, topDishes });
});

router.get('/export.csv', authMiddleware, requireRoles('admin', 'caisse'), async (req, res) => {
  const from = req.query.from || '1970-01-01';
  const to = req.query.to || new Date().toISOString().split('T')[0];
  const scope = scopeForUser(req);
  const rows = await queryAll(
    `SELECT id, table_number, total, status, payment_status, payment_method, amount_paid, change_due, notes, created_at, paid_at
     FROM orders
     WHERE date(created_at) BETWEEN date(?) AND date(?)${scope.clause}
     ORDER BY created_at DESC`,
    [from, to, ...scope.params]
  );
  const header = ['id', 'table', 'total', 'status', 'payment_status', 'payment_method', 'amount_paid', 'change_due', 'notes', 'created_at', 'paid_at'];
  const csv = [
    header.join(','),
    ...rows.map(row => [
      row.id,
      row.table_number,
      row.total,
      row.status,
      row.payment_status,
      row.payment_method,
      row.amount_paid || 0,
      row.change_due || 0,
      `"${String(row.notes || '').replaceAll('"', '""')}"`,
      row.created_at,
      row.paid_at || '',
    ].join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${from}-${to}.csv"`);
  res.send(csv);
});

// Parameterized routes AFTER static routes

router.get('/:id/public', async (req, res) => {
  const table = toPositiveInt(req.query.table);
  const orderId = toPositiveInt(req.params.id);
  if (!table || !orderId) return res.status(400).json({ error: 'Commande et table requis' });

  const order = await getOrderById(orderId);
  if (!order || order.table !== table) return res.status(404).json({ error: 'Commande introuvable' });

  res.json({
    id: order.id,
    table: order.table,
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    amountPaid: order.amountPaid,
    changeDue: order.changeDue,
    time: order.time,
    items: order.items,
  });
});

// Fix 9: Default date filter (today) to avoid returning entire history
router.get('/', authMiddleware, requireRoles('admin', 'serveur', 'cuisine', 'caisse'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const from = req.query.from || today;
  const to = req.query.to || today;
  const scope = scopeForUser(req);
  const orders = await queryAll(
    `SELECT * FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?)${scope.clause} ORDER BY created_at DESC`,
    [from, to, ...scope.params]
  );
  const result = await Promise.all(orders.map(async o => {
    const items = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    return formatOrder(o, items);
  }));
  res.json(result);
});

// Admin: update order status
router.patch('/:id', authMiddleware, requireRoles('admin', 'serveur', 'cuisine'), async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const scope = scopeForUser(req);
  const existing = await queryOne(`SELECT * FROM orders WHERE id = ?${scope.clause}`, [req.params.id, ...scope.params]);
  if (!existing) return res.status(404).json({ error: 'Commande introuvable' });
  if (existing.status === 'cancelled' && status !== 'cancelled') {
    return res.status(409).json({ error: 'Commande deja annulee' });
  }
  if (existing.status === 'served' && status === 'cancelled') {
    return res.status(409).json({ error: 'Commande deja servie' });
  }
  if (status === 'served' && existing.payment_status !== 'paid') {
    return res.status(409).json({ error: 'Paiement non confirme' });
  }

  await transaction(async () => {
    if (status === 'cancelled' && existing.status !== 'cancelled') await restoreStock(req.params.id);
    await runNoSave('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  });

  const order = await getOrderById(req.params.id);
  broadcast({ type: 'ORDER_UPDATED', order });
  res.json(order);
});

router.patch('/:id/payment', authMiddleware, requireRoles('admin', 'serveur', 'caisse'), async (req, res) => {
  const { paymentStatus, paymentMethod } = req.body;
  const validStatus = ['unpaid', 'paid', 'refunded'];
  const validMethods = ['', 'cash', 'mobile_money', 'card'];

  if (!validStatus.includes(paymentStatus) || !validMethods.includes(paymentMethod || '')) {
    return res.status(400).json({ error: 'Paiement invalide' });
  }

  const scope = scopeForUser(req);
  const existing = await queryOne(`SELECT * FROM orders WHERE id = ?${scope.clause}`, [req.params.id, ...scope.params]);
  if (!existing) return res.status(404).json({ error: 'Commande introuvable' });

  let amountPaid = 0;
  let changeDue = 0;
  if (paymentStatus === 'paid') {
    if (paymentMethod === 'cash') {
      amountPaid = req.body.amountPaid == null ? Number(existing.amount_paid) : Math.floor(Number(req.body.amountPaid));
      if (isNaN(amountPaid) || amountPaid < existing.total) {
        return res.status(400).json({ error: 'Montant recu insuffisant' });
      }
      changeDue = amountPaid - existing.total;
    } else {
      amountPaid = existing.total;
    }
  } else if (paymentStatus === 'unpaid') {
    amountPaid = existing.amount_paid || 0;
    changeDue = existing.change_due || 0;
  }

  const paidAt = paymentStatus === 'paid' ? new Date().toISOString() : null;
  await run(
    'UPDATE orders SET payment_status = ?, payment_method = ?, amount_paid = ?, change_due = ?, paid_at = ? WHERE id = ?',
    [paymentStatus, paymentMethod || '', amountPaid, changeDue, paidAt, req.params.id]
  );

  const order = await getOrderById(req.params.id);
  broadcast({ type: 'ORDER_UPDATED', order });
  res.json(order);
});

export default router;
