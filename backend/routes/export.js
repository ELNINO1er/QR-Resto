import { Router } from 'express';
import { queryAll, queryOne } from '../db.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { requireActiveRestaurant, scopedRestaurantId } from '../middleware/tenant.js';

const router = Router();

function formatDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split('T')[0].split(' ')[0];
}

// ---- OHADA Accounting Export ----
// Journal format compatible with OHADA SYSCOHADA
router.get('/ohada', authMiddleware, requireActiveRestaurant, requireRoles('admin'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const from = req.query.from || new Date().toISOString().split('T')[0];
  const to = req.query.to || from;

  const settings = await queryOne("SELECT value FROM settings WHERE restaurant_id = ? AND `key` = 'restaurant_name'", [restaurantId]);
  const restaurantName = settings?.value || 'Restaurant';

  const orders = await queryAll(`
    SELECT o.*, GROUP_CONCAT(oi.name || ' x' || oi.quantity, ', ') as items_list
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.restaurant_id = ? AND date(o.created_at) BETWEEN date(?) AND date(?)
      AND o.status != 'cancelled' AND o.payment_status = 'paid'
    GROUP BY o.id
    ORDER BY o.created_at
  `, [restaurantId, from, to]);

  // OHADA Journal entries
  // Compte 701: Ventes de marchandises
  // Compte 521: Banque / Caisse
  const lines = [
    ['Date', 'N Piece', 'N Compte', 'Libelle', 'Debit', 'Credit'].join(';'),
  ];

  for (const order of orders) {
    const date = formatDateOnly(order.created_at);
    const piece = `FAC-${String(order.id).padStart(6, '0')}`;
    const label = `Commande #${order.id} - Table ${order.table_number} - ${order.items_list || ''}`.slice(0, 100);
    const method = order.payment_method || 'cash';
    const account = method === 'cash' ? '571' : method === 'mobile_money' ? '521' : '512';

    // Debit: Cash/Bank account
    lines.push([date, piece, account, `${label} (encaissement)`, order.total, ''].join(';'));
    // Credit: Sales account
    lines.push([date, piece, '701', `${label} (vente)`, '', order.total].join(';'));
  }

  // Summary
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  lines.push('');
  lines.push(`# Export OHADA - ${restaurantName}`);
  lines.push(`# Periode: ${from} au ${to}`);
  lines.push(`# Total: ${totalRevenue} FCFA`);
  lines.push(`# Nombre de pieces: ${orders.length}`);

  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="journal-ohada-${from}-${to}.csv"`);
  res.send('\uFEFF' + csv); // BOM for Excel compatibility
});

// ---- ESC/POS Print Data ----
// Returns ESC/POS binary commands for thermal printer
router.get('/receipt/:orderId', authMiddleware, requireActiveRestaurant, requireRoles('admin', 'serveur', 'cuisine', 'caisse'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const order = await queryOne('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [req.params.orderId, restaurantId]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const settings = {};
  const rows = await queryAll('SELECT `key`, value FROM settings WHERE restaurant_id = ?', [restaurantId]);
  for (const r of rows) settings[r.key] = r.value;

  const restaurantName = settings.restaurant_name || 'Restaurant';
  const address = settings.address || '';
  const phone = settings.phone || '';
  const currency = settings.currency || 'FCFA';
  const thankYou = settings.receipt_thank_you || 'Merci pour votre visite !';

  // Build ESC/POS commands
  const ESC = 0x1B;
  const GS = 0x1D;
  const cmds = [];

  const text = (str) => cmds.push(...new TextEncoder().encode(str));
  const byte = (...b) => cmds.push(...b);

  // Initialize
  byte(ESC, 0x40); // ESC @ - Initialize printer
  byte(ESC, 0x61, 1); // Center align

  // Header
  byte(ESC, 0x45, 1); // Bold on
  byte(GS, 0x21, 0x11); // Double height+width
  text(restaurantName + '\n');
  byte(GS, 0x21, 0x00); // Normal size
  byte(ESC, 0x45, 0); // Bold off
  if (address) text(address + '\n');
  if (phone) text(phone + '\n');
  text('--------------------------------\n');

  byte(ESC, 0x61, 0); // Left align

  // Order info
  byte(ESC, 0x45, 1);
  text(`Commande #${order.id}\n`);
  byte(ESC, 0x45, 0);
  text(`Table: ${order.table_number}\n`);
  text(`Date: ${order.created_at?.replace('T', ' ').slice(0, 16) || ''}\n`);
  if (order.order_type && order.order_type !== 'dine_in') {
    text(`Type: ${order.order_type === 'takeaway' ? 'A emporter' : 'Livraison'}\n`);
    if (order.delivery_address) text(`Adresse: ${order.delivery_address}\n`);
  }
  text('--------------------------------\n');

  // Items
  for (const item of items) {
    const line = `${item.quantity}x ${item.name}`;
    const price = `${(item.quantity * item.price).toLocaleString()} ${currency}`;
    const padding = Math.max(1, 32 - line.length - price.length);
    text(line + ' '.repeat(padding) + price + '\n');
  }

  text('--------------------------------\n');

  // Total
  byte(ESC, 0x45, 1);
  const totalLine = `TOTAL: ${order.total.toLocaleString()} ${currency}`;
  text(totalLine + '\n');
  byte(ESC, 0x45, 0);

  if (order.amount_paid) text(`Recu: ${order.amount_paid.toLocaleString()} ${currency}\n`);
  if (order.change_due) text(`Monnaie: ${order.change_due.toLocaleString()} ${currency}\n`);
  text(`Paiement: ${order.payment_status === 'paid' ? 'Paye' : 'Non paye'}\n`);

  text('--------------------------------\n');
  byte(ESC, 0x61, 1); // Center
  text(thankYou + '\n\n\n');

  // Cut paper
  byte(GS, 0x56, 0x00); // Full cut

  const buffer = new Uint8Array(cmds);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.id}.bin"`);
  res.send(Buffer.from(buffer));
});

// JSON version of receipt (for WebUSB or network printing from browser)
router.get('/receipt/:orderId/json', authMiddleware, requireActiveRestaurant, requireRoles('admin', 'serveur', 'cuisine', 'caisse'), async (req, res) => {
  const restaurantId = scopedRestaurantId(req);
  const order = await queryOne('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [req.params.orderId, restaurantId]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const settingsRows = await queryAll('SELECT `key`, value FROM settings WHERE restaurant_id = ?', [restaurantId]);
  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

  res.json({
    restaurant: {
      name: settings.restaurant_name || 'Restaurant',
      address: settings.address || '',
      phone: settings.phone || '',
    },
    order: {
      id: order.id,
      table: order.table_number,
      type: order.order_type || 'dine_in',
      total: order.total,
      items: items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
      paymentStatus: order.payment_status,
      amountPaid: order.amount_paid || 0,
      changeDue: order.change_due || 0,
      date: order.created_at,
    },
    currency: settings.currency || 'FCFA',
    thankYou: settings.receipt_thank_you || 'Merci pour votre visite !',
  });
});

export default router;
