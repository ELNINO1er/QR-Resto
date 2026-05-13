import { Router } from 'express';
import { queryAll, queryOne, run, runNoSave, transaction } from '../db.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { requestedRestaurantId, requireActiveRestaurant, scopedRestaurantId } from '../middleware/tenant.js';

const router = Router();

// Public: submit review for an order (no auth needed - customer submits after eating)
router.post('/', async (req, res) => {
  const { orderId, table, ratings } = req.body;

  if (!orderId || !table || !Array.isArray(ratings) || ratings.length === 0) {
    return res.status(400).json({ error: 'orderId, table et ratings requis' });
  }

  // Verify order exists and belongs to this table
  const order = await queryOne('SELECT * FROM orders WHERE id = ? AND table_number = ?', [orderId, table]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  // Check order is served or ready (not pending/preparing)
  if (!['ready', 'served'].includes(order.status)) {
    return res.status(409).json({ error: 'La commande doit etre servie pour etre notee' });
  }

  // Check not already reviewed
  const existing = await queryOne('SELECT id FROM reviews WHERE order_id = ?', [orderId]);
  if (existing) return res.status(409).json({ error: 'Cette commande a deja ete notee' });

  const orderItems = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const validDishIds = new Set(orderItems.map(i => i.dish_id).filter(Boolean));

  await transaction(async () => {
    for (const r of ratings) {
      const dishId = Number(r.dishId);
      const rating = Number(r.rating);
      if (!validDishIds.has(dishId)) continue;
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;

      await runNoSave(
        'INSERT INTO reviews (restaurant_id, order_id, dish_id, rating, comment, table_number) VALUES (?, ?, ?, ?, ?, ?)',
        [order.restaurant_id || 1, orderId, dishId, rating, (r.comment || '').slice(0, 500), table]
      );

      // Update dish average rating
      const avg = await queryOne('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE dish_id = ?', [dishId]);
      if (avg) {
        await runNoSave('UPDATE dishes SET rating = ? WHERE id = ?', [Math.round(avg.avg * 10) / 10, dishId]);
      }
    }
  });

  res.status(201).json({ message: 'Merci pour votre avis !' });
});

// Public: check if order was already reviewed
router.get('/check/:orderId', async (req, res) => {
  const existing = await queryOne('SELECT id FROM reviews WHERE order_id = ?', [req.params.orderId]);
  res.json({ reviewed: !!existing });
});

// Admin: list reviews
router.get('/', authMiddleware, requireActiveRestaurant, requireRoles('admin'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const reviews = await queryAll(`
    SELECT r.*, d.name as dish_name, d.image as dish_image
    FROM reviews r
    LEFT JOIN dishes d ON d.id = r.dish_id
    WHERE r.restaurant_id = ?
    ORDER BY r.created_at DESC
    LIMIT 100
  `, [restaurantId]);
  res.json(reviews);
});

// Admin: delete a review
router.delete('/:id', authMiddleware, requireActiveRestaurant, requireRoles('admin'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const review = await queryOne('SELECT * FROM reviews WHERE id = ? AND restaurant_id = ?', [req.params.id, restaurantId]);
  if (!review) return res.status(404).json({ error: 'Avis introuvable' });

  await run('DELETE FROM reviews WHERE id = ?', [req.params.id]);

  // Recalculate average
  const avg = await queryOne('SELECT AVG(rating) as avg FROM reviews WHERE dish_id = ?', [review.dish_id]);
  await run('UPDATE dishes SET rating = ? WHERE id = ?', [avg?.avg ? Math.round(avg.avg * 10) / 10 : 0, review.dish_id]);

  res.json({ message: 'Avis supprime' });
});

export default router;
