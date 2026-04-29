import React, { useState, useEffect } from 'react';
import {
      QrCode, ShoppingCart, Plus, Minus, Trash2, Edit, Image as ImageIcon,
      Bell, TrendingUp, Package, Users, Clock, CheckCircle, X, Search,
      Filter, Star, ChefHat, Utensils, LogIn, Home, Menu as MenuIcon,
      BarChart3, Settings, Eye, EyeOff, Save, Camera, AlertCircle,
      DollarSign, Award, Globe
} from 'lucide-react';

const routeFromHash = () => {
  const route = window.location.hash.replace(/^#\/?/, '');
  return ['client', 'admin-login', 'admin'].includes(route) ? route : 'landing';
};

    function Icon({ icon: IconComponent, className, style }) {
      if (!IconComponent) return null;
      return <IconComponent className={className} style={style} />;
    }

    function DishModal({ dish, onSave, onClose, colors }) {
      const [form, setForm] = useState(dish);
      const emojis = ['🍽️','🍲','🥗','🍰','🥤','🍔','🍕','🍣','🍜','🌮','🍛','🍗','🥘','🍱','🍝','🥙','🌯','🍤','🍩','🍪','🍫','🍦','🥐','🥖','🍟','🌭','🥨','🥯','🧀','🥩','🥓','🍳','🥚','🍞','🥞','🧇','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🥝','🥥','🍅','🥑','🥒','🥬','🥦','🥕','🌽','🌶️','🥔','🍠'];

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: colors.cream }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: colors.text }}>{form.id ? 'Modifier le plat' : 'Ajouter un plat'}</h2>
              <button onClick={onClose}><X size={24} style={{ color: colors.text }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Nom du plat</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="2" className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Image (emoji)</label>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-5xl w-16 h-16 flex items-center justify-center rounded-lg" style={{ background: colors.sand }}>{form.image}</div>
                  <p className="text-xs" style={{ color: colors.textLight }}>Sélectionnez un emoji</p>
                </div>
                <div className="grid grid-cols-10 gap-1 max-h-32 overflow-y-auto p-2 rounded-lg" style={{ background: 'white' }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => setForm({ ...form, image: e })} className="text-2xl p-1 rounded hover:bg-gray-100">{e}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Prix (FCFA)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Stock</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Catégorie</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }}>
                    <option value="entrees">Entrées</option>
                    <option value="plats">Plats</option>
                    <option value="desserts">Desserts</option>
                    <option value="boissons">Boissons</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Temps prép (min)</label>
                  <input type="number" value={form.prepTime} onChange={e => setForm({ ...form, prepTime: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium" style={{ color: colors.text }}>Caractéristiques</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'veg', label: '🌱 Végétarien' },
                    { key: 'glutenFree', label: '🌾 Sans gluten' },
                    { key: 'spicy', label: '🌶️ Épicé' },
                    { key: 'available', label: '✓ Disponible' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setForm({ ...form, [f.key]: !form[f.key] })} className="px-3 py-1 rounded-full text-sm" style={{ background: form[f.key] ? colors.primary : colors.sand, color: form[f.key] ? colors.cream : colors.text }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-lg font-medium" style={{ background: colors.sand, color: colors.text }}>Annuler</button>
                <button onClick={() => onSave(form)} className="flex-1 py-3 rounded-lg font-bold" style={{ background: colors.primary, color: colors.cream }}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    function RestoQRApp() {
      const [view, setView] = useState(routeFromHash);
      const [adminTab, setAdminTab] = useState('orders');
      const [tableNumber, setTableNumber] = useState(5);
      const [cart, setCart] = useState([]);
      const [showCart, setShowCart] = useState(false);
      const [selectedCategory, setSelectedCategory] = useState('all');
      const [searchTerm, setSearchTerm] = useState('');
      const [showFilters, setShowFilters] = useState(false);
      const [filters, setFilters] = useState({ veg: false, glutenFree: false, spicy: false });
      const [loginEmail, setLoginEmail] = useState('');
      const [loginPassword, setLoginPassword] = useState('');
      const [showPassword, setShowPassword] = useState(false);
      const [editingDish, setEditingDish] = useState(null);
      const [showAddDish, setShowAddDish] = useState(false);
      const [orderNotes, setOrderNotes] = useState('');
      const [language, setLanguage] = useState('fr');
      const [notification, setNotification] = useState(null);

      useEffect(() => {
        const syncRoute = () => setView(routeFromHash());
        window.addEventListener('hashchange', syncRoute);
        return () => window.removeEventListener('hashchange', syncRoute);
      }, []);

      const navigate = (nextView) => {
        const nextHash = nextView === 'landing' ? '#/' : `#/${nextView}`;
        if (window.location.hash === nextHash) {
          setView(nextView);
          return;
        }
        window.location.hash = nextHash;
      };

      const [dishes, setDishes] = useState([
        { id: 1, name: 'Attiéké Poisson Braisé', description: 'Attiéké traditionnel avec poisson braisé, sauce tomate et légumes frais', price: 4500, category: 'plats', image: '🐟', stock: 15, available: true, veg: false, glutenFree: true, spicy: true, prepTime: 20, rating: 4.8 },
        { id: 2, name: 'Foutou Sauce Graine', description: 'Foutou banane plantain avec sauce graine de palme et viande', price: 5000, category: 'plats', image: '🍲', stock: 8, available: true, veg: false, glutenFree: true, spicy: true, prepTime: 25, rating: 4.9 },
        { id: 3, name: 'Salade César', description: 'Salade fraîche avec poulet grillé, parmesan et croutons maison', price: 3500, category: 'entrees', image: '🥗', stock: 20, available: true, veg: false, glutenFree: false, spicy: false, prepTime: 10, rating: 4.5 },
        { id: 4, name: 'Alloco', description: 'Bananes plantain frites avec sauce piment maison', price: 2000, category: 'entrees', image: '🍌', stock: 25, available: true, veg: true, glutenFree: true, spicy: true, prepTime: 8, rating: 4.7 },
        { id: 5, name: 'Tiramisu', description: 'Tiramisu italien traditionnel au mascarpone et café', price: 2500, category: 'desserts', image: '🍰', stock: 12, available: true, veg: true, glutenFree: false, spicy: false, prepTime: 5, rating: 4.6 },
        { id: 6, name: 'Bissap Glacé', description: "Boisson rafraîchissante à base de fleurs d'hibiscus", price: 1500, category: 'boissons', image: '🥤', stock: 0, available: false, veg: true, glutenFree: true, spicy: false, prepTime: 3, rating: 4.4 },
        { id: 7, name: 'Jus de Gingembre', description: 'Jus de gingembre frais maison, légèrement sucré', price: 1500, category: 'boissons', image: '🍹', stock: 18, available: true, veg: true, glutenFree: true, spicy: true, prepTime: 3, rating: 4.5 },
        { id: 8, name: 'Poulet Yassa', description: 'Poulet mariné aux oignons et citron, riz blanc', price: 4800, category: 'plats', image: '🍗', stock: 10, available: true, veg: false, glutenFree: true, spicy: false, prepTime: 22, rating: 4.7 },
      ]);

      const [orders, setOrders] = useState([
        { id: 1001, table: 3, items: [{ name: 'Attiéké Poisson Braisé', qty: 2, price: 4500 }, { name: 'Bissap Glacé', qty: 2, price: 1500 }], total: 12000, status: 'preparing', time: '12:34', notes: 'Sans piment' },
        { id: 1002, table: 7, items: [{ name: 'Foutou Sauce Graine', qty: 1, price: 5000 }], total: 5000, status: 'ready', time: '12:28', notes: '' },
        { id: 1003, table: 2, items: [{ name: 'Salade César', qty: 1, price: 3500 }, { name: 'Tiramisu', qty: 1, price: 2500 }], total: 6000, status: 'received', time: '12:40', notes: 'Anniversaire - bougie SVP' },
      ]);

      const categories = [
        { id: 'all', name: 'Tout', icon: '🍽️' },
        { id: 'entrees', name: 'Entrées', icon: '🥗' },
        { id: 'plats', name: 'Plats', icon: '🍲' },
        { id: 'desserts', name: 'Desserts', icon: '🍰' },
        { id: 'boissons', name: 'Boissons', icon: '🥤' },
      ];

      const showNotif = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
      };

      const addToCart = (dish) => {
        const existing = cart.find(i => i.id === dish.id);
        if (existing) {
          setCart(cart.map(i => i.id === dish.id ? { ...i, qty: i.qty + 1 } : i));
        } else {
          setCart([...cart, { ...dish, qty: 1 }]);
        }
        showNotif(`${dish.name} ajouté au panier`);
      };

      const updateQty = (id, delta) => {
        setCart(cart.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
      };

      const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));

      const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
      const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

      const submitOrder = () => {
        const newOrder = {
          id: Math.max(...orders.map(o => o.id)) + 1,
          table: tableNumber,
          items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          total: cartTotal,
          status: 'received',
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          notes: orderNotes,
        };
        setOrders([newOrder, ...orders]);
        setCart([]);
        setOrderNotes('');
        setShowCart(false);
        showNotif('Commande envoyée avec succès !');
      };

      const updateOrderStatus = (orderId, newStatus) => {
        setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        showNotif(`Commande #${orderId} mise à jour`);
      };

      const toggleDishAvailability = (id) => {
        setDishes(dishes.map(d => d.id === id ? { ...d, available: !d.available } : d));
        showNotif('Disponibilité modifiée');
      };

      const deleteDish = (id) => {
        setDishes(dishes.filter(d => d.id !== id));
        showNotif('Plat supprimé', 'warning');
      };

      const saveDish = (dish) => {
        if (dish.id) {
          setDishes(dishes.map(d => d.id === dish.id ? dish : d));
        } else {
          setDishes([...dishes, { ...dish, id: Math.max(...dishes.map(d => d.id)) + 1, rating: 0 }]);
        }
        setEditingDish(null);
        setShowAddDish(false);
        showNotif('Plat enregistré');
      };

      const filteredDishes = dishes.filter(d => {
        if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
        if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filters.veg && !d.veg) return false;
        if (filters.glutenFree && !d.glutenFree) return false;
        if (filters.spicy && !d.spicy) return false;
        return true;
      });

      const stats = {
        todayRevenue: orders.reduce((s, o) => s + o.total, 0),
        todayOrders: orders.length,
        avgOrder: orders.length ? Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length) : 0,
        lowStock: dishes.filter(d => d.stock < 10 && d.stock > 0).length,
      };

      const colors = {
        primary: '#7B1F2B',
        primaryDark: '#5A1620',
        primaryLight: '#A0303F',
        sand: '#F5EFE6',
        sandDark: '#E8DCC4',
        gold: '#C9A961',
        goldDark: '#A88947',
        cream: '#FAF6EF',
        text: '#2C1810',
        textLight: '#6B5444',
      };

      // ============ LANDING PAGE ============
      if (view === 'landing') {
        return (
          <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` }}>
            <div className="max-w-6xl mx-auto px-6 py-12">
              <div className="text-center mb-12">
                <div className="inline-block p-4 rounded-2xl mb-6" style={{ background: colors.gold }}>
                  <ChefHat size={48} style={{ color: colors.primaryDark }} />
                </div>
                <h1 className="text-5xl font-bold mb-4" style={{ color: colors.cream, fontFamily: 'serif' }}>Resto QR</h1>
                <p className="text-xl" style={{ color: colors.sandDark }}>La solution premium de commande digitale pour restaurants</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <div onClick={() => navigate('client')} className="rounded-2xl p-8 cursor-pointer transition-all hover:scale-105 shadow-2xl" style={{ background: colors.cream }}>
                  <div className="flex items-center mb-4">
                    <div className="p-3 rounded-xl mr-4" style={{ background: colors.primary }}>
                      <QrCode size={32} style={{ color: colors.gold }} />
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: colors.text }}>Vue Client</h2>
                  </div>
                  <p className="mb-4" style={{ color: colors.textLight }}>Simulez l'expérience d'un client qui scanne le QR code à sa table</p>
                  <div className="flex items-center font-semibold" style={{ color: colors.primary }}>
                    Accéder au menu →
                  </div>
                </div>

                <div onClick={() => navigate('admin-login')} className="rounded-2xl p-8 cursor-pointer transition-all hover:scale-105 shadow-2xl" style={{ background: colors.cream }}>
                  <div className="flex items-center mb-4">
                    <div className="p-3 rounded-xl mr-4" style={{ background: colors.primary }}>
                      <BarChart3 size={32} style={{ color: colors.gold }} />
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: colors.text }}>Espace Admin</h2>
                  </div>
                  <p className="mb-4" style={{ color: colors.textLight }}>Tableau de bord complet pour gérer le restaurant</p>
                  <div className="flex items-center font-semibold" style={{ color: colors.primary }}>
                    Connexion admin →
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-8" style={{ background: 'rgba(250,246,239,0.1)', backdropFilter: 'blur(10px)' }}>
                <h3 className="text-2xl font-bold mb-6 text-center" style={{ color: colors.cream }}>Fonctionnalités principales</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { icon: QrCode, title: 'QR Code par table', desc: 'Génération automatique' },
                    { icon: ShoppingCart, title: 'Commande en direct', desc: 'Reçue instantanément' },
                    { icon: Package, title: 'Gestion stock', desc: 'Mise à jour automatique' },
                    { icon: TrendingUp, title: 'Statistiques', desc: 'Analyses en temps réel' },
                    { icon: DollarSign, title: 'Paiement intégré', desc: 'Mobile Money & cartes' },
                    { icon: Award, title: 'Programme fidélité', desc: 'Points et récompenses' },
                  ].map((f, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(250,246,239,0.1)' }}>
                      <f.icon size={32} className="mb-2" style={{ color: colors.gold }} />
                      <h4 className="font-bold mb-1" style={{ color: colors.cream }}>{f.title}</h4>
                      <p className="text-sm" style={{ color: colors.sandDark }}>{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // ============ ADMIN LOGIN ============
      if (view === 'admin-login') {
        return (
          <div className="min-h-screen flex items-center justify-center px-6" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` }}>
            <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl" style={{ background: colors.cream }}>
              <button onClick={() => navigate('landing')} className="mb-4 text-sm" style={{ color: colors.primary }}>← Retour</button>
              <div className="text-center mb-8">
                <div className="inline-block p-3 rounded-xl mb-4" style={{ background: colors.primary }}>
                  <ChefHat size={32} style={{ color: colors.gold }} />
                </div>
                <h2 className="text-2xl font-bold" style={{ color: colors.text }}>Connexion Admin</h2>
                <p className="text-sm mt-2" style={{ color: colors.textLight }}>Accédez à votre tableau de bord</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Email</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@resto.ci" className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Mot de passe</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none pr-12" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff size={20} style={{ color: colors.textLight }} /> : <Eye size={20} style={{ color: colors.textLight }} />}
                    </button>
                  </div>
                </div>
                <button onClick={() => navigate('admin')} className="w-full py-3 rounded-lg font-bold transition-all hover:opacity-90" style={{ background: colors.primary, color: colors.cream }}>
                  Se connecter
                </button>
                <p className="text-center text-xs" style={{ color: colors.textLight }}>Demo : cliquez simplement sur "Se connecter"</p>
              </div>
            </div>
          </div>
        );
      }

      // ============ CLIENT VIEW ============
      if (view === 'client') {
        return (
          <div className="min-h-screen" style={{ background: colors.cream }}>
            {notification && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl animate-bounce" style={{ background: notification.type === 'warning' ? colors.gold : colors.primary, color: colors.cream }}>
                {notification.msg}
              </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-40 shadow-lg" style={{ background: colors.primary }}>
              <div className="px-4 py-3 flex items-center justify-between">
                <button onClick={() => navigate('landing')} className="text-sm" style={{ color: colors.gold }}>← Retour</button>
                <div className="text-center">
                  <h1 className="text-lg font-bold" style={{ color: colors.cream, fontFamily: 'serif' }}>Le Bistrot Royal</h1>
                  <p className="text-xs" style={{ color: colors.sandDark }}>Table {tableNumber}</p>
                </div>
                <button className="p-2" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>
                  <Globe size={20} style={{ color: colors.gold }} />
                </button>
              </div>
            </div>

            <div className="px-4 py-4">
              {/* Search & Filters */}
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textLight }} />
                  <input type="text" placeholder="Rechercher un plat..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: colors.sand, color: colors.primary }}>
                  <Filter size={16} />
                  Filtres {(filters.veg || filters.glutenFree || filters.spicy) && '•'}
                </button>
                {showFilters && (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'veg', label: '🌱 Végétarien' },
                      { key: 'glutenFree', label: '🌾 Sans gluten' },
                      { key: 'spicy', label: '🌶️ Épicé' },
                    ].map(f => (
                      <button key={f.key} onClick={() => setFilters({ ...filters, [f.key]: !filters[f.key] })} className="px-3 py-1 rounded-full text-sm transition-all" style={{ background: filters[f.key] ? colors.primary : colors.sand, color: filters[f.key] ? colors.cream : colors.text }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="flex-shrink-0 px-4 py-2 rounded-full font-medium transition-all" style={{ background: selectedCategory === cat.id ? colors.primary : 'white', color: selectedCategory === cat.id ? colors.cream : colors.text, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <span className="mr-1">{cat.icon}</span> {cat.name}
                  </button>
                ))}
              </div>

              {/* Dishes */}
              <div className="space-y-3 pb-32">
                {filteredDishes.map(dish => (
                  <div key={dish.id} className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'white', opacity: dish.available ? 1 : 0.5 }}>
                    <div className="flex">
                      <div className="w-28 h-28 flex items-center justify-center text-6xl flex-shrink-0" style={{ background: colors.sand }}>
                        {dish.image}
                      </div>
                      <div className="flex-1 p-3">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-base leading-tight" style={{ color: colors.text }}>{dish.name}</h3>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <Star size={12} className="fill-current" style={{ color: colors.gold }} />
                            <span className="text-xs font-medium" style={{ color: colors.textLight }}>{dish.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs mb-2 line-clamp-2" style={{ color: colors.textLight }}>{dish.description}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={12} style={{ color: colors.textLight }} />
                          <span className="text-xs" style={{ color: colors.textLight }}>{dish.prepTime} min</span>
                          {dish.veg && <span className="text-xs">🌱</span>}
                          {dish.spicy && <span className="text-xs">🌶️</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-lg" style={{ color: colors.primary }}>{dish.price.toLocaleString()} FCFA</span>
                          {dish.available ? (
                            <button onClick={() => addToCart(dish)} className="p-2 rounded-lg transition-all hover:scale-110" style={{ background: colors.primary }}>
                              <Plus size={16} style={{ color: colors.cream }} />
                            </button>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded" style={{ background: colors.sandDark, color: colors.textLight }}>Épuisé</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Cart Button */}
            {cartCount > 0 && !showCart && (
              <button onClick={() => setShowCart(true)} className="fixed bottom-6 left-4 right-4 py-4 rounded-2xl shadow-2xl flex items-center justify-between px-6 font-bold transition-all" style={{ background: colors.primary, color: colors.cream }}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingCart size={24} />
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: colors.gold, color: colors.primaryDark }}>{cartCount}</span>
                  </div>
                  <span>Voir le panier</span>
                </div>
                <span>{cartTotal.toLocaleString()} FCFA</span>
              </button>
            )}

            {/* Cart Modal */}
            {showCart && (
              <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl" style={{ background: colors.cream }}>
                  <div className="sticky top-0 px-6 py-4 flex items-center justify-between border-b-2" style={{ background: colors.cream, borderColor: colors.sandDark }}>
                    <h2 className="text-xl font-bold" style={{ color: colors.text }}>Mon Panier</h2>
                    <button onClick={() => setShowCart(false)}>
                      <X size={24} style={{ color: colors.text }} />
                    </button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'white' }}>
                        <div className="text-4xl">{item.image}</div>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm" style={{ color: colors.text }}>{item.name}</h4>
                          <p className="text-sm" style={{ color: colors.primary }}>{(item.price * item.qty).toLocaleString()} FCFA</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: colors.sand }}>
                            <Minus size={16} style={{ color: colors.text }} />
                          </button>
                          <span className="font-bold w-6 text-center" style={{ color: colors.text }}>{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: colors.primary }}>
                            <Plus size={16} style={{ color: colors.cream }} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Notes spéciales</label>
                      <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Sans oignons, bien cuit, allergies..." className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none text-sm" style={{ borderColor: colors.sandDark, background: 'white' }} rows="2" />
                    </div>
                    <div className="border-t-2 pt-4 mt-4" style={{ borderColor: colors.sandDark }}>
                      <div className="flex justify-between mb-2">
                        <span style={{ color: colors.textLight }}>Sous-total</span>
                        <span style={{ color: colors.text }}>{cartTotal.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold mb-4">
                        <span style={{ color: colors.text }}>Total</span>
                        <span style={{ color: colors.primary }}>{cartTotal.toLocaleString()} FCFA</span>
                      </div>
                      <button onClick={submitOrder} className="w-full py-4 rounded-xl font-bold text-lg" style={{ background: colors.primary, color: colors.cream }}>
                        Confirmer la commande
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

      // ============ ADMIN VIEW ============
      if (view === 'admin') {
        return (
          <div className="min-h-screen" style={{ background: colors.sand }}>
            {notification && (
              <div className="fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-2xl" style={{ background: notification.type === 'warning' ? colors.gold : colors.primary, color: colors.cream }}>
                {notification.msg}
              </div>
            )}

            {/* Sidebar */}
            <div className="fixed left-0 top-0 bottom-0 w-64 p-4 hidden lg:block" style={{ background: colors.primaryDark }}>
              <div className="flex items-center gap-3 mb-8 px-2">
                <div className="p-2 rounded-lg" style={{ background: colors.gold }}>
                  <ChefHat size={24} style={{ color: colors.primaryDark }} />
                </div>
                <div>
                  <h1 className="font-bold" style={{ color: colors.cream, fontFamily: 'serif' }}>Resto QR</h1>
                  <p className="text-xs" style={{ color: colors.sandDark }}>Admin Panel</p>
                </div>
              </div>
              <nav className="space-y-1">
                {[
                  { id: 'orders', icon: ShoppingCart, label: 'Commandes', badge: orders.filter(o => o.status === 'received').length },
                  { id: 'menu', icon: MenuIcon, label: 'Menu' },
                  { id: 'stock', icon: Package, label: 'Stock' },
                  { id: 'stats', icon: BarChart3, label: 'Statistiques' },
                  { id: 'tables', icon: QrCode, label: 'Tables & QR' },
                  { id: 'settings', icon: Settings, label: 'Paramètres' },
                ].map(item => (
                  <button key={item.id} onClick={() => setAdminTab(item.id)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all" style={{ background: adminTab === item.id ? colors.primary : 'transparent', color: colors.cream }}>
                    <div className="flex items-center gap-3">
                      <item.icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: colors.gold, color: colors.primaryDark }}>{item.badge}</span>
                    )}
                  </button>
                ))}
                <button onClick={() => navigate('landing')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mt-8" style={{ color: colors.sandDark }}>
                  <Home size={20} />
                  <span className="font-medium">Quitter</span>
                </button>
              </nav>
            </div>

            {/* Mobile header */}
            <div className="lg:hidden sticky top-0 z-30 p-4 flex items-center justify-between shadow-lg" style={{ background: colors.primaryDark }}>
              <div className="flex items-center gap-2">
                <ChefHat size={24} style={{ color: colors.gold }} />
                <span className="font-bold" style={{ color: colors.cream }}>Admin</span>
              </div>
              <select value={adminTab} onChange={e => setAdminTab(e.target.value)} className="px-3 py-2 rounded-lg" style={{ background: colors.primary, color: colors.cream, border: 'none' }}>
                <option value="orders">Commandes</option>
                <option value="menu">Menu</option>
                <option value="stock">Stock</option>
                <option value="stats">Statistiques</option>
                <option value="tables">Tables & QR</option>
                <option value="settings">Paramètres</option>
              </select>
            </div>

            <div className="lg:ml-64 p-4 lg:p-8">
              {/* ORDERS TAB */}
              {adminTab === 'orders' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Commandes en cours</h2>
                    <p style={{ color: colors.textLight }}>Gérez les commandes en temps réel</p>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders.map(order => {
                      const statusConfig = {
                        received: { color: colors.gold, label: 'Reçue', icon: Bell },
                        preparing: { color: colors.primaryLight, label: 'En préparation', icon: ChefHat },
                        ready: { color: '#5C8A4A', label: 'Prête', icon: CheckCircle },
                        served: { color: colors.textLight, label: 'Servie', icon: Utensils },
                      };
                      const config = statusConfig[order.status];
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
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {order.status === 'received' && (
                              <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: colors.primary, color: colors.cream }}>Commencer</button>
                            )}
                            {order.status === 'preparing' && (
                              <button onClick={() => updateOrderStatus(order.id, 'ready')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: colors.primary, color: colors.cream }}>Marquer prête</button>
                            )}
                            {order.status === 'ready' && (
                              <button onClick={() => updateOrderStatus(order.id, 'served')} className="col-span-2 py-2 rounded-lg text-sm font-medium" style={{ background: colors.primary, color: colors.cream }}>Servie</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MENU TAB */}
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
                        <div className="h-32 flex items-center justify-center text-7xl" style={{ background: colors.sand }}>{dish.image}</div>
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-bold" style={{ color: colors.text }}>{dish.name}</h3>
                            <span className="font-bold text-sm" style={{ color: colors.primary }}>{dish.price.toLocaleString()}</span>
                          </div>
                          <p className="text-xs mb-3 line-clamp-2" style={{ color: colors.textLight }}>{dish.description}</p>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs px-2 py-1 rounded" style={{ background: colors.sand, color: colors.text }}>Stock: {dish.stock}</span>
                            <span className="text-xs px-2 py-1 rounded" style={{ background: dish.available ? '#5C8A4A20' : colors.sandDark, color: dish.available ? '#5C8A4A' : colors.textLight }}>{dish.available ? 'Disponible' : 'Épuisé'}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => setEditingDish(dish)} className="py-2 rounded-lg text-xs font-medium" style={{ background: colors.sand, color: colors.text }}>
                              <Edit size={16} className="mx-auto" />
                            </button>
                            <button onClick={() => toggleDishAvailability(dish.id)} className="py-2 rounded-lg text-xs font-medium" style={{ background: colors.gold + '40', color: colors.text }}>
                              {dish.available ? <EyeOff size={16} className="mx-auto" /> : <Eye size={16} className="mx-auto" />}
                            </button>
                            <button onClick={() => deleteDish(dish.id)} className="py-2 rounded-lg text-xs font-medium" style={{ background: '#EFD9D9', color: colors.primary }}>
                              <Trash2 size={16} className="mx-auto" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STOCK TAB */}
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
                          <th className="text-left px-4 py-3 text-sm font-medium hidden md:table-cell" style={{ color: colors.text }}>Catégorie</th>
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
                                  <span className="text-2xl">{dish.image}</span>
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
                                  <button onClick={() => setDishes(dishes.map(d => d.id === dish.id ? { ...d, stock: Math.max(0, d.stock - 1) } : d))} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: colors.sand }}>
                                    <Minus size={12} style={{ color: colors.text }} />
                                  </button>
                                  <button onClick={() => setDishes(dishes.map(d => d.id === dish.id ? { ...d, stock: d.stock + 1 } : d))} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: colors.primary }}>
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

              {/* STATS TAB */}
              {adminTab === 'stats' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Statistiques</h2>
                    <p style={{ color: colors.textLight }}>Vue d'ensemble de votre activité</p>
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
                        {dishes.slice(0, 5).sort((a, b) => b.rating - a.rating).map((dish, i) => (
                          <div key={dish.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: i === 0 ? colors.gold : colors.sand, color: i === 0 ? colors.primaryDark : colors.text }}>{i + 1}</div>
                            <span className="text-2xl">{dish.image}</span>
                            <div className="flex-1">
                              <p className="font-medium text-sm" style={{ color: colors.text }}>{dish.name}</p>
                              <div className="flex items-center gap-1">
                                <Star size={12} className="fill-current" style={{ color: colors.gold }} />
                                <span className="text-xs" style={{ color: colors.textLight }}>{dish.rating}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                      <h3 className="font-bold mb-4" style={{ color: colors.text }}>Heures de pointe</h3>
                      <div className="space-y-2">
                        {[
                          { hour: '11h-12h', val: 30 },
                          { hour: '12h-13h', val: 85 },
                          { hour: '13h-14h', val: 70 },
                          { hour: '14h-15h', val: 25 },
                          { hour: '19h-20h', val: 60 },
                          { hour: '20h-21h', val: 90 },
                          { hour: '21h-22h', val: 50 },
                        ].map((h, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs w-14" style={{ color: colors.textLight }}>{h.hour}</span>
                            <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: colors.sand }}>
                              <div className="h-full rounded transition-all" style={{ width: `${h.val}%`, background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryLight})` }}></div>
                            </div>
                            <span className="text-xs font-medium w-8 text-right" style={{ color: colors.text }}>{h.val}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLES & QR TAB */}
              {adminTab === 'tables' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Tables & QR Codes</h2>
                    <p style={{ color: colors.textLight }}>Générez et imprimez les QR codes pour chaque table</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                      <div key={num} className="rounded-2xl p-4 shadow-md text-center" style={{ background: 'white' }}>
                        <div className="w-full aspect-square rounded-xl flex items-center justify-center mb-3" style={{ background: colors.sand }}>
                          <QrCode size={80} style={{ color: colors.primary }} />
                        </div>
                        <h3 className="font-bold mb-2" style={{ color: colors.text }}>Table {num}</h3>
                        <button className="w-full py-2 rounded-lg text-xs font-medium" style={{ background: colors.primary, color: colors.cream }}>Imprimer</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {adminTab === 'settings' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>Paramètres</h2>
                    <p style={{ color: colors.textLight }}>Configurez votre restaurant</p>
                  </div>
                  <div className="space-y-4 max-w-2xl">
                    <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                      <h3 className="font-bold mb-4" style={{ color: colors.text }}>Informations du restaurant</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Nom du restaurant</label>
                          <input type="text" defaultValue="Le Bistrot Royal" className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Adresse</label>
                          <input type="text" defaultValue="Cocody, Abidjan" className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Téléphone</label>
                            <input type="tel" defaultValue="+225 07 00 00 00 00" className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Devise</label>
                            <select className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }}>
                              <option>FCFA</option>
                              <option>EUR</option>
                              <option>USD</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl p-6 shadow-md" style={{ background: 'white' }}>
                      <h3 className="font-bold mb-4" style={{ color: colors.text }}>Modes de paiement</h3>
                      <div className="space-y-2">
                        {['Espèces', 'Mobile Money (Orange, MTN, Moov)', 'Carte bancaire', 'Wave'].map(method => (
                          <label key={method} className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" defaultChecked className="w-5 h-5" />
                            <span style={{ color: colors.text }}>{method}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button className="px-6 py-3 rounded-lg font-bold flex items-center gap-2" style={{ background: colors.primary, color: colors.cream }}>
                      <Save size={20} /> Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add/Edit Dish Modal */}
            {(showAddDish || editingDish) && (
              <DishModal
                dish={editingDish || { name: '', description: '', price: 0, category: 'plats', image: '🍽️', stock: 0, available: true, veg: false, glutenFree: false, spicy: false, prepTime: 15 }}
                onSave={saveDish}
                onClose={() => { setEditingDish(null); setShowAddDish(false); }}
                colors={colors}
              />
            )}
          </div>
        );
      }

      return null;
    }
export default RestoQRApp;


