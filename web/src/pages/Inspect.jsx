import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { send, upload } from '../api.js';
import { InView, TextEffect } from '../motion';
import { Sketch, SketchButton, Squiggle } from '../components/Sketch.jsx';

export default function Inspect() {
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [asset, setAsset] = useState('');
  const [inspector, setInspector] = useState('');
  const [sens, setSens] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  useEffect(() => { if (!file) { setPreview(''); return undefined; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);

  const choose = (f) => {
    setErr('');
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) { setErr('Choose a JPEG or PNG photo.'); return; }
    if (f.size > 8 * 1024 * 1024) { setErr('That file is over 8 MB. Choose a smaller photo.'); return; }
    setFile(f);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setErr('Choose a photo first.'); return; }
    setBusy(true); setErr('');
    const f = new FormData();
    f.append('image', file); f.append('asset', asset); f.append('inspector', inspector); f.append('sensitivity', String(sens));
    try { const r = await upload('/inspections', f); nav('/i/' + r.id); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const sample = async () => { setBusy(true); setErr(''); try { const r = await send('POST', '/inspections/sample', {}); nav('/i/' + r.id); } catch (x) { setErr(x.message); setBusy(false); } };

  return (
    <div className="page">
      <TextEffect as="h1" per="word" preset="blur">New inspection</TextEffect>
      <Squiggle />
      <InView><p className="lead">Use a sharp, evenly lit photo taken straight on to the surface. Avoid flash glare. Remove people from the frame.</p></InView>

      <form onSubmit={submit} className="form">
        <Sketch as="div" className={'drop' + (drag ? ' on' : '')} fill={drag ? '#fff1c4' : '#fffdf6'} seed={9}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}>
          {preview ? <img src={preview} alt="Chosen photo" className="thumb" /> : <p className="drop-hint">Drop a JPEG or PNG here, or choose a file</p>}
          <input ref={input} id="file" type="file" accept="image/jpeg,image/png" className="sr" onChange={(e) => choose(e.target.files[0])} />
          <label htmlFor="file" className="pick">{file ? 'Choose a different photo' : 'Choose a photo'}</label>
          {file ? <span className="muted">{file.name}, {(file.size / 1024).toFixed(0)} KB</span> : null}
        </Sketch>

        <div className="row2">
          <div><label htmlFor="asset">Asset or location</label><input id="asset" value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="Crane 4, boom plate B" maxLength={100} /></div>
          <div><label htmlFor="insp">Inspector</label><input id="insp" value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Your name" maxLength={100} /></div>
        </div>
        <label htmlFor="sens">Sensitivity: {Math.round(sens * 100)}%</label>
        <input id="sens" type="range" min="0" max="1" step="0.05" value={sens} onChange={(e) => setSens(Number(e.target.value))} />
        <p className="muted small">Higher finds fainter marks and also more false alarms. You can change it after the analysis and the circles update. The accuracy page shows the trade-off.</p>

        {err ? <p className="alert" role="alert">{err}</p> : null}
        <div className="cta-row">
          <SketchButton type="submit" disabled={busy}>{busy ? 'Analysing' : 'Analyse photo'}</SketchButton>
          <button type="button" className="textlink" onClick={sample} disabled={busy}>or try a synthetic test panel</button>
        </div>
      </form>
    </div>
  );
}
