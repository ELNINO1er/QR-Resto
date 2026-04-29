import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

function formatDish(d) {
  return {
    id: d.id, name: d.name, description: d.description, price: d.price,
    category: d.category, image: d.image, stock: d.stock,
    available: !!d.available, veg: !!d.veg, glutenFree: !!d.gluten_free,
    spicy: !!d.spicy, prepTime: d.prep_time, rating: d.rating,
  };
}

// Public: get menu
router.get('/', (_req, res) => {
  const dishes = queryAll('SELECT * FROM dishes ORDER BY category, name');
  res.json(dishes.map(formatDish));
});

// Admin: add dish
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, description, price, category, image, stock, available, veg, glutenFree, spicy, prepTime } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Nom, prix et categorie requis' });
  }
  const cleanStock = Math.max(0, Number(stock) || 0);

  const result = run(
    'INSERT INTO dishes (name, description, price, category, image, stock, available, veg, gluten_free, spicy, prep_time) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [name, description || '', price, category, image || '🍽️', cleanStock, available && cleanStock > 0 ? 1 : 0, veg ? 1 : 0, glutenFree ? 1 : 0, spicy ? 1 : 0, prepTime || 15]
  );

  const dish = queryOne('SELECT * FROM dishes WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(formatDish(dish));
});

// Admin: update dish
router.patch('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM dishes WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Plat introuvable' });

  const b = req.body;
  const newStock = Math.max(0, Number(b.stock ?? existing.stock) || 0);
  // Auto-update available based on stock if not explicitly set
  let newAvailable;
  if (newStock <= 0) {
    newAvailable = 0;
  } else if (b.available != null) {
    newAvailable = b.available ? 1 : 0;
  } else {
    newAvailable = existing.available;
  }

  run(
    `UPDATE dishes SET
      name = ?, description = ?, price = ?, category = ?, image = ?,
      stock = ?, available = ?, veg = ?, gluten_free = ?, spicy = ?, prep_time = ?
    WHERE id = ?`,
    [
      b.name ?? existing.name, b.description ?? existing.description,
      b.price ?? existing.price, b.category ?? existing.category,
      b.image ?? existing.image, newStock, newAvailable,
      b.veg != null ? (b.veg ? 1 : 0) : existing.veg,
      b.glutenFree != null ? (b.glutenFree ? 1 : 0) : existing.gluten_free,
      b.spicy != null ? (b.spicy ? 1 : 0) : existing.spicy,
      b.prepTime ?? existing.prep_time, id
    ]
  );

  const dish = queryOne('SELECT * FROM dishes WHERE id = ?', [id]);
  res.json(formatDish(dish));
});

// Admin: delete dish
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const result = run('DELETE FROM dishes WHERE id = ?', [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Plat introuvable' });
  res.json({ success: true });
});

export default router;
