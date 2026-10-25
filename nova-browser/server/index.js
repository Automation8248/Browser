import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

import { config } from './config.js';
import { router as authRouter, verifyToken, verifyJwt } from './auth.js';
import { registerStreamHandlers } from './streaming.js';
import { router as filesRouter } from './files.js';
import { setupProxy } from './proxy.js';
import { loadTabs, saveTabs, loadBookmarks, saveBookmarks, wipeProfile } from './session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Auth (public)
app.use('/api/auth', authRouter);

// Protected API
app.use('/api/files', verifyToken, filesRouter);
setupProxy(app);

// Session endpoints
app.get('/api/session/tabs', verifyToken, async (req, res) => {
  const tabs = await loadTabs(req.user.sub);
  res.json({ tabs });
});

app.post('/api/session/tabs', verifyToken, async (req, res) => {
  await saveTabs(req.user.sub, req.body.tabs || []);
  res.json({ ok: true });
});

app.get('/api/session/bookmarks', verifyToken, async (req, res) => {
  res.json({ bookmarks: await loadBookmarks(req.user.sub) });
});

app.post('/api/session/bookmarks', verifyToken, async (req, res) => {
  await saveBookmarks(req.user.sub, req.body.bookmarks || []);
  res.json({ ok: true });
});

// Ephemeral wipe on logout
app.post('/api/session/logout', verifyToken, async (req, res) => {
  if (config.ephemeral) await wipeProfile(req.user.sub);
  res.clearCookie('nova_token');
  res.json({ ok: true });
});

// Static (login + app)
app.use(express.static(path.join(__dirname, '../public')));

// WebSocket
const wss = new WebSocketServer({ noServer: true });
registerStreamHandlers(wss);

server.on('upgrade', (req, socket, head) => {
  const token = parseCookie(req.headers.cookie || '').nova_token;
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  try { verifyJwt(token); } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

function parseCookie(str) {
  return str.split(';').reduce((acc, p) => {
    const [k, ...v] = p.trim().split('=');
    if (k) acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

// Ephemeral boot wipe
if (config.ephemeral) {
  await fs.rm(config.profilesPath, { recursive: true, force: true }).catch(() => {});
  await fs.rm(config.downloadsPath, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(config.profilesPath, { recursive: true });
  await fs.mkdir(config.downloadsPath, { recursive: true });
  console.log('🗑  Ephemeral mode: data wiped.');
}

server.listen(config.port, () => {
  console.log(`✅ Nova Browser on :${config.port}`);
});

process.on('SIGTERM', async () => {
  if (config.ephemeral) {
    await fs.rm(config.profilesPath, { recursive: true, force: true }).catch(() => {});
    await fs.rm(config.downloadsPath, { recursive: true, force: true }).catch(() => {});
  }
  server.close(() => process.exit(0));
});
