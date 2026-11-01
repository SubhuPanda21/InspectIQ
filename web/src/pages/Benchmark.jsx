import { useState } from 'react';
import { send } from '../api.js';
import { AnimatedNumber, InView, TextEffect } from '../motion';
import { Sketch, SketchButton, Squiggle } from '../components/Sketch.jsx';

function Curves({ rows, def }) {
  const W = 560, H = 280, P = { l: 44, r: 14, t: 14, b: 40 };
  const X = (s) => P.l + s * (W - P.l - P.r), Y = (v) => P.t + (1 - v) * (H - P.t - P.b);
  const line = (key) => rows.map((r, i) => (i ? 'L' : 'M') + X(r.sensitivity).toFixed(1) + ' ' + Y(r[key]).toFixed(1)).join(' ');
  const series = [['precision', '#2d5bd1', 'precision'], ['recall', '#d6402b', 'recall'], ['f1', '#2f8a46', 'F1']];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="curves" role="img" aria-label="Precision, recall and F1 against sensitivity">
      {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="#d9d0b8" strokeDasharray="3 5" /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="14" fontFamily="Patrick Hand, cursive" fill="#5d574a">{v}</text></g>)}
      {rows.map((r) => <text key={r.sensitivity} x={X(r.sensitivity)} y={H - 16} textAnchor="middle" fontSize="14" fontFamily="Patrick Hand, cursive" fill="#5d574a">{r.sensitivity}</text>)}
      <text x={(W + P.l) / 2} y={H - 1} textAnchor="middle" fontSize="15" fontFamily="Patrick Hand, cursive" fill="#23211c">sensitivity setting</text>
      <line x1={X(def)} x2={X(def)} y1={P.t} y2={H - P.b} stroke="#23211c" strokeDasharray="2 4" />
      <text x={X(def) + 6} y={P.t + 14} fontSize="14" fontFamily="Patrick Hand, cursive" fill="#23211c">default</text>
      {series.map(([k, c]) => <path key={k} d={line(k)} fill="none" stroke={c} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="draw" />)}
      {series.map(([k, c]) => rows.map((r) => <circle key={k + r.sensitivity} cx={X(r.sensitivity)} cy={Y(r[k])} r="3.4" fill={c} />))}
    </svg>
  );
}

export default function Benchmark() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => { setBusy(true); setErr(''); try { setData(await send('POST', '/benchmark', { count: 40 })); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const at = data && data.rows.find((r) => Math.abs(r.sensitivity - data.defaultSensitivity) < 0.01);

  return (
    <div className="page">
      <TextEffect as="h1" per="word" preset="blur">How accurate is it?</TextEffect>
      <Squiggle />
      <InView>
        <p className="lead">This runs the detector on 40 generated panels. The generator draws cracks, scratches, corrosion patches and pits at known positions, so every detection can be scored against the truth.</p>
        <p className="muted">A detection counts as correct when its box overlaps a true defect by at least 20% (intersection over union). Precision is the share of detections that were real. Recall is the share of real defects found.</p>
        <p className="warnbox">The test panels and the detector were written by the same person. Real photos have more variety, so expect lower numbers in the field. Use this page to see how sensitivity trades false alarms against misses.</p>
        <SketchButton onClick={run} disabled={busy}>{busy ? 'Running 40 panels' : data ? 'Run again' : 'Run the benchmark'}</SketchButton>
        {err ? <p className="alert" role="alert">{err}</p> : null}
      </InView>

      {data ? (
        <InView>
          <h2>Result</h2>
          <p className="muted">{data.images} panels, {data.truthCount} true defects. At the default setting of {Math.round(data.defaultSensitivity * 100)}%:</p>
          <div className="big3">
            {[['Precision', at.precision], ['Recall', at.recall], ['F1', at.f1]].map(([k, v]) => (
              <Sketch key={k} className="bigcell" fill="#fffdf6" seed={k.length}><span className="bigk">{k}</span><span className="bigv"><AnimatedNumber value={v * 100} decimals={0} />%</span></Sketch>
            ))}
          </div>
          <p className="muted small">Of the defects it matched, {Math.round(at.classAccuracy * 100)}% were given the right type.</p>
          <Sketch className="chart" fill="#fffdf6" seed={21}><Curves rows={data.rows} def={data.defaultSensitivity} /></Sketch>
          <div className="legend"><span style={{ color: '#2d5bd1' }}>precision</span><span style={{ color: '#d6402b' }}>recall</span><span style={{ color: '#2f8a46' }}>F1</span></div>
          <table className="tbl">
            <thead><tr><th>Sensitivity</th><th>Found</th><th>False alarms</th><th>Missed</th><th>Precision</th><th>Recall</th></tr></thead>
            <tbody>{data.rows.map((r) => <tr key={r.sensitivity} className={Math.abs(r.sensitivity - data.defaultSensitivity) < 0.01 ? 'hl' : ''}><td>{r.sensitivity}</td><td>{r.tp}</td><td>{r.fp}</td><td>{r.fn}</td><td>{r.precision.toFixed(2)}</td><td>{r.recall.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </InView>
      ) : null}
    </div>
  );
}
