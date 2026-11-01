import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export class ImageError extends Error { constructor(message) { super(message); this.status = 400; } }

const MAX_PIXELS = 36e6;
export const MAX_SIDE = 800;

/** Decode a JPEG or PNG buffer to RGBA. Only the pixels are kept, so EXIF data such as GPS never reaches storage. */
export function decode(buf) {
  if (buf.length > 12e6) throw new ImageError('Image is too large. Use a file under 8 MB.');
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG') {
    if (buf.length < 24) throw new ImageError('PNG file is truncated.');
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (!w || !h || w * h > MAX_PIXELS) throw new ImageError('Image dimensions are too large.');
    try { const p = PNG.sync.read(buf); return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) }; }
    catch { throw new ImageError('Could not read this PNG.'); }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    try { const j = jpeg.decode(buf, { useTArray: true, maxResolutionInMP: 36, maxMemoryUsageInMB: 512, formatAsRGBA: true }); return { width: j.width, height: j.height, data: new Uint8ClampedArray(j.data) }; }
    catch { throw new ImageError('Could not read this JPEG.'); }
  }
  throw new ImageError('Only JPEG and PNG images are supported.');
}

/** Area-average downscale so thin features survive better than with nearest neighbour. */
export function fit(img, maxSide = MAX_SIDE) {
  const s = Math.max(img.width, img.height);
  if (s <= maxSide) return img;
  const k = maxSide / s;
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y / k), sy1 = Math.max(sy0 + 1, Math.min(img.height, Math.floor((y + 1) / k)));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / k), sx1 = Math.max(sx0 + 1, Math.min(img.width, Math.floor((x + 1) / k)));
      let r = 0, g = 0, b = 0, c = 0;
      for (let yy = sy0; yy < sy1; yy++) for (let xx = sx0; xx < sx1; xx++) { const i = (yy * img.width + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; c++; }
      const o = (y * w + x) * 4;
      out[o] = r / c; out[o + 1] = g / c; out[o + 2] = b / c; out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

export function encodePng(img) {
  const p = new PNG({ width: img.width, height: img.height });
  p.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(p);
}
export function decodePng(buf) { const p = PNG.sync.read(buf); return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) }; }

/* ---------- drawing for the annotated image ---------- */
const FONT = { 0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'] };
export const SEV_RGB = { critical: [214, 64, 43], high: [235, 140, 30], medium: [245, 200, 40], low: [45, 91, 209] };

function put(img, x, y, c) { if (x < 0 || y < 0 || x >= img.width || y >= img.height) return; const i = (y * img.width + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
function rect(img, x, y, w, h, c, t) { for (let k = 0; k < t; k++) for (let i = 0; i < w; i++) { put(img, x + i, y + k, c); put(img, x + i, y + h - 1 - k, c); } for (let k = 0; k < t; k++) for (let j = 0; j < h; j++) { put(img, x + k, y + j, c); put(img, x + w - 1 - k, y + j, c); } }
function fill(img, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(img, x + i, y + j, c); }
function number(img, n, x, y, scale, c) {
  String(n).split('').forEach((ch, k) => FONT[ch].forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '1') fill(img, x + (k * 4 + rx) * scale, y + ry * scale, scale, scale, c); })));
}

export function annotate(img, defects) {
  const out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  const scale = Math.max(2, Math.round(img.width / 260));
  defects.forEach((d) => {
    const c = SEV_RGB[d.severity] || SEV_RGB.low;
    const pad = 3, b = d.bbox;
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad), w = Math.min(img.width - x, b.w + pad * 2), h = Math.min(img.height - y, b.h + pad * 2);
    rect(out, x - 1, y - 1, w + 2, h + 2, [20, 20, 20], 1);
    rect(out, x, y, w, h, c, 2);
    const digits = String(d.id).length;
    const lw = digits * 4 * scale + scale, lh = 5 * scale + scale * 2;
    const ly = y - lh >= 0 ? y - lh : y;
    fill(out, x, ly, lw + scale, lh, c);
    number(out, d.id, x + scale, ly + scale, scale, d.severity === 'medium' ? [20, 20, 20] : [255, 255, 255]);
  });
  return out;
}

export function heatmap(values, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = values[i] / 255;
    data[i * 4] = 30 + 225 * Math.min(1, v * 1.6); data[i * 4 + 1] = 30 + 190 * Math.max(0, v * 1.6 - 0.35); data[i * 4 + 2] = 40 * (1 - v); data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}
