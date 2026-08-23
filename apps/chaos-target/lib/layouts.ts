import { ROLES } from './roles.js';
import type { Role } from './roles.js';

export type Layout = 'a' | 'b';

const money = (n: number, c: string | null): string =>
  `${c ?? ''} ${n.toLocaleString('en-US')}`.trim();

const STYLES = `
  :root{color-scheme:light;--ink:#10151c;--muted:#5c6672;--line:#e3e7ec;--accent:#1d4ed8}
  *{box-sizing:border-box}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:#fff;line-height:1.5}
  header{border-bottom:1px solid var(--line);padding:2rem 1.5rem 1.5rem}
  .wrap{max-width:820px;margin:0 auto}
  h1{margin:0 0 .25rem;font-size:1.35rem;letter-spacing:-.01em}
  .sub{color:var(--muted);font-size:.9rem;margin:0}
  main{padding:1.5rem}
  .job-card,.posting-row{border-bottom:1px solid var(--line);padding:1.1rem 0}
  .job-card:last-child,.posting-row:last-child{border-bottom:0}
  .job-title,.posting-row__heading{font-size:1rem;font-weight:600;margin:0 0 .3rem}
  .job-title a,.posting-row__heading a{color:var(--ink);text-decoration:none}
  .job-meta,.posting-row__attrs{color:var(--muted);font-size:.875rem}
  .job-meta span+span::before{content:" · "}
  .posting-row__attrs dt{display:none}
  .posting-row__attrs dd{display:inline;margin:0}
  .posting-row__attrs dd+dd::before{content:" · "}
  .job-pay,.compensation{font-size:.875rem;margin-top:.3rem}
  .compensation .amount{font-weight:500}
  .job-blurb,.posting-row__summary{font-size:.875rem;color:var(--muted);margin:.5rem 0 0}
`;

/** The layout the collector is built against. */
function layoutA(role: Role): string {
  const pay =
    role.min === null || role.max === null
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
 * The same board after a redesign.
 *
 * Every class is renamed, spans become a definition list, the salary is nested a
 * level deeper and split across three elements, and the date moves ahead of the
 * location. A selector written against layout A cannot survive any of that. The
 * plain-language description of each field still can — which is the entire claim
 * being demonstrated.
 */
function layoutB(role: Role): string {
  const pay =
    role.min === null || role.max === null
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

export function renderBoard(layout: Layout): string {
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

/**
 * A single job page, in whichever layout is live.
 *
 * The salary sits in the same markup the board uses for it, so a redesign breaks
 * extraction here too — which is the point, since this is the page a scraper
 * follows to read the description.
 */
export function renderJob(role: Role, layout: Layout): string {
  const pay =
    role.min === null || role.max === null
      ? '<p class="job-pay">Compensation not disclosed for this role.</p>'
      : layout === 'b'
        ? `<p class="compensation">
             <span class="amount">${money(role.min, role.currency)}</span>
             <span class="separator">to</span>
             <span class="amount">${money(role.max, role.currency)}</span>
             <span class="period">per year</span>
           </p>`
        : `<p class="job-pay">${money(role.min, role.currency)} – ${money(role.max, role.currency)} per year</p>`;

  const meta =
    layout === 'b'
      ? `<dl class="posting-row__attrs">
           <dt>Posted</dt><dd class="attr-date">Posted ${role.posted}</dd>
           <dt>Location</dt><dd class="attr-place">${role.location}</dd>
           <dt>Arrangement</dt><dd class="attr-arrangement">${role.workplace}</dd>
           <dt>Contract</dt><dd class="attr-contract">${role.type}</dd>
         </dl>`
      : `<p class="job-meta">
           <span class="job-location">${role.location}</span>
           <span class="job-workplace">${role.workplace}</span>
           <span class="job-type">${role.type}</span>
           <span class="job-posted">Posted ${role.posted}</span>
         </p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${role.title} — Northwind Robotics</title><style>${STYLES}</style></head>
<body>
  <header><div class="wrap"><h1>Northwind Robotics</h1><p class="sub">Open roles</p></div></header>
  <main class="wrap">
    <article class="${layout === 'b' ? 'posting-row' : 'job-card'}">
      <h2 class="${layout === 'b' ? 'posting-row__heading' : 'job-title'}">${role.title}</h2>
      ${meta}
      ${pay}
      <div class="${layout === 'b' ? 'posting-row__summary' : 'job-blurb'}">
        <p>${role.blurb}</p>
        <p>You will join a small team and own your area end to end. We care about
        clear writing, tested code and shipping things that work in the field.</p>
        <p>Northwind Robotics builds warehouse automation for logistics operators
        across Europe.</p>
      </div>
      <p><a href="/">Back to all roles</a></p>
    </article>
  </main>
</body></html>`;
}

/**
 * The structured feed, published beside the rendered board exactly as
 * Greenhouse, Lever and Ashby publish theirs.
 *
 * It never changes when the layout flips. That is what makes it ground truth:
 * the redesign under test cannot touch it, so grading a heal against it is a
 * real check rather than a circular one.
 */
export function truthFeed(): unknown {
  return {
    jobs: ROLES.map((role) => ({
      id: role.id,
      title: role.title,
      location: role.location,
      workplace: role.workplace,
      employment_type: role.type,
      posted: role.posted,
      salary_min: role.min,
      salary_max: role.max,
      currency: role.currency,
      description: role.blurb,
      apply_url: `/jobs/${role.id}`,
    })),
  };
}
