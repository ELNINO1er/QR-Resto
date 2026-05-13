import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ShoppingCart, Plus, Minus, Trash2, Edit, Bell, TrendingUp, Package,
  Clock, CheckCircle, X, ChefHat, Utensils, Home, Menu as MenuIcon,
  BarChart3, Settings, Eye, EyeOff, Save, AlertCircle, DollarSign,
  QrCode, LogOut, Users, CreditCard, History, Printer, Download, KeyRound, Calendar,
  Star,
} from 'lucide-react';
import { colors } from '../lib/colors';
import { useAuth } from '../context/AuthContext';
import {
  getOrders, updateOrderStatus as apiUpdateStatus, getMenu, addDish,
  updateDish, deleteDish as apiDeleteDish, getStats, getSettings,
  updateSettings as apiUpdateSettings, updatePayment, getUsers, createUser,
  updateUser, deleteUser as apiDeleteUser, changePassword, getReports,
  exportOrdersCsv, getNetworkInfo, getRestaurants, createRestaurant,
  updateRestaurant, getBackups, createBackup, restoreBackup, exportDatabaseUrl,
  getActiveRestaurantId, setActiveRestaurantId,
  getTableStatus, saveTableLayout, getTableOrders,
  getReservations, updateReservation, deleteReservation,
  exportOhada, getReviews, deleteReview, getAdminFormulas,
  createFormula, deleteFormula,
} from '../lib/api';
import { connectWs, onWsMessage, disconnectWs } from '../lib/ws';
import { NotificationBanner, useNotification } from '../components/Notification';
import DishModal from '../components/DishModal';
import DishImage from '../components/DishImage';
import Dropdown from '../components/Dropdown';
import { RevenueChart, PeakHoursChart, PaymentMethodsChart, ComparisonCard } from '../components/AnalyticsCharts';
import FloorPlan, { TableDetailPanel } from '../components/FloorPlan';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'serveur', password: '', restaurantId: '' });
  const [restaurants, setRestaurants] = useState([]);
  const [activeRestaurantId, setActiveRestaurantIdState] = useState(getActiveRestaurantId());
  const [newRestaurant, setNewRestaurant] = useState({ name: '', slug: '' });
  const [backups, setBackups] = useState([]);
  const [reports, setReports] = useState({ sales: [], topDishes: [] });
  const [reportPeriod, setReportPeriod] = useState('day');
  const [exportRange, setExportRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [qrOrigin, setQrOrigin] = useState(window.location.origin);
  const [floorTables, setFloorTables] = useState([]);
  const [selectedFloorTable, setSelectedFloorTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [editingLayout, setEditingLayout] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationDate, setReservationDate] = useState(new Date().toISOString().split('T')[0]);
  const [reviews, setReviews] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [newFormula, setNewFormula] = useState({
    name: '',
    description: '',
    price: 0,
    availableFrom: '',
    availableUntil: '',
    items: [
      { category: 'entree', dishId: '', label: 'Entree' },
      { category: 'plat', dishId: '', label: 'Plat' },
      { category: 'dessert', dishId: '', label: 'Dessert' },
    ],
  });

  // Load data
  const loadData = useCallback(async () => {
    try {
      const role = user?.role || 'admin';
      const canSeeStats = ['superadmin', 'admin', 'caisse'].includes(role);
      const canSeeSettings = ['superadmin', 'admin'].includes(role);

      const [ordersData, menuData, statsData, settingsData] = await Promise.all([
        getOrders(),
        getMenu(true),
        canSeeStats ? getStats() : Promise.resolve({ todayRevenue: 0, todayOrders: 0, avgOrder: 0, lowStock: 0, topDishes: [], peakHours: [] }),
        canSeeSettings ? getSettings() : Promise.resolve({}),
      ]);
      setOrders(ordersData);
      setDishes(menuData);
      setStats(statsData);
      setSettingsState(settingsData);
      if (canSeeStats) getReports(reportPeriod).then(setReports).catch(() => {});
      else setReports({ sales: [], topDishes: [] });
      if (['superadmin', 'admin'].includes(user?.role)) getUsers().then(setUsers).catch(() => {});
      if (user?.role === 'superadmin') {
        getRestaurants().then(data => {
          setRestaurants(data);
          if (!activeRestaurantId) return;
          const activeExists = data.some(r => String(r.id) === String(activeRestaurantId));
          if (!activeExists) {
            setActiveRestaurantId(null);
            setActiveRestaurantIdState(null);
          }
        }).catch(() => {});
        getBackups().then(setBackups).catch(() => {});
      }
      getNetworkInfo().then(info => {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        setQrOrigin(isLocalhost && info.origin ? info.origin : window.location.origin);
      }).catch(() => {});
    } catch (err) {
      showNotif('Erreur de chargement', 'warning');
    }
  }, [activeRestaurantId, reportPeriod, user?.role]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      getOrders()
        .then(setOrders)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.mustChangePassword) {
      setAdminTab('security');
      showNotif('Changez le mot de passe par defaut', 'warning');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.mustChangePassword]);

  useEffect(() => {
    if (user?.role === 'superadmin' && activeRestaurantId && !newUser.restaurantId) {
      setNewUser(prev => ({ ...prev, restaurantId: String(activeRestaurantId) }));
    }
  }, [activeRestaurantId, newUser.restaurantId, user?.role]);

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

  // Fix 10+11: Deduplicate WS updates + remove showNotif from deps
  useEffect(() => {
    connectWs();
    const unsub = onWsMessage((data) => {
      if (data.type === 'NEW_ORDER') {
        setOrders(prev => {
          if (prev.some(o => o.id === data.order.id)) return prev;
          return [data.order, ...prev];
        });
        playNewOrderSound();
        showNotif(`Nouvelle commande #${data.order.id} - Table ${data.order.table}`);
      }
      if (data.type === 'ORDER_UPDATED') {
        setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
      }
    });
    return () => { unsub(); disconnectWs(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRestaurantId, playNewOrderSound]);

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

  const handleCreateFormula = async () => {
    try {
      const cleanItems = newFormula.items
        .filter(item => item.dishId || item.label)
        .map(item => ({ ...item, dishId: item.dishId ? Number(item.dishId) : null }));
      const created = await createFormula({ ...newFormula, price: Number(newFormula.price), items: cleanItems });
      setFormulas(prev => [...prev, created]);
      setNewFormula({
        name: '',
        description: '',
        price: 0,
        availableFrom: '',
        availableUntil: '',
        items: [
          { category: 'entree', dishId: '', label: 'Entree' },
          { category: 'plat', dishId: '', label: 'Plat' },
          { category: 'dessert', dishId: '', label: 'Dessert' },
        ],
      });
      showNotif('Formule creee');
    } catch (err) { showNotif(err.message || 'Erreur formule', 'warning'); }
  };

  const handleDeleteFormula = async (id) => {
    try {
      await deleteFormula(id);
      setFormulas(prev => prev.filter(f => f.id !== id));
      showNotif('Formule supprimee', 'warning');
    } catch { showNotif('Erreur formule', 'warning'); }
  };

  const handleDeleteReview = async (id) => {
    try {
      await deleteReview(id);
      setReviews(prev => prev.filter(r => r.id !== id));
      showNotif('Avis supprime', 'warning');
    } catch { showNotif('Erreur avis', 'warning'); }
  };

  const handleToggleAvailability = async (dish) => {
    try {
      const updated = await updateDish(dish.id, { visible: !dish.visible });
      setDishes(prev => prev.map(d => d.id === dish.id ? updated : d));
      showNotif('Visibilite client modifiee');
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

  const handleUpdatePayment = async (order, paymentStatus, paymentMethod = order.paymentMethod || '', amountPaid) => {
    try {
      const updated = await updatePayment(order.id, paymentStatus, paymentMethod, amountPaid);
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      showNotif('Paiement mis a jour');
    } catch (err) { showNotif(err.message || 'Erreur paiement', 'warning'); }
  };

  const handleCreateUser = async () => {
    if (user?.role === 'superadmin' && !newUser.restaurantId) {
      showNotif('Selectionnez un restaurant pour cet utilisateur', 'warning');
      return;
    }
    try {
      const created = await createUser({
        ...newUser,
        restaurantId: user?.role === 'superadmin' ? newUser.restaurantId : undefined,
      });
      setUsers(prev => [created, ...prev]);
      setNewUser({ name: '', email: '', role: 'serveur', password: '', restaurantId: activeRestaurantId || '' });
      showNotif('Utilisateur cree');
    } catch (err) { showNotif(err.message || 'Erreur utilisateur', 'warning'); }
  };

  const handleCreateRestaurant = async () => {
    try {
      const created = await createRestaurant(newRestaurant);
      setRestaurants(prev => [created, ...prev]);
      setNewRestaurant({ name: '', slug: '' });
      showNotif('Restaurant cree');
    } catch (err) { showNotif(err.message || 'Erreur restaurant', 'warning'); }
  };

  const handleToggleRestaurant = async (restaurant) => {
    try {
      const updated = await updateRestaurant(restaurant.id, {
        name: restaurant.name,
        status: restaurant.status === 'active' ? 'suspended' : 'active',
      });
      setRestaurants(prev => prev.map(r => r.id === restaurant.id ? updated : r));
    } catch (err) { showNotif(err.message || 'Erreur restaurant', 'warning'); }
  };

  const handleManageRestaurant = (restaurant) => {
    setActiveRestaurantId(restaurant.id);
    setActiveRestaurantIdState(String(restaurant.id));
    setNewUser(prev => ({ ...prev, restaurantId: String(restaurant.id) }));
    setAdminTab('orders');
    showNotif(`Espace ${restaurant.name} ouvert`);
  };

  const handleCloseRestaurant = () => {
    setActiveRestaurantId(null);
    setActiveRestaurantIdState(null);
    setAdminTab('restaurants');
  };

  const handleCreateBackup = async () => {
    try {
      await createBackup();
      setBackups(await getBackups());
      showNotif('Sauvegarde creee');
    } catch (err) { showNotif(err.message || 'Erreur sauvegarde', 'warning'); }
  };

  const handleRestoreBackup = async (backupName) => {
    try {
      await restoreBackup(backupName);
      showNotif('Sauvegarde restauree');
      loadData();
    } catch (err) { showNotif(err.message || 'Erreur restauration', 'warning'); }
  };

  const downloadDatabase = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(exportDatabaseUrl(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resto-backup-${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { showNotif('Erreur export base', 'warning'); }
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
    const currency = settings.currency || 'FCFA';
    const restaurantName = settings.restaurant_name || activeRestaurant?.name || 'Resto QR';
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
      ${order.notes ? `<p><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}
      <div class="row total"><span>Total</span><span>${order.total.toLocaleString()} ${currency}</span></div>
      <div class="row"><span>Recu</span><span>${Number(order.amountPaid || 0).toLocaleString()} ${currency}</span></div>
      <div class="row"><span>Monnaie</span><span>${Number(order.changeDue || 0).toLocaleString()} ${currency}</span></div>
      <div class="thanks">${escapeHtml(thankYou)}</div>
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
      ${Array.from({ length: tablesCount }, (_, i) => i + 1).map(num => `<div class="card"><img src="${qrCodes[num] || ''}"><h2>Table ${num}</h2><p>${tableQrUrl(num)}</p></div>`).join('')}
      </div></body></html>
    `);
    win.document.close();
    win.print();
  };

  const downloadExport = async () => {
    try {
      await exportOrdersCsv(exportRange.from, exportRange.to);
    } catch {
      showNotif('Erreur export CSV', 'warning');
    }
  };

  const downloadOhada = async () => {
    try {
      await exportOhada(exportRange.from, exportRange.to);
      showNotif('Export OHADA telecharge');
    } catch {
      showNotif('Erreur export OHADA', 'warning');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const activeRestaurant = restaurants.find(r => String(r.id) === String(activeRestaurantId));
  const superadminManaging = user?.role === 'superadmin' && !!activeRestaurantId;
  const restaurantOptions = useMemo(() => restaurants.map(r => ({
    value: String(r.id),
    label: `${r.name}${r.status === 'suspended' ? ' (suspendu)' : ''}`,
  })), [restaurants]);

  const sidebarItems = useMemo(() => [
    { id: 'orders', icon: ShoppingCart, label: 'Commandes', roles: ['superadmin', 'admin', 'serveur', 'cuisine'], badge: orders.filter(o => o.status === 'pending').length, tenantOnly: true },
    { id: 'payments', icon: CreditCard, label: 'Paiements', roles: ['superadmin', 'admin', 'serveur', 'caisse'], badge: orders.filter(o => o.paymentStatus !== 'paid').length, tenantOnly: true },
    { id: 'menu', icon: MenuIcon, label: 'Menu', roles: ['superadmin', 'admin'], tenantOnly: true },
    { id: 'stock', icon: Package, label: 'Stock', roles: ['superadmin', 'admin'], tenantOnly: true },
    { id: 'history', icon: History, label: 'Historique', roles: ['superadmin', 'admin', 'caisse'], tenantOnly: true },
    { id: 'reviews', icon: Star, label: 'Avis', roles: ['superadmin', 'admin'], tenantOnly: true },
    { id: 'stats', icon: BarChart3, label: 'Statistiques', roles: ['superadmin', 'admin', 'caisse'], tenantOnly: true },
    { id: 'tables', icon: QrCode, label: 'Tables & QR', roles: ['superadmin', 'admin'], tenantOnly: true },
    { id: 'reservations', icon: Calendar, label: 'Reservations', roles: ['superadmin', 'admin', 'serveur'], tenantOnly: true },
    { id: 'users', icon: Users, label: 'Utilisateurs', roles: ['superadmin', 'admin'] },
    { id: 'restaurants', icon: Home, label: 'Restaurants', roles: ['superadmin'] },
    { id: 'maintenance', icon: Download, label: 'Maintenance', roles: ['superadmin'] },
    { id: 'settings', icon: Settings, label: 'Parametres', roles: ['superadmin', 'admin'] },
    { id: 'security', icon: KeyRound, label: 'Securite', roles: ['superadmin', 'admin'] },
  ].filter(item => {
    if (!item.roles.includes(user?.role || 'admin')) return false;
    if (user?.role === 'superadmin' && item.tenantOnly && !superadminManaging) return false;
    return true;
  }), [orders, superadminManaging, user?.role]);

  useEffect(() => {
    if (sidebarItems.length && !sidebarItems.some(item => item.id === adminTab)) {
      setAdminTab(sidebarItems[0].id);
    }
  }, [adminTab, sidebarItems]);

  const tablesCount = parseInt(settings.tables_count) || 12;
  const tableQrUrl = useCallback((table) => `${qrOrigin}/t/${table}?restaurantId=${activeRestaurantId || user?.restaurantId || 1}`, [activeRestaurantId, qrOrigin, user?.restaurantId]);
  const restaurantNameById = useCallback((restaurantId) => {
    const restaurant = restaurants.find(r => String(r.id) === String(restaurantId));
    return restaurant?.name || `Restaurant #${restaurantId || 1}`;
  }, [restaurants]);
  const accessLabelByRole = {
    superadmin: 'Plateforme',
    admin: 'Administration',
    serveur: 'Ecran serveur',
    cuisine: 'Ecran cuisine',
    caisse: 'Caisse',
  };

  useEffect(() => {
    if (adminTab !== 'tables') return;

    let cancelled = false;
    async function generateQrCodes() {
      const entries = await Promise.all(
        Array.from({ length: tablesCount }, async (_, i) => {
          const table = i + 1;
          const url = tableQrUrl(table);
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

    // Load floor plan
    getTableStatus().then(setFloorTables).catch(() => {});
    const floorTimer = setInterval(() => {
      getTableStatus().then(setFloorTables).catch(() => {});
    }, 5000);

    return () => { cancelled = true; clearInterval(floorTimer); };
  }, [adminTab, tablesCount, tableQrUrl, showNotif]);

  useEffect(() => {
    if (adminTab !== 'reservations') return;
    getReservations(reservationDate).then(setReservations).catch(() => {});
  }, [adminTab, reservationDate]);

  useEffect(() => {
    if (adminTab !== 'reviews') return;
    getReviews().then(setReviews).catch(() => {});
  }, [adminTab]);

  useEffect(() => {
    if (adminTab !== 'menu') return;
    getAdminFormulas().then(setFormulas).catch(() => {});
  }, [adminTab]);

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
          <Dropdown
            value={adminTab}
            onChange={setAdminTab}
            options={sidebarItems.map(i => ({ value: i.id, label: i.label }))}
            className="min-w-44"
            buttonStyle={{ background: colors.primary, borderColor: colors.primary, color: colors.cream, minHeight: 40, paddingTop: 8, paddingBottom: 8 }}
          />
          <button onClick={handleLogout} className="p-2 rounded-lg" style={{ color: colors.cream }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="lg:ml-64 p-4 lg:p-8">
        {user?.role === 'superadmin' && activeRestaurant && (
          <div className="mb-4 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-md" style={{ background: 'white' }}>
            <div>
              <p className="text-xs font-medium" style={{ color: colors.textLight }}>Restaurant actif</p>
              <h2 className="font-bold" style={{ color: colors.text }}>{activeRestaurant.name}</h2>
            </div>
            <button onClick={handleCloseRestaurant} className="px-4 py-2 rounded-lg font-medium" style={{ background: colors.sand, color: colors.text }}>
              Retour aux restaurants
            </button>
          </div>
        )}

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
                    cancelled: { color: colors.primary, label: 'Annulee', icon: X },
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
                      <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: colors.sand, color: colors.text }}>
                        <strong>{order.orderType === 'takeaway' ? 'A emporter' : order.orderType === 'delivery' ? 'Livraison' : 'Sur place'}</strong>
                        {order.customerName && <span> - {order.customerName}</span>}
                        {order.deliveryPhone && <div>{order.deliveryPhone}</div>}
                        {order.deliveryAddress && <div>{order.deliveryAddress}</div>}
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
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'served')}
                            disabled={order.paymentStatus !== 'paid'}
                            className="col-span-2 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                            style={{ background: colors.primary, color: colors.cream }}
                          >
                            {order.paymentStatus === 'paid' ? 'Servie' : 'Paiement requis'}
                          </button>
                        )}
                        {!['served', 'cancelled'].includes(order.status) && (
                          <button onClick={() => handleUpdateStatus(order.id, 'cancelled')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: '#EFD9D9', color: colors.primary }}>Annuler la commande</button>
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
              <p style={{ color: colors.textLight }}>Encaissement espece et calcul automatique de la monnaie</p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
              <table className="w-full">
                <thead style={{ background: colors.sand }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">Commande</th>
                    <th className="text-left px-4 py-3 text-sm">Total</th>
                    <th className="text-left px-4 py-3 text-sm">Statut</th>
                    <th className="text-left px-4 py-3 text-sm">Recu</th>
                    <th className="text-left px-4 py-3 text-sm">Monnaie</th>
                    <th className="text-left px-4 py-3 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const amount = order.amountPaid || 0;
                    const numericAmount = Number(amount) || 0;
                    const changeDue = Math.max(0, numericAmount - order.total);
                    const canPay = numericAmount >= order.total;
                    return (
                    <tr key={order.id} className="border-t" style={{ borderColor: colors.sand }}>
                      <td className="px-4 py-3 font-medium">#{order.id} · Table {order.table}</td>
                      <td className="px-4 py-3">{order.total.toLocaleString()} FCFA</td>
                      <td className="px-4 py-3">{order.paymentStatus === 'paid' ? 'Paye' : order.paymentStatus === 'refunded' ? 'Rembourse' : 'Non paye'}</td>
                      <td className="px-4 py-3">
                        {numericAmount.toLocaleString()} FCFA
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: canPay ? '#5C8A4A' : colors.primary }}>
                        {canPay ? changeDue.toLocaleString() : 'Insuffisant'} FCFA
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdatePayment(order, 'paid', 'cash', numericAmount)} disabled={!canPay || order.paymentStatus === 'paid'} className="px-3 py-1 rounded text-sm disabled:opacity-50" style={{ background: colors.primary, color: colors.cream }}>Confirmer recu</button>
                          <button onClick={() => handleUpdatePayment(order, 'paid', 'mobile_money')} disabled={order.paymentStatus === 'paid'} className="px-3 py-1 rounded text-sm disabled:opacity-50" style={{ background: colors.gold, color: colors.primaryDark }}>Mobile Money</button>
                          <button onClick={() => handleUpdatePayment(order, 'paid', 'card')} disabled={order.paymentStatus === 'paid'} className="px-3 py-1 rounded text-sm disabled:opacity-50" style={{ background: colors.sandDark, color: colors.text }}>Carte</button>
                          <button onClick={() => handleUpdatePayment(order, 'unpaid', '')} className="px-3 py-1 rounded text-sm" style={{ background: colors.sand, color: colors.text }}>Annuler</button>
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
                <button onClick={downloadOhada} className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: colors.gold, color: colors.primaryDark }}>
                  <Download size={18} /> OHADA
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
            <div className="rounded-2xl p-4 shadow-md mb-6" style={{ background: 'white' }}>
              <h3 className="font-bold mb-3" style={{ color: colors.text }}>Formules</h3>
              <div className="grid lg:grid-cols-[1fr_120px] gap-3 mb-3">
                <input placeholder="Nom de la formule" value={newFormula.name} onChange={e => setNewFormula({ ...newFormula, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <input type="number" placeholder="Prix" value={newFormula.price} onChange={e => setNewFormula({ ...newFormula, price: e.target.value })} className="px-3 py-2 rounded-lg border" />
              </div>
              <textarea placeholder="Description" value={newFormula.description} onChange={e => setNewFormula({ ...newFormula, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border mb-3" rows="2" />
              <div className="grid md:grid-cols-3 gap-2 mb-3">
                {newFormula.items.map((item, index) => (
                  <Dropdown
                    key={index}
                    value={item.dishId}
                    onChange={dishId => setNewFormula(prev => ({ ...prev, items: prev.items.map((it, i) => i === index ? { ...it, dishId } : it) }))}
                    options={[{ value: '', label: item.label }, ...dishes.map(d => ({ value: String(d.id), label: d.name }))]}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input type="time" value={newFormula.availableFrom} onChange={e => setNewFormula({ ...newFormula, availableFrom: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <input type="time" value={newFormula.availableUntil} onChange={e => setNewFormula({ ...newFormula, availableUntil: e.target.value })} className="px-3 py-2 rounded-lg border" />
              </div>
              <button onClick={handleCreateFormula} className="px-4 py-2 rounded-lg font-medium mb-4" style={{ background: colors.primary, color: colors.cream }}>Creer la formule</button>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {formulas.map(formula => (
                  <div key={formula.id} className="rounded-xl p-3" style={{ background: colors.sand }}>
                    <div className="flex justify-between gap-2">
                      <strong style={{ color: colors.text }}>{formula.name}</strong>
                      <span style={{ color: colors.primary }}>{Number(formula.price).toLocaleString()} FCFA</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: colors.textLight }}>{formula.items?.map(i => i.label || i.category).join(' + ')}</p>
                    <button onClick={() => handleDeleteFormula(formula.id)} className="mt-2 text-xs px-2 py-1 rounded" style={{ background: '#EFD9D9', color: colors.primary }}>Supprimer</button>
                  </div>
                ))}
              </div>
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
                      <span className="text-xs px-2 py-1 rounded" style={{ background: dish.available ? '#5C8A4A20' : colors.sandDark, color: dish.available ? '#5C8A4A' : colors.textLight }}>
                        {dish.available ? 'Disponible' : dish.visible === false ? 'Masque' : 'Epuise'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setEditingDish(dish)} className="py-2 rounded-lg text-xs font-medium" style={{ background: colors.sand, color: colors.text }}>
                        <Edit size={16} className="mx-auto" />
                      </button>
                      <button onClick={() => handleToggleAvailability(dish)} className="py-2 rounded-lg text-xs font-medium" style={{ background: colors.gold + '40', color: colors.text }}>
                        {dish.visible !== false ? <EyeOff size={16} className="mx-auto" /> : <Eye size={16} className="mx-auto" />}
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

        {/* ===== REVIEWS ===== */}
        {adminTab === 'reviews' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Avis clients</h2>
                <p style={{ color: colors.textLight }}>Notes et commentaires par plat</p>
              </div>
              <button onClick={() => getReviews().then(setReviews).catch(() => {})} className="px-4 py-2 rounded-lg font-medium" style={{ background: colors.primary, color: colors.cream }}>Actualiser</button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.length === 0 && <p style={{ color: colors.textLight }}>Aucun avis pour le moment.</p>}
              {reviews.map(review => (
                <div key={review.id} className="rounded-2xl p-4 shadow-md" style={{ background: 'white' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold" style={{ color: colors.text }}>{review.dish_name || `Plat #${review.dish_id}`}</h3>
                      <p className="text-xs" style={{ color: colors.textLight }}>Commande #{review.order_id} - Table {review.table_number || '-'}</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: colors.gold }}>{review.rating}/5</span>
                  </div>
                  {review.comment && <p className="text-sm mb-3" style={{ color: colors.text }}>{review.comment}</p>}
                  <button onClick={() => handleDeleteReview(review.id)} className="text-xs px-3 py-1 rounded" style={{ background: '#EFD9D9', color: colors.primary }}>Supprimer</button>
                </div>
              ))}
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
                { label: 'Revenus du jour', value: `${stats.todayRevenue.toLocaleString()} FCFA`, icon: DollarSign, color: colors.primary, yesterday: stats.yesterdayRevenue, unit: ' FCFA' },
                { label: 'Commandes', value: stats.todayOrders, icon: ShoppingCart, color: colors.gold, yesterday: stats.yesterdayOrders },
                { label: 'Panier moyen', value: `${stats.avgOrder.toLocaleString()} FCFA`, icon: TrendingUp, color: colors.primaryLight },
                { label: 'Temps moyen prep', value: stats.avgPrepTime ? `${stats.avgPrepTime} min` : '-', icon: Clock, color: '#5C8A4A' },
              ].map((stat, i) => (
                <div key={i} className="rounded-2xl p-4 shadow-md" style={{ background: 'white' }}>
                  <div className="p-2 rounded-lg inline-block mb-3" style={{ background: stat.color + '20' }}>
                    <stat.icon size={20} style={{ color: stat.color }} />
                  </div>
                  <p className="text-xs mb-1" style={{ color: colors.textLight }}>{stat.label}</p>
                  <p className="text-xl font-bold" style={{ color: colors.text }}>{stat.value}</p>
                  {stat.yesterday != null && <ComparisonCard today={typeof stat.value === 'number' ? stat.value : (stat.label.includes('Revenus') ? stats.todayRevenue : stats.todayOrders)} yesterday={stat.yesterday} />}
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Revenus (7 derniers jours)</h3>
                <RevenueChart data={stats.dailyRevenue} />
              </div>
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Heures de pointe</h3>
                <PeakHoursChart data={stats.peakHours} />
              </div>
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
                <h3 className="font-bold mb-4" style={{ color: colors.text }}>Modes de paiement</h3>
                <PaymentMethodsChart data={stats.paymentMethods} />
              </div>
            </div>
          </div>
        )}

        {/* ===== TABLES & QR ===== */}
        {adminTab === 'tables' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Tables & QR Codes</h2>
              <p style={{ color: colors.textLight }}>Plan de salle en temps reel et QR codes</p>
            </div>

            {/* Floor Plan */}
            <div className="rounded-2xl p-6 shadow-md mb-6" style={{ background: 'white' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: colors.text }}>Plan de salle</h3>
                <div className="flex gap-2">
                  {editingLayout ? (
                    <>
                      <button onClick={() => { saveTableLayout(floorTables).then(() => { showNotif('Disposition sauvegardee'); setEditingLayout(false); }).catch(() => showNotif('Erreur', 'warning')); }} className="px-3 py-1 rounded-lg text-sm font-medium" style={{ background: '#5C8A4A', color: 'white' }}>
                        <Save size={14} className="inline mr-1" /> Sauvegarder
                      </button>
                      <button onClick={() => setEditingLayout(false)} className="px-3 py-1 rounded-lg text-sm" style={{ background: colors.sand }}>Annuler</button>
                    </>
                  ) : (
                    <button onClick={() => setEditingLayout(true)} className="px-3 py-1 rounded-lg text-sm font-medium" style={{ background: colors.sand, color: colors.text }}>
                      <Edit size={14} className="inline mr-1" /> Modifier
                    </button>
                  )}
                </div>
              </div>
              <FloorPlan
                tables={floorTables}
                editable={editingLayout}
                onTableClick={(table) => {
                  setSelectedFloorTable(table);
                  if (table.status !== 'free') {
                    getTableOrders(table.number).then(setTableOrders).catch(() => setTableOrders([]));
                  } else {
                    setTableOrders([]);
                  }
                }}
                onLayoutChange={(number, x, y) => {
                  setFloorTables(prev => prev.map(t => t.number === number ? { ...t, x, y } : t));
                }}
              />
            </div>

            {/* Table Detail */}
            {selectedFloorTable && (
              <div className="mb-6">
                <TableDetailPanel
                  table={selectedFloorTable}
                  orders={tableOrders}
                  onClose={() => setSelectedFloorTable(null)}
                  currency={settings.currency || 'FCFA'}
                />
              </div>
            )}

            {/* QR Codes */}
            <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: colors.text }}>QR Codes</h3>
                <div className="flex gap-2">
                  <span className="text-sm px-3 py-2 rounded-lg" style={{ background: colors.sand, color: colors.primary }}>
                    {qrOrigin}/t/N
                  </span>
                  <button onClick={printQrSheet} className="px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                    <Printer size={18} /> Imprimer
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: tablesCount }, (_, i) => i + 1).map(num => (
                  <div key={num} className="rounded-2xl p-4 shadow-md text-center" style={{ background: colors.sand }}>
                    <div className="w-full aspect-square rounded-xl flex items-center justify-center mb-3" style={{ background: 'white' }}>
                      {qrCodes[num] ? (
                        <img src={qrCodes[num]} alt={`QR table ${num}`} className="w-[88%] h-[88%] object-contain rounded-lg" />
                      ) : (
                        <QrCode size={80} style={{ color: colors.primary }} />
                      )}
                    </div>
                    <h3 className="font-bold mb-1" style={{ color: colors.text }}>Table {num}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== RESERVATIONS ===== */}
        {adminTab === 'reservations' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Reservations</h2>
              <p style={{ color: colors.textLight }}>Gerez les reservations de vos clients</p>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input type="date" value={reservationDate} onChange={e => { setReservationDate(e.target.value); getReservations(e.target.value).then(setReservations).catch(() => {}); }} className="px-4 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark }} />
              <button onClick={() => getReservations(reservationDate).then(setReservations).catch(() => {})} className="px-4 py-2 rounded-lg font-medium" style={{ background: colors.primary, color: colors.cream }}>Actualiser</button>
              <span className="text-sm" style={{ color: colors.textLight }}>{reservations.length} reservation(s)</span>
            </div>
            <div className="space-y-3">
              {reservations.length === 0 && <p style={{ color: colors.textLight }}>Aucune reservation pour cette date.</p>}
              {reservations.map(r => (
                <div key={r.id} className="rounded-2xl p-5 shadow-md flex items-start justify-between" style={{ background: 'white' }}>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: colors.text }}>{r.customer_name}</h3>
                    <p className="text-sm" style={{ color: colors.textLight }}>
                      {r.time_slot} - {r.party_size} personne(s)
                      {r.table_number && ` - Table ${r.table_number}`}
                    </p>
                    {r.customer_phone && <p className="text-sm" style={{ color: colors.textLight }}>{r.customer_phone}</p>}
                    {r.notes && <p className="text-sm mt-1 px-3 py-1 rounded" style={{ background: colors.sand, color: colors.text }}>{r.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
                      background: r.status === 'confirmed' ? colors.gold + '20' : r.status === 'seated' ? '#5C8A4A20' : r.status === 'cancelled' ? '#d32f2f20' : colors.sand,
                      color: r.status === 'confirmed' ? colors.gold : r.status === 'seated' ? '#5C8A4A' : r.status === 'cancelled' ? '#d32f2f' : colors.text,
                    }}>
                      {r.status === 'confirmed' ? 'Confirmee' : r.status === 'arrived' ? 'Arrivee' : r.status === 'seated' ? 'Installee' : r.status === 'completed' ? 'Terminee' : r.status === 'cancelled' ? 'Annulee' : r.status === 'no_show' ? 'Non venue' : r.status}
                    </span>
                    <div className="flex gap-1">
                      {r.status === 'confirmed' && (
                        <button onClick={() => updateReservation(r.id, { status: 'seated' }).then(() => getReservations(reservationDate).then(setReservations)).catch(() => showNotif('Erreur', 'warning'))} className="text-xs px-2 py-1 rounded" style={{ background: '#5C8A4A', color: 'white' }}>Installer</button>
                      )}
                      {r.status !== 'cancelled' && r.status !== 'completed' && (
                        <button onClick={() => updateReservation(r.id, { status: 'cancelled' }).then(() => getReservations(reservationDate).then(setReservations)).catch(() => showNotif('Erreur', 'warning'))} className="text-xs px-2 py-1 rounded" style={{ background: '#d32f2f20', color: '#d32f2f' }}>Annuler</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== USERS ===== */}
        {adminTab === 'users' && ['superadmin', 'admin'].includes(user?.role) && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Utilisateurs & roles</h2>
              <p style={{ color: colors.textLight }}>Creation des comptes de connexion du personnel</p>
            </div>
            <div className="rounded-2xl p-4 shadow-md mb-4" style={{ background: 'white' }}>
              <div className="grid md:grid-cols-6 gap-3">
                <input placeholder="Nom" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <input placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="px-3 py-2 rounded-lg border" />
                {user?.role === 'superadmin' && (
                  <Dropdown
                    value={newUser.restaurantId}
                    onChange={restaurantId => setNewUser({ ...newUser, restaurantId })}
                    options={restaurantOptions}
                    placeholder="Restaurant requis"
                  />
                )}
                <Dropdown
                  value={newUser.role}
                  onChange={role => setNewUser({ ...newUser, role })}
                  options={[
                    ...(user?.role === 'superadmin' ? [{ value: 'superadmin', label: 'Super Admin' }] : []),
                    { value: 'serveur', label: 'Serveur' },
                    { value: 'cuisine', label: 'Cuisine' },
                    { value: 'caisse', label: 'Caisse' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
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
                    {user?.role === 'superadmin' && <th className="text-left px-4 py-3 text-sm">Restaurant</th>}
                    <th className="text-left px-4 py-3 text-sm">Role</th>
                    <th className="text-left px-4 py-3 text-sm">Acces</th>
                    <th className="text-left px-4 py-3 text-sm">Securite</th>
                    <th className="text-left px-4 py-3 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t" style={{ borderColor: colors.sand }}>
                      <td className="px-4 py-3">{u.name}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      {user?.role === 'superadmin' && <td className="px-4 py-3">{restaurantNameById(u.restaurantId)}</td>}
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3">{accessLabelByRole[u.role] || 'Administration'}</td>
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

        {/* ===== RESTAURANTS ===== */}
        {adminTab === 'restaurants' && user?.role === 'superadmin' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Restaurants</h2>
              <p style={{ color: colors.textLight }}>Creation et controle des espaces restaurants</p>
            </div>
            <div className="rounded-2xl p-4 shadow-md mb-4" style={{ background: 'white' }}>
              <div className="grid md:grid-cols-3 gap-3">
                <input placeholder="Nom du restaurant" value={newRestaurant.name} onChange={e => setNewRestaurant({ ...newRestaurant, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <input placeholder="Slug optionnel" value={newRestaurant.slug} onChange={e => setNewRestaurant({ ...newRestaurant, slug: e.target.value })} className="px-3 py-2 rounded-lg border" />
                <button onClick={handleCreateRestaurant} className="rounded-lg font-medium" style={{ background: colors.primary, color: colors.cream }}>Creer</button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
              <table className="w-full">
                <thead style={{ background: colors.sand }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">Nom</th>
                    <th className="text-left px-4 py-3 text-sm">Slug</th>
                    <th className="text-left px-4 py-3 text-sm">Statut</th>
                    <th className="text-left px-4 py-3 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map(r => (
                    <tr key={r.id} className="border-t" style={{ borderColor: colors.sand }}>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3">{r.slug}</td>
                      <td className="px-4 py-3">{r.status === 'active' ? 'Actif' : 'Suspendu'}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => handleManageRestaurant(r)} className="px-3 py-1 rounded text-sm" style={{ background: colors.primary, color: colors.cream }}>
                          Gerer
                        </button>
                        <button onClick={() => handleToggleRestaurant(r)} className="px-3 py-1 rounded text-sm" style={{ background: colors.sand, color: colors.text }}>
                          {r.status === 'active' ? 'Suspendre' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== MAINTENANCE ===== */}
        {adminTab === 'maintenance' && user?.role === 'superadmin' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Maintenance</h2>
              <p style={{ color: colors.textLight }}>Sauvegarde, export et restauration de l'installation</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={handleCreateBackup} className="px-4 py-2 rounded-lg font-medium" style={{ background: colors.primary, color: colors.cream }}>Creer une sauvegarde</button>
              <button onClick={downloadDatabase} className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: colors.sand, color: colors.text }}>
                <Download size={18} /> Exporter la base
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white' }}>
              <table className="w-full">
                <thead style={{ background: colors.sand }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm">Sauvegarde</th>
                    <th className="text-left px-4 py-3 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(backup => (
                    <tr key={backup.name} className="border-t" style={{ borderColor: colors.sand }}>
                      <td className="px-4 py-3">{backup.name}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleRestoreBackup(backup.name)} className="px-3 py-1 rounded text-sm" style={{ background: '#EFD9D9', color: colors.primary }}>Restaurer</button>
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr><td className="px-4 py-6" colSpan="2" style={{ color: colors.textLight }}>Aucune sauvegarde disponible.</td></tr>
                  )}
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
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Message de remerciement facture</label>
                    <textarea value={settings.receipt_thank_you || ''} onChange={e => setSettingsState({ ...settings, receipt_thank_you: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} rows="3" maxLength="220" />
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
              <p style={{ color: colors.textLight }}>Mot de passe et acces utilisateurs</p>
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
                <h3 className="font-bold mb-2" style={{ color: colors.text }}>Comptes du personnel</h3>
                <p className="text-sm mb-4" style={{ color: colors.textLight }}>
                  Creez les comptes cuisine, serveur, caisse et admin dans la table Utilisateurs. Chaque personne se connecte ensuite avec son email et son mot de passe.
                </p>
                {['superadmin', 'admin'].includes(user?.role) && (
                  <button onClick={() => setAdminTab('users')} className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                    <Users size={18} /> Gerer les utilisateurs
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dish Modal */}
      {(showAddDish || editingDish) && (
        <DishModal
          dish={editingDish || { name: '', description: '', price: 0, category: 'plats', image: '🍽️', stock: 0, available: true, visible: true, veg: false, glutenFree: false, spicy: false, prepTime: 15 }}
          onSave={handleSaveDish}
          onClose={() => { setEditingDish(null); setShowAddDish(false); }}
        />
      )}
    </div>
  );
}
