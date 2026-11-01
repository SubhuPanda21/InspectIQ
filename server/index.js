import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, purgeOld } from './db.js';
import { prepare, detect, heatValues, checklist, narrative } from './detect.js';
import { decode, decodePng, encodePng, fit, annotate, heatmap, ImageError } from './imaging.js';
import { generate } from './synth.js';
import { benchmark } from './bench.js';
import { reportPdf } from './report.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RETENTION_DAYS = 30;
const DEFAULT_SENS = 0.7;
const MAX_ITEMS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sensOf = (v, d = DEFAULT_SENS) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d; };

export function createApp({ dataDir, distDir } = {}) {
  dataDir = dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'data');
  distDir = distDir || path.join(here, '..', 'dist');
  const db = openDb(dataDir);
  purgeOld(db, dataDir, RETENTION_DAYS);
  const purgeTimer = setInterval(() => purgeOld(db, dataDir, RETENTION_DAYS), 3600000);
  purgeTimer.unref();
  const imgPath = (id) => path.join(dataDir, 'images', id + '.png');

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.json({ limit: '30kb' }));

  const hits = new Map();
  const limit = (name, max, windowMs) => (req, res, next) => {
    const key = name + ':' + req.ip; const t = Date.now(); const rec = hits.get(key);
    if (!rec || t > rec.reset) { hits.set(key, { n: 1, reset: t + windowMs }); return next(); }
    if (++rec.n > max) { res.set('Retry-After', String(Math.ceil((rec.reset - t) / 1000))); return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' }); }
    next();
  };
  setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); }, 60000).unref();
  app.use('/api', limit('api', 300, 60000));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 8 } });

  const cid = (req) => {
    const id = req.get('x-client-id') || req.query.cid;
    if (!id || !UUID.test(id)) throw new HttpError(400, 'Missing or invalid client id');
    return id;
  };
  const row = (req) => {
    const r = db.prepare('SELECT * FROM inspections WHERE id = ? AND client_id = ?').get(req.params.id, cid(req));
    if (!r) throw new HttpError(404, 'Inspection not found');
    return r;
  };
  const view = (r) => {
    const defects = JSON.parse(r.defects);
    const rec = { id: r.id, asset: r.asset, inspector: r.inspector, notes: r.notes, source: r.source, sensitivity: r.sensitivity, width: r.width, height: r.height, createdAt: r.created_at, defects, truth: r.truth ? JSON.parse(r.truth) : null };
    rec.checklist = checklist(defects);
    rec.narrative = narrative(rec, defects);
    return rec;
  };
  const loadImage = (id) => decodePng(fs.readFileSync(imgPath(id)));
  const insert = (client, img, meta, truth) => {
    const id = crypto.randomUUID(); const t = Date.now();
    if (db.prepare('SELECT COUNT(*) AS n FROM inspections WHERE client_id = ?').get(client).n >= MAX_ITEMS) throw new HttpError(400, 'Inspection limit reached. Delete one to add another.');
    const result = detect(prepare(img), meta.sensitivity);
    fs.writeFileSync(imgPath(id), encodePng(img));
    db.prepare('INSERT INTO inspections (id, client_id, created_at, updated_at, asset, inspector, notes, source, sensitivity, width, height, defects, truth) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, client, t, t, meta.asset, meta.inspector, meta.notes, meta.source, meta.sensitivity, img.width, img.height, JSON.stringify(result.defects), truth ? JSON.stringify(truth) : null);
    return id;
  };

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.get('/api/inspections', (req, res) => {
    const rows = db.prepare('SELECT * FROM inspections WHERE client_id = ? ORDER BY created_at DESC').all(cid(req));
    res.json(rows.map((r) => { const d = JSON.parse(r.defects); const order = ['critical', 'high', 'medium', 'low']; return { id: r.id, asset: r.asset, source: r.source, createdAt: r.created_at, count: d.filter((x) => x.type !== 'glare').length, worst: d.length ? order.find((s) => d.some((x) => x.severity === s)) : null }; }));
  });

  app.post('/api/inspections', limit('upload', 40, 10 * 60000), upload.single('image'), (req, res) => {
    const client = cid(req);
    if (!req.file) throw new HttpError(400, 'Choose a JPEG or PNG photo.');
    const img = fit(decode(req.file.buffer));
    const id = insert(client, img, { asset: str(req.body.asset, 100), inspector: str(req.body.inspector, 100), notes: str(req.body.notes, 2000), source: 'upload', sensitivity: sensOf(req.body.sensitivity) });
    res.status(201).json({ id });
  });

  app.post('/api/inspections/sample', limit('upload', 40, 10 * 60000), (req, res) => {
    const client = cid(req);
    const seed = Number.isInteger(req.body && req.body.seed) ? req.body.seed : crypto.randomInt(1, 1e6);
    const { img, truth } = generate(seed);
    const id = insert(client, img, { asset: 'Synthetic test panel ' + seed, inspector: '', notes: '', source: 'sample', sensitivity: DEFAULT_SENS }, truth);
    res.status(201).json({ id });
  });

  app.get('/api/inspections/:id', (req, res) => res.json(view(row(req))));

  app.patch('/api/inspections/:id', (req, res) => {
    const r = row(req); const b = req.body || {};
    let defects = r.defects, sensitivity = r.sensitivity;
    if (b.sensitivity !== undefined && sensOf(b.sensitivity) !== r.sensitivity) {
      sensitivity = sensOf(b.sensitivity);
      defects = JSON.stringify(detect(prepare(loadImage(r.id)), sensitivity).defects);
    }
    db.prepare('UPDATE inspections SET asset=?, inspector=?, notes=?, sensitivity=?, defects=?, updated_at=? WHERE id=?')
      .run(b.asset !== undefined ? str(b.asset, 100) : r.asset, b.inspector !== undefined ? str(b.inspector, 100) : r.inspector, b.notes !== undefined ? str(b.notes, 2000) : r.notes, sensitivity, defects, Date.now(), r.id);
    res.json(view(row(req)));
  });

  app.delete('/api/inspections/:id', (req, res) => {
    const r = row(req);
    db.prepare('DELETE FROM inspections WHERE id = ?').run(r.id);
    try { fs.unlinkSync(imgPath(r.id)); } catch { /* already gone */ }
    res.json({ ok: true });
  });

  const png = (res, buf, name) => res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60', ...(name ? { 'Content-Disposition': 'attachment; filename="' + name + '"' } : {}) }).send(buf);
  app.get('/api/inspections/:id/image.png', (req, res) => { const r = row(req); png(res, fs.readFileSync(imgPath(r.id))); });
  app.get('/api/inspections/:id/annotated.png', (req, res) => { const r = row(req); png(res, encodePng(annotate(loadImage(r.id), JSON.parse(r.defects))), req.query.download ? 'inspectiq-annotated.png' : null); });
  app.get('/api/inspections/:id/heatmap.png', (req, res) => {
    const r = row(req); const prep = prepare(loadImage(r.id));
    png(res, encodePng(heatmap(heatValues(prep), prep.width, prep.height)));
  });
  app.get('/api/inspections/:id/report.pdf', (req, res) => {
    const r = row(req); const rec = view(r);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="inspection-report.pdf"' });
    reportPdf(rec, encodePng(annotate(loadImage(r.id), rec.defects)), res);
  });

  // Public, no stored data: a synthetic panel analysed live. Used on the landing page.
  const previewCache = new Map();
  app.get('/api/preview.png', (req, res) => {
    const seed = Math.max(1, Math.min(999, parseInt(req.query.seed, 10) || 3));
    if (!previewCache.has(seed)) {
      const { img } = generate(seed);
      previewCache.set(seed, encodePng(annotate(img, detect(prepare(img), DEFAULT_SENS).defects)));
      if (previewCache.size > 40) previewCache.delete(previewCache.keys().next().value);
    }
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }).send(previewCache.get(seed));
  });

  const benchCache = new Map();
  app.post('/api/benchmark', limit('bench', 12, 10 * 60000), (req, res) => {
    const count = Math.max(10, Math.min(40, parseInt(req.body && req.body.count, 10) || 30));
    if (!benchCache.has(count)) benchCache.set(count, benchmark({ count, sensitivities: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] }));
    res.json({ ...benchCache.get(count), defaultSensitivity: DEFAULT_SENS });
  });

  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    app.get('/', (req, res) => res.type('text').send('API is running. Build the frontend with: npm run build'));
  }
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || 500;
    let message = err.message;
    if (err instanceof multer.MulterError) { status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large. Use a file under 8 MB.' : 'Upload failed.'; }
    if (err.type === 'entity.too.large') status = 413;
    if (status >= 500) { console.error(err); message = 'Something went wrong on the server.'; }
    res.status(status).json({ error: message });
  });
  app.locals.close = () => { clearInterval(purgeTimer); db.close(); };
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => console.log('InspectIQ listening on :' + port));
  const stop = () => server.close(() => { app.locals.close(); process.exit(0); });
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
export { ImageError };
