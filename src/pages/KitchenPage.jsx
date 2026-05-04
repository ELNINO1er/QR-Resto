import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Clock, CheckCircle, LogOut, Volume2 } from 'lucide-react';
import { colors } from '../lib/colors';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus } from '../lib/api';
import { connectWs, disconnectWs, onWsMessage } from '../lib/ws';
import { NotificationBanner, useNotification } from '../components/Notification';

export default function KitchenPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { notification, showNotif } = useNotification();
  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const refreshActiveOrders = useCallback(() => (
    getOrders().then(data => setOrders(data.filter(o => !['served', 'cancelled'].includes(o.status))))
  ), []);

  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 740;
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }, [soundEnabled]);

  // Fix 11: Remove showNotif from deps (it's stable via useCallback with [])
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

  // Fix 10: Ignore WS echo for actions initiated locally by tracking pending updates
  useEffect(() => {
    connectWs();
    const unsub = onWsMessage(data => {
      if (data.type === 'NEW_ORDER') {
        setOrders(prev => {
          if (prev.some(o => o.id === data.order.id)) return prev;
          return [data.order, ...prev];
        });
        playSound();
        showNotif(`Nouvelle commande table ${data.order.table}`);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSound]);

  const setStatus = async (order, status) => {
    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrders(prev => ['served', 'cancelled'].includes(status) ? prev.filter(o => o.id !== order.id) : prev.map(o => o.id === order.id ? updated : o));
    } catch {
      showNotif('Erreur statut', 'warning');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ background: colors.sand }}>
      <NotificationBanner notification={notification} />
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-lg" style={{ background: colors.primaryDark }}>
        <div className="flex items-center gap-3">
          <ChefHat size={28} style={{ color: colors.gold }} />
          <div>
            <h1 className="font-bold" style={{ color: colors.cream }}>Cuisine</h1>
            <p className="text-xs" style={{ color: colors.sandDark }}>{orders.length} commande(s) active(s)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg" style={{ background: colors.primary, color: colors.cream }}>
            <Volume2 size={20} />
          </button>
          <button onClick={() => navigate('/admin')} className="px-3 py-2 rounded-lg text-sm" style={{ background: colors.gold, color: colors.primaryDark }}>Admin</button>
          <button onClick={handleLogout} className="p-2 rounded-lg" style={{ color: colors.cream }}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map(order => (
          <section key={order.id} className="rounded-2xl p-5 shadow-md" style={{ background: 'white' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: colors.text }}>Table {order.table}</h2>
                <p className="text-sm" style={{ color: colors.textLight }}>Commande #{order.id} · {order.time}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: colors.sand, color: colors.primary }}>
                {order.status === 'pending' ? 'Recue' : order.status === 'preparing' ? 'Preparation' : 'Prete'}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-lg">
                  <span>{item.qty}x {item.name}</span>
                </div>
              ))}
            </div>
            {order.notes && <p className="p-3 rounded-lg text-sm mb-4" style={{ background: colors.sand, color: colors.text }}>{order.notes}</p>}
            <div className="grid grid-cols-2 gap-2">
              {order.status === 'pending' && (
                <button onClick={() => setStatus(order, 'preparing')} className="col-span-2 py-3 rounded-lg font-bold flex items-center justify-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                  <Clock size={18} /> Commencer
                </button>
              )}
              {order.status === 'preparing' && (
                <button onClick={() => setStatus(order, 'ready')} className="col-span-2 py-3 rounded-lg font-bold flex items-center justify-center gap-2" style={{ background: '#5C8A4A', color: 'white' }}>
                  <CheckCircle size={18} /> Prete
                </button>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
