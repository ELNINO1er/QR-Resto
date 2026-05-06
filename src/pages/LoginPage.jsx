import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Eye, EyeOff } from 'lucide-react';
import { colors } from '../lib/colors';
import { useAuth } from '../context/AuthContext';

function dashboardPathForRole(role) {
  if (role === 'cuisine') return '/kitchen';
  if (role === 'serveur') return '/server';
  return '/admin';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)` }}>
      <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl" style={{ background: colors.cream }}>
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-xl mb-4" style={{ background: colors.primary }}>
            <ChefHat size={32} style={{ color: colors.gold }} />
          </div>
          <h2 className="text-2xl font-bold" style={{ color: colors.text }}>Connexion personnel</h2>
          <p className="text-sm mt-2" style={{ color: colors.textLight }}>Admin, cuisine, serveur et caisse</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm text-center" style={{ background: '#EFD9D9', color: colors.primary }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@resto.ci" className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none" style={{ borderColor: colors.sandDark, background: colors.sand }} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Mot de passe</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none pr-12" style={{ borderColor: colors.sandDark, background: colors.sand }} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff size={20} style={{ color: colors.textLight }} /> : <Eye size={20} style={{ color: colors.textLight }} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-bold transition-all hover:opacity-90 disabled:opacity-50" style={{ background: colors.primary, color: colors.cream }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
