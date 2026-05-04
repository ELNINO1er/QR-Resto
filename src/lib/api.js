const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}

// Auth
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const getMe = () => request('/auth/me');
export const changePassword = (currentPassword, newPassword) =>
  request('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });

// Menu
export const getMenu = (all = false) => request(`/menu${all ? '?all=1' : ''}`);
export const addDish = (dish) =>
  request('/menu', { method: 'POST', body: JSON.stringify(dish) });
export const updateDish = (id, data) =>
  request(`/menu/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteDish = (id) =>
  request(`/menu/${id}`, { method: 'DELETE' });

// Orders
export const createOrder = (order) =>
  request('/orders', { method: 'POST', body: JSON.stringify(order) });
export const getPublicOrder = (id, table) => request(`/orders/${id}/public?table=${encodeURIComponent(table)}`);
export const getOrders = (from, to) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return request(`/orders${qs ? `?${qs}` : ''}`);
};
export const updateOrderStatus = (id, status) =>
  request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const updatePayment = (id, paymentStatus, paymentMethod, amountPaid) =>
  request(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ paymentStatus, paymentMethod, amountPaid }) });
export const getStats = () => request('/orders/stats');
export const getReports = (period = 'day') => request(`/orders/reports?period=${period}`);
// Fix 13: Download CSV with auth token (plain URL wouldn't have Authorization header)
export async function exportOrdersCsv(from, to) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/orders/export.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur export');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${from}-${to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Users
export const getUsers = () => request('/users');
export const createUser = (user) =>
  request('/users', { method: 'POST', body: JSON.stringify(user) });
export const updateUser = (id, user) =>
  request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(user) });
export const deleteUser = (id) =>
  request(`/users/${id}`, { method: 'DELETE' });

// Restaurants / Super Admin
export const getRestaurants = () => request('/restaurants');
export const createRestaurant = (restaurant) =>
  request('/restaurants', { method: 'POST', body: JSON.stringify(restaurant) });
export const updateRestaurant = (id, restaurant) =>
  request(`/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(restaurant) });

// Settings
export const getPublicSettings = () => request('/settings/public');
export const getNetworkInfo = () => request('/settings/network');
export const getSettings = () => request('/settings');
export const updateSettings = (data) =>
  request('/settings', { method: 'PATCH', body: JSON.stringify(data) });

// Maintenance / Super Admin
export const getBackups = () => request('/maintenance/backups');
export const createBackup = () => request('/maintenance/backups', { method: 'POST' });
export const restoreBackup = (backupName) =>
  request('/maintenance/restore', { method: 'POST', body: JSON.stringify({ backupName }) });
export const exportDatabaseUrl = () => '/api/maintenance/export.db';
