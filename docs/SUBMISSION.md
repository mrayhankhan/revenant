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

**On Windows, use `npm.cmd` rather than `npm`** — PowerShell's execution policy
blocks the `.ps1` shim and the run dies before it starts. Worth testing each
command once before you record.

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
npm run collect -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel
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
npx vercel alias set revenant-chaos-jld8rwkq2-rays-projects-6f560386.vercel.app revenant-chaos.vercel.app
```

> "Last part. This is a job board I control, so I can break it on purpose."

**Alt-tab to the terminal.** Run the heal loop — it reports 60 rows, healthy:

```bash
npm run heal -w @revenant/core -- chaos https://revenant-chaos.vercel.app
```

> "The scraper reads it fine. Sixty jobs."

**Now redesign the board.** Same URL, completely different HTML, about two
seconds — no redeploy, no cut:

```bash
npx vercel alias set revenant-chaos-7y9in19er-rays-projects-6f560386.vercel.app revenant-chaos.vercel.app
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

**What does your project do?**
> Revenant is a job feed that tells you which listings are already dead. It
> scrapes public ATS job boards with Bright Data Scraper Studio, then checks each
> posting against the company's own careers board — a role that is gone from
> their board but still listed elsewhere is provably dead, not merely old. It also
> recovers salary that the ATS APIs do not carry, and ranks postings against your
> CV without ever applying on your behalf.

**How did you use Bright Data Scraper Studio?**
> I built a custom collector (`c_msyq5cea136y76lhb0`) with
> `bdata scraper create`, using one plain-English field spec reused across
> Greenhouse, Lever and Ashby boards. It scrapes the rendered board HTML rather
> than the platforms' JSON APIs, for two reasons: the APIs carry no compensation
> field at all, and an API that never changes shape gives self-healing nothing to
> do. `bdata scraper run` collects, and `bdata scraper heal` repairs — without
> `--auto-approve`, because the proposed fix is re-run and graded against the ATS
> platform's own feed before `bdata scraper approve` accepts it. The collector ID
> feeds a SQLite database and a Next.js app.

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
