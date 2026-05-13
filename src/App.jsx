import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import MenuPage from './pages/MenuPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import KitchenPage from './pages/KitchenPage';
import ServerPage from './pages/ServerPage';
import ReservationPage from './pages/ReservationPage';

function TableRedirect() {
  const { table } = useParams();
  const location = useLocation();
  const suffix = location.search ? `&${location.search.slice(1)}` : '';
  return <Navigate to={`/menu?table=${table}${suffix}`} replace />;
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5EFE6' }}>
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🍽️</div>
          <p style={{ color: '#6B5444' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/admin" replace />;
  return children;
}

function dashboardPathForRole(role) {
  if (role === 'cuisine') return '/kitchen';
  if (role === 'serveur') return '/server';
  return '/admin';
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/reservation" element={<ReservationPage />} />
      <Route path="/t/:table" element={<TableRedirect />} />
      <Route path="/login" element={user ? <Navigate to={dashboardPathForRole(user.role)} replace /> : <LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/kitchen" element={<ProtectedRoute roles={['superadmin', 'admin', 'cuisine']}><KitchenPage /></ProtectedRoute>} />
      <Route path="/server" element={<ProtectedRoute roles={['superadmin', 'admin', 'serveur']}><ServerPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
