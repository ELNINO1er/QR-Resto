// Browser push notification helper (no paid service needed)

let permissionGranted = false;

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function sendNotification(title, options = {}) {
  if (!canNotify()) return null;
  // Don't notify if the tab is focused
  if (document.visibilityState === 'visible') return null;
  return new Notification(title, {
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    vibrate: [200, 100, 200],
    ...options,
  });
}
