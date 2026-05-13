import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, LogOut, Printer, ShoppingCart } from 'lucide-react';
import { colors } from '../lib/colors';
import { useAuth } from '../context/AuthContext';
import { getOrders, getPublicSettings, updateOrderStatus, updatePayment } from '../lib/api';
import { connectWs, disconnectWs, onWsMessage } from '../lib/ws';
import { NotificationBanner, useNotification } from '../components/Notification';
import { requestNotificationPermission, sendNotification } from '../lib/notifications';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function ServerPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notification, showNotif } = useNotification();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const refreshActiveOrders = useCallback(() => (
    getOrders().then(data => setOrders(data.filter(o => !['served', 'cancelled'].includes(o.status))))
  ), []);

  useEffect(() => { requestNotificationPermission(); }, []);

  // Fix 11: Remove showNotif from deps
  useEffect(() => {
    refreshActiveOrders()
      .catch(() => showNotif('Erreur de chargement', 'warning'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshActiveOrders]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshActiveOrders().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshActiveOrders]);

  useEffect(() => {
    getPublicSettings(user?.restaurantId || 1)
      .then(setSettings)
      .catch(() => {});
  }, [user?.restaurantId]);

  // Fix 10: Deduplicate WS updates (avoid double state update from API response + WS echo)
  useEffect(() => {
    connectWs();
    const unsub = onWsMessage(data => {
      if (data.type === 'NEW_ORDER') {
        setOrders(prev => {
          if (prev.some(o => o.id === data.order.id)) return prev;
          return [data.order, ...prev];
        });
        sendNotification('Nouvelle commande', { body: `Table ${data.order.table}`, tag: `order-${data.order.id}` });
      }
      if (data.type === 'ORDER_UPDATED') {
        if (data.order.status === 'ready') {
          sendNotification('Commande prete', { body: `Table ${data.order.table} - Commande #${data.order.id} a servir`, tag: `ready-${data.order.id}` });
        }
        setOrders(prev => {
          if (['served', 'cancelled'].includes(data.order.status)) {
            return prev.filter(o => o.id !== data.order.id);
          }
          return prev.some(o => o.id === data.order.id)
            ? prev.map(o => o.id === data.order.id ? data.order : o)
            : [data.order, ...prev];
        });
      }
    });
    return () => { unsub(); disconnectWs(); };
  }, []);

  const setServed = async (order) => {
    try {
      const updated = await updateOrderStatus(order.id, 'served');
      setOrders(prev => prev.filter(o => o.id !== updated.id));
      showNotif(`Commande #${order.id} servie`);
    } catch {
      showNotif('Erreur statut', 'warning');
    }
  };

  const confirmCash = async (order) => {
    try {
      const updated = await updatePayment(order.id, 'paid', 'cash', order.amountPaid || order.total);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      showNotif(`Argent confirme pour #${order.id}`);
    } catch (err) {
      showNotif(err.message || 'Erreur paiement', 'warning');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const readyOrders = orders.filter(o => o.status === 'ready');
  const activeOrders = orders.filter(o => o.status !== 'ready');

  return (
    <div className="min-h-screen" style={{ background: colors.sand }}>
      <NotificationBanner notification={notification} />
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-lg" style={{ background: colors.primaryDark }}>
        <div className="flex items-center gap-3">
          <ShoppingCart size={28} style={{ color: colors.gold }} />
          <div>
            <h1 className="font-bold" style={{ color: colors.cream }}>Service</h1>
            <p className="text-xs" style={{ color: colors.sandDark }}>{readyOrders.length} commande(s) prete(s)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin')} className="px-3 py-2 rounded-lg text-sm" style={{ background: colors.gold, color: colors.primaryDark }}>Admin</button>
          <button onClick={handleLogout} className="p-2 rounded-lg" style={{ color: colors.cream }}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: colors.text }}>A servir maintenant</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {readyOrders.map(order => (
              <OrderCard key={order.id} order={order} settings={settings} onPaid={confirmCash} onServed={setServed} highlight />
            ))}
            {readyOrders.length === 0 && <p style={{ color: colors.textLight }}>Aucune commande prete.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: colors.text }}>En preparation</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOrders.map(order => (
              <OrderCard key={order.id} order={order} settings={settings} onPaid={confirmCash} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderCard({ order, settings, onPaid, onServed, highlight = false }) {
  const statusLabel = order.status === 'pending' ? 'Recue' : order.status === 'preparing' ? 'Preparation' : 'Prete';
  const declaredCash = Number(order.amountPaid || order.total);
  const changeDue = Number(order.changeDue || Math.max(0, declaredCash - order.total));
  const currency = settings.currency || 'FCFA';

  const printReceipt = () => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return;
    const restaurantName = settings.restaurant_name || 'Resto QR';
    const thankYou = settings.receipt_thank_you || 'Merci pour votre visite et a bientot.';
    const paidLabel = order.paymentStatus === 'paid' ? 'Paye' : order.paymentStatus === 'refunded' ? 'Rembourse' : 'Non paye';
    win.document.write(`
      <html><head><title>Facture ${order.id}</title>
      <style>body{font-family:Arial;padding:18px;color:#111}.center{text-align:center} h1{font-size:22px;margin:0 0 4px}.muted{color:#555;font-size:12px}.row{display:flex;justify-content:space-between;gap:12px;margin:6px 0}.total{font-weight:bold;border-top:1px solid #000;padding-top:8px;margin-top:8px}.thanks{border-top:1px dashed #999;margin-top:14px;padding-top:10px;text-align:center;font-size:13px}</style>
      </head><body>
      <div class="center">
        <h1>${escapeHtml(restaurantName)}</h1>
        ${settings.address ? `<div class="muted">${escapeHtml(settings.address)}</div>` : ''}
        ${settings.phone ? `<div class="muted">${escapeHtml(settings.phone)}</div>` : ''}
      </div>
      <p><strong>Facture #${order.id}</strong><br><span class="muted">Table ${order.table} - ${escapeHtml(order.time || '')} - ${paidLabel}</span></p>
      ${order.items.map(i => `<div class="row"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>${(i.qty * i.price).toLocaleString()} ${currency}</span></div>`).join('')}
      <div class="row total"><span>Total</span><span>${order.total.toLocaleString()} ${currency}</span></div>
      <div class="row"><span>Recu</span><span>${declaredCash.toLocaleString()} ${currency}</span></div>
      <div class="row"><span>Monnaie</span><span>${changeDue.toLocaleString()} ${currency}</span></div>
      <div class="thanks">${escapeHtml(thankYou)}</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <section className="rounded-2xl p-5 shadow-md" style={{ background: 'white', border: highlight ? `2px solid #5C8A4A` : 'none' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-2xl font-bold" style={{ color: colors.text }}>Table {order.table}</h3>
          <p className="text-sm" style={{ color: colors.textLight }}>Commande #{order.id} - {order.time}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: colors.sand, color: highlight ? '#5C8A4A' : colors.primary }}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{item.qty}x {item.name}</span>
            <span>{(item.qty * item.price).toLocaleString()} {currency}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3 mb-3" style={{ borderColor: colors.sand }}>
        <strong style={{ color: colors.primary }}>{order.total.toLocaleString()} {currency}</strong>
        <span className="text-sm" style={{ color: order.paymentStatus === 'paid' ? '#5C8A4A' : colors.textLight }}>
          {order.paymentStatus === 'paid' ? 'Argent recu' : 'A confirmer'}
        </span>
      </div>

      <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ background: order.paymentStatus === 'paid' ? '#5C8A4A20' : colors.sand, color: order.paymentStatus === 'paid' ? '#315C25' : colors.text }}>
        Client a {declaredCash.toLocaleString()} {currency} - Monnaie a remettre {changeDue.toLocaleString()} {currency}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPaid(order)}
          disabled={order.paymentStatus === 'paid'}
          className="col-span-2 py-2 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: colors.sand, color: colors.text }}
        >
          <CreditCard size={17} /> Confirmer argent recu
        </button>
        {onServed && (
          <button onClick={() => onServed(order)} disabled={order.paymentStatus !== 'paid'} className="col-span-2 py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: colors.primary, color: colors.cream }}>
            <CheckCircle size={18} /> Marquer servie
          </button>
        )}
        {order.paymentStatus === 'paid' && (
          <button onClick={printReceipt} className="col-span-2 py-2 rounded-lg font-medium flex items-center justify-center gap-2" style={{ background: colors.sand, color: colors.text }}>
            <Printer size={17} /> Imprimer facture
          </button>
        )}
      </div>
    </section>
  );
}
