# Submission pack

Everything for the form, the video, the screenshots and the LinkedIn post.

**Repo** https://github.com/mrayhankhan/revenant
**Demo** https://revenant-jobs.vercel.app (no login)
**Collector** `c_msyq5cea136y76lhb0`

---

## 1. Screenshots for the README

Four images into `docs/screenshots/`. The README already links the first three,
so they appear the moment the files exist.

| File | What to capture | How |
|---|---|---|
| `feed.png` | The feed. Set the Function filter to **Engineering** first so the grid is full of recognisable roles. Hover one card so it is caught mid-flip. | Browser at ~1440px wide, capture the viewport only, not the whole page |
| `heal.png` | Terminal running `npm run collect`, showing the fill-rate bars and the accuracy block | Full terminal window, dark theme, make the text large enough to read on a phone |
| `health.png` | `/health` — the per-field extraction table with baselines | Scroll so "Extraction by field" is at the top of the shot |
| `match.png` | `/match` after clicking **Use a sample CV**, with one card's "what to add" expanded | Shows the tailoring, which is the part reviewers do not expect |

Two things that make screenshots read as professional: capture at a **16:9-ish
crop** rather than a tall full-page scroll, and make sure **no browser bookmarks
bar or personal tabs** are visible.

---

## 2. Demo video — 3 minutes

Record in one take. A cut at the interesting moment reads as the interesting
moment not having happened.

### 0:00 — The problem (30s)

**Show:** the landing page, top of hero.

> "Job boards go stale and nobody measures it. The obvious answer is: just look
> at the posting date.
>
> That does not work. Companies re-post roles and the clock resets. In the eleven
> thousand postings I collected, a hundred and seventeen listings are under two
> weeks old and are re-lists of a role first posted over a month earlier. One role
> has been re-listed across six and a half years.
>
> The listings that waste your time look like the freshest ones on the board."

### 0:30 — Scroll the story (25s)

**Show:** scroll slowly through the five chapters. Let each land.

> "So Revenant checks each posting against the company's own careers board. Gone
> from their board but still listed elsewhere is not a guess — that is the company
> contradicting the listing."

### 0:55 — The feed (35s)

**Show:** `/feed`. Set Function to Engineering. Hover a card so it flips.

> "Five thousand three hundred live postings from ninety-six company boards, all
> collected with Bright Data Scraper Studio. Filter by function, work mode, level,
> company.
>
> Every card carries a liveness score and the reason behind it — not just a
> number."

Click **Stale** in the verdict filter, open one card.

> "Open for a hundred and seven days. Re-posted twice."

### 1:30 — Match (30s)

**Show:** `/match`, click **Use a sample CV**, expand one "what to add".

> "Paste a CV and every live posting is scored against it. No model call — it
> names the exact skills that matched, and the ones the posting asks for that your
> CV does not mention.
>
> Every suggestion quotes the sentence in the posting that motivates it. And it
> stops here: Revenant never applies on your behalf."

### 2:00 — Scraper Studio, and the number that matters (40s)

**Show:** terminal. Run `npm run collect -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel`

> "This is the Scraper Studio collector running against Vercel's board. Watch the
> salary field.
>
> Greenhouse's structured API carries zero compensation — nought out of eleven
> thousand postings. Pay-transparency law puts the range in the description prose,
> so Scraper Studio extracts it from the page instead. Forty-three of fifty.
>
> Zero to eighty-six percent. That is why this scrapes the rendered page rather
> than consuming the API."

Point at the accuracy block.

> "And it is graded — a hundred percent on every field the page actually shows,
> scored against Greenhouse's own feed."

### 2:40 — Self-healing (15s)

**Show:** `/health`, then the heal section of the README or the landing animation.

> "When a board changes shape and extraction drops below its baseline, Scraper
> Studio proposes a fix and parks it at an approval gate. I deliberately do not
> auto-approve — a heal can bind to the wrong element, refill the field perfectly
> and return the wrong value.
>
> So the fix is re-run and graded against the platform's own feed before it is
> accepted. Anyone can call self-heal. This is what lets me say why I rejected
> one."

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
