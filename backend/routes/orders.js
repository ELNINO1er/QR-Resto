import { Router } from 'express';
import { queryAll, queryOne, run, runNoSave, transaction } from '../db.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';

const router = Router();

let broadcast = () => {};
export function setBroadcast(fn) { broadcast = fn; }

function getOrderById(id) {
  const o = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
  if (!o) return null;
  const items = queryAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
  return formatOrder(o, items);
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
    paidAt: o.paid_at,
    notes: o.notes,
    time: o.created_at ? new Date(o.created_at + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
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

function validateOrder(table, items) {
  const tableNumber = toPositiveInt(table);
  if (!tableNumber || !Array.isArray(items) || items.length === 0) {
    const error = new Error('Table et articles requis');
    error.status = 400;
    throw error;
  }

  const cleanItems = buildOrderItems(items);
  const orderItems = [];
  let total = 0;

  for (const item of cleanItems) {
    const dish = queryOne('SELECT * FROM dishes WHERE id = ?', [item.dishId]);
    if (!dish) {
      const error = new Error('Plat introuvable');
      error.status = 404;
      throw error;
    }
    if (!dish.available) {
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

// Public: create order
router.post('/', (req, res) => {
  const { table, items, notes } = req.body;
  let validated;
  try {
    validated = validateOrder(table, items);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  const orderId = transaction(() => {
    runNoSave('INSERT INTO orders (table_number, total, status, notes) VALUES (?, ?, ?, ?)',
      [validated.tableNumber, validated.total, 'pending', notes || '']);

    // Get the last inserted order id
    const row = queryOne('SELECT last_insert_rowid() as id');
    const oid = row.id;

    for (const item of validated.orderItems) {
      runNoSave('INSERT INTO order_items (order_id, dish_id, name, quantity, price) VALUES (?,?,?,?,?)',
        [oid, item.dishId, item.name, item.quantity, item.price]);

      runNoSave(
        'UPDATE dishes SET stock = stock - ?, available = CASE WHEN stock - ? > 0 THEN available ELSE 0 END WHERE id = ?',
        [item.quantity, item.quantity, item.dishId]
      );
    }
    return oid;
  });

  const order = getOrderById(orderId);
  broadcast({ type: 'NEW_ORDER', order });
  res.status(201).json(order);
});

// Admin: get all orders
router.get('/', authMiddleware, requireRoles('admin', 'serveur', 'cuisine', 'caisse'), (req, res) => {
  const params = [];
  let where = '';
  if (req.query.from || req.query.to) {
    const from = req.query.from || '1970-01-01';
    const to = req.query.to || new Date().toISOString().split('T')[0];
    where = 'WHERE date(created_at) BETWEEN date(?) AND date(?)';
    params.push(from, to);
  }
  const orders = queryAll(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);
  const result = orders.map(o => {
    const items = queryAll('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    return formatOrder(o, items);
  });
  res.json(result);
});

// Admin: update order status
router.patch('/:id', authMiddleware, requireRoles('admin', 'serveur', 'cuisine'), (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'preparing', 'ready', 'served'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const result = run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Commande introuvable' });

  const order = getOrderById(req.params.id);
  broadcast({ type: 'ORDER_UPDATED', order });
  res.json(order);
});

router.patch('/:id/payment', authMiddleware, requireRoles('admin', 'serveur', 'caisse'), (req, res) => {
  const { paymentStatus, paymentMethod } = req.body;
  const validStatus = ['unpaid', 'paid', 'refunded'];
  const validMethods = ['', 'cash', 'mobile_money', 'card'];

  if (!validStatus.includes(paymentStatus) || !validMethods.includes(paymentMethod || '')) {
    return res.status(400).json({ error: 'Paiement invalide' });
  }

  const paidAt = paymentStatus === 'paid' ? new Date().toISOString() : null;
  const result = run(
    'UPDATE orders SET payment_status = ?, payment_method = ?, paid_at = ? WHERE id = ?',
    [paymentStatus, paymentMethod || '', paidAt, req.params.id]
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Commande introuvable' });

  const order = getOrderById(req.params.id);
  broadcast({ type: 'ORDER_UPDATED', order });
  res.json(order);
});

// Admin: stats
router.get('/stats', authMiddleware, requireRoles('admin', 'caisse'), (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = queryOne(
    "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE date(created_at) = date(?)", [today]
  );
  const lowStock = queryOne('SELECT COUNT(*) as count FROM dishes WHERE stock < 10 AND stock > 0');
  const topDishes = queryAll(`
    SELECT
      oi.dish_id as dishId,
      oi.name,
      COALESCE(d.image, '') as image,
      SUM(oi.quantity) as quantity,
      SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    LEFT JOIN dishes d ON d.id = oi.dish_id
    GROUP BY oi.dish_id, oi.name, d.image
    ORDER BY quantity DESC, revenue DESC
    LIMIT 5
  `);
  const hours = queryAll(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as count
    FROM orders
    GROUP BY hour
    ORDER BY hour
  `);
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

router.get('/reports', authMiddleware, requireRoles('admin', 'caisse'), (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day';
  const format = period === 'day' ? '%Y-%m-%d' : period === 'week' ? '%Y-W%W' : '%Y-%m';
  const sales = queryAll(`
    SELECT strftime('${format}', created_at) as label,
      COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as paidRevenue
    FROM orders
    GROUP BY label
    ORDER BY label DESC
    LIMIT 30
  `);
  const topDishes = queryAll(`
    SELECT oi.name, COALESCE(d.image, '') as image, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    LEFT JOIN dishes d ON d.id = oi.dish_id
    GROUP BY oi.dish_id, oi.name, d.image
    ORDER BY quantity DESC, revenue DESC
    LIMIT 10
  `);
  res.json({ period, sales, topDishes });
});

router.get('/export.csv', authMiddleware, requireRoles('admin', 'caisse'), (req, res) => {
  const from = req.query.from || '1970-01-01';
  const to = req.query.to || new Date().toISOString().split('T')[0];
  const rows = queryAll(
    `SELECT id, table_number, total, status, payment_status, payment_method, notes, created_at, paid_at
     FROM orders
     WHERE date(created_at) BETWEEN date(?) AND date(?)
     ORDER BY created_at DESC`,
    [from, to]
  );
  const header = ['id', 'table', 'total', 'status', 'payment_status', 'payment_method', 'notes', 'created_at', 'paid_at'];
  const csv = [
    header.join(','),
    ...rows.map(row => [
      row.id,
      row.table_number,
      row.total,
      row.status,
      row.payment_status,
      row.payment_method,
      `"${String(row.notes || '').replaceAll('"', '""')}"`,
      row.created_at,
      row.paid_at || '',
    ].join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${from}-${to}.csv"`);
  res.send(csv);
});

export default router;
