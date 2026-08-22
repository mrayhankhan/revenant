# Revenant

**The job feed that knows which listings are already dead.**

Built for [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) (WeMakeDevs × Bright Data, 17–23 August 2026).

A *revenant* is something that keeps walking after it has died — which is exactly
what a ghost job is: a listing still live on an aggregator for a role that was
filled, cancelled, or never real.

---

## The problem

Every job aggregator rots, quietly.

Listings stay "open" for months after the role was filled. The same job appears
five times across five boards. And when a site changes its markup, a field turns
`null` and nobody notices — because on job postings, a missing salary looks
exactly like a job that never advertised one.

Revenant treats a posting as a **decaying object**. Every listing carries a
liveness score, the plain-English reason behind that score, and a record of when
each field was last verified against the company's own systems.

**It deliberately stops before submit.** Revenant reads public listings and hands
you the decision. There is no auto-apply, no logged-in scraping, no ATS
automation — see [Scope and limits](#scope-and-limits).

---

## The two ideas worth reading the code for

### 1. A `null` is not a break, and telling them apart needs history

The naive way to notice a broken scraper is to alert when a field comes back
empty. On job boards that does not work: **roughly 60% of postings advertise no
salary at all.** An alert on "salary is null" fires constantly and is muted
within a day. An alert on "every salary is null" never fires for a site that was
always sparse.

So Revenant never looks at nulls. It compares each field's fill rate against
what *that specific collector* has historically produced. A 40% salary fill rate
is healthy for one board and a catastrophic regression for another.

```
same run, zero salaries extracted:
  baseline 0.5%  → healthy   (this source never had salary)
  baseline 40%   → broken    (extraction just died)
```

That single distinction is what lets the heal loop run unattended.
→ [`healing/baseline.ts`](packages/core/src/healing/baseline.ts)

### 2. A heal is graded before it is accepted

`bdata scraper heal` proposes a fix and **parks it at an approval gate**. The
obvious move is `--auto-approve`.

We deliberately don't.

Auto-approving accepts a fix on the word of the thing that produced it. A heal
that re-binds to the wrong DOM element restores the fill rate *perfectly* while
returning a job's department where its location used to be — and fill-rate
monitoring calls that a success.

So Revenant leaves the gate closed, re-runs the collector, grades the output
field-by-field against the ATS platform's **own JSON feed**, and only then
approves or rejects.

```
heal proposed → re-run → grade vs ground truth
                            ├─ accuracy rose and cleared the bar → approve
                            └─ otherwise                          → reject
```

Anyone can call self-heal. This is what lets us say *why we rejected one*.
→ [`healing/orchestrator.ts`](packages/core/src/healing/orchestrator.ts) ·
[`healing/audit.ts`](packages/core/src/healing/audit.ts)

---

## How Scraper Studio is used

Revenant scrapes the **rendered HTML** of ATS job boards through Scraper Studio.
It does not consume the platforms' JSON feeds as a data source, and that is a
deliberate architectural decision with two reasons:

**A stable API cannot break.** A pipeline built on one has nothing to self-heal
and no way to demonstrate that it does.

**The rendered page is strictly richer** — and this is measured, not asserted.
The same field, from the same company, by both routes:

```
compensation via the structured ATS feed     0 / 3,509     (0%)
compensation via Scraper Studio + parsing   43 / 50       (86%)
```

Greenhouse's feed carries **no compensation field whatsoever**. Pay-transparency
law still requires the range to appear in the posting, so it lands in the
description prose — `"The annual salary range for this position is $232,000 -
$348,000."` — where only a page scrape can reach it.

Recovered ranges from one real run, currency and all:

```
USD 230,000 – 340,000     USD 152,000 – 209,000     AUD 388,000 – 524,000
```

The JSON feeds stay on as an **oracle** — never a data source. They grade the
scrape and answer whether a role still exists.

### Graded against ground truth

Output of `npm run collect` against Vercel's board, scored field-by-field
against Greenhouse's own feed:

```
paired 50, unmatched 0
  title            100.0%
  location         100.0%
  applyUrl         100.0%
  descriptionHtml  100.0%
  postedAt           0.0%   ← the board index does not display dates
  overall           80.0%
```

`postedAt` is the honest gap: that value exists on individual job pages, not on
the index this collector reads. It is reported rather than hidden, because a
metric you can only pass is not a metric.

### The field spec

One plain-language description, reused across every platform. It says what each
value *is*, never where it sits — which is what remains true after a redesign,
and therefore what makes healing possible.

```
Every job posting on this board. For each: the job title as displayed; the
hiring company name; where the role is based as written; whether it is remote,
hybrid or on-site; the advertised salary range with its currency if stated
anywhere in the posting including the description text; the employment type;
the date it says it was posted; the full job description; and the link a
candidate follows to apply.
```

Tests assert this spec never mentions a selector, a class, or an XPath.
→ [`collectors/board.ts`](packages/core/src/collectors/board.ts)

### Commands

```bash
npx -p @brightdata/cli bdata login
npm run scraper:create -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/stripe
npm run collect       -w @revenant/core -- greenhouse <board-url>
```

`scraper:create` wraps `bdata scraper create`, writes the collector id into
`.env`, and takes 5–15 minutes on a real board — that is normal, not a hang.

---

## Matching a CV, without a model

Paste a CV at `/match` and every live posting is scored against it. Each result
names the skills it matched and the ones the posting asked for that the CV does
not mention:

> **[69] Robinhood — Senior Software Developer, DevX**
> Matches your Kubernetes, Python and CI/CD.
> Asks for Terraform and Go, not mentioned on your CV.

Matching is a set intersection over a curated skill vocabulary, not an embedding
search. That is a deliberate trade:

- **It can show its work.** "This posting asks for Kubernetes; your CV does not
  mention it" is checkable by the person reading it. A similarity score is not,
  and they are being asked to act on it.
- **It is deterministic**, so the score can be tested and cannot drift.
- **It costs nothing per posting** — 1,500 postings scored per request, in
  milliseconds, with no API key required.

The cost is recall: a skill outside the vocabulary is invisible. That is the
right way to fail here — a missed match is a smaller harm than a confident wrong
one.

Coverage is weighted by how much a posting actually named. Ratio alone put a
"Sr. Engagement Manager" at the top of a backend engineer's results on a single
mention of AWS, because 1/1 beats 8/8. Postings naming few skills are now pulled
toward neutral, and that role fell from 90 to 62.

Ghosts are excluded before ranking. A perfect skill match for a role filled in
April is precisely what this project exists to keep out of your list.

**Tailoring suggestions quote the sentence that motivates them**, so a change can
be judged rather than trusted — and Revenant never submits anything on your
behalf.

→ [`match/resume.ts`](packages/core/src/match/resume.ts)

## Ghost detection

A ghost job is *live* but not *real*. Aggregators cannot tell, because the only
fact they hold is that the listing is still on their own page.

Revenant reads two things aggregators never read together: the aggregator's copy
**and the company's own ATS board**. When a role is gone from the company's board
but still listed elsewhere, that is not a heuristic — the company itself stopped
listing it.

| Signal | Weight |
|---|---|
| Absent from the company's own board | **conclusive** |
| Apply link no longer resolves | high |
| Age since posting (gentle < 30d, steep > 90d) | high |
| Re-post churn with a fresh date | medium |
| Description unchanged across every check | low |

**`ghost` requires proof and is unreachable by inference.** A 2,000-day-old
listing with a dead apply link and 20 re-posts scores 0 and is still only marked
`stale`. Telling a job seeker a real role is dead costs them an opportunity —
the worse of the two errors — so `ghost` means exactly one thing wherever it
appears.

Every score ships with its reasons, because a bare number persuades nobody:

> *"Removed from the company's own job board 12 days ago, but still listed here."*

→ [`decay/liveness.ts`](packages/core/src/decay/liveness.ts)

---

## Finding companies without spending credits

Crawling to *discover* career pages means loading mostly-empty pages to find the
few that hold jobs — spending a metered budget on discovery rather than
extraction, and needing a crawler before it needs a scraper.

ATS boards are **addressable** instead. Every Greenhouse, Lever and Ashby board
lives at a known URL shape keyed by a company slug, so Revenant generates
candidate slugs from a company name and confirms each against the platform's
free feed *before* a collector ever loads the page.

```
$ npm run discover -w @revenant/core -- --file companies.txt

greenhouse  572 roles  https://job-boards.greenhouse.io/stripe
ashby       136 roles  https://jobs.ashbyhq.com/ramp
greenhouse  810 roles  https://job-boards.greenhouse.io/databricks
...
17/18 companies resolved, 2852 open roles, 2.4s
```

Zero Bright Data credits. What this buys is the **hidden job market** — roles
that live on a company's own board and never reach an aggregator at all.

→ [`discovery/`](packages/core/src/discovery/)

---

## Running it

Requires Node 22+. No native toolchain, no Docker, no external database.

```bash
npm install
npm run db:push  -w @revenant/core
npm run ingest   -w @revenant/core -- --file companies.txt
npm run dev      -w @revenant/web
```

Then open <http://localhost:3000>.

Add a Bright Data key to `.env` (copy `.env.example`) to enable the Scraper
Studio collectors. Without one, `ingest` seeds the database from the ATS feeds so
the pipeline, decay engine and UI all run on real jobs — that is a bootstrap for
local development, not the submitted design.

### Every command

| Command | What it does |
|---|---|
| `discover` | Resolve company names to public ATS boards |
| `ingest` | Populate the database end to end |
| `scraper:create` | Build a Scraper Studio collector |
| `collect` | Run a collector over a board |
| `oracle:check` | Verify ground-truth sources are reachable |
| `db:stats` | What is actually in the database |
| `db:reset` | Clear collected data, keep the schema |

---

## Current state

Real numbers from `npm run db:stats`, not claims:

```
postings                 3,509        across 15 company boards
  live                   2,053
  aging                    376
  stale                  1,080
  ghost                      0        ← see below
duplicates collapsed       108
tests                       135       in 11 files

Scraper Studio, one real run against Vercel's board:
  rows returned               50       0 rejected
  salary recovered         43/50       vs 0/3,509 through the structured feed
  accuracy vs ground truth    80%      100% on every field the index displays
```

**Why `ghost` is 0, and why that is correct.** A ghost requires a source that
*contradicts* the company's own board. The database is currently seeded from
that board alone, so every posting is confirmed present by construction. Ghosts
appear the moment a second, disagreeing source exists — an aggregator scrape, or
simply a later run after a company removes a role. The mechanism is built and
tested; it needs contradicting evidence to fire.

Reporting a fabricated ghost count would have been easy and would have made the
demo better. It would also have been a lie about the one thing this project
claims to do.

---

## Architecture

```
Bright Data Scraper Studio          one plain-language field spec
  rendered board HTML               proxy · unblocking · retries · self-heal
        │
        ▼
  collect ──► normalise ──► dedup ──► store
     │
     ├──► drift: fill rate vs per-collector baseline
     │      └── degraded? ──► heal ──► grade vs oracle ──► approve / reject
     │
     └──► decay: re-verify against the company's own board ──► liveness score
        │
        ▼
  SQLite (libsql + Drizzle)  ──►  Next.js 15
```

```
packages/core/
├── brightdata/   bdata CLI wrapper (create · run · heal · approve)
├── collectors/   Collector + Oracle contracts; the board collector
├── healing/      baselines · drift · ground-truth audit · orchestrator
├── decay/        liveness scoring and ghost detection
├── discovery/    company → ATS board resolution
├── normalize/    cross-source dedup
├── oracle/       ATS feeds as ground truth (never as a data source)
└── db/           schema and connection
apps/web/         feed · listing · health
```

Six structurally unrelated sources sit behind one four-member `Collector`
interface. → [`collectors/base.ts`](packages/core/src/collectors/base.ts)

---

## Scope and limits

**Public data only.** Company career boards and public ATS pages. Nothing
logged-in, paywalled, or personal.

**No automatic applications.** Revenant never submits anything on your behalf.
The tailoring is the valuable part; a bot can click a button, it cannot rewrite
your CV against a specific posting. Mass auto-apply is also the thing that broke
job boards for everyone, and platforms actively ban it.

**Not yet built:** CV tailoring, the health dashboard's real data (it currently
renders placeholder heal events — `heal_events` is empty because no collector
has healed yet), and the Ashby collector.

---

## AI assistance

This project was built with **Claude Code** (Claude Opus 5), as permitted by the
hackathon rules and disclosed here as they require. Architecture decisions,
design trade-offs and the code itself were produced collaboratively; every
number quoted in this README was measured by running the code, not asserted.

---

## Licence

MIT
