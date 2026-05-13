import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { requireActiveRestaurant, scopedRestaurantId } from '../middleware/tenant.js';

const router = Router();

// Get table statuses (real-time) + layout
router.get('/status', authMiddleware, requireActiveRestaurant, requireRoles('admin', 'serveur', 'caisse'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const tablesCount = await queryOne("SELECT value FROM settings WHERE restaurant_id = ? AND `key` = 'tables_count'", [restaurantId]);
  const count = parseInt(tablesCount?.value || '12');

  // Get active orders per table
  const activeOrders = await queryAll(`
    SELECT table_number, status, payment_status, COUNT(*) as order_count, MAX(id) as last_order_id,
      COALESCE(SUM(total), 0) as total
    FROM orders
    WHERE restaurant_id = ? AND status NOT IN ('served', 'cancelled') AND date(created_at) = date('now')
    GROUP BY table_number
  `, [restaurantId]);

  // Get layout
  const layout = await queryAll('SELECT * FROM table_layout WHERE restaurant_id = ?', [restaurantId]);
  const layoutMap = Object.fromEntries(layout.map(l => [l.table_number, l]));

  const tables = [];
  for (let i = 1; i <= count; i++) {
    const orders = activeOrders.filter(o => o.table_number === i);
    let status = 'free';
    let total = 0;
    let paymentPending = false;

    if (orders.length > 0) {
      total = orders.reduce((s, o) => s + o.total, 0);
      const hasReady = orders.some(o => o.status === 'ready');
      const hasUnpaid = orders.some(o => o.payment_status !== 'paid');
      if (hasReady && hasUnpaid) status = 'payment_pending';
      else if (hasReady) status = 'ready';
      else status = 'occupied';
      paymentPending = hasUnpaid;
    }

    const l = layoutMap[i];
    tables.push({
      number: i,
      status,
      total,
      paymentPending,
      orderCount: orders.reduce((s, o) => s + o.order_count, 0),
      x: l?.x ?? ((i - 1) % 4) * 25 + 5,
      y: l?.y ?? Math.floor((i - 1) / 4) * 25 + 5,
      seats: l?.seats ?? 4,
      shape: l?.shape ?? 'round',
    });
  }

  res.json(tables);
});

// Save layout (drag & drop positions)
router.put('/layout', authMiddleware, requireActiveRestaurant, requireRoles('admin'), async (req, res) => {
  const { tables } = req.body;
  if (!Array.isArray(tables)) return res.status(400).json({ error: 'Tables requises' });
  const restaurantId = scopedRestaurantId(req);

  for (const t of tables) {
    const existing = await queryOne('SELECT id FROM table_layout WHERE restaurant_id = ? AND table_number = ?', [restaurantId, t.number]);
    if (existing) {
      await run('UPDATE table_layout SET x = ?, y = ?, seats = ?, shape = ? WHERE id = ?',
        [t.x, t.y, t.seats || 4, t.shape || 'round', existing.id]);
    } else {
      await run('INSERT INTO table_layout (restaurant_id, table_number, x, y, seats, shape) VALUES (?,?,?,?,?,?)',
        [restaurantId, t.number, t.x, t.y, t.seats || 4, t.shape || 'round']);
    }
  }

  res.json({ success: true });
});

// Split bill - get order items for a table
router.get('/:tableNumber/orders', authMiddleware, requireActiveRestaurant, requireRoles('admin', 'serveur', 'caisse'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const orders = await queryAll(`
    SELECT o.*, GROUP_CONCAT(oi.name || ' x' || oi.quantity) as items_summary
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.restaurant_id = ? AND o.table_number = ? AND o.status NOT IN ('served', 'cancelled') AND date(o.created_at) = date('now')
    GROUP BY o.id
    ORDER BY o.created_at
  `, [restaurantId, req.params.tableNumber]);

  res.json(orders.map(o => ({
    id: o.id,
    total: o.total,
    status: o.status,
    paymentStatus: o.payment_status,
    itemsSummary: o.items_summary,
    createdAt: o.created_at,
  })));
});

export default router;
