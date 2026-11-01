import { Link } from 'react-router-dom';
import { InView, TextEffect } from '../motion';
import { Squiggle } from '../components/Sketch.jsx';
import { site } from '../site.config.js';

const Contact = () => (
  <p>{site.contactEmail ? <>Questions or deletion requests: <a href={'mailto:' + site.contactEmail}>{site.contactEmail}</a>.</> : 'Questions or deletion requests: open an issue on the project repository, or contact the person who operates this deployment.'}</p>
);

export function Privacy() {
  return (
    <article className="legal">
      <TextEffect as="h1" per="word" preset="blur">Privacy policy</TextEffect>
      <Squiggle />
      <p className="muted">Last updated {site.updated}</p>
      <InView>
        <h2>What this service stores</h2>
        <ul>
          <li>The photos you upload, resized to at most 800 pixels on the longest side and re-saved as PNG. The original file is not kept, and metadata such as GPS position and camera details is dropped in the process.</li>
          <li>What you type for each inspection: asset name, inspector name and notes, plus the detected defects and the sensitivity you chose.</li>
          <li>A random identifier created in your browser (localStorage key <code>inspectiq_client</code>). It is sent with your requests so you see only your own inspections. It is not linked to your name or email.</li>
        </ul>
        <h2>What it does not do</h2>
        <ul>
          <li>No accounts, no cookies, no analytics, no advertising and no third party scripts or fonts.</li>
          <li>Photos are analysed on this server with fixed image processing rules. They are not sent to any outside service or model.</li>
          <li>Your IP address is held in memory briefly for rate limiting and is not written to the database.</li>
        </ul>
        <h2>Photos of people and sensitive sites</h2>
        <p>Upload photos of equipment and surfaces. Do not upload images of people, or of sites where photography is not permitted. Anything visible in a photo is stored with it.</p>
        <h2>Access</h2>
        <p>Inspections are private to the browser that created them. There are no public links. The image address contains your random identifier, so do not share it.</p>
        <h2>Retention and deletion</h2>
        <p>Inspections and their images are deleted automatically {site.retentionDays} days after they were created. You can delete one at any time from the app. Provider backups may persist briefly.</p>
        <h2>Contact</h2>
        <Contact />
      </InView>
    </article>
  );
}

export function Terms() {
  return (
    <article className="legal">
      <TextEffect as="h1" per="word" preset="blur">Terms of use</TextEffect>
      <Squiggle />
      <p className="muted">Last updated {site.updated}</p>
      <InView>
        <h2>The service</h2>
        <p>{site.name} analyses photos you upload and produces candidate defect locations, severity ratings and a report. It is provided as is, without warranty.</p>
        <h2>Not a safety decision</h2>
        <p>Results come from simple image analysis. It can miss defects and can flag things that are not defects, such as glare, dirt or texture. Severity uses size and contrast in the photo only and is not a measurement in millimetres. Do not use the output as the sole basis for deciding that equipment is safe or unsafe. A qualified person must inspect the asset.</p>
        <h2>Your content</h2>
        <p>You keep ownership of what you upload. You allow the service to store and process it for the retention period. You are responsible for having the right to upload it.</p>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not upload unlawful content, images of people, or images you are not allowed to share.</li>
          <li>Do not attempt to overload, probe or attack the service, or bypass its limits.</li>
        </ul>
        <h2>Availability and changes</h2>
        <p>The service may be limited, changed or stopped at any time. Inspections may be removed at the end of the retention period.</p>
        <h2>Liability</h2>
        <p>To the extent the law allows, the operator is not liable for losses arising from use of the service or reliance on its output.</p>
        <h2>Contact</h2>
        <Contact />
        <p>See also the <Link to="/privacy">privacy policy</Link>.</p>
      </InView>
    </article>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <TextEffect as="h1" per="word" preset="blur">Page not found</TextEffect>
      <p><Link to="/">Back to the start</Link></p>
    </div>
  );
}
