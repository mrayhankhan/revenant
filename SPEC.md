# Halflife

**The job feed that knows which listings are already dead.**

Submission for *Into the Scrape-Verse* (WeMakeDevs × Bright Data, Aug 17–23 2026).

---

## 1. The thesis

Every job aggregator on the market rots. Listings stay "open" for nine months after
the role was filled. The same job appears five times across five boards. A board
changes its markup and the salary field quietly becomes `null` for every row after
that — and nobody notices, because a missing field looks exactly like a job that
didn't post a salary.

Halflife treats a job posting as a **decaying object**. Every listing carries a
freshness score and a per-field verification timestamp. We re-verify continuously,
detect ghost jobs, collapse duplicates across boards, and when a board changes its
layout the collector repairs itself and backfills the gap.

Then, because the data is trustworthy, we do the thing the data was always for:
tailor a CV and cover letter against a specific posting, with every edit traced to
the line in the posting that justified it.

**We deliberately stop before submit.** Public data in, human decision out. No
auto-apply, no logged-in scraping, no ATS automation.

---

## 2. Why this scores on all six criteria

| Criterion | How Halflife scores |
|---|---|
| **Potential impact** | Everyone in the room has job-hunted. Ghost jobs and stale listings are a felt, universal problem with no good existing solution. |
| **Creativity & innovation** | Ghost-job detection and field-level decay scoring are genuinely novel. No aggregator does this. It reframes "job board" as "data freshness problem." |
| **Technical excellence** | Heterogeneous sources → one canonical schema, fuzzy cross-board dedup, scheduled verification, provenance on every field. Real engineering, not CRUD. |
| **Use of Scraper Studio** | 6 collectors across 6 structurally unrelated sites, all driven from one plain-language field spec. Studio is the load-bearing wall, not a dependency. |
| **Reliability & self-healing** | Self-healing is the *product thesis*, not a feature. Per-field fill-rate monitoring auto-triggers heal, heal events are first-class objects surfaced in the UI with selector diffs. |
| **Presentation** | Live chaos-target demo: mutate a board mid-video, watch the collector break, heal, and backfill on camera. See §8. |

**Track coverage:**
- *Web-Slinger (Best Use of Bright Data)* — §5, §6. Deepest possible Studio usage.
- *Suit-Up (Best UI)* — §7. Feed, decay timeline, heal timeline, CV diff view.
- *Spider-Sense (Best Clean Code)* — §9. One app, one worker, typed end to end, one-command setup.

---

## 3. Scope — what ships and what doesn't

**Ships (v1, the demo):**
1. 6 self-healing collectors, one per source.
2. Normalizer → canonical `Posting` schema.
3. Cross-board dedup.
4. Decay engine + ghost-job detection.
5. Heal loop with heal-event history.
6. CV + cover letter tailoring with per-edit provenance.
7. Web UI: feed, listing detail, health dashboard, CV diff.

**Explicitly out of scope** (say so in the README — restraint reads as judgment):
- Automatic application submission.
- Any logged-in or paywalled source.
- Email/notification delivery.
- User accounts. Single-profile local app; the résumé is a file you drop in.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Bright Data Scraper Studio                                 │
│  6 collectors, one plain-language field spec each           │
│  proxy rotation · unblocking · retries · SELF-HEAL          │
└────────────────────────┬────────────────────────────────────┘
                         │ Bright Data CLI / API
┌────────────────────────▼────────────────────────────────────┐
│  worker/  (scheduled, Node + TS)                            │
│                                                             │
│   collect ──► normalize ──► dedup ──► persist               │
│      │                                                      │
│      ├──► health: per-field fill-rate vs baseline           │
│      │      └── degraded? ──► trigger self-heal ──► backfill│
│      │                                                      │
│      └──► verify: re-check live postings ──► decay score    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  SQLite (Drizzle ORM)                                       │
│  postings · sources · field_observations · heal_events      │
│  verifications · duplicates · tailorings                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  web/  Next.js 15 (App Router) + Tailwind + shadcn/ui       │
│  Feed · Listing · Health · Tailor                           │
└─────────────────────────────────────────────────────────────┘
```

**Stack decisions, and why:**
- **SQLite + Drizzle** — no Docker, no external DB. `npm run setup` and it runs. Clean-code judges reward a repo that starts on the first try.
- **Next.js single app** — API routes + UI in one place. No microservices to explain.
- **TypeScript strict, zod at every boundary** — every Studio response is parsed through a schema before it touches the DB. This is also *how we detect drift*: a zod failure is a healing signal.
- **Claude (claude-opus-5) for prose fields** — parsing requirements out of freeform JD text, and CV tailoring. Structured outputs only, never free text into the DB.

---

## 5. The collectors

Six sources, chosen so that structural diversity is maximal — that's what makes
self-healing visible.

| # | Source | Type | Why it's in |
|---|---|---|---|
| 1 | **Greenhouse** job boards | Structured ATS | Clean, predictable. The control group. |
| 2 | **Lever** postings | Structured ATS | Different shape, same logical schema. Proves the plain-language spec generalizes. |
| 3 | **Ashby** boards | JS-heavy ATS | Client-rendered. Exercises Bright Data's rendering. |
| 4 | **Wellfound** | Aggregator | Startup roles, comp data usually present. |
| 5 | **Company careers pages** | Unstructured | The hard case. 5–10 hand-picked companies, wildly different HTML. This is where self-healing earns its keep — *and* it's the ghost-job ground truth (§6). |
| 6 | **Indeed** | Large aggregator | Volume + the strongest anti-bot target we attempt. |

**Bonus, not load-bearing:** LinkedIn. Most aggressive anti-bot of the set. Attempt
it, but the demo must be green without it. Never gate the video on it.

**The plain-language field spec** — one description, reused across all six. This is
the core Scraper Studio story:

```
title            the job title as displayed
company          the hiring company's name
location         where the role is based, as written
remote_policy    remote, hybrid, on-site, or unstated
salary_min       lower bound of advertised compensation, if any
salary_max       upper bound of advertised compensation, if any
salary_currency  currency of the advertised compensation
employment_type  full-time, contract, internship, etc.
posted_at        the date the listing says it was posted
description_html the full job description body
apply_url        the link a candidate would follow to apply
```

Studio rewrites the extraction per site from these descriptions. When a site moves,
the description is still true — that's the whole pitch, and it's what we demo.

**Credit budget.** Free tier is 5,000 credits/month plus the $50 `wemakedevs` code.
Rules of engagement:
- Cap initial harvest at ~1,500 listings total across all sources.
- Verification re-checks are **incremental**: only postings not verified in 24h, and
  only the cheapest possible check (§6).
- Never re-scrape unchanged pages. Store a content hash.
- Reserve ~500 credits untouched for demo day. Do not burn these.

---

## 6. The two engines

### 6.1 Decay engine — ghost-job detection

A ghost job is a listing that is *live* but not *real*: filled, cancelled, or a
permanent evergreen req collecting résumés. We infer it from converging signals.

| Signal | Weight | How we get it |
|---|---|---|
| Age since `posted_at` | high | From the listing. >90 days is a strong signal. |
| **Absent from the company's own careers page** | **highest** | Source #5 is the ground truth. If Indeed still lists it and the company's own page doesn't, it's a ghost. This is the killer signal — it's only possible *because* we scrape both. |
| Repost churn | medium | Same role reposted N times with a fresh `posted_at`. Detected via dedup history. |
| `apply_url` dead or redirects to a generic careers index | high | Cheap HEAD request, no Studio credits. |
| Description unchanged across many verifications | low | Content hash. |

Output per listing: a **halflife score** (0–100) and a plain-English reason string
— *"Still listed on Indeed, but removed from Acme's careers page 12 days ago."*
The reason string is what sells it in the demo; never show a bare number.

**Verification loop** — nightly, cheapest-first, short-circuit on any conclusive
signal so we don't spend Studio credits when a HEAD request already answered it.

### 6.2 Heal loop — self-healing

Per collector, per field, we track fill-rate over a rolling window and compare
against a baseline established during the first successful run.

```
observe → baseline → detect → heal → verify → backfill → record
```

- **Detect.** A field's fill-rate drops below `baseline * 0.5`, or zod parsing starts
  failing for a field that previously parsed. Both are drift.
  Critically: distinguish *"no salary posted"* (normal, was always ~40% fill) from
  *"salary extraction broke"* (was 40%, now 0%). Baselines make this possible — a
  naive null-check cannot tell these apart, and this distinction is the single most
  technically interesting thing in the project. Lead with it in the README.
- **Heal.** Trigger Scraper Studio's self-heal for that collector.
- **Verify.** Re-run against a small fixture set of known-good URLs. Fill-rate
  recovered? Then the heal took.
- **Backfill.** Re-scrape rows collected during the degraded window so no gap
  persists downstream.
- **Record.** Persist a `heal_event`: timestamp, collector, field, before/after
  selector, rows affected, rows recovered. **This is a first-class UI object.**

---

## 7. UI — the Suit-Up track

Four screens. Dark, dense, typographic. Data-first, not marketing-site.

1. **Feed.** Job cards with a halflife indicator (a decaying bar, not a badge),
   match score, comp, source pills showing all boards a deduped role appeared on.
   Filters: freshness, comp, remote, stack. Default sort: *freshest that matches*.
2. **Listing.** Parsed requirements as chips. Decay timeline — every verification as
   a point, the moment it vanished from the company's careers page marked in red.
   Every field annotated with "verified 4h ago" on hover.
3. **Health.** The Watchtower. Per-collector, per-field fill-rate sparklines. Heal
   events on a timeline with expandable before/after selector diffs. This screen is
   what wins the Bright Data track — make it beautiful, not utilitarian.
4. **Tailor.** Résumé side-by-side with the tailored version, changes highlighted.
   Click any change → the exact line in the job description that justified it.
   Export PDF. **No submit button anywhere, by design.**

Design rules: one accent colour, everything else greyscale. Motion only on state
change (a heal event landing should animate; nothing else should). Real data in
every screenshot — no lorem ipsum, judges notice.

---

## 8. The demo — the chaos target

The highest-leverage 90 seconds of the entire week. Nobody can wait for Greenhouse
to redesign during a 3-minute video, so we make it happen on command.

**Setup:** clone one Greenhouse board to a static page, deploy to Vercel at
`chaos-target.vercel.app`. Add collector #7 pointed at it. Keep a mutation script
that renames classes, moves the salary into a nested span, and reorders the DOM.

**Demo script (3 min):**

| Time | Beat |
|---|---|
| 0:00 | The problem. A real listing, live on a board today, that the company's own careers page no longer has. "This job doesn't exist. Every aggregator still shows it." |
| 0:25 | The feed. Fresh roles, deduped across six boards, ghosts greyed out with reasons. |
| 0:50 | Tailor. Pick a role, CV rewrites itself, click a change → the requirement that drove it. |
| 1:20 | **Chaos.** Split screen. Run the mutation script — page visibly changes. Health screen: salary fill-rate drops to 0, field goes red. |
| 1:50 | **Heal.** Self-heal fires. Selector diff appears on screen, old → new. Field returns to green. Backfill runs. Row count recovers. |
| 2:20 | "The field description never changed. The page did." Restate the thesis. |
| 2:40 | Scope statement: public data only, we stop before submit. |

Record the healing beat **for real, unedited, in one take**. If it's cut, judges
assume it's staged.

---

## 9. Repo layout — the Spider-Sense track

```
halflife/
├── README.md              # problem, architecture, Studio usage, AI disclosure, one-command setup
├── SPEC.md                # this file
├── .env.example
├── package.json           # npm run setup | dev | collect | verify | heal
├── docs/
│   ├── architecture.md
│   ├── self-healing.md    # the baseline-vs-null insight, written up properly
│   └── sample-output.json # REQUIRED DELIVERABLE: example structured output
├── packages/
│   ├── schema/            # zod schemas + drizzle tables. Single source of truth.
│   ├── collectors/        # one module per source, identical interface
│   │   ├── base.ts        # Collector interface — every source implements this
│   │   ├── greenhouse.ts
│   │   └── ...
│   ├── normalize/         # source rows → canonical Posting
│   ├── dedup/
│   ├── decay/             # halflife scoring + ghost detection
│   ├── healing/           # baselines, drift detection, heal orchestration
│   └── tailor/            # CV + cover letter, provenance tracking
├── worker/                # scheduler; composes the packages, holds no logic itself
└── web/                   # Next.js app
```

**Standards, enforced not aspirational:** TypeScript strict. Zod at every I/O
boundary. No `any`. Every package has a README paragraph. Vitest on `decay`,
`dedup`, `normalize`, `healing` — the four pieces with real logic. ESLint + Prettier
in CI via GitHub Actions. Conventional commits. `npm run setup && npm run dev` works
from a fresh clone with only a Bright Data key in `.env`.

The Collector interface is the thing a judge will notice — six wildly different
sources behind one identical 4-method contract is the clearest possible signal of
structure.

---

## 10. Schedule — Aug 17–23

| Day | Goal | Done when |
|---|---|---|
| **17** | Scaffold + first collector | Repo runs. Greenhouse collector returns typed rows into SQLite. |
| **18** | All 6 collectors + normalizer + dedup | 1,000+ real listings, deduped, in canonical schema. |
| **19** | Healing engine | Baselines recorded, drift detected, heal triggers, `heal_events` persisted. Chaos target deployed. |
| **20** | Decay + ghost detection | Halflife scores with reason strings. Careers-page cross-check working. |
| **21** | UI: feed + listing + health | All three screens on real data. This is a full design day — do not compress it. |
| **22** | Tailoring + polish | CV diff with provenance. README, docs, sample output, CI green. |
| **23** | Demo + submit | Video recorded (healing in one unedited take). Repo public. Submitted with hours to spare. |

**Hard rules:** UI day is untouchable — the Suit-Up track is won on the 21st, and a
beautiful UI also carries the Presentation criterion. Feature-freeze at noon on the
23rd. A polished 80% project beats a broken 100% one in every hackathon ever run.

**If we fall behind, cut in this order:** LinkedIn → Indeed → cover letters (keep CV
tailoring) → Wellfound. Never cut: healing, health screen, ghost detection, chaos
demo. Those are four of the six criteria.

---

## 11. Submission checklist

- [ ] Public repo
- [ ] README: problem, architecture, **how Scraper Studio is used**, setup, scope limits
- [ ] `docs/sample-output.json` — example structured output
- [ ] Demo video
- [ ] Explicit explanation of Scraper Studio's role
- [ ] **AI assistance disclosed** (built with Claude Code — undisclosed use is a stated disqualifier)
- [ ] Public data only; no logged-in, paywalled, or personal data — stated in README
- [ ] Synthetic résumé in all demos and fixtures. Never a real employment history in a public repo.
```
