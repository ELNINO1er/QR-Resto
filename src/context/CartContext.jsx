import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState(null);

  const addToCart = (dish) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === dish.id);
      if (existing) {
        return prev.map(i => i.id === dish.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: dish.id, name: dish.name, price: dish.price, image: dish.image, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)
    );
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{ cart, tableNumber, setTableNumber, addToCart, updateQty, removeFromCart, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
