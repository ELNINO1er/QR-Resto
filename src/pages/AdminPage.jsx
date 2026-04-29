import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ShoppingCart, Plus, Minus, Trash2, Edit, Bell, TrendingUp, Package,
  Clock, CheckCircle, X, ChefHat, Utensils, Home, Menu as MenuIcon,
  BarChart3, Settings, Eye, EyeOff, Save, AlertCircle, DollarSign,
  QrCode, LogOut, Users, CreditCard, History, Printer, Download, KeyRound,
  Volume2
} from 'lucide-react';
import { colors } from '../lib/colors';
import { useAuth } from '../context/AuthContext';
import {
  getOrders, updateOrderStatus as apiUpdateStatus, getMenu, addDish,
  updateDish, deleteDish as apiDeleteDish, getStats, getSettings,
  updateSettings as apiUpdateSettings, updatePayment, getUsers, createUser,
  updateUser, deleteUser as apiDeleteUser, changePassword, getReports,
  exportOrdersUrl
} from '../lib/api';
import { connectWs, onWsMessage, disconnectWs } from '../lib/ws';
import { NotificationBanner, useNotification } from '../components/Notification';
import DishModal from '../components/DishModal';
import DishImage from '../components/DishImage';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notification, showNotif } = useNotification();

  const [adminTab, setAdminTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, avgOrder: 0, lowStock: 0 });
  const [settings, setSettingsState] = useState({});
  const [editingDish, setEditingDish] = useState(null);
  const [showAddDish, setShowAddDish] = useState(false);
  const [qrCodes, setQrCodes] = useState({});
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'serveur', password: '' });
  const [reports, setReports] = useState({ sales: [], topDishes: [] });
  const [reportPeriod, setReportPeriod] = useState('day');
  const [exportRange, setExportRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [ordersData, menuData, statsData, settingsData] = await Promise.all([
        getOrders(), getMenu(), getStats(), getSettings()
      ]);
      setOrders(ordersData);
      setDishes(menuData);
      setStats(statsData);
      setSettingsState(settingsData);
      getReports(reportPeriod).then(setReports).catch(() => {});
      if (user?.role === 'admin') getUsers().then(setUsers).catch(() => {});
    } catch (err) {
      showNotif('Erreur de chargement', 'warning');
    }
  }, [reportPeriod, user?.role]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (user?.mustChangePassword) {
      setAdminTab('security');
      showNotif('Changez le mot de passe par defaut', 'warning');
    }
  }, [user?.mustChangePassword, showNotif]);

  const playNewOrderSound = useCallback(() => {
    if (!soundEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }, [soundEnabled]);

  // WebSocket for real-time
  useEffect(() => {
    connectWs();
    const unsub = onWsMessage((data) => {
      if (data.type === 'NEW_ORDER') {
        setOrders(prev => [data.order, ...prev]);
        playNewOrderSound();
        showNotif(`Nouvelle commande #${data.order.id} - Table ${data.order.table}`);
      }
      if (data.type === 'ORDER_UPDATED') {
        setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
      }
    });
    return () => { unsub(); disconnectWs(); };
  }, [playNewOrderSound, showNotif]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const updated = await apiUpdateStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      showNotif(`Commande #${orderId} mise a jour`);
    } catch { showNotif('Erreur', 'warning'); }
  };

  const handleSaveDish = async (dish) => {
    try {
      if (dish.id) {
        const updated = await updateDish(dish.id, dish);
        setDishes(prev => prev.map(d => d.id === dish.id ? updated : d));
      } else {
        const created = await addDish(dish);
        setDishes(prev => [...prev, created]);
      }
      setEditingDish(null);
      setShowAddDish(false);
      showNotif('Plat enregistre');
    } catch { showNotif('Erreur', 'warning'); }
  };

  const handleDeleteDish = async (id) => {
    try {
      await apiDeleteDish(id);
      setDishes(prev => prev.filter(d => d.id !== id));
      showNotif('Plat supprime', 'warning');
    } catch { showNotif('Erreur', 'warning'); }
  };

  const handleToggleAvailability = async (dish) => {
    try {
      const updated = await updateDish(dish.id, { available: !dish.available });
      setDishes(prev => prev.map(d => d.id === dish.id ? updated : d));
      showNotif('Disponibilite modifiee');
    } catch { showNotif('Erreur', 'warning'); }
  };

  const handleUpdateStock = async (dish, delta) => {
    const newStock = Math.max(0, dish.stock + delta);
    try {
      const updated = await updateDish(dish.id, { stock: newStock });
      setDishes(prev => prev.map(d => d.id === dish.id ? updated : d));
    } catch { showNotif('Erreur', 'warning'); }
  };

  const handleSaveSettings = async () => {
    try {
      await apiUpdateSettings(settings);
      showNotif('Parametres enregistres');
    } catch { showNotif('Erreur', 'warning'); }
  };

  const handleUpdatePayment = async (order, paymentStatus, paymentMethod = order.paymentMethod || '') => {
    try {
      const updated = await updatePayment(order.id, paymentStatus, paymentMethod);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      showNotif('Paiement mis a jour');
    } catch { showNotif('Erreur paiement', 'warning'); }
  };

  const handleCreateUser = async () => {
    try {
      const created = await createUser(newUser);
      setUsers(prev => [created, ...prev]);
      setNewUser({ name: '', email: '', role: 'serveur', password: '' });
      showNotif('Utilisateur cree');
    } catch (err) { showNotif(err.message || 'Erreur utilisateur', 'warning'); }
  };

  const handleChangePassword = async () => {
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      showNotif('Mot de passe modifie');
    } catch (err) { showNotif(err.message || 'Erreur mot de passe', 'warning'); }
  };

  const printTicket = (order) => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return;
    win.document.write(`
      <html><head><title>Commande ${order.id}</title>
      <style>body{font-family:Arial;padding:18px} h1{font-size:20px}.row{display:flex;justify-content:space-between;margin:6px 0}.total{font-weight:bold;border-top:1px solid #000;padding-top:8px}</style>
      </head><body>
      <h1>Commande #${order.id}</h1><p>Table ${order.table} - ${order.time}</p>
      ${order.items.map(i => `<div class="row"><span>${i.qty}x ${i.name}</span><span>${(i.qty * i.price).toLocaleString()} FCFA</span></div>`).join('')}
      ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
      <div class="row total"><span>Total</span><span>${order.total.toLocaleString()} FCFA</span></div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const printQrSheet = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Tables</title>
      <style>body{font-family:Arial;padding:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{text-align:center;border:1px solid #ddd;padding:14px;break-inside:avoid}img{width:170px;height:170px}</style>
      </head><body><div class="grid">
      ${Array.from({ length: tablesCount }, (_, i) => i + 1).map(num => `<div class="card"><img src="${qrCodes[num] || ''}"><h2>Table ${num}</h2><p>${baseMenuUrl}?table=${num}</p></div>`).join('')}
      </div></body></html>
    `);
    win.document.close();
    win.print();
  };

  const downloadExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(exportOrdersUrl(exportRange.from, exportRange.to), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${exportRange.from}-${exportRange.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showNotif('Erreur export CSV', 'warning');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebarItems = [
    { id: 'orders', icon: ShoppingCart, label: 'Commandes', badge: orders.filter(o => o.status === 'pending').length },
    { id: 'payments', icon: CreditCard, label: 'Paiements', badge: orders.filter(o => o.paymentStatus !== 'paid').length },
    { id: 'menu', icon: MenuIcon, label: 'Menu' },
    { id: 'stock', icon: Package, label: 'Stock' },
    { id: 'history', icon: History, label: 'Historique' },
    { id: 'stats', icon: BarChart3, label: 'Statistiques' },
    { id: 'tables', icon: QrCode, label: 'Tables & QR' },
    ...(user?.role === 'admin' ? [{ id: 'users', icon: Users, label: 'Utilisateurs' }] : []),
    { id: 'settings', icon: Settings, label: 'Parametres' },
    { id: 'security', icon: KeyRound, label: 'Securite' },
  ];

  const tablesCount = parseInt(settings.tables_count) || 12;
  const baseMenuUrl = `${window.location.origin}/menu`;

  useEffect(() => {
    if (adminTab !== 'tables') return;

    let cancelled = false;
    async function generateQrCodes() {
      const entries = await Promise.all(
        Array.from({ length: tablesCount }, async (_, i) => {
          const table = i + 1;
          const url = `${baseMenuUrl}?table=${table}`;
          const dataUrl = await QRCode.toDataURL(url, {
            margin: 1,
            width: 220,
            color: { dark: colors.primaryDark, light: '#FFFFFF' },
          });
          return [table, dataUrl];
        })
      );
      if (!cancelled) setQrCodes(Object.fromEntries(entries));
    }

    generateQrCodes().catch(() => showNotif('Erreur de generation QR', 'warning'));
    return () => { cancelled = true; };
  }, [adminTab, tablesCount, baseMenuUrl, showNotif]);

  return (
    <div className="min-h-screen" style={{ background: colors.sand }}>
      <NotificationBanner notification={notification} />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-64 p-4 hidden lg:flex lg:flex-col" style={{ background: colors.primaryDark }}>
        <div className="flex items-center gap-3 mb-6 px-2 flex-shrink-0">
          <div className="p-2 rounded-lg" style={{ background: colors.gold }}>
            <ChefHat size={24} style={{ color: colors.primaryDark }} />
          </div>
          <div>
            <h1 className="font-bold" style={{ color: colors.cream, fontFamily: 'serif' }}>Resto QR</h1>
            <p className="text-xs" style={{ color: colors.sandDark }}>Admin Panel</p>
          </div>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
          {sidebarItems.map(item => (
            <button key={item.id} onClick={() => setAdminTab(item.id)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all" style={{ background: adminTab === item.id ? colors.primary : 'transparent', color: colors.cream }}>
              <div className="flex items-center gap-3">
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: colors.gold, color: colors.primaryDark }}>{item.badge}</span>}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mt-4 flex-shrink-0" style={{ background: colors.primary, color: colors.cream }}>
          <LogOut size={20} /> <span className="font-medium">Deconnexion</span>
        </button>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 p-4 flex items-center justify-between shadow-lg" style={{ background: colors.primaryDark }}>
        <div className="flex items-center gap-2">
          <ChefHat size={24} style={{ color: colors.gold }} />
          <span className="font-bold" style={{ color: colors.cream }}>Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={adminTab} onChange={e => setAdminTab(e.target.value)} className="px-3 py-2 rounded-lg" style={{ background: colors.primary, color: colors.cream, border: 'none' }}>
            {sidebarItems.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <button onClick={handleLogout} className="p-2 rounded-lg" style={{ color: colors.cream }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="lg:ml-64 p-4 lg:p-8">

        {/* ===== ORDERS ===== */}
        {adminTab === 'orders' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Commandes en cours</h2>
              <p style={{ color: colors.textLight }}>Gerez les commandes en temps reel</p>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <p style={{ color: colors.textLight }}>Aucune commande pour le moment</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map(order => {
                  const sc = {
                    pending: { color: colors.gold, label: 'Recue', icon: Bell },
                    preparing: { color: colors.primaryLight, label: 'En preparation', icon: ChefHat },
                    ready: { color: '#5C8A4A', label: 'Prete', icon: CheckCircle },
                    served: { color: colors.textLight, label: 'Servie', icon: Utensils },
                  };
                  const config = sc[order.status] || sc.pending;
                  const StatusIcon = config.icon;
                  return (
                    <div key={order.id} className="rounded-2xl p-4 shadow-md" style={{ background: 'white' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-bold text-lg" style={{ color: colors.text }}>#{order.id}</span>
                          <span className="ml-2 text-sm" style={{ color: colors.textLight }}>Table {order.table}</span>
                        </div>
                        <span className="text-xs" style={{ color: colors.textLight }}>{order.time}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: config.color + '20' }}>
                        <StatusIcon size={16} style={{ color: config.color }} />
                        <span className="text-sm font-medium" style={{ color: config.color }}>{config.label}</span>
                      </div>
                      <div className="space-y-1 mb-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span style={{ color: colors.text }}>{item.qty}x {item.name}</span>
                            <span style={{ color: colors.textLight }}>{(item.price * item.qty).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <div className="mb-3 px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: colors.sand }}>
                          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: colors.gold }} />
                          <p className="text-xs" style={{ color: colors.text }}>{order.notes}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t-2" style={{ borderColor: colors.sand }}>
                        <span className="font-bold" style={{ color: colors.primary }}>{order.total.toLocaleString()} FCFA</span>
                        <span className="text-xs px-2 py-1 rounded" style={{ background: order.paymentStatus === 'paid' ? '#5C8A4A20' : colors.sand, color: order.paymentStatus === 'paid' ? '#5C8A4A' : colors.textLight }}>
                          {order.paymentStatus === 'paid' ? 'Paye' : 'Non paye'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {order.status === 'pending' && (
                          <button onClick={() => handleUpdateStatus(order.id, 'preparing')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: colors.primary, color: colors.cream }}>Commencer</button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => handleUpdateStatus(order.id, 'ready')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: colors.primary, color: colors.cream }}>Marquer prete</button>
                        )}
                        {order.status === 'ready' && (
                          <button onClick={() => handleUpdateStatus(order.id, 'served')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: colors.primary, color: colors.cream }}>Servie</button>
                        )}
                        <button onClick={() => printTicket(order)} className="col-span-2 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: colors.sand, color: colors.text }}>
                          <Printer size={16} /> Ticket cuisine
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== PAYMENTS ===== */}
        {adminTab === 'payments' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Paiements</h2>
              <p style={{ color: colors.textLight }}>Suivi mobile money, especes et cartes</p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
              <table className="w-full">
                <thead style={{ background: colors.sand }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">Commande</th>
                    <th className="text-left px-4 py-3 text-sm">Total</th>
                    <th className="text-left px-4 py-3 text-sm">Statut</th>
                    <th className="text-left px-4 py-3 text-sm">Methode</th>
                    <th className="text-left px-4 py-3 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="border-t" style={{ borderColor: colors.sand }}>
                      <td className="px-4 py-3 font-medium">#{order.id} · Table {order.table}</td>
                      <td className="px-4 py-3">{order.total.toLocaleString()} FCFA</td>
                      <td className="px-4 py-3">{order.paymentStatus === 'paid' ? 'Paye' : order.paymentStatus === 'refunded' ? 'Rembourse' : 'Non paye'}</td>
                      <td className="px-4 py-3">
                        <select value={order.paymentMethod || ''} onChange={e => handleUpdatePayment(order, order.paymentStatus || 'unpaid', e.target.value)} className="px-2 py-1 rounded border">
                          <option value="">Aucune</option>
                          <option value="cash">Especes</option>
                          <option value="mobile_money">Mobile money</option>
                          <option value="card">Carte</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdatePayment(order, 'paid', order.paymentMethod || 'cash')} className="px-3 py-1 rounded text-sm" style={{ background: colors.primary, color: colors.cream }}>Paye</button>
                          <button onClick={() => handleUpdatePayment(order, 'unpaid', '')} className="px-3 py-1 rounded text-sm" style={{ background: colors.sand, color: colors.text }}>Annuler</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== HISTORY ===== */}
        {adminTab === 'history' && (
          <div>
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Historique & exports</h2>
                <p style={{ color: colors.textLight }}>Commandes, rapports et exports CSV</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input type="date" value={exportRange.from} onChange={e => setExportRange({ ...exportRange, from: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <input type="date" value={exportRange.to} onChange={e => setExportRange({ ...exportRange, to: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <button onClick={downloadExport} className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                  <Download size={18} /> CSV
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {['day', 'week', 'month'].map(p => (
                <button key={p} onClick={() => { setReportPeriod(p); getReports(p).then(setReports); }} className="py-3 rounded-lg font-medium" style={{ background: reportPeriod === p ? colors.primary : 'white', color: reportPeriod === p ? colors.cream : colors.text }}>
                  {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-4 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-3" style={{ color: colors.text }}>Ventes</h3>
                <div className="space-y-2">
                  {(reports.sales || []).map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: colors.sand }}>
                      <span>{row.label}</span>
                      <span className="font-bold">{row.revenue.toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-4 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-3" style={{ color: colors.text }}>Plats vendus</h3>
                <div className="space-y-2">
                  {(reports.topDishes || []).map(dish => (
                    <div key={dish.name} className="flex items-center justify-between py-2 border-b" style={{ borderColor: colors.sand }}>
                      <span className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded overflow-hidden inline-block" style={{ background: colors.sand }}>
                          <DishImage value={dish.image} emojiClassName="text-xl" rounded="rounded" />
                        </span>
                        {dish.name}
                      </span>
                      <span className="font-bold">{dish.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== MENU ===== */}
        {adminTab === 'menu' && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Gestion du Menu</h2>
                <p style={{ color: colors.textLight }}>Ajoutez, modifiez ou supprimez des plats</p>
              </div>
              <button onClick={() => setShowAddDish(true)} className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                <Plus size={20} /> Ajouter un plat
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dishes.map(dish => (
                <div key={dish.id} className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
                  <div className="h-40 overflow-hidden" style={{ background: colors.sand }}>
                    <DishImage value={dish.image} emojiClassName="text-7xl" rounded="rounded-none" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold" style={{ color: colors.text }}>{dish.name}</h3>
                      <span className="font-bold text-sm" style={{ color: colors.primary }}>{dish.price.toLocaleString()}</span>
                    </div>
                    <p className="text-xs mb-3 line-clamp-2" style={{ color: colors.textLight }}>{dish.description}</p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs px-2 py-1 rounded" style={{ background: colors.sand, color: colors.text }}>Stock: {dish.stock}</span>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: dish.available ? '#5C8A4A20' : colors.sandDark, color: dish.available ? '#5C8A4A' : colors.textLight }}>{dish.available ? 'Disponible' : 'Epuise'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setEditingDish(dish)} className="py-2 rounded-lg text-xs font-medium" style={{ background: colors.sand, color: colors.text }}>
                        <Edit size={16} className="mx-auto" />
                      </button>
                      <button onClick={() => handleToggleAvailability(dish)} className="py-2 rounded-lg text-xs font-medium" style={{ background: colors.gold + '40', color: colors.text }}>
                        {dish.available ? <EyeOff size={16} className="mx-auto" /> : <Eye size={16} className="mx-auto" />}
                      </button>
                      <button onClick={() => handleDeleteDish(dish.id)} className="py-2 rounded-lg text-xs font-medium" style={{ background: '#EFD9D9', color: colors.primary }}>
                        <Trash2 size={16} className="mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== STOCK ===== */}
        {adminTab === 'stock' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Gestion du Stock</h2>
              <p style={{ color: colors.textLight }}>Suivez les niveaux et alertes</p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
              <table className="w-full">
                <thead style={{ background: colors.sand }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: colors.text }}>Plat</th>
                    <th className="text-left px-4 py-3 text-sm font-medium hidden md:table-cell" style={{ color: colors.text }}>Categorie</th>
                    <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.text }}>Stock</th>
                    <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.text }}>Statut</th>
                    <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.text }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dishes.map(dish => {
                    const status = dish.stock === 0 ? { label: 'Rupture', color: colors.primary } : dish.stock < 10 ? { label: 'Bas', color: colors.gold } : { label: 'OK', color: '#5C8A4A' };
                    return (
                      <tr key={dish.id} className="border-t" style={{ borderColor: colors.sand }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-10 h-10 rounded overflow-hidden flex-shrink-0" style={{ background: colors.sand }}>
                              <DishImage value={dish.image} emojiClassName="text-2xl" rounded="rounded" />
                            </span>
                            <span className="font-medium text-sm" style={{ color: colors.text }}>{dish.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm capitalize hidden md:table-cell" style={{ color: colors.textLight }}>{dish.category}</td>
                        <td className="px-4 py-3 text-center font-bold" style={{ color: colors.text }}>{dish.stock}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs px-2 py-1 rounded font-medium" style={{ background: status.color + '20', color: status.color }}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleUpdateStock(dish, -1)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: colors.sand }}>
                              <Minus size={12} style={{ color: colors.text }} />
                            </button>
                            <button onClick={() => handleUpdateStock(dish, 1)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: colors.primary }}>
                              <Plus size={12} style={{ color: colors.cream }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== STATS ===== */}
        {adminTab === 'stats' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Statistiques</h2>
              <p style={{ color: colors.textLight }}>Vue d'ensemble de votre activite</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Revenus du jour', value: `${stats.todayRevenue.toLocaleString()} FCFA`, icon: DollarSign, color: colors.primary },
                { label: 'Commandes', value: stats.todayOrders, icon: ShoppingCart, color: colors.gold },
                { label: 'Panier moyen', value: `${stats.avgOrder.toLocaleString()} FCFA`, icon: TrendingUp, color: colors.primaryLight },
                { label: 'Stock bas', value: stats.lowStock, icon: AlertCircle, color: '#C77D32' },
              ].map((stat, i) => (
                <div key={i} className="rounded-2xl p-4 shadow-md" style={{ background: 'white' }}>
                  <div className="p-2 rounded-lg inline-block mb-3" style={{ background: stat.color + '20' }}>
                    <stat.icon size={20} style={{ color: stat.color }} />
                  </div>
                  <p className="text-xs mb-1" style={{ color: colors.textLight }}>{stat.label}</p>
                  <p className="text-xl font-bold" style={{ color: colors.text }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Top des plats</h3>
                <div className="space-y-3">
                  {(stats.topDishes || []).length === 0 ? (
                    <p className="text-sm" style={{ color: colors.textLight }}>Aucune vente enregistree</p>
                  ) : (stats.topDishes || []).map((dish, i) => (
                    <div key={dish.dishId || dish.name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: i === 0 ? colors.gold : colors.sand, color: i === 0 ? colors.primaryDark : colors.text }}>{i + 1}</div>
                      <span className="w-10 h-10 rounded overflow-hidden flex-shrink-0" style={{ background: colors.sand }}>
                        <DishImage value={dish.image} emojiClassName="text-2xl" rounded="rounded" />
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: colors.text }}>{dish.name}</p>
                        <p className="text-xs" style={{ color: colors.textLight }}>{dish.quantity} vendu(s) · {dish.revenue.toLocaleString()} FCFA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Heures de pointe</h3>
                <div className="space-y-2">
                  {(stats.peakHours || []).length === 0 ? (
                    <p className="text-sm" style={{ color: colors.textLight }}>Aucune commande enregistree</p>
                  ) : (stats.peakHours || []).map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs w-14" style={{ color: colors.textLight }}>{h.hour}</span>
                      <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: colors.sand }}>
                        <div className="h-full rounded transition-all" style={{ width: `${h.val}%`, background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryLight})` }} />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: colors.text }}>{h.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== TABLES & QR ===== */}
        {adminTab === 'tables' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Tables & QR Codes</h2>
              <p style={{ color: colors.textLight }}>Generez les QR codes pour chaque table</p>
              <p className="text-sm mt-2 px-3 py-2 rounded-lg inline-block" style={{ background: 'white', color: colors.primary }}>
                URL type: {baseMenuUrl}?table=N
              </p>
              <button onClick={printQrSheet} className="ml-3 px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                <Printer size={18} /> Imprimer la feuille
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: tablesCount }, (_, i) => i + 1).map(num => (
                <div key={num} className="rounded-2xl p-4 shadow-md text-center" style={{ background: 'white' }}>
                  <div className="w-full aspect-square rounded-xl flex items-center justify-center mb-3" style={{ background: colors.sand }}>
                    {qrCodes[num] ? (
                      <img src={qrCodes[num]} alt={`QR table ${num}`} className="w-[88%] h-[88%] object-contain rounded-lg" />
                    ) : (
                      <QrCode size={80} style={{ color: colors.primary }} />
                    )}
                  </div>
                  <h3 className="font-bold mb-1" style={{ color: colors.text }}>Table {num}</h3>
                  <p className="text-xs mb-3" style={{ color: colors.textLight }}>/menu?table={num}</p>
                  <button className="w-full py-2 rounded-lg text-xs font-medium" style={{ background: colors.primary, color: colors.cream }}>Imprimer</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== USERS ===== */}
        {adminTab === 'users' && user?.role === 'admin' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Utilisateurs & roles</h2>
              <p style={{ color: colors.textLight }}>Admin, serveur, cuisine et caisse</p>
            </div>
            <div className="rounded-2xl p-4 shadow-md mb-4" style={{ background: 'white' }}>
              <div className="grid md:grid-cols-5 gap-3">
                <input placeholder="Nom" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <input placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="px-3 py-2 rounded-lg border">
                  <option value="serveur">Serveur</option>
                  <option value="cuisine">Cuisine</option>
                  <option value="caisse">Caisse</option>
                  <option value="admin">Admin</option>
                </select>
                <input type="password" placeholder="Mot de passe" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <button onClick={handleCreateUser} className="rounded-lg font-medium" style={{ background: colors.primary, color: colors.cream }}>Ajouter</button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
              <table className="w-full">
                <thead style={{ background: colors.sand }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">Nom</th>
                    <th className="text-left px-4 py-3 text-sm">Email</th>
                    <th className="text-left px-4 py-3 text-sm">Role</th>
                    <th className="text-left px-4 py-3 text-sm">Securite</th>
                    <th className="text-left px-4 py-3 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t" style={{ borderColor: colors.sand }}>
                      <td className="px-4 py-3">{u.name}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3">{u.mustChangePassword ? 'A changer' : 'OK'}</td>
                      <td className="px-4 py-3">
                        <button onClick={async () => { await apiDeleteUser(u.id); setUsers(prev => prev.filter(x => x.id !== u.id)); }} className="px-3 py-1 rounded text-sm" style={{ background: '#EFD9D9', color: colors.primary }}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== SETTINGS ===== */}
        {adminTab === 'settings' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Parametres</h2>
              <p style={{ color: colors.textLight }}>Configurez votre restaurant</p>
            </div>
            <div className="space-y-4 max-w-2xl">
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Informations du restaurant</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Nom du restaurant</label>
                    <input type="text" value={settings.restaurant_name || ''} onChange={e => setSettingsState({ ...settings, restaurant_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Adresse</label>
                    <input type="text" value={settings.address || ''} onChange={e => setSettingsState({ ...settings, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Telephone</label>
                      <input type="tel" value={settings.phone || ''} onChange={e => setSettingsState({ ...settings, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Nombre de tables</label>
                      <input type="number" value={settings.tables_count || '12'} onChange={e => setSettingsState({ ...settings, tables_count: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleSaveSettings} className="px-6 py-3 rounded-lg font-bold flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                <Save size={20} /> Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* ===== SECURITY ===== */}
        {adminTab === 'security' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Securite</h2>
              <p style={{ color: colors.textLight }}>Mot de passe et notifications</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Changer le mot de passe</h3>
                <div className="space-y-3">
                  <input type="password" placeholder="Mot de passe actuel" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <input type="password" placeholder="Nouveau mot de passe" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <button onClick={handleChangePassword} className="px-4 py-2 rounded-lg font-medium" style={{ background: colors.primary, color: colors.cream }}>Enregistrer</button>
                </div>
              </div>
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Notifications cuisine</h3>
                <button onClick={() => setSoundEnabled(!soundEnabled)} className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: soundEnabled ? colors.primary : colors.sand, color: soundEnabled ? colors.cream : colors.text }}>
                  <Volume2 size={18} /> {soundEnabled ? 'Son active' : 'Son coupe'}
                </button>
                <button onClick={() => navigate('/kitchen')} className="mt-3 px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: colors.sand, color: colors.text }}>
                  <ChefHat size={18} /> Ouvrir l'ecran cuisine
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dish Modal */}
      {(showAddDish || editingDish) && (
        <DishModal
          dish={editingDish || { name: '', description: '', price: 0, category: 'plats', image: '🍽️', stock: 0, available: true, veg: false, glutenFree: false, spicy: false, prepTime: 15 }}
          onSave={handleSaveDish}
          onClose={() => { setEditingDish(null); setShowAddDish(false); }}
        />
      )}
    </div>
  );
}
