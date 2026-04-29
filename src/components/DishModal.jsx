import React, { useState } from 'react';
import { X } from 'lucide-react';
import { colors } from '../lib/colors';

const emojis = ['🍽️','🍲','🥗','🍰','🥤','🍔','🍕','🍣','🍜','🌮','🍛','🍗','🥘','🍱','🍝','🥙','🌯','🍤','🍩','🍪','🍫','🍦','🥐','🥖','🍟','🌭','🥨','🥯','🧀','🥩','🥓','🍳','🥚','🍞','🥞','🧇','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🥝','🥥','🍅','🥑','🥒','🥬','🥦','🥕','🌽','🌶️','🥔','🍠'];

export default function DishModal({ dish, onSave, onClose }) {
  const [form, setForm] = useState(dish);

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
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Categorie</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }}>
                <option value="entrees">Entrees</option>
                <option value="plats">Plats</option>
                <option value="desserts">Desserts</option>
                <option value="boissons">Boissons</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Temps prep (min)</label>
              <input type="number" value={form.prepTime} onChange={e => setForm({ ...form, prepTime: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: colors.text }}>Caracteristiques</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'veg', label: '🌱 Vegetarien' },
                { key: 'glutenFree', label: '🌾 Sans gluten' },
                { key: 'spicy', label: '🌶️ Epice' },
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
