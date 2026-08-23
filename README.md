# Revenant

**A job feed that tells you which listings are already dead.**

Live demo → **https://revenant-jobs.vercel.app** (no login, no signup)
Built for [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse), Aug 2026.

<!--
SCREENSHOTS — add these three, then delete this comment.
Judges read the README first, so put pictures above everything else.
  docs/screenshots/feed.png      the feed, showing liveness scores
  docs/screenshots/heal.png      terminal output of `npm run heal`
  docs/screenshots/health.png    the collector health page
-->

![The feed](docs/screenshots/feed.png)

---

## What it does

Job boards go stale and nobody measures it. A role gets filled, but the listing
stays up for months. The same job shows up on five different boards. And when a
site changes its HTML, a field silently starts returning nothing.

Revenant scrapes job boards with Bright Data Scraper Studio and scores every
listing on whether it is still real:

- **Ghost detection.** We scrape the aggregator *and* the company's own careers
  board. If a role is gone from the company's board but still listed elsewhere,
  it is dead — and we can prove it rather than guess.
- **Salary that the API does not have.** Greenhouse's JSON feed has no
  compensation field at all: 0 out of 3,509 postings. Scraper Studio pulls the
  range out of the job description text instead — 43 of 50 on Vercel's board.
- **Self-healing that gets checked.** When a heal is proposed, we re-run the
  scraper and compare the result against the ATS platform's own feed before
  accepting it.
- **CV matching.** Paste a CV, get roles ranked by fit, with the exact skills you
  are missing named. It never applies for you.

---

## How I used Bright Data Scraper Studio

**Collector:** `c_msyq5cea136y76lhb0`
**Target:** `https://job-boards.greenhouse.io/vercel` (rendered HTML, not the JSON API)

Everything runs through the CLI, driven from Claude Code.

### 1. Created the scraper

```bash
npm run scraper:create -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel
```

This wraps `bdata scraper create <url> "<description>"`. Took 4.6 minutes and
returned the collector ID, which it writes into `.env`.

The description I gave it — one plain-English spec, no CSS selectors:

```
Every job posting on this board. For each: the job title as displayed; the
hiring company name; where the role is based as written; whether it is remote,
hybrid or on-site; the advertised salary range with its currency if stated
anywhere in the posting including the description text; the employment type;
the date it says it was posted; the full job description; and the link a
candidate follows to apply.
```

The phrase **"including the description text"** is what recovers the salary. The
board's own salary field mostly says *"Competitive compensation package"*, while
the real number sits further down the page in prose.

### 2. Ran it

```bash
npm run collect -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel
```

Wraps `bdata scraper run`. Real output:

```
50 rows returned, 0 rejected  (154.5s)

field fill rates
  title            ████████████████████ 100%  50/50
  location         ████████████████████ 100%  50/50
  descriptionHtml  ████████████████████ 100%  50/50
  applyUrl         ████████████████████ 100%  50/50
  salaryMin        █████████████████···  86%  43/50
  postedAt         ····················   0%  0/50

accuracy vs greenhouse's own feed
  paired 50, missed 34, unmatched 0
  title            100.0%
  location         100.0%
  applyUrl         100.0%
  descriptionHtml  100.0%
  postedAt           0.0%   ← the board index doesn't show dates
  overall           80.0%
```

Full output: [`docs/sample-output.json`](docs/sample-output.json)

### 3. Healing

```bash
npm run heal -w @revenant/core -- chaos <url>
```

Wraps `bdata scraper heal` and `bdata scraper approve`. The important part is
that **we do not pass `--auto-approve`.**

`bdata scraper heal` proposes a fix and waits for approval. If you auto-approve,
you are trusting the fix because the thing that made it says it works. But a heal
can latch onto the wrong element — it fills the field back up with the job's
department where the location used to be. Fill rate looks perfect. The data is
wrong.

So we re-run the scraper, compare the output field-by-field against the ATS
platform's own JSON feed, and approve only if accuracy actually improved.

### 4. Where the data goes

Collector → normalise → dedupe → SQLite → Next.js app. The collector ID is the
integration point: `npm run ingest` pulls a board, and the site reads from the
database.

**Why scrape HTML when these platforms have a JSON API?** Two reasons. The API
has no salary field, so scraping the page gets data the API cannot give you. And
an API that never changes shape gives self-healing nothing to do — the whole
point of the hackathon.

The JSON feeds are still used, but as a **reference to check the scrape against**,
never as the data source.

---

## Numbers

All from `npm run db:stats`, not estimates.

```
3,509 postings   from 15 company boards
  live   2,053
  aging    376
  stale  1,080
108 duplicates collapsed

salary via ATS API:            0 / 3,509    (0%)
salary via Scraper Studio:    43 / 50       (86%)
accuracy vs ground truth:     80% overall, 100% on every field the page shows

135 tests
```

---

## Two things worth reading the code for

### 1. Empty is not the same as broken

The obvious way to detect a broken scraper is to alert when a field comes back
empty. That does not work on job boards, because most postings genuinely do not
list a salary. Alert on empty and it fires constantly until you mute it.

So Revenant compares each field against what *that collector* usually returns:

```
same run, zero salaries found:
  usually 0.5% → fine      (this board never had salary)
  usually 40%  → broken    (extraction just died)
```

[`healing/baseline.ts`](packages/core/src/healing/baseline.ts)

### 2. A heal is checked before it is trusted

Fill rate cannot tell a good fix from a confident wrong one. Ground truth can.

```
heal proposed → re-run → compare against the platform's own feed
                            ├─ accuracy improved and cleared the bar → approve
                            └─ otherwise                             → reject
```

[`healing/orchestrator.ts`](packages/core/src/healing/orchestrator.ts) ·
[`healing/audit.ts`](packages/core/src/healing/audit.ts)

---

## Ghost detection

A ghost job is live but not real. Aggregators cannot tell, because the only thing
they know is that the listing is still on their own page.

We read the company's own board too. If the role is gone from there but still
listed elsewhere, the company itself stopped listing it.

| Signal | Weight |
|---|---|
| Gone from the company's own board | **proof** |
| Apply link no longer works | high |
| Age (gentle under 30 days, steep over 90) | high |
| Re-posted repeatedly with a fresh date | medium |
| Description never changes | low |

**`ghost` requires proof.** A 2,000-day-old listing with a dead apply link scores
0 and is still only marked `stale`. Telling someone a real job is dead costs them
an opportunity, so that word is reserved for cases we can back up.

Every score comes with its reason:

> *"Removed from the company's own job board 12 days ago, but still listed here."*

[`decay/liveness.ts`](packages/core/src/decay/liveness.ts)

---

## Finding company boards cheaply

Crawling to *find* career pages means loading a lot of empty pages. ATS boards
have predictable URLs instead, so we generate candidate slugs from a company name
and check them against the platform's free feed before any scraper runs.

```
$ npm run discover -w @revenant/core -- --file companies.txt

greenhouse  572 roles  https://job-boards.greenhouse.io/stripe
ashby       136 roles  https://jobs.ashbyhq.com/ramp
greenhouse  810 roles  https://job-boards.greenhouse.io/databricks
...
17/18 companies resolved, 2852 open roles, 2.4s
```

Zero Bright Data credits spent. This finds roles that only exist on a company's
own board and never reach an aggregator.

---

## Running it

Node 22+. No Docker, no external database.

```bash
npm install
npm run db:push -w @revenant/core
npm run ingest  -w @revenant/core -- --file companies.txt
npm run dev
```

Open http://localhost:3000. A sample database is committed, so it works before
you ingest anything.

For the Scraper Studio collectors, add a Bright Data key to `.env` (copy
`.env.example`).

| Command | What it does |
|---|---|
| `discover` | Find company boards |
| `ingest` | Fill the database |
| `scraper:create` | Build a Scraper Studio collector |
| `collect` | Run a collector, print fill rates and accuracy |
| `heal` | Detect drift, heal, grade, approve or reject |
| `db:stats` | What is in the database |

---

## Architecture

```
Bright Data Scraper Studio          one plain-English field spec
  rendered board HTML               proxies, retries, unblocking, self-heal
        │
        ▼
  collect → normalise → dedupe → store
     │
     ├── drift check: fill rate vs this collector's baseline
     │      └── dropped? → heal → grade vs ATS feed → approve / reject
     │
     └── decay check: still on the company's board? → liveness score
        │
        ▼
  SQLite  →  Next.js
```

```
packages/core/
├── brightdata/   bdata CLI wrapper (create, run, heal, approve)
├── collectors/   the board collector
├── healing/      baselines, drift detection, grading, orchestration
├── decay/        liveness scoring and ghost detection
├── discovery/    company → board lookup
├── match/        CV matching
├── normalize/    dedupe, salary parsing
├── oracle/       ATS feeds used as reference
└── db/
apps/web/         feed, match, listing, health
apps/chaos-target/  a board we can break on purpose, to test healing
```

---

## What it does not do

- **No auto-apply.** It never submits anything for you.
- **Public data only.** Public ATS boards. No logins, no paywalls, no government
  sites, no personal data.
- **No account.** Your CV stays in your browser and is scored in memory. Nothing
  is stored server-side.
- **Not built yet:** the Ashby collector, and email digests.

---

## AI disclosure

Built with Claude Code (Claude Opus 5), as the rules allow. I directed the
architecture and the design decisions; the numbers in this README all came from
running the code.

MIT licensed.
