import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, LogOut, ShoppingCart } from 'lucide-react';
import { colors } from '../lib/colors';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus, updatePayment } from '../lib/api';
import { connectWs, disconnectWs, onWsMessage } from '../lib/ws';
import { NotificationBanner, useNotification } from '../components/Notification';

export default function ServerPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { notification, showNotif } = useNotification();
  const [orders, setOrders] = useState([]);
  const refreshActiveOrders = useCallback(() => (
    getOrders().then(data => setOrders(data.filter(o => !['served', 'cancelled'].includes(o.status))))
  ), []);

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

  // Fix 10: Deduplicate WS updates (avoid double state update from API response + WS echo)
  useEffect(() => {
    connectWs();
    const unsub = onWsMessage(data => {
      if (data.type === 'NEW_ORDER') {
        setOrders(prev => {
          if (prev.some(o => o.id === data.order.id)) return prev;
          return [data.order, ...prev];
        });
      }
      if (data.type === 'ORDER_UPDATED') {
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
              <OrderCard key={order.id} order={order} onPaid={confirmCash} onServed={setServed} highlight />
            ))}
            {readyOrders.length === 0 && <p style={{ color: colors.textLight }}>Aucune commande prete.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: colors.text }}>En preparation</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOrders.map(order => (
              <OrderCard key={order.id} order={order} onPaid={confirmCash} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderCard({ order, onPaid, onServed, highlight = false }) {
  const statusLabel = order.status === 'pending' ? 'Recue' : order.status === 'preparing' ? 'Preparation' : 'Prete';
  const declaredCash = Number(order.amountPaid || order.total);
  const changeDue = Number(order.changeDue || Math.max(0, declaredCash - order.total));

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
            <span>{(item.qty * item.price).toLocaleString()} FCFA</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3 mb-3" style={{ borderColor: colors.sand }}>
        <strong style={{ color: colors.primary }}>{order.total.toLocaleString()} FCFA</strong>
        <span className="text-sm" style={{ color: order.paymentStatus === 'paid' ? '#5C8A4A' : colors.textLight }}>
          {order.paymentStatus === 'paid' ? 'Argent recu' : 'A confirmer'}
        </span>
      </div>

      <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ background: order.paymentStatus === 'paid' ? '#5C8A4A20' : colors.sand, color: order.paymentStatus === 'paid' ? '#315C25' : colors.text }}>
        Client a {declaredCash.toLocaleString()} FCFA - Monnaie a remettre {changeDue.toLocaleString()} FCFA
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
      </div>
    </section>
  );
}
