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
export const getMenu = () => request('/menu');
export const addDish = (dish) =>
  request('/menu', { method: 'POST', body: JSON.stringify(dish) });
export const updateDish = (id, data) =>
  request(`/menu/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteDish = (id) =>
  request(`/menu/${id}`, { method: 'DELETE' });

// Orders
export const createOrder = (order) =>
  request('/orders', { method: 'POST', body: JSON.stringify(order) });
export const getOrders = () => request('/orders');
export const updateOrderStatus = (id, status) =>
  request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const updatePayment = (id, paymentStatus, paymentMethod) =>
  request(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ paymentStatus, paymentMethod }) });
export const getStats = () => request('/orders/stats');
export const getReports = (period = 'day') => request(`/orders/reports?period=${period}`);
export const exportOrdersUrl = (from, to) => `/api/orders/export.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

// Users
export const getUsers = () => request('/users');
export const createUser = (user) =>
  request('/users', { method: 'POST', body: JSON.stringify(user) });
export const updateUser = (id, user) =>
  request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(user) });
export const deleteUser = (id) =>
  request(`/users/${id}`, { method: 'DELETE' });

// Settings
export const getPublicSettings = () => request('/settings/public');
export const getNetworkInfo = () => request('/settings/network');
export const getSettings = () => request('/settings');
export const updateSettings = (data) =>
  request('/settings', { method: 'PATCH', body: JSON.stringify(data) });
