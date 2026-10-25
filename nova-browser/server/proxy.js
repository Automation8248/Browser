import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';

export function setupProxy(app) {
  const target = config.outboundProxy;
  if (!target) {
    app.get('/api/proxy/status', (_req, res) => {
      res.json({ enabled: false, proxy: null });
    });
    return;
  }
  app.use('/proxy', createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    ws: true,
    onProxyReq: (proxyReq) => proxyReq.setHeader('X-Nova-Proxy', '1'),
  }));
  app.get('/api/proxy/status', (_req, res) => {
    res.json({ enabled: true, proxy: target.replace(/\/\/.*@/, '//***@') });
  });
}
