import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import MenuPage from './pages/MenuPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import KitchenPage from './pages/KitchenPage';

function ProtectedRoute({ children }) {
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
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/kitchen" element={<ProtectedRoute><KitchenPage /></ProtectedRoute>} />
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
