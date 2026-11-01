// Seeded synthetic test panels with known defect positions. Used for the sample button, the landing preview and the benchmark.

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export function generate(seed = 1, { width = 320, height = 240, maxDefects = 4 } = {}) {
  const r = rng(seed * 7919 + 13);
  const data = new Uint8ClampedArray(width * height * 4);
  const base = 125 + r() * 25;
  const streak = Array.from({ length: width }, (_, x) => 6 * Math.sin(x * 0.07 + r() * 6) + 3 * Math.sin(x * 0.23 + r() * 6));
  const gx = (r() - 0.5) * 24, gy = (r() - 0.5) * 24;
  const px = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = base + streak[x] + gx * (x / width - 0.5) + gy * (y / height - 0.5) + gauss(r) * 4;
    const i = (y * width + x) * 3;
    px[i] = v + 2; px[i + 1] = v; px[i + 2] = v - 3;
  }
  const truth = [];
  const free = (b) => truth.every((t) => b.x > t.bbox.x + t.bbox.w + 8 || b.x + b.w < t.bbox.x - 8 || b.y > t.bbox.y + t.bbox.h + 8 || b.y + b.h < t.bbox.y - 8);
  const stamp = (cx, cy, rad, delta) => {
    for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const d = Math.hypot(x - cx, y - cy);
      const a = Math.max(0, Math.min(1, rad + 0.5 - d));
      if (a <= 0) continue;
      const i = (y * width + x) * 3;
      px[i] += delta * a; px[i + 1] += delta * a; px[i + 2] += delta * a;
    }
  };
  const count = 1 + Math.floor(r() * maxDefects);
  const kinds = ['crack', 'scratch', 'corrosion', 'pit'];
  for (let k = 0, tries = 0; k < count && tries < 60; tries++) {
    const type = kinds[Math.floor(r() * kinds.length)];
    if (type === 'crack' || type === 'scratch') {
      const L = 36 + r() * 50; let x = 30 + r() * (width - 60), y = 30 + r() * (height - 60), th = r() * Math.PI;
      const pts = [];
      for (let s = 0; s < L; s++) { pts.push([x, y]); th += (r() - 0.5) * (type === 'crack' ? 0.5 : 0.08); x += Math.cos(th); y += Math.sin(th); }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const bbox = { x: Math.floor(Math.min(...xs) - 1), y: Math.floor(Math.min(...ys) - 1), w: Math.ceil(Math.max(...xs) - Math.min(...xs) + 3), h: Math.ceil(Math.max(...ys) - Math.min(...ys) + 3) };
      if (bbox.x < 2 || bbox.y < 2 || bbox.x + bbox.w > width - 2 || bbox.y + bbox.h > height - 2 || !free(bbox)) continue;
      const delta = type === 'crack' ? -(55 + r() * 25) : (45 + r() * 15);
      pts.forEach(([a, b]) => stamp(a, b, type === 'crack' ? 1.0 : 0.7, delta));
      truth.push({ type, bbox }); k++;
    } else if (type === 'corrosion') {
      const rx = 9 + r() * 12, ry = 9 + r() * 12, cx = rx + 6 + r() * (width - 2 * rx - 12), cy = ry + 6 + r() * (height - 2 * ry - 12);
      const bbox = { x: Math.floor(cx - rx), y: Math.floor(cy - ry), w: Math.ceil(2 * rx), h: Math.ceil(2 * ry) };
      if (!free(bbox)) continue;
      const alpha0 = 0.55 + r() * 0.25, ph = r() * 6;
      for (let y = bbox.y; y < bbox.y + bbox.h; y++) for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const edge = dx * dx + dy * dy + 0.18 * Math.sin(Math.atan2(dy, dx) * 5 + ph);
        if (edge >= 1) continue;
        const a = alpha0 * (0.75 + 0.25 * gauss(r));
        const i = (y * width + x) * 3;
        px[i] = px[i] * (1 - a) + (150 + gauss(r) * 8) * a; px[i + 1] = px[i + 1] * (1 - a) + 78 * a; px[i + 2] = px[i + 2] * (1 - a) + 40 * a;
      }
      truth.push({ type, bbox }); k++;
    } else {
      const rad = 3 + r() * 3, cx = 12 + r() * (width - 24), cy = 12 + r() * (height - 24);
      const bbox = { x: Math.floor(cx - rad - 1), y: Math.floor(cy - rad - 1), w: Math.ceil(2 * rad + 2), h: Math.ceil(2 * rad + 2) };
      if (!free(bbox)) continue;
      stamp(cx, cy, rad, -(50 + r() * 20));
      truth.push({ type, bbox }); k++;
    }
  }
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    data[i * 4] = px[j]; data[i * 4 + 1] = px[j + 1]; data[i * 4 + 2] = px[j + 2]; data[i * 4 + 3] = 255;
  }
  return { img: { width, height, data }, truth };
}
