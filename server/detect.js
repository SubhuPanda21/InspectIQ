// Surface defect detector. Classical computer vision, no model weights, no network calls.
//   1. Local contrast: how far each pixel sits from the mean of its neighbourhood, in local standard deviations.
//   2. Colour anomaly: reddish pixels against their neighbourhood (corrosion).
//   3. Threshold, bridge small gaps, label connected regions.
//   4. Measure each region (area, length, elongation, colour) and classify it by rule.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;

function integral(src, w, h) {
  const W = w + 1;
  const out = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      out[(y + 1) * W + x + 1] = out[y * W + x + 1] + row;
    }
  }
  return out;
}
const boxSum = (I, W, x0, y0, x1, y1) => I[(y1 + 1) * W + x1 + 1] - I[y0 * W + x1 + 1] - I[(y1 + 1) * W + x0] + I[y0 * W + x0];

/** Heavy part, independent of sensitivity. Reuse it when only the threshold changes. */
export function prepare(img, opts = {}) {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const gray = new Float32Array(n), red = new Float32Array(n), gray2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    gray2[i] = gray[i] * gray[i];
    red[i] = r - (g + b) / 2;
  }
  const R = opts.radius ?? Math.max(8, Math.round(Math.min(w, h) / 20));
  const W = w + 1;
  const Ig = integral(gray, w, h), Ig2 = integral(gray2, w, h), Ir = integral(red, w, h);
  const z = new Float32Array(n), dRed = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(h - 1, y + R);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(w - 1, x + R);
      const cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
      const mean = boxSum(Ig, W, x0, y0, x1, y1) / cnt;
      const v = Math.max(0, boxSum(Ig2, W, x0, y0, x1, y1) / cnt - mean * mean);
      const i = y * w + x;
      z[i] = (gray[i] - mean) / Math.max(Math.sqrt(v), 3.5);
      dRed[i] = red[i] - boxSum(Ir, W, x0, y0, x1, y1) / cnt;
    }
  }
  return { width: w, height: h, data, z, dRed };
}

export const thresholds = (sens) => ({ zT: lerp(5.0, 2.0, sens), rT: lerp(52, 14, sens), minArea: Math.round(lerp(24, 6, sens)) });

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/** Cheap part: threshold, label and classify. */
export function detect(prep, sensitivity = 0.5) {
  const sens = clamp(Number(sensitivity), 0, 1);
  const { width: w, height: h, data, z, dRed } = prep;
  const n = w * h;
  const { zT, rT, minArea } = thresholds(sens);
  const mask = new Uint8Array(n), isRed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const redHit = dRed[i] > rT;
    if (redHit) isRed[i] = 1;
    if (redHit || Math.abs(z[i]) > zT) mask[i] = 1;
  }
  // 3x3 dilation so thin lines with gaps stay in one region
  const dil = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) dil[yy * w + xx] = 1;
    }
  }
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  const regions = [];
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (!dil[s] || label[s]) continue;
    next++;
    let sp = 0; stack[sp++] = s; label[s] = next;
    let area = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sred = 0, redN = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, sr = 0, sg = 0, sb = 0;
    while (sp) {
      const i = stack[--sp]; const x = i % w, y = (i - x) / w;
      if (mask[i]) {
        area++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sz += z[i]; sred += dRed[i]; if (isRed[i]) redN++;
        sr += data[i * 4]; sg += data[i * 4 + 1]; sb += data[i * 4 + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x > 0 && dil[i - 1] && !label[i - 1]) { label[i - 1] = next; stack[sp++] = i - 1; }
      if (x < w - 1 && dil[i + 1] && !label[i + 1]) { label[i + 1] = next; stack[sp++] = i + 1; }
      if (y > 0 && dil[i - w] && !label[i - w]) { label[i - w] = next; stack[sp++] = i - w; }
      if (y < h - 1 && dil[i + w] && !label[i + w]) { label[i + w] = next; stack[sp++] = i + w; }
    }
    if (area >= minArea) regions.push({ area, sx, sy, sxx, syy, sxy, sz, sred, redN, x0, y0, x1, y1, sr, sg, sb });
  }

  const defects = regions.map((g) => {
    const cx = g.sx / g.area, cy = g.sy / g.area;
    const vxx = g.sxx / g.area - cx * cx + 1 / 12, vyy = g.syy / g.area - cy * cy + 1 / 12, vxy = g.sxy / g.area - cx * cy;
    const tr = vxx + vyy, det = vxx * vyy - vxy * vxy;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(tr / 2 - disc, 1 / 12);
    const elong = Math.sqrt(l1 / l2);
    const length = 3.46 * Math.sqrt(l1);
    const meanZ = g.sz / g.area, meanRed = g.sred / g.area, redFrac = g.redN / g.area;
    let type, severity;
    if (redFrac > 0.45 && g.area >= minArea) {
      type = 'corrosion';
      severity = g.area >= 1000 ? 'critical' : g.area >= 350 ? 'high' : g.area >= 120 ? 'medium' : 'low';
    } else if (elong >= 3.2 && length >= 12) {
      if (meanZ < 0) { type = 'crack'; severity = length >= 50 ? 'critical' : length >= 25 ? 'high' : 'medium'; }
      else { type = 'scratch'; severity = length >= 60 ? 'medium' : 'low'; }
    } else if (meanZ < 0 && g.area <= 150) {
      type = 'pit'; severity = g.area >= 60 ? 'medium' : 'low';
    } else if (meanZ < 0) {
      type = 'wear'; severity = g.area >= 400 ? 'medium' : 'low';
    } else {
      type = 'glare'; severity = 'low';
    }
    const strength = type === 'corrosion' ? meanRed / rT : Math.abs(meanZ) / zT;
    const confidence = clamp(1 - Math.exp(-Math.max(0, strength - 0.6) * 1.4), 0.2, 0.99);
    return {
      type, severity, confidence: Math.round(confidence * 100) / 100,
      bbox: { x: g.x0, y: g.y0, w: g.x1 - g.x0 + 1, h: g.y1 - g.y0 + 1 },
      area: g.area, length: Math.round(length), cx: Math.round(cx), cy: Math.round(cy),
      meanZ: Math.round(meanZ * 10) / 10,
      color: [Math.round(g.sr / g.area), Math.round(g.sg / g.area), Math.round(g.sb / g.area)],
    };
  });
  defects.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.area - a.area);
  defects.forEach((d, i) => { d.id = i + 1; });
  return { sensitivity: sens, thresholds: { zT: +zT.toFixed(2), rT: +rT.toFixed(1), minArea }, defects };
}

export function analyze(img, sensitivity = 0.5, opts = {}) {
  const prep = prepare(img, opts);
  return { ...detect(prep, sensitivity), width: img.width, height: img.height, prep };
}

/** Anomaly strength 0..255 for each pixel, for the heat map. */
export function heatValues(prep) {
  const n = prep.width * prep.height;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = clamp(Math.round((Math.max(Math.abs(prep.z[i]) / 8, prep.dRed[i] / 80)) * 255), 0, 255);
  return out;
}

/* ---------- reporting helpers ---------- */
export const TYPE_LABEL = { crack: 'Crack', scratch: 'Scratch', corrosion: 'Corrosion', pit: 'Pit', wear: 'Surface wear', glare: 'Bright spot (possible glare)' };
const FOLLOW_UP = {
  crack: { critical: 'Treat as a structural concern. Have a qualified person assess it before the asset returns to service.', high: 'Schedule a close inspection soon and monitor for growth.', medium: 'Mark the end points and re-inspect at the next interval to see if it grows.' },
  corrosion: { critical: 'Large corroded area. Plan treatment or repair and check remaining thickness.', high: 'Plan cleaning and protective treatment. Check thickness where it is deepest.', medium: 'Treat the surface and re-inspect at the next interval.', low: 'Note and monitor.' },
  scratch: { medium: 'Check whether the coating or base metal is breached.', low: 'Cosmetic unless the coating is breached. Note and monitor.' },
  pit: { medium: 'Measure depth. Pits can grow under coating.', low: 'Note and monitor.' },
  wear: { medium: 'Compare with the previous inspection to estimate wear rate.', low: 'Note and monitor.' },
  glare: { low: 'Likely lighting. Retake the photo from another angle before acting.' },
};
export const followUp = (d) => (FOLLOW_UP[d.type] && FOLLOW_UP[d.type][d.severity]) || 'Review with a qualified inspector.';

export function checklist(defects) {
  const items = [
    ['Structural integrity (cracks)', ['crack']],
    ['Corrosion', ['corrosion']],
    ['Surface wear and pitting', ['pit', 'wear']],
    ['Surface finish (scratches)', ['scratch']],
  ];
  return items.map(([name, types]) => {
    const hit = defects.filter((d) => types.includes(d.type));
    const bad = hit.some((d) => d.severity === 'critical' || d.severity === 'high');
    return { item: name, status: bad ? 'fail' : hit.length ? 'review' : 'none', count: hit.length };
  });
}

export function narrative(meta, defects) {
  const real = defects.filter((d) => d.type !== 'glare');
  if (!real.length) return 'No defects were detected in this image at the chosen sensitivity. This does not prove the surface is free of defects. Small, low-contrast or hidden damage may not appear in a photograph.';
  const by = {};
  real.forEach((d) => { by[d.type] = (by[d.type] || 0) + 1; });
  const parts = Object.entries(by).map(([t, c]) => c + ' ' + (TYPE_LABEL[t] || t).toLowerCase() + (c > 1 && !t.endsWith('s') ? 's' : ''));
  const worst = real[0];
  return (meta.asset ? meta.asset + ': ' : '') + real.length + ' finding' + (real.length === 1 ? '' : 's') + ' (' + parts.join(', ') + '). The most severe is ' + (TYPE_LABEL[worst.type] || worst.type).toLowerCase() + ' number ' + worst.id + ', rated ' + worst.severity + '. ' + followUp(worst) + ' Ratings come from size and contrast in the photo only. An inspector must confirm each finding on site.';
}
