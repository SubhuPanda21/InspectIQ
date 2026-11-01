import { useEffect, useRef } from 'react';
import rough from 'roughjs';

export const SEV_COLOR = { critical: '#d6402b', high: '#e07b12', medium: '#b68a00', low: '#2d5bd1' };

/** Draws a hand-drawn ring and number around every defect, on top of the photo. */
export default function Overlay({ width, height, defects, activeId, truth, showTruth, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);
    const sw = Math.max(2, width / 200);
    defects.forEach((d, i) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-id', d.id); g.setAttribute('class', 'ring'); g.style.setProperty('--i', i);
      g.style.cursor = 'pointer';
      const cx = d.bbox.x + d.bbox.w / 2, cy = d.bbox.y + d.bbox.h / 2;
      const rw = Math.max(d.bbox.w * 1.35 + 10, 22), rh = Math.max(d.bbox.h * 1.35 + 10, 22);
      const ring = rc.ellipse(cx, cy, rw, rh, { stroke: SEV_COLOR[d.severity], strokeWidth: sw, roughness: 1.8, seed: d.id * 11 });
      ring.querySelectorAll('path').forEach((p) => p.setAttribute('pathLength', '1'));
      g.appendChild(ring);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.textContent = String(d.id);
      t.setAttribute('x', Math.max(2, cx - rw / 2 - 2)); t.setAttribute('y', Math.max(sw * 5, cy - rh / 2 - 2));
      t.setAttribute('fill', SEV_COLOR[d.severity]); t.setAttribute('font-size', Math.max(16, width / 18)); t.setAttribute('font-family', 'Caveat, cursive'); t.setAttribute('font-weight', '700');
      t.setAttribute('stroke', '#fffdf6'); t.setAttribute('stroke-width', sw * 0.9); t.setAttribute('paint-order', 'stroke');
      g.appendChild(t);
      g.addEventListener('click', () => onPick && onPick(d.id));
      svg.appendChild(g);
    });
    if (showTruth && truth) {
      truth.forEach((t) => {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', t.bbox.x); r.setAttribute('y', t.bbox.y); r.setAttribute('width', t.bbox.w); r.setAttribute('height', t.bbox.h);
        r.setAttribute('fill', 'none'); r.setAttribute('stroke', '#2f8a46'); r.setAttribute('stroke-width', sw * 0.8); r.setAttribute('stroke-dasharray', '5 4');
        svg.appendChild(r);
      });
    }
  }, [width, height, defects, truth, showTruth, onPick]);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.querySelectorAll('.ring').forEach((g) => g.classList.toggle('active', String(g.getAttribute('data-id')) === String(activeId)));
  }, [activeId, defects]);
  return <svg ref={ref} className="overlay" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={defects.length + ' defects circled on the photo'} />;
}
