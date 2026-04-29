import React, { useState, useCallback } from 'react';
import { colors } from '../lib/colors';

let showNotifFn = null;

export function useNotification() {
  const [notification, setNotification] = useState(null);

  const showNotif = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  showNotifFn = showNotif;

  return { notification, showNotif };
}

export function showGlobalNotif(msg, type = 'success') {
  if (showNotifFn) showNotifFn(msg, type);
}

export function NotificationBanner({ notification }) {
  if (!notification) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl animate-bounce"
      style={{ background: notification.type === 'warning' ? colors.gold : colors.primary, color: colors.cream }}>
      {notification.msg}
    </div>
  );
}
