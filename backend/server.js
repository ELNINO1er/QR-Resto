import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import swaggerUiDist from 'swagger-ui-dist';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes, { setBroadcast } from './routes/orders.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/users.js';
import restaurantRoutes from './routes/restaurants.js';
import maintenanceRoutes, { scheduleAutomaticBackups } from './routes/maintenance.js';
import { verifyToken } from './middleware/auth.js';
import { openApiSpec } from './openapi.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath();

function isPrivateHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('192.168.')
    || hostname.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function getAllowedOrigins() {
  return (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) return callback(null, true);

    if (process.env.NODE_ENV !== 'production') {
      try {
        if (isPrivateHost(new URL(origin).hostname)) return callback(null, true);
      } catch {
        return callback(new Error('CORS origin invalide'));
      }
    }

    return callback(new Error('Origine non autorisee'));
  },
}));
app.use(express.json({ limit: '6mb' }));
app.use('/api/docs-assets', express.static(swaggerUiPath));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/api/docs', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Resto API Docs</title>
  <link rel="stylesheet" href="/api/docs-assets/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs-assets/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`);
});

// WebSocket
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

// Fix 7: Accept WS connections without token in query string.
// Auth is done via the first message: { type: "auth", token: "..." }
// Also supports legacy query string token for backwards compat.
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/ws') return;

  const legacyToken = url.searchParams.get('token');
  let authenticated = false;
  if (legacyToken) {
    try {
      const payload = verifyToken(legacyToken);
      ws._restaurantId = payload.restaurantId || 1;
      ws._role = payload.role;
      authenticated = true;
    } catch {
      // Will require first-message auth
    }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws._authenticated = authenticated;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  if (ws._authenticated) {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);
  }

  let authTimeout = null;
  if (!ws._authenticated) {
    authTimeout = setTimeout(() => {
      if (!ws._authenticated) ws.close(4001, 'Auth timeout');
    }, 5000);
  }

  ws.on('message', (raw) => {
    if (ws._authenticated) return;
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'auth' && msg.token) {
        const payload = verifyToken(msg.token);
        ws._authenticated = true;
        ws._role = payload.role;
        ws._restaurantId = payload.role === 'superadmin'
          ? Number(msg.restaurantId || payload.restaurantId || 1)
          : (payload.restaurantId || 1);
        clearTimeout(authTimeout);
        clients.add(ws);
        console.log(`[WS] Client authenticated (${clients.size} total)`);
        ws.send(JSON.stringify({ type: 'AUTH_OK' }));
      } else {
        ws.close(4003, 'Invalid auth message');
      }
    } catch {
      ws.close(4003, 'Auth failed');
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimeout);
    clients.delete(ws);
  });
  ws.on('error', () => {
    clearTimeout(authTimeout);
    clients.delete(ws);
  });
});

setBroadcast((data) => {
  const msg = JSON.stringify(data);
  const restaurantId = data.order?.restaurantId;
  for (const c of clients) {
    if (c.readyState !== 1) continue;
    if (!restaurantId || c._restaurantId === restaurantId) c.send(msg);
  }
});

// Start
async function start() {
  await initDb();
  if (process.env.NODE_ENV !== 'test') scheduleAutomaticBackups();
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
