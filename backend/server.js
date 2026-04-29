import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes, { setBroadcast } from './routes/orders.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/users.js';
import { verifyToken } from './middleware/auth.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// WebSocket
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/ws') return;

  try {
    const token = url.searchParams.get('token');
    if (!token) throw new Error('Missing token');
    verifyToken(token);
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);
  ws.on('close', () => { clients.delete(ws); });
  ws.on('error', () => { clients.delete(ws); });
});

setBroadcast((data) => {
  const msg = JSON.stringify(data);
  for (const c of clients) {
    if (c.readyState === 1) c.send(msg);
  }
});

// Start
async function start() {
  await initDb();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Resto QR Backend`);
    console.log(`  -> http://localhost:${PORT}`);
    console.log(`  -> WebSocket: ws://localhost:${PORT}/ws`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch(console.error);
}

export { app, server, start };
