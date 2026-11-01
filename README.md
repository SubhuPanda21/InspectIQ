# InspectIQ

Upload a photo of a metal surface. InspectIQ finds cracks, scratches, corrosion and pits with classical computer vision, circles and rates each one, fills a checklist and writes a PDF report. A built-in benchmark scores the detector against generated panels with known defects.

## How it works

- **Pipeline (pure JS):** grayscale, integral-image local mean and standard deviation z-score, redness anomaly, threshold, dilation, connected components, region moments, then rules for crack, scratch, corrosion, pit, wear and glare, with severity.
- **Uploads:** JPEG or PNG up to 8 MB, resized to 800 px and re-encoded as PNG (metadata dropped).
- **Output:** annotated image, heat map, live sensitivity slider, PDF report (pdfkit).
- **Benchmark:** `/accuracy` generates synthetic panels with ground truth and reports precision, recall and F1 at each sensitivity (IoU 0.2). At the default 0.7 on the built-in panels the F1 is about 0.98.
- **Style:** hand-drawn UI (rough.js).

## Honest limits

The benchmark panels and the detector come from the same author, so real-world accuracy will be lower; say that in interviews. There is no depth or millimetre measurement, glare and dirt can look like defects, and "nothing detected" is not a pass. Findings need on-site confirmation. It is a portfolio project, not a certified inspection tool.

## Resume bullets (edit to taste)

- Built InspectIQ, a full-stack surface-inspection app (Node, Express, React) with a from-scratch computer vision pipeline (integral-image anomaly detection, connected components, rule-based classification) and automated PDF reports.
- Added a ground-truth benchmark harness that reports precision, recall and F1 against synthetic panels (F1 about 0.98 at the default setting), with the limits of synthetic data stated in the UI; 7 automated tests.

## Interview talking points

- Why classical CV first: explainable, no training data, a baseline to beat with a learned model.
- The integral image trick for fast local statistics.
- Why a benchmark on self-generated data is optimistic, and how you would collect real labelled photos.

## Run locally

Requires Node 22.13 or newer (it uses the built-in `node:sqlite`).

```bash
npm install
npm run dev      # API on :3000, Vite on :5173 (open the Vite URL)
npm test         # node --test
npm run build && npm start   # production, serves everything on :3000
```

## Deploy

Any host that runs a Node web service or a Dockerfile works (Render, Railway, Fly.io, a VPS).

- Build command: `npm install && npm run build`. Start command: `npm start`. Or use the included `Dockerfile`.
- Attach a **persistent disk** and point `DATA_DIR` at it (the Dockerfile uses `/data`). Without it, data is lost on each deploy.
- Set `TRUST_PROXY=1` behind a platform proxy so the rate limiter sees real client IPs.
- Put your contact email in `web/src/site.config.js` so the privacy and terms pages show it.

## Privacy model

No accounts and no cookies. Each browser gets a random ID stored in localStorage and sent as a header. Data is scoped to that ID and deleted automatically after the retention period shown in the app. Requests are rate limited and a strict Content-Security-Policy is set.
