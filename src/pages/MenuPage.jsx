import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ShoppingCart, Plus, Minus, X, Search, Filter, Star, Clock, ArrowLeft, QrCode, CheckCircle } from 'lucide-react';
import { colors } from '../lib/colors';
import { useCart } from '../context/CartContext';
import { getMenu, createOrder, getPublicSettings, getNetworkInfo, getPublicOrder } from '../lib/api';
import { NotificationBanner, useNotification } from '../components/Notification';
import DishImage from '../components/DishImage';
import Dropdown from '../components/Dropdown';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const categories = [
  { id: 'all', name: 'Tout', icon: '🍽️' },
  { id: 'entrees', name: 'Entrees', icon: '🥗' },
  { id: 'plats', name: 'Plats', icon: '🍲' },
  { id: 'desserts', name: 'Desserts', icon: '🍰' },
  { id: 'boissons', name: 'Boissons', icon: '🥤' },
];

export default function MenuPage() {
  const [searchParams] = useSearchParams();
  const { cart, tableNumber, setTableNumber, addToCart, updateQty, cartTotal, cartCount, clearCart } = useCart();
  const { notification, showNotif } = useNotification();
  const restaurantId = searchParams.get('restaurantId') || '1';

  const [dishes, setDishes] = useState([]);
  const [restaurantName, setRestaurantName] = useState('Resto QR');
  const [publicSettings, setPublicSettings] = useState({});
  const [tablesCount, setTablesCount] = useState(12);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ veg: false, glutenFree: false, spicy: false });
  const [showCart, setShowCart] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTable, setSelectedTable] = useState(1);
  const [qrOrigin, setQrOrigin] = useState(window.location.origin);
  const [tableQr, setTableQr] = useState('');
  const [lastOrder, setLastOrder] = useState(null);

  // Get table number from URL
  useEffect(() => {
    const table = searchParams.get('table');
    if (table) {
      const num = parseInt(table);
      if (num > 0) {
        setTableNumber(num);
        localStorage.setItem('table', String(num));
      }
    } else {
      setTableNumber(null);
    }
  }, [searchParams, setTableNumber]);

  // Load menu + settings
  useEffect(() => {
    Promise.all([getMenu(false, restaurantId), getPublicSettings(restaurantId)])
      .then(([menuData, settings]) => {
        setDishes(menuData);
        setPublicSettings(settings);
        if (settings.restaurant_name) setRestaurantName(settings.restaurant_name);
        if (settings.tables_count) setTablesCount(parseInt(settings.tables_count));
      })
      .catch(() => showNotif('Erreur de chargement du menu', 'warning'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    getNetworkInfo(restaurantId)
      .then(info => {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        setQrOrigin(isLocalhost && info.origin ? info.origin : window.location.origin);
      })
      .catch(() => {});
  }, [restaurantId]);

  useEffect(() => {
    const url = `${qrOrigin}/t/${selectedTable}?restaurantId=${restaurantId}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: colors.primaryDark, light: '#FFFFFF' },
    }).then(setTableQr).catch(() => setTableQr(''));
  }, [qrOrigin, restaurantId, selectedTable]);

  useEffect(() => {
    if (!lastOrder?.id || !tableNumber) return;

    const refresh = () => {
      getPublicOrder(lastOrder.id, tableNumber)
        .then(setLastOrder)
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [lastOrder?.id, tableNumber]);

  const filteredDishes = dishes.filter(d => {
    if (d.visible === false) return false;
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filters.veg && !d.veg) return false;
    if (filters.glutenFree && !d.glutenFree) return false;
    if (filters.spicy && !d.spicy) return false;
    return true;
  });

  const handleAddToCart = (dish) => {
    addToCart(dish);
    showNotif(`${dish.name} ajoute au panier`);
  };

  const submitOrder = async () => {
    if (!tableNumber) {
      showNotif('Numero de table manquant', 'warning');
      return;
    }
    const declaredCash = cashAmount !== '' ? Math.floor(Number(cashAmount)) : null;
    setSubmitting(true);
    try {
      const order = await createOrder({
        table: tableNumber,
        items: cart.map(i => ({ dishId: i.id, name: i.name, quantity: i.qty, price: i.price })),
        notes: orderNotes,
        restaurantId,
        ...(declaredCash != null ? { cashAmount: declaredCash } : {}),
      });
      setLastOrder(order);
      clearCart();
      setOrderNotes('');
      setCashAmount('');
      setShowCart(false);
      showNotif('Commande envoyee avec succes !');
    } catch {
      showNotif('Erreur lors de l\'envoi', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = (order) => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return;
    const currency = publicSettings.currency || 'FCFA';
    const thankYou = publicSettings.receipt_thank_you || 'Merci pour votre visite et a bientot.';
    const paidLabel = order.paymentStatus === 'paid' ? 'Paye' : order.paymentStatus === 'refunded' ? 'Rembourse' : 'Non paye';
    win.document.write(`
      <html><head><title>Facture ${order.id}</title>
      <style>body{font-family:Arial;padding:18px;color:#111}.center{text-align:center} h1{font-size:22px;margin:0 0 4px}.muted{color:#555;font-size:12px}.row{display:flex;justify-content:space-between;gap:12px;margin:6px 0}.total{font-weight:bold;border-top:1px solid #000;padding-top:8px;margin-top:8px}.thanks{border-top:1px dashed #999;margin-top:14px;padding-top:10px;text-align:center;font-size:13px}</style>
      </head><body>
      <div class="center">
        <h1>${escapeHtml(restaurantName)}</h1>
        ${publicSettings.address ? `<div class="muted">${escapeHtml(publicSettings.address)}</div>` : ''}
        ${publicSettings.phone ? `<div class="muted">${escapeHtml(publicSettings.phone)}</div>` : ''}
      </div>
      <p><strong>Facture #${order.id}</strong><br><span class="muted">Table ${order.table} - ${escapeHtml(order.time || '')} - ${paidLabel}</span></p>
      ${order.items.map(i => `<div class="row"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>${(i.qty * i.price).toLocaleString()} ${currency}</span></div>`).join('')}
      <div class="row total"><span>Total</span><span>${order.total.toLocaleString()} ${currency}</span></div>
      <div class="row"><span>Recu</span><span>${Number(order.amountPaid || 0).toLocaleString()} ${currency}</span></div>
      <div class="row"><span>Monnaie</span><span>${Number(order.changeDue || 0).toLocaleString()} ${currency}</span></div>
      <div class="thanks">${escapeHtml(thankYou)}</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.cream }}>
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🍽️</div>
          <p style={{ color: colors.textLight }}>Chargement du menu...</p>
        </div>
      </div>
    );
  }

  // Table selection screen when no table number
  if (!tableNumber) {
    const selectTable = (num) => {
      setTableNumber(num);
      localStorage.setItem('table', String(num));
    };
    const tableOptions = Array.from({ length: tablesCount }, (_, i) => i + 1);
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` }}>
        <div className="w-full max-w-5xl grid lg:grid-cols-[1fr_420px] gap-6 items-stretch">
          <section className="rounded-2xl p-8 lg:p-10 flex flex-col justify-between" style={{ background: colors.cream }}>
            <div>
              <div className="text-6xl mb-5">🍽️</div>
              <h1 className="text-3xl lg:text-4xl font-bold mb-3" style={{ color: colors.text, fontFamily: 'serif' }}>{restaurantName}</h1>
              <p className="text-lg mb-8" style={{ color: colors.textLight }}>Scannez le QR code de votre table pour ouvrir directement le menu et commander.</p>
              <div className="rounded-xl p-4 mb-6" style={{ background: colors.sand }}>
                <div className="flex items-start gap-3">
                  <QrCode size={22} style={{ color: colors.primary }} />
                  <div>
                    <p className="font-bold" style={{ color: colors.text }}>Parcours recommande</p>
                    <p className="text-sm" style={{ color: colors.textLight }}>Chaque table a son QR code imprime. Le client scanne et arrive directement sur la bonne table.</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm" style={{ color: colors.textLight }}>Adresse QR exemple: {qrOrigin}/t/{selectedTable}?restaurantId={restaurantId}</p>
          </section>

          <section className="rounded-2xl p-6 shadow-2xl" style={{ background: colors.cream }}>
            <h2 className="text-xl font-bold mb-1" style={{ color: colors.text }}>Acces rapide</h2>
            <p className="text-sm mb-5" style={{ color: colors.textLight }}>Pour tester sans QR, choisissez une table.</p>

            <label className="block text-sm font-bold mb-2" style={{ color: colors.text }}>Table</label>
            <Dropdown
              value={selectedTable}
              onChange={setSelectedTable}
              options={tableOptions.map(num => ({ value: num, label: `Table ${num}` }))}
              className="mb-4"
              buttonStyle={{ minHeight: 58, fontSize: 18, fontWeight: 700 }}
            />

            <button onClick={() => selectTable(selectedTable)} className="w-full py-4 rounded-xl font-bold text-lg mb-6" style={{ background: colors.primary, color: colors.cream }}>
              Voir le menu de la table {selectedTable}
            </button>

            <div className="rounded-xl p-4 text-center" style={{ background: 'white' }}>
              <p className="font-bold mb-3" style={{ color: colors.text }}>QR code test</p>
              <div className="w-56 h-56 mx-auto rounded-xl flex items-center justify-center" style={{ background: colors.sand }}>
                {tableQr ? <img src={tableQr} alt={`QR table ${selectedTable}`} className="w-52 h-52 object-contain rounded-lg" /> : <QrCode size={96} style={{ color: colors.primary }} />}
              </div>
              <p className="text-xs mt-3 break-all" style={{ color: colors.textLight }}>{qrOrigin}/t/{selectedTable}?restaurantId={restaurantId}</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.cream }}>
      <NotificationBanner notification={notification} />

      {/* Header */}
      <div className="sticky top-0 z-40 shadow-lg" style={{ background: colors.primary }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => { setTableNumber(null); localStorage.removeItem('table'); }} className="flex items-center gap-1 text-sm" style={{ color: colors.gold }}>
            <ArrowLeft size={16} /> Tables
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold" style={{ color: colors.cream, fontFamily: 'serif' }}>{restaurantName}</h1>
            <p className="text-xs" style={{ color: colors.sandDark }}>Table {tableNumber}</p>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="px-4 py-4">
        {lastOrder && (
          <div className="mb-4 rounded-xl p-4 shadow-md" style={{ background: 'white' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm" style={{ color: colors.textLight }}>Commande #{lastOrder.id}</p>
                <h2 className="font-bold text-lg" style={{ color: colors.text }}>Suivi de votre commande</h2>
              </div>
              <button onClick={() => setLastOrder(null)} className="p-1"><X size={18} style={{ color: colors.textLight }} /></button>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[
                { key: 'pending', label: 'Recue' },
                { key: 'preparing', label: 'Preparation' },
                { key: 'ready', label: 'Prete' },
                { key: 'served', label: 'Servie' },
              ].map((step, index, steps) => {
                const orderIndex = steps.findIndex(s => s.key === lastOrder.status);
                const active = lastOrder.status === 'cancelled' ? false : index <= orderIndex;
                return (
                  <div key={step.key} className="rounded-lg px-2 py-2 text-center text-xs font-medium" style={{ background: active ? colors.primary : colors.sand, color: active ? colors.cream : colors.textLight }}>
                    {active && <CheckCircle size={14} className="mx-auto mb-1" />}
                    {step.label}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: colors.sand, color: colors.text }}>
              Especes annoncees: {Number(lastOrder.amountPaid || 0).toLocaleString()} FCFA. Monnaie prevue: {Number(lastOrder.changeDue || 0).toLocaleString()} FCFA.
            </div>
            {lastOrder.paymentStatus === 'paid' && (
              <button onClick={() => printReceipt(lastOrder)} className="mt-3 w-full py-3 rounded-lg font-bold" style={{ background: colors.primary, color: colors.cream }}>
                Imprimer la facture
              </button>
            )}
            {lastOrder.status === 'cancelled' && <p className="text-sm mt-3" style={{ color: colors.primary }}>Commande annulee. Contactez le personnel.</p>}
          </div>
        )}

        {/* Search & Filters */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textLight }} />
            <input type="text" placeholder="Rechercher un plat..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: colors.sand, color: colors.primary }}>
            <Filter size={16} /> Filtres {(filters.veg || filters.glutenFree || filters.spicy) && '•'}
          </button>
          {showFilters && (
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'veg', label: '🌱 Vegetarien' },
                { key: 'glutenFree', label: '🌾 Sans gluten' },
                { key: 'spicy', label: '🌶️ Epice' },
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
                <div className="w-28 h-28 flex-shrink-0 overflow-hidden" style={{ background: colors.sand }}>
                  <DishImage value={dish.image} emojiClassName="text-6xl" rounded="rounded-none" />
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
                      <button onClick={() => handleAddToCart(dish)} className="p-2 rounded-lg transition-all hover:scale-110" style={{ background: colors.primary }}>
                        <Plus size={16} style={{ color: colors.cream }} />
                      </button>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded" style={{ background: colors.sandDark, color: colors.textLight }}>Epuise</span>
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
              <button onClick={() => setShowCart(false)}><X size={24} style={{ color: colors.text }} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'white' }}>
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: colors.sand }}>
                    <DishImage value={item.image} emojiClassName="text-4xl" rounded="rounded-lg" />
                  </div>
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
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Notes speciales</label>
                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Sans oignons, bien cuit, allergies..." className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none text-sm" style={{ borderColor: colors.sandDark, background: 'white' }} rows="2" />
              </div>
              <div className="rounded-xl p-3" style={{ background: 'white' }}>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Je paie en especes avec</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                  placeholder={`${cartTotal.toLocaleString()} FCFA ou plus`}
                  className="w-full px-3 py-3 rounded-lg border-2 focus:outline-none"
                  style={{ borderColor: Number(cashAmount) >= cartTotal ? colors.sandDark : colors.primary, background: colors.cream }}
                />
                <div className="flex justify-between text-sm mt-2">
                  <span style={{ color: colors.textLight }}>Monnaie preparee par la caisse</span>
                  <strong style={{ color: Number(cashAmount) >= cartTotal ? '#5C8A4A' : colors.primary }}>
                    {Number(cashAmount) >= cartTotal ? `${(Number(cashAmount) - cartTotal).toLocaleString()} FCFA` : 'Montant insuffisant'}
                  </strong>
                </div>
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
                <button onClick={submitOrder} disabled={submitting} className="w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50" style={{ background: colors.primary, color: colors.cream }}>
                  {submitting ? 'Envoi en cours...' : 'Confirmer la commande'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
