let socket = null;
let listeners = new Set();
let reconnectTimer = null;

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = localStorage.getItem('token');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${proto}//${window.location.host}/ws${query}`;
}

export function connectWs() {
  if (socket?.readyState === WebSocket.OPEN) return;

  try {
    socket = new WebSocket(getWsUrl());

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        for (const listener of listeners) listener(data);
      } catch {}
    };

    socket.onclose = () => {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWs, 3000);
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
  clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
}
