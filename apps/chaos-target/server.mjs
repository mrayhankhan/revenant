/**
 * The chaos target.
 *
 * A job board we control, so that self-healing can be demonstrated instead of
 * described. No real board redesigns itself during a three-minute video, so we
 * host one and break it on command while a Scraper Studio collector is pointed
 * at it.
 *
 * The important property is that **the URL never changes**. Flipping the layout
 * mutates what `/` serves; it does not move the board to a second address. If
 * the demo switched to `?v=b`, the collector would be scraping a different URL
 * and the whole exercise would prove nothing — a redesign is the same page
 * coming back different, and that is exactly what this reproduces.
 *
 *   node apps/chaos-target/server.mjs           # serves on :4180, layout A
 *   curl -X POST localhost:4180/chaos/flip      # same URL, redesigned markup
 *   curl localhost:4180/chaos/state             # which layout is live
 *
 * Deploy it anywhere Node runs, or expose it with a tunnel so Bright Data can
 * reach it. Layout choice is held in memory: restart and you are back to A.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4180);

/**
 * One dataset, two renderings. The facts never differ between layouts — only
 * the markup does — so any change in extracted values is the scraper's doing,
 * never the content's. That is what makes the accuracy audit meaningful.
 */
const ROLES = [
  {
    id: 'nr-4417',
    title: 'Senior Robotics Engineer',
    location: 'Berlin, Germany',
    workplace: 'Hybrid',
    type: 'Full-time',
    posted: '2026-08-04',
    min: 95000,
    max: 125000,
    currency: 'EUR',
    blurb:
      'Own motion planning for our warehouse fleet, from simulation through to on-robot deployment.',
  },
  {
    id: 'nr-4418',
    title: 'Embedded Systems Engineer',
    location: 'Remote, Netherlands',
    workplace: 'Remote',
    type: 'Full-time',
    posted: '2026-08-09',
    min: 80000,
    max: 105000,
    currency: 'EUR',
    blurb:
      'Firmware for our next-generation actuator control boards. C++ and a lot of oscilloscope time.',
  },
  {
    id: 'nr-4419',
    title: 'Computer Vision Researcher',
    location: 'Zurich, Switzerland',
    workplace: 'On-site',
    type: 'Full-time',
    posted: '2026-07-28',
    min: 130000,
    max: 165000,
    currency: 'CHF',
    blurb: 'Depth estimation and object tracking in cluttered industrial environments.',
  },
  {
    id: 'nr-4420',
    title: 'Technical Writer, Robotics',
    location: 'Remote, Europe',
    workplace: 'Remote',
    type: 'Contract',
    posted: '2026-08-11',
    min: 55000,
    max: 70000,
    currency: 'EUR',
    blurb: 'Turn our SDK into documentation an integrator can follow without calling support.',
  },
  {
    id: 'nr-4421',
    title: 'Field Deployment Technician',
    location: 'Rotterdam, Netherlands',
    workplace: 'On-site',
    type: 'Full-time',
    posted: '2026-08-01',
    // Deliberately unadvertised. A legitimately absent salary must not read as
    // a broken extraction — the distinction the baseline detector exists to make.
    min: null,
    max: null,
    currency: null,
    blurb: 'Commission and maintain robot cells on customer sites across the Benelux.',
  },
  {
    id: 'nr-4422',
    title: 'Product Manager, Autonomy',
    location: 'Berlin, Germany',
    workplace: 'Hybrid',
    type: 'Full-time',
    posted: '2026-07-19',
    min: 100000,
    max: 130000,
    currency: 'EUR',
    blurb: 'Own the autonomy roadmap and decide what ships next to the fleet.',
  },
];

const money = (n, c) => `${c} ${n.toLocaleString('en-US')}`;

const STYLES = `
  :root { color-scheme: light; --ink:#10151c; --muted:#5c6672; --line:#e3e7ec; --accent:#1d4ed8; }
  *{box-sizing:border-box} body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:#fff;line-height:1.5}
  header{border-bottom:1px solid var(--line);padding:2rem 1.5rem 1.5rem}
  .wrap{max-width:820px;margin:0 auto} h1{margin:0 0 .25rem;font-size:1.35rem;letter-spacing:-.01em}
  .sub{color:var(--muted);font-size:.9rem;margin:0} main{padding:1.5rem}
  .job-card,.posting-row{border-bottom:1px solid var(--line);padding:1.1rem 0}
  .job-card:last-child,.posting-row:last-child{border-bottom:0}
  .job-title,.posting-row__heading{font-size:1rem;font-weight:600;margin:0 0 .3rem}
  .job-title a,.posting-row__heading a{color:var(--ink);text-decoration:none}
  .job-meta,.posting-row__attrs{color:var(--muted);font-size:.875rem}
  .job-meta span+span::before{content:" · "}
  .posting-row__attrs dt{display:none} .posting-row__attrs dd{display:inline;margin:0}
  .posting-row__attrs dd+dd::before{content:" · "}
  .job-pay,.compensation{font-size:.875rem;margin-top:.3rem}
  .compensation .amount{font-weight:500}
  .job-blurb,.posting-row__summary{font-size:.875rem;color:var(--muted);margin:.5rem 0 0}
`;

/** The layout the collector was built against. */
function layoutA(role) {
  const pay =
    role.min === null
      ? ''
      : `<p class="job-pay">${money(role.min, role.currency)} – ${money(role.max, role.currency)} per year</p>`;

  return `
    <article class="job-card" data-job-id="${role.id}">
      <h3 class="job-title"><a href="/jobs/${role.id}">${role.title}</a></h3>
      <p class="job-meta">
        <span class="job-location">${role.location}</span>
        <span class="job-workplace">${role.workplace}</span>
        <span class="job-type">${role.type}</span>
        <span class="job-posted">Posted ${role.posted}</span>
      </p>
      ${pay}
      <p class="job-blurb">${role.blurb}</p>
    </article>`;
}

/**
 * The same board after a redesign: definition list instead of spans, salary
 * nested a level deeper and split across elements, date moved ahead of the
 * location, every class renamed. A selector written against layout A cannot
 * survive this. The plain-language description of each field still can.
 */
function layoutB(role) {
  const pay =
    role.min === null
      ? ''
      : `<p class="compensation">
           <span class="amount">${money(role.min, role.currency)}</span>
           <span class="separator">to</span>
           <span class="amount">${money(role.max, role.currency)}</span>
           <span class="period">per year</span>
         </p>`;

  return `
    <section class="posting-row" data-requisition="${role.id}">
      <h3 class="posting-row__heading"><a href="/jobs/${role.id}">${role.title}</a></h3>
      <dl class="posting-row__attrs">
        <dt>Posted</dt><dd class="attr-date">Posted ${role.posted}</dd>
        <dt>Location</dt><dd class="attr-place">${role.location}</dd>
        <dt>Arrangement</dt><dd class="attr-arrangement">${role.workplace}</dd>
        <dt>Contract</dt><dd class="attr-contract">${role.type}</dd>
      </dl>
      ${pay}
      <p class="posting-row__summary">${role.blurb}</p>
    </section>`;
}

let layout = 'a';

function page() {
  const render = layout === 'b' ? layoutB : layoutA;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Northwind Robotics — Open Roles</title><style>${STYLES}</style></head>
<body>
  <header><div class="wrap"><h1>Northwind Robotics</h1><p class="sub">Open roles</p></div></header>
  <main class="wrap">${ROLES.map(render).join('')}</main>
</body></html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (url.pathname === '/chaos/flip' && request.method === 'POST') {
    layout = layout === 'a' ? 'b' : 'a';
    console.log(`layout is now ${layout.toUpperCase()}`);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ layout }));
    return;
  }

  if (url.pathname === '/chaos/state') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ layout, roles: ROLES.length }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      // The board must never be served from cache, or a flip would not be
      // visible to the very next scrape.
      'cache-control': 'no-store, max-age=0',
    });
    response.end(page());
    return;
  }

  response.writeHead(404, { 'content-type': 'text/plain' });
  response.end('not found');
});

server.listen(PORT, () => {
  console.log(`chaos target on http://localhost:${PORT}  (layout ${layout.toUpperCase()})`);
  console.log(`flip:  curl -X POST http://localhost:${PORT}/chaos/flip`);
});
