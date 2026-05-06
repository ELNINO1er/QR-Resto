let socket = null;
let listeners = new Set();
let reconnectTimer = null;
let manuallyClosed = false;

// Fix 7: No longer send token in URL query string (leaked in logs).
// Auth is done via first message after connection.
function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function connectWs() {
  const token = localStorage.getItem('token');
  if (!token) return;
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

  try {
    manuallyClosed = false;
    clearTimeout(reconnectTimer);
    socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
      const currentToken = localStorage.getItem('token');
      const restaurantId = localStorage.getItem('activeRestaurantId');
      if (currentToken) socket.send(JSON.stringify({ type: 'auth', token: currentToken, restaurantId }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'AUTH_OK') return;
        for (const listener of listeners) listener(data);
      } catch {}
    };

    socket.onclose = () => {
      socket = null;
      clearTimeout(reconnectTimer);
      if (!manuallyClosed && listeners.size > 0) {
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    };

    socket.onerror = () => {
      socket?.close();
    };
  } catch {}
}

export function onWsMessage(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function disconnectWs() {
  manuallyClosed = true;
  clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
}
