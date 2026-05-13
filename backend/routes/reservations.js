import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { requestedRestaurantId, requireActiveRestaurant, scopedRestaurantId, getRestaurantOrNull } from '../middleware/tenant.js';

const router = Router();

const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '18:00', '18:30', '19:00', '19:30', '20:00',
  '20:30', '21:00', '21:30',
];

// Public: get available slots for a date
router.get('/slots', async (req, res) => {
  const { date } = req.query;
  const restaurantId = requestedRestaurantId(req) || 1;
  if (!date) return res.status(400).json({ error: 'Date requise' });

  const restaurant = await getRestaurantOrNull(restaurantId);
  if (!restaurant || restaurant.status !== 'active') return res.status(404).json({ error: 'Restaurant introuvable' });

  const tablesRow = await queryOne("SELECT value FROM settings WHERE restaurant_id = ? AND `key` = 'tables_count'", [restaurantId]);
  const tablesCount = parseInt(tablesRow?.value || '12');

  // Get existing reservations for this date
  const existing = await queryAll(
    "SELECT time_slot, COUNT(*) as count FROM reservations WHERE restaurant_id = ? AND date = ? AND status != 'cancelled' GROUP BY time_slot",
    [restaurantId, date]
  );
  const countBySlot = Object.fromEntries(existing.map(e => [e.time_slot, e.count]));

  const slots = TIME_SLOTS.map(slot => ({
    time: slot,
    available: (countBySlot[slot] || 0) < tablesCount,
    remaining: tablesCount - (countBySlot[slot] || 0),
  }));

  res.json({ date, slots });
});

// Public: create reservation
router.post('/', async (req, res) => {
  const { customerName, customerPhone, customerEmail, date, timeSlot, partySize, notes } = req.body;
  const restaurantId = requestedRestaurantId(req) || 1;

  if (!customerName || !date || !timeSlot || !partySize) {
    return res.status(400).json({ error: 'Nom, date, creneau et nombre de personnes requis' });
  }
  if (!TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({ error: 'Creneau invalide' });
  }
  if (partySize < 1 || partySize > 20) {
    return res.status(400).json({ error: 'Nombre de personnes invalide (1-20)' });
  }

  // Check date is not in the past
  const today = new Date().toISOString().split('T')[0];
  if (date < today) return res.status(400).json({ error: 'Date passee' });

  // Check availability
  const tablesRow = await queryOne("SELECT value FROM settings WHERE restaurant_id = ? AND `key` = 'tables_count'", [restaurantId]);
  const tablesCount = parseInt(tablesRow?.value || '12');
  const existing = await queryOne(
    "SELECT COUNT(*) as count FROM reservations WHERE restaurant_id = ? AND date = ? AND time_slot = ? AND status != 'cancelled'",
    [restaurantId, date, timeSlot]
  );
  if (existing.count >= tablesCount) {
    return res.status(409).json({ error: 'Creneau complet' });
  }

  const result = await run(
    'INSERT INTO reservations (restaurant_id, customer_name, customer_phone, customer_email, date, time_slot, party_size, notes) VALUES (?,?,?,?,?,?,?,?)',
    [restaurantId, customerName.slice(0, 100), (customerPhone || '').slice(0, 20), (customerEmail || '').slice(0, 100), date, timeSlot, partySize, (notes || '').slice(0, 500)]
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    message: 'Reservation confirmee !',
  });
});

// Public: check reservation by id + phone
router.get('/check/:id', async (req, res) => {
  const reservation = await queryOne(
    'SELECT id, customer_name, date, time_slot, party_size, status FROM reservations WHERE id = ?',
    [req.params.id]
  );
  if (!reservation) return res.status(404).json({ error: 'Reservation introuvable' });
  res.json(reservation);
});

// Admin: list reservations
router.get('/', authMiddleware, requireActiveRestaurant, requireRoles('admin', 'serveur'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const reservations = await queryAll(
    "SELECT * FROM reservations WHERE restaurant_id = ? AND date = ? ORDER BY time_slot",
    [restaurantId, date]
  );
  res.json(reservations);
});

// Admin: list reservations for a date range
router.get('/range', authMiddleware, requireActiveRestaurant, requireRoles('admin'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const from = req.query.from || new Date().toISOString().split('T')[0];
  const to = req.query.to || from;
  const reservations = await queryAll(
    "SELECT * FROM reservations WHERE restaurant_id = ? AND date BETWEEN ? AND ? ORDER BY date, time_slot",
    [restaurantId, from, to]
  );
  res.json(reservations);
});

// Admin: update reservation status
router.patch('/:id', authMiddleware, requireActiveRestaurant, requireRoles('admin', 'serveur'), async (req, res) => {
  const { status, tableNumber } = req.body;
  const restaurantId = scopedRestaurantId(req);
  const valid = ['confirmed', 'arrived', 'seated', 'completed', 'cancelled', 'no_show'];
  if (status && !valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  const existing = await queryOne('SELECT * FROM reservations WHERE id = ? AND restaurant_id = ?', [req.params.id, restaurantId]);
  if (!existing) return res.status(404).json({ error: 'Reservation introuvable' });

  if (status) await run('UPDATE reservations SET status = ? WHERE id = ?', [status, req.params.id]);
  if (tableNumber != null) await run('UPDATE reservations SET table_number = ? WHERE id = ?', [tableNumber, req.params.id]);

  const updated = await queryOne('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// Admin: delete reservation
router.delete('/:id', authMiddleware, requireActiveRestaurant, requireRoles('admin'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const result = await run('DELETE FROM reservations WHERE id = ? AND restaurant_id = ?', [req.params.id, restaurantId]);
  if (result.changes === 0) return res.status(404).json({ error: 'Reservation introuvable' });
  res.json({ success: true });
});

export default router;
