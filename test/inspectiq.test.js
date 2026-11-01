import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { createApp } from '../server/index.js';
import { generate } from '../server/synth.js';
import { prepare, detect } from '../server/detect.js';
import { benchmark } from '../server/bench.js';
import { encodePng } from '../server/imaging.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iq-'));
const app = createApp({ dataDir: dir, distDir: path.join(dir, 'none') });
const server = app.listen(0);
const base = 'http://127.0.0.1:' + server.address().port;
const A = '123e4567-e89b-42d3-a456-426614174000';
const B = '223e4567-e89b-42d3-a456-426614174000';
test.after(() => { server.close(); app.locals.close(); });
const get = (p, id = A) => fetch(base + p, { headers: { 'x-client-id': id } });
const json = async (p, id = A) => (await get(p, id)).json();

test('detector finds each defect type on a known panel', () => {
  let found = new Set();
  for (let s = 1; s <= 12; s++) {
    const { img, truth } = generate(s);
    const d = detect(prepare(img), 0.7).defects;
    truth.forEach((t) => { if (d.some((x) => x.type === t.type)) found.add(t.type); });
  }
  for (const t of ['crack', 'scratch', 'corrosion', 'pit']) assert.ok(found.has(t), 'never found ' + t);
});

test('benchmark: strong at the default sensitivity, and sensitivity trades precision for recall', () => {
  const r = benchmark({ count: 30, sensitivities: [0.3, 0.7, 0.9] });
  const at = (s) => r.rows.find((x) => x.sensitivity === s);
  assert.ok(at(0.7).f1 > 0.85, 'F1 at 0.7 was ' + at(0.7).f1);
  assert.ok(at(0.9).precision < at(0.7).precision);
  assert.ok(at(0.3).recall < at(0.7).recall);
});

test('a blank surface has no findings', () => {
  const w = 200, h = 150, data = new Uint8ClampedArray(w * h * 4).fill(130);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  assert.equal(detect(prepare({ width: w, height: h, data }), 0.7).defects.length, 0);
});

test('upload a real JPEG, then re-analyse, annotate, export and delete', async () => {
  const { img } = generate(5, { width: 400, height: 300 });
  const jpg = jpeg.encode({ width: img.width, height: img.height, data: Buffer.from(img.data) }, 92).data;
  const form = new FormData();
  form.append('image', new Blob([jpg], { type: 'image/jpeg' }), 'panel.jpg');
  form.append('asset', 'Crane panel 7'); form.append('inspector', 'S. Panda');
  const up = await fetch(base + '/api/inspections', { method: 'POST', headers: { 'x-client-id': A }, body: form });
  assert.equal(up.status, 201);
  const { id } = await up.json();

  let rec = await json('/api/inspections/' + id);
  assert.equal(rec.asset, 'Crane panel 7');
  assert.equal(rec.source, 'upload');
  assert.ok(rec.defects.length >= 1);
  assert.equal(rec.checklist.length, 4);
  assert.match(rec.narrative, /finding/);

  const lo = await (await fetch(base + '/api/inspections/' + id, { method: 'PATCH', headers: { 'x-client-id': A, 'content-type': 'application/json' }, body: JSON.stringify({ sensitivity: 0.1, notes: 'checked at dusk' }) })).json();
  assert.ok(lo.defects.length <= rec.defects.length);
  assert.equal(lo.notes, 'checked at dusk');

  for (const p of ['image.png', 'annotated.png', 'heatmap.png']) {
    const r = await get('/api/inspections/' + id + '/' + p);
    assert.equal(r.status, 200, p);
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
  }
  const pdf = await get('/api/inspections/' + id + '/report.pdf');
  const buf = Buffer.from(await pdf.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 8000);

  assert.equal((await get('/api/inspections/' + id, B)).status, 404, 'other clients cannot read it');
  assert.equal((await fetch(base + '/api/inspections/' + id, { method: 'DELETE', headers: { 'x-client-id': A } })).status, 200);
  assert.equal((await get('/api/inspections/' + id)).status, 404);
  assert.equal(fs.existsSync(path.join(dir, 'images', id + '.png')), false);
});

test('sample panel stores ground truth for comparison', async () => {
  const r = await fetch(base + '/api/inspections/sample', { method: 'POST', headers: { 'x-client-id': A, 'content-type': 'application/json' }, body: JSON.stringify({ seed: 11 }) });
  const { id } = await r.json();
  const rec = await json('/api/inspections/' + id);
  assert.equal(rec.source, 'sample');
  assert.ok(rec.truth.length >= 1);
  const list = await json('/api/inspections');
  assert.ok(list.some((x) => x.id === id));
});

test('bad uploads are refused with clear messages', async () => {
  const send = async (blob, name) => { const f = new FormData(); if (blob) f.append('image', blob, name); return fetch(base + '/api/inspections', { method: 'POST', headers: { 'x-client-id': A }, body: f }); };
  let r = await send(null); assert.equal(r.status, 400);
  r = await send(new Blob(['not an image at all'], { type: 'image/png' }), 'x.png'); assert.equal(r.status, 400);
  assert.match((await r.json()).error, /JPEG and PNG/);
  r = await send(new Blob([Buffer.alloc(9 * 1024 * 1024, 1)]), 'big.jpg'); assert.equal(r.status, 413);
  const trunc = encodePng({ width: 20, height: 20, data: new Uint8ClampedArray(1600).fill(200) }).subarray(0, 30);
  r = await send(new Blob([trunc]), 't.png'); assert.equal(r.status, 400);
});

test('public preview and benchmark endpoints', async () => {
  const p = await fetch(base + '/api/preview.png?seed=3');
  assert.equal(p.headers.get('content-type'), 'image/png');
  const b = await (await fetch(base + '/api/benchmark', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: 20 }) })).json();
  assert.equal(b.images, 20);
  assert.equal(b.rows.length, 9);
});
