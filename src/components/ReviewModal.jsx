import React, { useState } from 'react';
import { Star, X, Send } from 'lucide-react';
import { colors } from '../lib/colors';
import { submitReview } from '../lib/api';

export default function ReviewModal({ order, onClose, onSubmitted }) {
  const [ratings, setRatings] = useState(
    order.items.map(item => ({ dishId: item.dishId, name: item.name, rating: 0, comment: '' }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setRating = (index, rating) => {
    setRatings(prev => prev.map((r, i) => i === index ? { ...r, rating } : r));
  };

  const setComment = (index, comment) => {
    setRatings(prev => prev.map((r, i) => i === index ? { ...r, comment } : r));
  };

  const handleSubmit = async () => {
    const validRatings = ratings.filter(r => r.rating > 0);
    if (validRatings.length === 0) {
      setError('Veuillez noter au moins un plat');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitReview(order.id, order.table, validRatings);
      onSubmitted();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl" style={{ background: colors.cream }}>
        <div className="sticky top-0 px-6 py-4 flex items-center justify-between border-b" style={{ background: colors.cream, borderColor: colors.sandDark }}>
          <h2 className="text-lg font-bold" style={{ color: colors.text }}>Notez votre repas</h2>
          <button onClick={onClose}><X size={22} style={{ color: colors.textLight }} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm" style={{ color: colors.textLight }}>Votre avis nous aide a nous ameliorer !</p>

          {ratings.map((item, index) => (
            <div key={index} className="rounded-xl p-4" style={{ background: 'white' }}>
              <p className="font-medium mb-2" style={{ color: colors.text }}>{item.name}</p>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(index, star)} className="p-1 transition-transform hover:scale-110">
                    <Star
                      size={28}
                      style={{ color: star <= item.rating ? colors.gold : colors.sandDark }}
                      className={star <= item.rating ? 'fill-current' : ''}
                    />
                  </button>
                ))}
              </div>
              {item.rating > 0 && (
                <input
                  type="text"
                  value={item.comment}
                  onChange={e => setComment(index, e.target.value)}
                  placeholder="Un commentaire ? (optionnel)"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: colors.sandDark }}
                  maxLength={500}
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-center" style={{ color: '#d32f2f' }}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: colors.primary, color: colors.cream }}
          >
            <Send size={18} />
            {submitting ? 'Envoi...' : 'Envoyer mon avis'}
          </button>
        </div>
      </div>
    </div>
  );
}
