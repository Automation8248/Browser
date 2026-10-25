import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import { config } from './config.js';

const router = express.Router();
const ROOT = config.downloadsPath;

async function safePath(userId, rel) {
  const base = path.join(ROOT, userId);
  await fs.mkdir(base, { recursive: true });
  const abs = path.resolve(base, rel || '');
  if (!abs.startsWith(base)) throw new Error('Forbidden');
  return abs;
}

// List
router.get('/list', async (req, res) => {
  try {
    const dir = await safePath(req.user.sub, req.query.path || '');
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (e) => {
      const full = path.join(dir, e.name);
      const st = await fs.stat(full);
      return { name: e.name, isDir: e.isDirectory(), size: st.size, mtime: st.mtimeMs };
    }));
    res.json({ path: req.query.path || '/', files });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Upload
const upload = multer({
  dest: '/tmp/nova-uploads',
  limits: { fileSize: 500 * 1024 * 1024 },
});
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const dest = await safePath(req.user.sub, path.basename(req.file.originalname));
    await fs.rename(req.file.path, dest);
    res.json({ ok: true, name: path.basename(dest), size: req.file.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download (stream)
router.get('/download', async (req, res) => {
  try {
    const file = await safePath(req.user.sub, req.query.path);
    const st = await fs.stat(file);
    if (!st.isFile()) return res.status(400).json({ error: 'Not a file' });
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file)}"`);
    res.setHeader('Content-Length', st.size);
    res.setHeader('Content-Type', 'application/octet-stream');
    (await fs.open(file)).createReadStream().pipe(res);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Export ZIP
router.get('/export', async (req, res) => {
  try {
    const dir = await safePath(req.user.sub, req.query.path || '');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="nova-export-${Date.now()}.zip"`);
    const arc = archiver('zip', { zlib: { level: 6 } });
    arc.on('error', (err) => res.status(500).end(err.message));
    arc.pipe(res);
    arc.directory(dir, false);
    await arc.finalize();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete
router.delete('/delete', async (req, res) => {
  try {
    const p = await safePath(req.user.sub, req.query.path);
    await fs.rm(p, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export { router };
