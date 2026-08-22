# Submission pack

Everything needed for the form, the video and the LinkedIn post, in one place.

---

## 1. Demo video script — 3 minutes

Record in one take where you can. Judges assume a cut at the interesting moment
means the interesting moment did not happen.

### 0:00 — The problem (25s)

> "Every job aggregator rots. Listings stay open months after the role was
> filled, the same job shows up on five boards, and when a site changes its
> markup a field quietly turns null — and nobody notices, because a missing
> salary looks exactly like a job that never advertised one.
>
> Revenant treats a posting as a decaying object."

### 0:25 — The feed (35s)

Open `/feed`. Point at the counts.

> "3,509 real postings from 15 company boards. Live, aging, stale — and every
> score carries its reason."

Click **stale**. Open one card.

> "Open for 107 days. Re-posted twice. That's not a guess, it's the posting's
> own history."

### 1:00 — Match against a CV (35s)

Open `/match`, click **Use a sample CV**.

> "It scored 1,500 live postings in under a second. No model call — it names
> the exact skills that matched, and the ones the posting asked for that the CV
> doesn't mention."

Expand **What to add**.

> "And every suggestion quotes the sentence in the posting that motivates it.
> We stop here — Revenant never applies for you."

### 1:35 — Scraper Studio, and the number that matters (35s)

Show the terminal, run `npm run collect`.

> "This is a Scraper Studio collector on the rendered board HTML. Watch the
> salary field.
>
> Greenhouse's structured API carries zero compensation across all 3,509
> postings. Pay-transparency law puts the range in the description prose — so
> Scraper Studio extracts it from the page. 43 of 50. Zero to 86 percent.
> That's why we scrape the page instead of consuming the API."

### 2:10 — Self-healing, graded (40s)

Split screen: chaos target on the left, terminal on the right.

```bash
npm run heal -w @revenant/core -- chaos <url>   # baseline
curl <url>/chaos/flip                           # redesign, live
npm run heal -w @revenant/core -- chaos <url>   # detect, heal, grade
```

> "Same URL. The markup just changed underneath it — every class renamed, the
> salary nested and split.
>
> The fill rate collapses against the baseline, so we ask Scraper Studio to
> heal. It proposes a fix and parks it at an approval gate.
>
> We don't auto-approve. A heal that latches onto the wrong element refills the
> field perfectly and returns the department where the location used to be —
> fill rate calls that a success. So we re-run, grade it against the platform's
> own feed, and only then approve."

### 2:50 — Close (10s)

> "Anyone can call self-heal. We're the only ones who can tell you why we
> rejected one."

---

## 2. LinkedIn post

> Job boards rot, and nobody measures it.
>
> A listing stays "open" months after the role was filled. The same job appears
> on five boards. And when a site changes its markup, a field quietly turns null
> — invisible, because a missing salary looks exactly like a job that never
> advertised one.
>
> So for Into the Scrape-Verse I built Revenant: a job feed that knows which
> listings are already dead.
>
> Two things I learned building it.
>
> 1️⃣ Compensation is in the page, not the API.
>
> Greenhouse's structured feed carries no salary field at all — 0 out of 3,509
> postings I collected. But pay-transparency law requires the range to appear in
> the posting, so it lands in the description prose.
>
> Bright Data Scraper Studio extracts it from the rendered page: 43 of 50. Zero
> to 86%. That single measurement is the whole argument for scraping pages
> instead of consuming APIs.
>
> 2️⃣ "It healed" is not the same as "it healed correctly."
>
> `bdata scraper heal` parks a proposed fix at an approval gate. The obvious move
> is --auto-approve. I deliberately didn't.
>
> A heal that re-binds to the wrong element restores the fill rate perfectly
> while returning a job's department where its location used to be. Fill-rate
> monitoring calls that a success.
>
> So Revenant leaves the gate closed, re-runs the collector, grades the result
> against the ATS platform's own JSON feed, and approves or rejects on measured
> accuracy. Anyone can call self-heal. This is what lets me say why I rejected
> one.
>
> Also in there: ghost-job detection that requires proof (a role is only called
> dead when the company's own board contradicts the listing), and CV matching
> that names the exact skills you're missing rather than handing you a number.
>
> It never applies on your behalf. Public data in, human decision out.
>
> 135 tests. Built with Claude Code, disclosed in the README.
>
> Repo: <your-repo-url>
>
> #ScrapeVerse #BrightData #WeMakeDevs

**Post it with a screenshot of `/health` or the heal terminal output** — the
numbers are the hook, not the logo.

---

## 3. Form checklist

| Field | Answer |
|---|---|
| Repo | `https://github.com/mrayhankhan/revenant` |
| Demo video | (link) |
| Structured output | `docs/sample-output.json` — 50 real postings |
| Scraper Studio use | See README § "How Scraper Studio is used" |
| AI disclosure | Claude Code, disclosed in README § "AI assistance" |
| Public data only | Public ATS boards. No auth, no paywall, no government sites. |

### Collector

```
c_msyq5cea136y76lhb0   greenhouse board HTML
```

### Numbers worth quoting

```
3,509 postings · 15 company boards · 108 duplicates collapsed
salary:   0/3,509 via ATS API   →   43/50 via Scraper Studio   (0% → 86%)
accuracy vs ground truth: 100% on title, location, applyUrl, description
matching: 1,500 postings scored per request, no model call
135 tests
```

---

## 4. Order of operations

1. `gh auth login`, make the repo public, push
2. **Submit the form now** — it accepts updates until the deadline
3. Record the video
4. Update the submission with the video link
5. Post on LinkedIn, tag WeMakeDevs

Submitting early costs nothing and guarantees the certificate and Top-50 swag.
Leaving it to the last hour risks everything built this week.
