import { prepare, detect } from './detect.js';
import { generate } from './synth.js';

export function iou(a, b) {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

/** Match detections to ground truth greedily by IoU. A match needs IoU of at least 0.2. */
export function score(defects, truth) {
  const used = new Set();
  let tp = 0, classOk = 0;
  const order = [...defects].sort((a, b) => b.confidence - a.confidence);
  order.forEach((d) => {
    let best = -1, bi = -1;
    truth.forEach((t, i) => { if (used.has(i)) return; const v = iou(d.bbox, t.bbox); if (v > best) { best = v; bi = i; } });
    if (best >= 0.2) { used.add(bi); tp++; if (truth[bi].type === d.type) classOk++; }
  });
  return { tp, fp: defects.length - tp, fn: truth.length - tp, classOk };
}

export function benchmark({ count = 30, seeds = null, sensitivities = [0.5], size } = {}) {
  const set = Array.from({ length: count }, (_, i) => (seeds ? seeds[i] : 1000 + i)).map((s) => generate(s, size));
  const preps = set.map((s) => prepare(s.img));
  const rows = sensitivities.map((sens) => {
    let tp = 0, fp = 0, fn = 0, classOk = 0;
    preps.forEach((p, i) => { const r = score(detect(p, sens).defects, set[i].truth); tp += r.tp; fp += r.fp; fn += r.fn; classOk += r.classOk; });
    const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    return { sensitivity: sens, tp, fp, fn, precision, recall, f1, classAccuracy: tp ? classOk / tp : 0 };
  });
  return { images: count, truthCount: set.reduce((a, s) => a + s.truth.length, 0), rows };
}
