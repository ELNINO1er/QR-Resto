import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { getRestaurantOrNull, requestedRestaurantId, requireActiveRestaurant, scopedRestaurantId } from '../middleware/tenant.js';

const router = Router();
const MAX_IMAGE_LENGTH = 3 * 1024 * 1024;
const VALID_CATEGORIES = ['entrees', 'plats', 'desserts', 'boissons'];

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value, field, { required = false, max = 255 } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw createHttpError(`${field} requis`);
  if (text.length > max) throw createHttpError(`${field} trop long`);
  return text;
}

function cleanPositiveInteger(value, field, { required = false, min = 1, max = 999999 } = {}) {
  if ((value == null || value === '') && !required) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw createHttpError(`${field} invalide`);
  }
  return number;
}

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

function cleanDishInput(body, existing = {}) {
  const name = body.name != null
    ? cleanText(body.name, 'Nom', { required: true, max: 120 })
    : existing.name;
  const description = body.description != null
    ? cleanText(body.description, 'Description', { max: 600 })
    : (existing.description ?? '');
  const price = body.price != null
    ? cleanPositiveInteger(body.price, 'Prix', { required: true, min: 1, max: 10000000 })
    : existing.price;
  const category = body.category != null
    ? cleanText(body.category, 'Categorie', { required: true, max: 40 })
    : existing.category;

  if (!name || !price || !category) throw createHttpError('Nom, prix et categorie requis');
  if (!VALID_CATEGORIES.includes(category)) throw createHttpError('Categorie invalide');

  const stockValue = body.stock != null
    ? cleanPositiveInteger(body.stock, 'Stock', { min: 0, max: 9999 })
    : (existing.stock ?? 0);
  const prepTime = body.prepTime != null
    ? cleanPositiveInteger(body.prepTime, 'Temps de preparation', { min: 1, max: 240 })
    : (existing.prep_time ?? 15);

  return {
    name,
    description,
    price,
    category,
    stock: stockValue,
    prepTime,
  };
}

async function sendMenu(req, res, includeAll = false) {
  const restaurantId = includeAll ? scopedRestaurantId(req) : (requestedRestaurantId(req) || 1);
  const restaurant = await getRestaurantOrNull(restaurantId);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  if (restaurant.status !== 'active' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Restaurant suspendu' });
  }
  const dishes = includeAll
    ? queryAll('SELECT * FROM dishes WHERE restaurant_id = ? ORDER BY category, name', [restaurantId])
    : queryAll('SELECT * FROM dishes WHERE restaurant_id = ? AND COALESCE(visible, 1) = 1 AND stock > 0 ORDER BY category, name', [restaurantId]);
  return res.json((await dishes).map(formatDish));
}

// Public: get menu. Admin can request all dishes with ?all=1.
router.get('/', async (req, res) => {
  if (req.query.all === '1') {
    return authMiddleware(req, res, () => requireActiveRestaurant(req, res, () => adminOnly(req, res, () => sendMenu(req, res, true))));
  }
  return await sendMenu(req, res);
});

// Admin: add dish
router.post('/', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const { image, available, visible, veg, glutenFree, spicy } = req.body;
  let cleanInput;
  let cleanImage;
  try {
    cleanInput = cleanDishInput(req.body);
    cleanImage = validateImage(image);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  const cleanVisible = visible != null ? (visible ? 1 : 0) : (available != null ? (available ? 1 : 0) : 1);

  const result = await run(
    'INSERT INTO dishes (restaurant_id, name, description, price, category, image, stock, available, visible, veg, gluten_free, spicy, prep_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      req.user.restaurantId || 1, cleanInput.name, cleanInput.description, cleanInput.price, cleanInput.category,
      cleanImage, cleanInput.stock, cleanVisible && cleanInput.stock > 0 ? 1 : 0,
      cleanVisible, veg ? 1 : 0, glutenFree ? 1 : 0, spicy ? 1 : 0, cleanInput.prepTime,
    ]
  );

  const dish = await queryOne('SELECT * FROM dishes WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(formatDish(dish));
});

// Admin: update dish
router.patch('/:id', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const { id } = req.params;
  const existing = req.user.role === 'superadmin'
    ? await queryOne('SELECT * FROM dishes WHERE id = ?', [id])
    : await queryOne('SELECT * FROM dishes WHERE id = ? AND restaurant_id = ?', [id, scopedRestaurantId(req)]);
  if (!existing) return res.status(404).json({ error: 'Plat introuvable' });

  const b = req.body;
  let cleanInput;
  let cleanImage;
  try {
    cleanInput = cleanDishInput(b, existing);
    cleanImage = b.image != null ? validateImage(b.image) : existing.image;
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }
  const newStock = cleanInput.stock;
  const existingVisible = existing.visible == null ? 1 : existing.visible;
  const newVisible = b.visible != null
    ? (b.visible ? 1 : 0)
    : b.available != null
      ? (b.available ? 1 : 0)
      : existingVisible;
  const newAvailable = newVisible && newStock > 0 ? 1 : 0;

  await run(
    `UPDATE dishes SET
      name = ?, description = ?, price = ?, category = ?, image = ?,
      stock = ?, available = ?, visible = ?, veg = ?, gluten_free = ?, spicy = ?, prep_time = ?
    WHERE id = ?`,
    [
      cleanInput.name, cleanInput.description, cleanInput.price, cleanInput.category,
      cleanImage, cleanInput.stock, newAvailable, newVisible,
      b.veg != null ? (b.veg ? 1 : 0) : existing.veg,
      b.glutenFree != null ? (b.glutenFree ? 1 : 0) : existing.gluten_free,
      b.spicy != null ? (b.spicy ? 1 : 0) : existing.spicy,
      cleanInput.prepTime, id
    ]
  );

  const dish = await queryOne('SELECT * FROM dishes WHERE id = ?', [id]);
  res.json(formatDish(dish));
});

// Admin: delete dish
router.delete('/:id', authMiddleware, requireActiveRestaurant, adminOnly, async (req, res) => {
  const result = req.user.role === 'superadmin'
    ? await run('DELETE FROM dishes WHERE id = ?', [req.params.id])
    : await run('DELETE FROM dishes WHERE id = ? AND restaurant_id = ?', [req.params.id, scopedRestaurantId(req)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Plat introuvable' });
  res.json({ success: true });
});

export default router;
