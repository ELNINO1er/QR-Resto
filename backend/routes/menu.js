import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();
const MAX_IMAGE_LENGTH = 5 * 1024 * 1024;

function formatDish(d) {
  const visible = d.visible == null ? 1 : d.visible;
  return {
    id: d.id, name: d.name, description: d.description, price: d.price,
    category: d.category, image: d.image, stock: d.stock,
    available: !!visible && d.stock > 0, visible: !!visible, veg: !!d.veg, glutenFree: !!d.gluten_free,
    spicy: !!d.spicy, prepTime: d.prep_time, rating: d.rating,
  };
}

function validateImage(image) {
  if (!image) return '🍽️';
  if (typeof image !== 'string') {
    const error = new Error('Image invalide');
    error.status = 400;
    throw error;
  }
  if (image.length > MAX_IMAGE_LENGTH) {
    const error = new Error('Image trop volumineuse');
    error.status = 413;
    throw error;
  }
  if (image.startsWith('data:') && !image.startsWith('data:image/')) {
    const error = new Error('Format image invalide');
    error.status = 400;
    throw error;
  }
  return image;
}

// Public: get menu
router.get('/', (_req, res) => {
  const dishes = queryAll('SELECT * FROM dishes ORDER BY category, name');
  res.json(dishes.map(formatDish));
});

// Admin: add dish
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, description, price, category, image, stock, available, visible, veg, glutenFree, spicy, prepTime } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Nom, prix et categorie requis' });
  }
  const cleanStock = Math.max(0, Number(stock) || 0);
  let cleanImage;
  try {
    cleanImage = validateImage(image);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  const cleanVisible = visible != null ? (visible ? 1 : 0) : (available != null ? (available ? 1 : 0) : 1);

  const result = run(
    'INSERT INTO dishes (name, description, price, category, image, stock, available, visible, veg, gluten_free, spicy, prep_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [name, description || '', price, category, cleanImage, cleanStock, cleanVisible && cleanStock > 0 ? 1 : 0, cleanVisible, veg ? 1 : 0, glutenFree ? 1 : 0, spicy ? 1 : 0, prepTime || 15]
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
  let cleanImage;
  try {
    cleanImage = b.image != null ? validateImage(b.image) : existing.image;
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }
  const newStock = Math.max(0, Number(b.stock ?? existing.stock) || 0);
  const existingVisible = existing.visible == null ? 1 : existing.visible;
  const newVisible = b.visible != null
    ? (b.visible ? 1 : 0)
    : b.available != null
      ? (b.available ? 1 : 0)
      : existingVisible;
  const newAvailable = newVisible && newStock > 0 ? 1 : 0;

  run(
    `UPDATE dishes SET
      name = ?, description = ?, price = ?, category = ?, image = ?,
      stock = ?, available = ?, visible = ?, veg = ?, gluten_free = ?, spicy = ?, prep_time = ?
    WHERE id = ?`,
    [
      b.name ?? existing.name, b.description ?? existing.description,
      b.price ?? existing.price, b.category ?? existing.category,
      cleanImage, newStock, newAvailable, newVisible,
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
