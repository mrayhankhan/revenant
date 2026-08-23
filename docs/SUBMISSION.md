# Submission pack

Everything for the form, the video, the screenshots and the LinkedIn post.

**Repo** https://github.com/mrayhankhan/revenant
**Demo** https://revenant-jobs.vercel.app (no login)
**Collector** `c_msyq5cea136y76lhb0`

---

## 1. Screenshots — done

All four are in `docs/screenshots/` and live in the README.

---

## 2. The video — 2.5 minutes

### Before you start

**Facecam in a corner, one window at a time.** Not split-screen — the terminal
output has to be readable, and sharing the frame with a browser and a face
leaves none of it legible. Record full-screen browser and full-screen terminal
and alt-tab between them. Switching windows on camera reads as deliberate; it is
the shared frame that reads as clutter.

**Terminal font size 18 or larger.** This is the part that has to be believed,
and nobody can read 12pt on a phone.

**Start with the chaos board on its original design.** The command to put it
there is in the 2:00 beat below, along with the one that breaks it.

**Every command below is written `npm.cmd` and `npx.cmd`, on purpose.** Plain
`npm` and `npx` resolve to `.ps1` shims that PowerShell's execution policy
refuses to load, and the run dies before it starts:

> npx : File ...
px.ps1 cannot be loaded because running scripts is disabled on
> this system.

The `.cmd` form is the same tool and skips the shim entirely. Copy the commands
exactly as written — all three have been run and verified in this shell.

**Neither of the two winners I looked at showed self-healing happening.** SRE
Sentinel won a FutureStack prize for automated self-healing and its README
explains it entirely in ASCII diagrams. If you actually show a break and a
repair, you are doing the thing they only described.

---

### 0:00 (20s) — The problem

**Show:** landing page, top.

> "Everyone has applied to a job that was already filled.
>
> You check the date. It says two days ago. So you spend an hour on the
> application — but the company filled that role in March and just re-posted it.
> The clock reset.
>
> I collected eleven thousand postings to see how often that happens. A hundred
> and seventeen of them look under two weeks old and are re-posts of something
> over a month old. One role has been re-listed across six and a half years."

---

### 0:20 (30s) — Why I scrape companies, not LinkedIn

**Show:** scroll slowly through the story chapters on the landing page.

> "Here's the part that makes this work.
>
> LinkedIn and Indeed are aggregators. They hold a *copy* of a job posting, and
> nobody tells them when it's taken down.
>
> So I don't scrape them. I scrape the companies directly — Greenhouse, Lever and
> Ashby, the systems companies actually run hiring on. That's the source, not a
> copy.
>
> Which means I can do something an aggregator can't: if a role is gone from the
> company's own board but still listed elsewhere, that isn't a guess. That's the
> company contradicting the listing."

---

### 0:50 (35s) — The product

**Show:** `/feed`. Filter to **Engineering**. Hover a card so it flips over.

> "Five thousand live postings, ninety-six company boards, all collected with
> Bright Data Scraper Studio.
>
> Filter by function, level, remote. Hover a card and it turns over.
>
> Every job has a score — and underneath it, the reason for that score."

**Show:** click **Stale**, open a card.

> "Open a hundred and seven days. Re-posted twice. That's why."

**Show:** `/match`, click **Use a sample CV**, expand one "what to add".

> "Paste a CV and every job gets scored against it. No AI model — it names the
> skills that matched, and what the job asks for that your CV doesn't mention,
> quoting the sentence that says so.
>
> And it stops there. It never applies for you."

---

### 1:25 (35s) — Scraper Studio, and the number that matters

**Show:** terminal, full screen. Run this:

```bash
npm.cmd run collect -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel
```

> "I described the data I wanted in one paragraph of plain English. No CSS
> selectors. Scraper Studio built the scraper — and the same paragraph works on
> all three platforms, which have completely different page layouts.
>
> Now watch the salary field."

**Wait for the bars. Let them fill.**

> "These companies publish a JSON API. It has no salary field at all — zero out
> of eleven thousand postings.
>
> But pay-transparency law says the range has to appear in the posting. So it's
> there, buried in the description text, where an API can never reach it.
>
> Scraper Studio reads it off the page. Forty-three of fifty. Zero, to
> eighty-six percent.
>
> That's why I scrape the rendered page instead of calling the API."

---

### 2:00 (30s) — Self-healing, live

This is the one section that has to be one continuous take. Alt-tab between the
two windows rather than cutting.

**Browser, full screen:** `https://revenant-chaos.vercel.app` — the original
design. If it is not already there, put it there *before you hit record*:

```bash
npx.cmd vercel alias set revenant-chaos-jld8rwkq2-rays-projects-6f560386.vercel.app revenant-chaos.vercel.app
```

> "Last part. This is a job board I control, so I can break it on purpose."

**Alt-tab to the terminal.** Run the heal loop — it reports 60 rows, healthy:

```bash
npm.cmd run heal -w @revenant/core -- chaos https://revenant-chaos.vercel.app
```

> "The scraper reads it fine. Sixty jobs."

**Now redesign the board.** Same URL, completely different HTML, about two
seconds — no redeploy, no cut:

```bash
npx.cmd vercel alias set revenant-chaos-7y9in19er-rays-projects-6f560386.vercel.app revenant-chaos.vercel.app
```

**Alt-tab back to the browser and refresh it on camera.** The page visibly
changes. This is the moment the whole section rests on — let the viewer see it.

> "Now the company redesigns their site. Same URL — every class renamed, the
> salary moved and split apart."

**Alt-tab to the terminal. Run the same heal command again.**

> "Zero rows. The scraper is broken.
>
> Scraper Studio proposes a fix — and I don't auto-approve it. A bad fix can grab
> the wrong element and refill the field with the wrong value. It looks perfectly
> healthy and the data is wrong. So the fix gets checked against the company's own
> feed first."

**Let the output land.**

> "Sixty rows back. And it recovered the job title, which the original scraper
> never managed to extract at all."

**When the take is done, put the board back on the original design** — otherwise
the next attempt starts already broken and there is nothing left to break:

```bash
npx.cmd vercel alias set revenant-chaos-jld8rwkq2-rays-projects-6f560386.vercel.app revenant-chaos.vercel.app
```

---

### 2:30 (5s) — Close

**Show:** the feed again.

> "Public job data in. Human decision out. It never applies for you."

---

### The four things a judge should remember

If you only get four sentences across, make them these:

1. **I scrape companies directly, not LinkedIn** — Greenhouse, Lever, Ashby. The
   source, not a copy.
2. **That lets me prove a job is dead** — gone from the company's board but still
   listed elsewhere is the company contradicting the listing.
3. **The page has data the API does not** — salary, zero to eighty-six percent.
4. **A heal is checked before it is trusted** — against the company's own feed,
   not against what my scraper produced yesterday.

---

### If you fumble

Do not re-record the whole thing. The only section that must be continuous is
the heal, because a cut there looks like the break was staged — and even there,
alt-tabbing between windows is not a cut. Everything before it can be recorded
in pieces and joined.

---

## 3. LinkedIn post

Tag **WeMakeDevs** and **Bright Data**. Judged on quality, not engagement.

> Everyone says: just check the posting date.
>
> I collected 11,153 job postings to see whether that works. It does not.
>
> 1,015 roles appear more than once. 117 listings are under two weeks old and are
> re-lists of a role first posted over a month earlier. One role has been
> re-listed across 2,404 days.
>
> Companies re-post and the clock resets — so the listings that waste your time
> look like the freshest ones on the board.
>
> So for Into the Scrape-Verse I built Revenant: it checks each posting against
> the company's own careers board. Gone from their board but still listed
> elsewhere is not a guess. That is the company contradicting the listing.
>
> Two things I learned building it with Bright Data Scraper Studio.
>
> 1) Compensation is in the page, not the API.
>
> Greenhouse's structured feed has no salary field at all — 0 of 11,153 postings.
> Pay-transparency law still requires the range to appear, so it lands in the
> description prose. Scraper Studio pulls it out of the rendered page: 43 of 50 on
> one board. Zero to 86%.
>
> That single measurement is the whole argument for scraping pages instead of
> consuming APIs.
>
> 2) "It healed" is not the same as "it healed correctly."
>
> `bdata scraper heal` parks a proposed fix at an approval gate. The obvious move
> is --auto-approve. I deliberately did not.
>
> A heal can re-bind to the wrong element: the fill rate recovers perfectly while
> the field returns a job's department where its location used to be. Fill-rate
> monitoring calls that a success.
>
> So the fix is re-run and graded against the ATS platform's own feed, and only
> approved if accuracy actually improved.
>
> 5,348 live postings · 96 company boards · Greenhouse, Lever and Ashby · 149 tests
>
> Live, no login: https://revenant-jobs.vercel.app
> Code: https://github.com/mrayhankhan/revenant
>
> Built with Claude Code, disclosed in the README.
>
> #ScrapeVerse #BrightData #WeMakeDevs

Post it with the `/health` screenshot or the terminal output. The numbers are the
hook.

---

## 4. Form answers

Do not write N/A anywhere — that was called out on the livestream.

Every number below is reproducible from the database committed to the repo
(`data/demo.db`), so a judge who clones it gets the same figures.

---

**What does your project do? / What problem does it solve, and who is it for?**

> Revenant is a job feed that tells you which listings are already dead.
>
> The problem is that a posting date is not the age of a role. When a company
> re-lists a job the clock resets, so a role filled months ago reads as posted
> this week — and "just check the date" is the advice everyone gives. In the
> database committed to this repo, 463 roles appear more than once, and 25
> postings that look under two weeks old are re-listings of something first
> posted over a month earlier. The widest gap between listings of the same role
> is 1,502 days. A date filter reads every one of those as new.
>
> So Revenant does not infer age from the date. It reads the company's own
> careers board — Greenhouse, Lever, Ashby, the systems companies actually run
> hiring on — and compares. If a role is gone from the company's board but is
> still listed elsewhere, that is the company contradicting the listing, and the
> job is provably dead rather than merely old. Every posting carries a liveness
> score with the reason in plain language underneath it, and the word "ghost" is
> reserved for cases that can be backed up: a 2,000-day-old listing with a dead
> apply link still only scores as stale, because telling someone a real job is
> dead costs them an opportunity.
>
> It also recovers salary that the ATS APIs do not carry, marks how many times a
> role has been re-listed, filters by function, level and remote policy, and
> ranks postings against a pasted CV — naming the skills that matched and the
> ones the job asks for that the CV never mentions, quoting the sentence that
> asks.
>
> It is for people applying to jobs, and most of all for early-career applicants,
> for whom an hour spent tailoring an application to a role that was filled in
> March is an hour that buys nothing. It never applies on anyone's behalf and it
> decides nothing for you — it tells you which listings are worth your time and
> shows its reasoning.
>
> 5,348 postings across 96 company boards. No login, no account, and a pasted CV
> is scored in memory and never stored.

---

**How did you use Scraper Studio? / What are you scraping and how does it fit?**

> I scrape the rendered HTML of public ATS job boards — `job-boards.greenhouse.io`,
> `jobs.lever.co` and `jobs.ashbyhq.com` — for 96 companies including Stripe,
> Anthropic, Cloudflare, Databricks and Ramp. Not LinkedIn or Indeed: those are
> aggregators holding a *copy* of a posting, and nobody tells them when it comes
> down. Scraping the company's own board is what makes the whole project
> possible, because it is the source rather than a copy of it.
>
> Scraper Studio is what lets one description work across all three platforms. I
> wrote a single paragraph of plain English describing what each field *is* —
> never where it sits in the DOM — and `bdata scraper create` built the collector
> (`c_msyq5cea136y76lhb0`). The phrase that mattered was asking for "the
> advertised salary range with its currency if stated anywhere in the posting
> **including the description text**". Boards put "Competitive compensation
> package" in the salary field and hide the real number in prose further down the
> page; asking for it anywhere in the posting is what finds it. Three completely
> different page structures, one description — that is the part I could not have
> hand-written in a week.
>
> I pointed it at the rendered page rather than the JSON APIs these platforms
> publish, deliberately, for two reasons. Greenhouse's board API has no
> compensation field at all, so the page carries data the API cannot give me — on
> Vercel's board the API returned 0 salary ranges out of 50 and the Scraper Studio
> collector returned 43. And an API that never changes shape gives self-healing
> nothing to do. The APIs are still used, but as a reference to grade the scrape
> against, never as the source: 80% accuracy overall, 100% on every field the page
> actually shows.
>
> `bdata scraper run` collects. `bdata scraper heal` repairs — and I never pass
> `--auto-approve`. A heal can latch onto the wrong element, refill the field
> perfectly, and return a job's department where its location used to be: the fill
> rate looks healthy and the data is wrong. So the heal parks at the approval
> gate, I read the rows the gate says the fix *would* produce, grade them against
> the ATS platform's own feed, and only then call `bdata scraper approve`.
>
> I ran that loop for real rather than only building it. I deployed a job board I
> control, pointed a collector at it, and redesigned it at the same URL — every
> class renamed, the salary nested and split across three elements. The collector
> dropped to 0 rows, the detector caught it, the heal was proposed, graded and
> approved, and 60 rows came back — including the job title, which the original
> collector had never managed to extract at all.
>
> Running it live also broke two assumptions I had written into the code. Drift is
> measured per field across rows, so a run returning no rows produces no evidence
> about any field — the loop printed "extraction is healthy" while extraction was
> completely broken, which was the worst failure and the only one it could not
> see. And I had been grading a re-run of the collector, but a proposed fix is not
> live until it is approved, so the re-run always returns the *old* scraper's
> output: the first genuine heal got rejected for being correct. Both are fixed,
> both are explained in the README, and neither would have surfaced from reading
> the code.

---

**Which websites did you scrape?**
> Public ATS job boards: `job-boards.greenhouse.io`, `jobs.lever.co` and
> `jobs.ashbyhq.com` for 96 companies including Stripe, Anthropic, Cloudflare,
> Databricks and Ramp. All public, no login, no paywall, no personal data, no
> government sites.

**AI disclosure**
> Built with Claude Code (Claude Opus 5). I directed the architecture and design
> decisions and can explain every part of the codebase. Every number in the README
> came from running the code.

---

## 5. Order of operations

1. Submit the form now with the repo and demo links
2. Take the four screenshots, commit them
3. Record the video, update the submission
4. Post on LinkedIn

The form accepts edits until the deadline, so submitting first costs nothing and
removes the risk of losing the week's work to a clock.
