import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function registerStreamHandlers(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');

    // Auth from upgrade cookie
    try {
      const token = parseCookie(req.headers.cookie || '').nova_token;
      ws.user = jwt.verify(token, config.jwtSecret);
    } catch {
      ws.close(4401, 'Unauthorized');
      return;
    }

    switch (url.pathname) {
      case '/stream':   return handleStream(ws);
      case '/clipboard': return handleClipboard(ws);
      case '/input':    return handleInput(ws);
      case '/api/tabs': return handleTabsSync(ws);
      default:
        ws.close(4404, 'Unknown endpoint');
    }
  });
}

// ── STREAM: CDP frames ───────────────────────────
async function handleStream(ws) {
  let browser, client;
  try {
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.connect({
      browserWSEndpoint: config.chromiumUrl,
      defaultViewport: null,
    });
    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());
    client = await page.createCDPSession();

    await client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 75,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: 1,
    });

    client.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'frame',
          data,
          width: metadata.deviceWidth,
          height: metadata.deviceHeight,
          ts: Date.now(),
        }));
      }
      client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });

    // Input forwarding
    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      try {
        if (msg.type === 'mouse') {
          if (msg.action === 'move') await page.mouse.move(msg.x, msg.y);
          else if (msg.action === 'down') await page.mouse.down({ button: msg.button || 'left' });
          else if (msg.action === 'up') await page.mouse.up({ button: msg.button || 'left' });
          else if (msg.action === 'wheel') await page.mouse.wheel({ deltaY: msg.deltaY });
        } else if (msg.type === 'key') {
          if (msg.action === 'down') await page.keyboard.down(msg.key);
          else if (msg.action === 'up') await page.keyboard.up(msg.key);
        } else if (msg.type === 'navigate') {
          await page.goto(msg.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
        } else if (msg.type === 'back') {
          await page.goBack().catch(() => {});
        } else if (msg.type === 'forward') {
          await page.goForward().catch(() => {});
        } else if (msg.type === 'reload') {
          await page.reload().catch(() => {});
        }
      } catch (e) {
        // ignore individual event errors
      }
    });

    ws.on('close', async () => {
      try { await client.send('Page.stopScreencast'); } catch {}
      try { await browser.disconnect(); } catch {}
    });
  } catch (err) {
    ws.send(JSON.stringify({ type: 'error', message: String(err) }));
    ws.close(1011, 'Stream error');
  }
}

// ── CLIPBOARD ────────────────────────────────────
const clipboardClients = new Set();
function handleClipboard(ws) {
  clipboardClients.add(ws);
  ws.on('message', (raw) => {
    for (const c of clipboardClients) {
      if (c !== ws && c.readyState === WebSocket.OPEN) c.send(raw.toString());
    }
  });
  ws.on('close', () => clipboardClients.delete(ws));
}

// ── INPUT (reserved) ─────────────────────────────
const inputClients = new Set();
function handleInput(ws) {
  inputClients.add(ws);
  ws.on('close', () => inputClients.delete(ws));
}

// ── TABS sync (broadcast between same user's tabs) ─
const tabClients = new Map(); // userId -> Set<ws>
function handleTabsSync(ws) {
  const userId = ws.user.sub;
  if (!tabClients.has(userId)) tabClients.set(userId, new Set());
  tabClients.get(userId).add(ws);

  ws.on('message', (raw) => {
    for (const c of tabClients.get(userId) || []) {
      if (c !== ws && c.readyState === WebSocket.OPEN) c.send(raw.toString());
    }
  });
  ws.on('close', () => {
    const set = tabClients.get(userId);
    if (set) set.delete(ws);
  });
}

function parseCookie(str) {
  return str.split(';').reduce((acc, p) => {
    const [k, ...v] = p.trim().split('=');
    if (k) acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}
