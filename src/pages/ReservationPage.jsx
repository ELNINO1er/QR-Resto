import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Clock, Users, CheckCircle, ArrowLeft } from 'lucide-react';
import { colors } from '../lib/colors';
import { getReservationSlots, createReservation, getPublicSettings } from '../lib/api';

export default function ReservationPage() {
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') || '1';

  const [restaurantName, setRestaurantName] = useState('Resto QR');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicSettings(restaurantId)
      .then(s => { if (s.restaurant_name) setRestaurantName(s.restaurant_name); })
      .catch(() => {});
  }, [restaurantId]);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setDate(tomorrow);
  }, []);

  useEffect(() => {
    if (!date) return;
    getReservationSlots(date, restaurantId)
      .then(data => setSlots(data.slots || []))
      .catch(() => setSlots([]));
  }, [date, restaurantId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !date || !selectedSlot) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createReservation({
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        date,
        timeSlot: selectedSlot,
        partySize,
        notes,
        restaurantId,
      });
      setSuccess(result);
    } catch (err) {
      setError(err.message || 'Erreur lors de la reservation');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` }}>
        <div className="w-full max-w-md rounded-2xl p-8 text-center" style={{ background: colors.cream }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#5C8A4A20' }}>
            <CheckCircle size={32} style={{ color: '#5C8A4A' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: colors.text }}>Reservation confirmee !</h2>
          <p className="mb-4" style={{ color: colors.textLight }}>Numero de reservation: <strong>#{success.id}</strong></p>
          <div className="rounded-xl p-4 mb-6 text-left" style={{ background: colors.sand }}>
            <p><strong>Date:</strong> {date}</p>
            <p><strong>Heure:</strong> {selectedSlot}</p>
            <p><strong>Personnes:</strong> {partySize}</p>
            <p><strong>Nom:</strong> {name}</p>
          </div>
          <button onClick={() => { setSuccess(null); setName(''); setPhone(''); setEmail(''); setNotes(''); setSelectedSlot(''); }} className="w-full py-3 rounded-xl font-bold" style={{ background: colors.primary, color: colors.cream }}>
            Nouvelle reservation
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` }}>
      <div className="w-full max-w-lg mx-auto">
        <a href={`/menu?restaurantId=${restaurantId}`} className="flex items-center gap-2 mb-6 text-sm" style={{ color: colors.gold }}>
          <ArrowLeft size={16} /> Retour au menu
        </a>

        <div className="rounded-2xl p-6 shadow-2xl" style={{ background: colors.cream }}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🍽️</div>
            <h1 className="text-2xl font-bold" style={{ color: colors.text, fontFamily: 'serif' }}>{restaurantName}</h1>
            <p style={{ color: colors.textLight }}>Reservez votre table</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
                <Calendar size={14} className="inline mr-1" /> Date
              </label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={today} className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark }} />
            </div>

            {/* Time Slot */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                <Clock size={14} className="inline mr-1" /> Creneau horaire
              </label>
              <div className="grid grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.time)}
                    className="py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
                    style={{
                      background: selectedSlot === slot.time ? colors.primary : 'white',
                      color: selectedSlot === slot.time ? colors.cream : colors.text,
                      border: `1px solid ${colors.sandDark}`,
                    }}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>

            {/* Party Size */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
                <Users size={14} className="inline mr-1" /> Nombre de personnes
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: colors.sand }}>-</button>
                <span className="text-2xl font-bold w-10 text-center" style={{ color: colors.primary }}>{partySize}</span>
                <button type="button" onClick={() => setPartySize(Math.min(20, partySize + 1))} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: colors.primary, color: colors.cream }}>+</button>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Nom *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom" required className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Telephone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00" className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, occasion speciale..." className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none" style={{ borderColor: colors.sandDark }} rows={2} />
            </div>

            {error && <p className="text-sm text-center" style={{ color: '#d32f2f' }}>{error}</p>}

            <button type="submit" disabled={loading || !selectedSlot} className="w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50" style={{ background: colors.primary, color: colors.cream }}>
              {loading ? 'Reservation en cours...' : 'Confirmer la reservation'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
