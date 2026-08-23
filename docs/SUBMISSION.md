# Submission pack

Everything for the form, the video, the screenshots and the LinkedIn post.

**Repo** https://github.com/mrayhankhan/revenant
**Demo** https://revenant-jobs.vercel.app (no login)
**Collector** `c_msyq5cea136y76lhb0`

---

## 1. Screenshots — done

All four are in `docs/screenshots/` and live in the README.

---

## 2a. Short version — 90 seconds

The floor worth recording. Four beats, nothing cut that a judge needs. Roughly
220 words, which is 90 seconds at a normal speaking pace — do not rush it to fit.

### 0:00 (15s) — The problem, and the idea

**Show:** landing page.

> "Everyone has applied to a job that was already filled. You check the date, it
> says two days ago — but the company filled it in March and re-posted it.
>
> LinkedIn and Indeed only hold a *copy* of a posting, and nobody tells them when
> it comes down. So I don't scrape them. I scrape the companies directly —
> Greenhouse, Lever, Ashby. The source, not a copy.
>
> That means if a role is gone from the company's own board but still listed
> elsewhere, it isn't a guess. That's the company contradicting the listing."

### 0:15 (20s) — It works

**Show:** `/feed`, filter to Engineering, hover a card so it flips.

> "Five thousand live postings from ninety-six company boards, collected with
> Bright Data Scraper Studio. Filter by function, level, remote. Every job has a
> score — and the reason for it underneath."

**Show:** click a stale card.

> "Open a hundred and seven days, re-posted twice."

### 0:35 (30s) — The number that matters

**Show:** terminal running `npm run collect`.

> "I described the data I wanted in one paragraph of plain English — no CSS
> selectors — and Scraper Studio built the scraper. Same paragraph works on all
> three platforms.
>
> Now watch the salary field. These companies publish a JSON API, and it has *no
> salary field at all* — zero out of eleven thousand postings. But the law says
> the range has to appear in the posting, so it's buried in the description text
> where an API can't reach it.
>
> Scraper Studio pulls it off the page. Forty-three of fifty. Zero to eighty-six
> percent."

### 1:05 (25s) — Self-healing, for real

**Show:** the heal run, one take.

> "Last thing. I built a job board I control, pointed a collector at it, then
> redesigned it — same URL, every class renamed.
>
> The collector dropped to zero rows. Scraper Studio proposed a fix — and I don't
> auto-approve it, because a bad fix can grab the wrong element and refill the
> field with the wrong value. It looks healthy and the data is wrong. So the fix
> gets checked against the company's own feed first.
>
> Sixty rows back. It even recovered the job title, which the original scraper
> never extracted."

> "Public data in, human decision out. It never applies for you."

---

## 2b. Absolute minimum — 60 seconds

Only if you are out of time. You lose the matching feature and the detail behind
every number, and Presentation is a scored criterion — but this still shows a
working product, real Scraper Studio usage, and a live heal.

**Show:** feed → terminal collect → heal run.

> "Everyone has applied to a job that was already filled. The date says two days
> ago, but it was filled in March and re-posted.
>
> LinkedIn only has a copy of the posting. So I scrape the companies directly —
> Greenhouse, Lever, Ashby. If a role is gone from the company's own board but
> still listed elsewhere, that's the company telling you it's dead.
>
> Five thousand live jobs, ninety-six boards, all through Bright Data Scraper
> Studio. I described what I wanted in plain English and it built the scraper.
>
> Their JSON API has no salary field — zero out of eleven thousand. The law puts
> the range in the description text, so Scraper Studio reads it off the page.
> Zero to eighty-six percent.
>
> And when I redesigned a board under a live collector, it dropped to zero rows,
> Scraper Studio proposed a fix, I checked it against the company's own feed
> before approving — and sixty rows came back."

---

## 2c. Full version — 3 minutes

**How to deliver it.** Short sentences. Pause between beats. Say the numbers
slowly — they are the evidence, and a rushed number sounds made up. Do not read
this word for word; know each beat and say it in your own voice.

Record the healing section in **one take**. A cut at the moment something breaks
reads as the moment not having happened.

---

### 0:00 — The problem (25s)

**Show:** landing page, top of hero.

> "Everyone has applied to a job that was already filled.
>
> You check the date, it says two days ago, so you spend an hour on the
> application. But the company filled that role in March. They just re-posted it,
> and the clock reset.
>
> I collected eleven thousand job postings to see how often that happens. One
> thousand and fifteen roles are listed more than once. A hundred and seventeen
> look less than two weeks old but are re-posts of something over a month old.
> One role has been re-listed across six and a half years.
>
> So checking the date does not work. The listings that waste your time look like
> the freshest ones on the board."

---

### 0:25 — The idea: go to the source (30s)

**Show:** scroll slowly through the five story chapters. Let each one land.

> "Here is the thing that makes this possible.
>
> LinkedIn and Indeed are aggregators. They hold a *copy* of a job posting, and
> nobody tells them when it is taken down. That copy can sit there for months.
>
> So I do not scrape them. I scrape the companies directly — Greenhouse, Lever
> and Ashby, the systems companies actually run their hiring on. That is the
> source, not a copy of it.
>
> And once you are reading the source, you can do something nobody else can: if a
> role is gone from the company's own board but still listed on an aggregator,
> that is not a guess. That is the company contradicting the listing."

**This is the key differentiator — say it clearly and do not rush it.**

---

### 0:55 — The product (35s)

**Show:** `/feed`. Set Function to **Engineering**. Hover a card so it flips.

> "Five thousand three hundred live postings from ninety-six company boards, all
> collected with Bright Data Scraper Studio.
>
> Filter by function, by remote or hybrid, by level, by company. Hover a card and
> it turns over.
>
> Every job has a score — and underneath it, the reason for that score. Not just a
> number you have to trust."

**Show:** click **Stale**, open one card.

> "Open for a hundred and seven days. Re-posted twice. That is why it scored low."

---

### 1:30 — Matching (25s)

**Show:** `/match`, click **Use a sample CV**, expand one "what to add".

> "Paste your CV and every live job gets scored against it.
>
> There is no AI model here. It tells you exactly which of your skills matched,
> and exactly what the job asks for that your CV does not mention — and it quotes
> the sentence from the posting that says so. You can check its reasoning.
>
> And it stops there. It will never apply for you."

---

### 1:55 — Scraper Studio, and the number that matters (40s)

**Show:** terminal. Run:
```bash
npm run collect -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel
```

> "This is the Scraper Studio collector. I described what I wanted in one
> paragraph of plain English — no CSS selectors — and it built the scraper. The
> same paragraph works on Greenhouse, Lever and Ashby: three completely different
> page layouts, one description.
>
> Now watch the salary field."

**Wait for the fill-rate bars.**

> "These companies publish a JSON API. It has *no salary field at all* — zero out
> of eleven thousand postings.
>
> But pay-transparency law says the range has to appear in the posting. So it is
> there — buried in the description text, where an API can never reach it.
>
> Scraper Studio pulls it out of the page. Forty-three of fifty. Zero to eighty-six
> percent.
>
> That is why I scrape the rendered page instead of calling the API."

**Point at the accuracy block.**

> "And I check the result against the company's own feed. A hundred percent on
> every field the page actually shows."

---

### 2:35 — Self-healing, for real (20s)

**Show:** terminal, the heal run. One take.

> "Last part. I built a job board I control, pointed a collector at it, then
> redesigned it — same URL, every class renamed, the salary moved.
>
> The collector went to zero rows. Scraper Studio proposed a fix.
>
> I do not auto-approve it. A bad fix can grab the wrong element and refill the
> field perfectly with the wrong value — it looks healthy and the data is wrong.
> So the fix is checked against the company's own feed first, then approved.
>
> Sixty rows came back. And it recovered the job title, which the original
> scraper never managed to extract at all."

---

### 2:55 — Close (5s)

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

### 2:55 — Close (5s)

> "Public data in, human decision out. It never applies for you."

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
