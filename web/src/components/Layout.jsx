import { Link, NavLink } from 'react-router-dom';
import { PageTransition, ScrollProgress } from '../motion';
import { site } from '../site.config.js';

export default function Layout({ children }) {
  return (
    <>
      <ScrollProgress className="progress" />
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label={site.name + ' home'}>
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><path d="M14 5c-5.500-.4-9 3.600-8.600 8.400.4 5 4.800 8 9.200 7.200 4.400-.9 7-5 5.600-9.400-1-3.200-3.600-5.800-6.200-6.200z" fill="none" stroke="#23211c" strokeWidth="2.200" strokeLinecap="round" /><path d="M20 20l7 7" stroke="#23211c" strokeWidth="2.800" strokeLinecap="round" /><path d="M9 14l3 2.500L18 10" stroke="#d6402b" strokeWidth="2.200" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          InspectIQ
        </Link>
        <nav aria-label="Main">
          <NavLink to="/inspect">New inspection</NavLink>
          <NavLink to="/inspections">My inspections</NavLink>
          <NavLink to="/accuracy">Accuracy</NavLink>
        </nav>
      </header>
      <main id="main"><PageTransition>{children}</PageTransition></main>
      <footer className="site-footer">
        <span>InspectIQ finds candidate defects in photos. A qualified person decides what they mean.</span>
        <nav aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          {site.repoUrl ? <a href={site.repoUrl} rel="noreferrer">Source</a> : null}
        </nav>
      </footer>
    </>
  );
}
