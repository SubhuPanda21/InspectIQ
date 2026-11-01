import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imageUrl, send } from '../api.js';
import { AnimatedGroup, TextEffect } from '../motion';
import { Sketch, SketchButton, Squiggle } from '../components/Sketch.jsx';
import { SEV_COLOR } from '../components/Overlay.jsx';

export default function Inspections() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/inspections').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const remove = async (id) => { if (!window.confirm('Delete this inspection and its photo?')) return; try { await send('DELETE', '/inspections/' + id); load(); } catch (e) { setErr(e.message); } };
  return (
    <div className="page wide">
      <TextEffect as="h1" per="word" preset="blur">My inspections</TextEffect>
      <Squiggle />
      <p className="muted">Tied to a random ID stored in this browser. Photos are deleted automatically after 30 days.</p>
      {err ? <p className="alert" role="alert">{err}</p> : null}
      {rows && rows.length === 0 ? <Sketch className="empty" fill="#fffdf6" seed={3}><p>Nothing here yet.</p><Link to="/inspect" className="nolink"><SketchButton tabIndex={-1}>Start an inspection</SketchButton></Link></Sketch> : null}
      {rows && rows.length ? (
        <AnimatedGroup className="cards" itemClassName="card-item" stagger={0.06}>
          {rows.map((r) => (
            <Sketch className="icard" key={r.id} fill="#fffdf6" seed={r.id.charCodeAt(0)}>
              <Link to={'/i/' + r.id} className="nolink"><img src={imageUrl(r.id)} alt={'Photo for ' + (r.asset || 'inspection')} loading="lazy" /></Link>
              <div className="meta">
                <Link to={'/i/' + r.id}><strong>{r.asset || 'Untitled inspection'}</strong></Link>
                <span className="muted small">{new Date(r.createdAt).toLocaleDateString()}{r.source === 'sample' ? ' | test panel' : ''}</span>
                <span className="small">{r.count} finding{r.count === 1 ? '' : 's'}{r.worst ? <> | worst <b style={{ color: SEV_COLOR[r.worst] }}>{r.worst}</b></> : null}</span>
                <button className="textlink danger" onClick={() => remove(r.id)}>Delete</button>
              </div>
            </Sketch>
          ))}
        </AnimatedGroup>
      ) : null}
    </div>
  );
}
