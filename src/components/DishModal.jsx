import React, { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { colors } from '../lib/colors';
import DishImage from './DishImage';
import Dropdown from './Dropdown';

const imagePresets = ['plat', 'soupe', 'salade', 'dessert', 'boisson', 'pizza', 'riz', 'poulet'];

const allergens = [
  ['gluten', 'Gluten'], ['crustaces', 'Crustaces'], ['oeufs', 'Oeufs'], ['poisson', 'Poisson'],
  ['arachides', 'Arachides'], ['soja', 'Soja'], ['lait', 'Lait'], ['fruits_a_coque', 'Fruits a coque'],
  ['celeri', 'Celeri'], ['moutarde', 'Moutarde'], ['sesame', 'Sesame'], ['sulfites', 'Sulfites'],
  ['lupin', 'Lupin'], ['mollusques', 'Mollusques'],
];

export default function DishModal({ dish, onSave, onClose }) {
  const [form, setForm] = useState({ allergens: [], availableFrom: '', availableUntil: '', ...dish });
  const [imageError, setImageError] = useState('');

  const toggleAllergen = (key) => {
    const current = Array.isArray(form.allergens) ? form.allergens : [];
    setForm({ ...form, allergens: current.includes(key) ? current.filter(a => a !== key) : [...current, key] });
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Choisissez un fichier image');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageError('Image trop lourde: maximum 3 Mo');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm({ ...form, image: reader.result });
      setImageError('');
    };
    reader.onerror = () => setImageError('Lecture image impossible');
    reader.readAsDataURL(file);
  };

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
            <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Description</label>
            <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows="2" className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Image du plat</label>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0" style={{ background: colors.sand }}>
                <DishImage value={form.image} emojiClassName="text-2xl" rounded="rounded-lg" />
              </div>
              <div className="flex-1">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer" style={{ background: colors.primary, color: colors.cream }}>
                  <ImagePlus size={18} /> Charger une photo
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <p className="text-xs mt-2" style={{ color: colors.textLight }}>JPG, PNG ou WebP, 3 Mo maximum.</p>
                {imageError && <p className="text-xs mt-1" style={{ color: colors.primary }}>{imageError}</p>}
              </div>
            </div>
            <div className="flex gap-1 flex-wrap p-2 rounded-lg" style={{ background: 'white' }}>
              {imagePresets.map(value => (
                <button key={value} onClick={() => setForm({ ...form, image: value })} className="text-xs px-2 py-1 rounded" style={{ background: colors.sand, color: colors.text }}>{value}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Prix (FCFA)</label>
              <input type="number" value={form.price || 0} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Stock</label>
              <input type="number" value={form.stock || 0} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Categorie</label>
              <Dropdown
                value={form.category}
                onChange={category => setForm({ ...form, category })}
                options={[
                  { value: 'entrees', label: 'Entrees' },
                  { value: 'plats', label: 'Plats' },
                  { value: 'desserts', label: 'Desserts' },
                  { value: 'boissons', label: 'Boissons' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Temps prep (min)</label>
              <input type="number" value={form.prepTime || 15} onChange={e => setForm({ ...form, prepTime: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: colors.text }}>Caracteristiques</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'veg', label: 'Vegetarien' },
                { key: 'glutenFree', label: 'Sans gluten' },
                { key: 'spicy', label: 'Epice' },
                { key: 'available', label: 'Disponible' },
              ].map(f => (
                <button key={f.key} onClick={() => setForm({ ...form, [f.key]: !form[f.key] })} className="px-3 py-1 rounded-full text-sm" style={{ background: form[f.key] ? colors.primary : colors.sand, color: form[f.key] ? colors.cream : colors.text }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>Allergenes</p>
            <div className="flex gap-2 flex-wrap">
              {allergens.map(([key, label]) => (
                <button key={key} onClick={() => toggleAllergen(key)} className="px-3 py-1 rounded-full text-sm" style={{ background: form.allergens?.includes(key) ? '#FFF3E0' : colors.sand, color: form.allergens?.includes(key) ? '#E65100' : colors.text }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Disponible de</label>
              <input type="time" value={form.availableFrom || ''} onChange={e => setForm({ ...form, availableFrom: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Disponible jusqu'a</label>
              <input type="time" value={form.availableUntil || ''} onChange={e => setForm({ ...form, availableUntil: e.target.value })} className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: 'white' }} />
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
