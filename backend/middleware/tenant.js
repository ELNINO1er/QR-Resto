import { DEFAULT_RESTAURANT_ID } from '../config.js';
import { queryOne } from '../db.js';

export function requestedRestaurantId(req) {
  const raw = req.headers['x-restaurant-id'] || req.query.restaurantId || req.body?.restaurantId;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function scopedRestaurantId(req) {
  if (req.user?.role === 'superadmin') return requestedRestaurantId(req) || DEFAULT_RESTAURANT_ID;
  return req.user?.restaurantId || DEFAULT_RESTAURANT_ID;
}

export async function getRestaurantOrNull(id) {
  return await queryOne('SELECT * FROM restaurants WHERE id = ?', [id]);
}

export async function requireActiveRestaurant(req, res, next) {
  const id = scopedRestaurantId(req);
  const restaurant = await getRestaurantOrNull(id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  if (restaurant.status !== 'active' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Restaurant suspendu' });
  }
  req.restaurant = restaurant;
  req.restaurantId = id;
  next();
}
