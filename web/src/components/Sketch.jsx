import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import rough from 'roughjs';

/** A box whose border is drawn by hand (rough.js). Content sits on top. The seed keeps the wobble stable between renders. */
export function Sketch({ as: Tag = 'div', className = '', stroke = '#23211c', fill, fillStyle = 'solid', roughness = 1.5, strokeWidth = 2.2, seed = 3, children, style, ...rest }) {
  const ref = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !size.w) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(rough.svg(svg).rectangle(3, 3, size.w - 6, size.h - 6, { stroke, strokeWidth, roughness, fill, fillStyle, seed, bowing: 1.3, fillWeight: 1.2, hachureGap: 7 }));
  }, [size, stroke, strokeWidth, roughness, fill, fillStyle, seed]);
  return (
    <Tag ref={ref} className={'sketch ' + className} style={style} {...rest}>
      <svg ref={svgRef} className="sketch-svg" width={size.w} height={size.h} aria-hidden="true" />
      <span className="sketch-in">{children}</span>
    </Tag>
  );
}

export function SketchButton({ children, tone = 'yellow', className = '', ...rest }) {
  const [hover, setHover] = useState(false);
  const fills = { yellow: ['#ffe27a', '#ffd23f'], white: ['#fffdf6', '#fff1c4'], red: ['#f7b2a6', '#f08e7d'] }[tone];
  return (
    <Sketch as="button" className={'sbtn ' + className} fill={hover ? fills[1] : fills[0]} seed={7} roughness={1.7}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} {...rest}>
      {children}
    </Sketch>
  );
}

/** Hand-drawn underline that draws itself when scrolled into view. */
export function Squiggle({ className = '', color = '#d6402b' }) {
  const reduce = useReducedMotion();
  return (
    <svg className={'squiggle ' + className} viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
      <motion.path d="M3 9 C 25 2, 48 13, 75 7 S 130 4, 160 9 S 190 6, 197 5" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: 'easeOut' }} />
    </svg>
  );
}

const PATHS = {
  upload: ['M10 40 L10 52 L54 52 L54 40', 'M32 44 L32 12', 'M20 24 L32 12 L44 24'],
  detect: ['M26 8 C 12 6, 6 20, 12 30 C 18 40, 36 38, 40 26 C 44 14, 36 8, 26 8 Z', 'M38 36 L54 54', 'M18 22 L24 28 L34 16'],
  review: ['M8 12 L56 12 L56 48 L8 48 Z', 'M16 24 L26 24', 'M16 34 L40 34', 'M42 22 L47 28 L54 18'],
  report: ['M16 6 L42 6 L52 16 L52 58 L16 58 Z', 'M42 6 L42 16 L52 16', 'M24 28 L44 28', 'M24 38 L44 38', 'M24 48 L36 48'],
  arrow: ['M4 20 C 20 6, 40 34, 66 14', 'M54 6 L68 14 L56 26'],
  check: ['M6 22 L18 34 L40 8'],
};
export function Doodle({ name, size = 64, color = '#23211c', delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <svg width={size} height={name === 'arrow' ? size * 0.5 : size} viewBox={name === 'arrow' ? '0 0 72 40' : '0 0 64 64'} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d, i) => (
        <motion.path key={i} d={d} initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: delay + i * 0.25, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}
