# Chaos target

A job board we control, so self-healing can be **demonstrated** rather than
described. No real board redesigns itself during a three-minute demo, so this
one does it on command.

The board is fictional — "Northwind Robotics", six invented roles. It exists
only to be broken.

## The property that matters

**The URL never changes.** Flipping the layout mutates what `/` serves; it does
not move the board to a second address.

An earlier version switched layouts with `?v=b`, which would have pointed the
collector at a *different URL* — and then the demo proves nothing, because a
redesign is the same page coming back different. That distinction is the whole
point of the exercise.

## Two layouts, identical facts

| | Layout A | Layout B |
|---|---|---|
| Card element | `<article class="job-card">` | `<section class="posting-row">` |
| Attributes | `<span>` list | `<dl>` / `<dd>` |
| Salary | one `<p class="job-pay">` | nested, split across three `<span>`s |
| Field order | location first | date first |

Every class renamed, the structure rebuilt, the salary moved and split. **No
selector written against layout A survives layout B.** The plain-language
description of each field does — which is exactly the claim being tested.

The data is byte-identical between layouts, so any change in extracted values is
the scraper's doing and never the content's. If a heal returns a different salary
after the redesign, the heal is wrong.

One role advertises no salary at all. A legitimately empty field must not read as
broken extraction, so the demo run has to contain one.

## Ground truth

`/chaos/truth` publishes a structured feed beside the rendered board, exactly as
Greenhouse, Lever and Ashby publish theirs — and, like theirs, it is unaffected
by the layout. Revenant grades every heal against it.

Without this the heal loop would have nothing to check its own repair against and
would correctly refuse to approve anything.

## Endpoints

| Route | Purpose |
|---|---|
| `/` | The board. Point the collector here. |
| `/chaos/flip` | Redesign it. GET or POST. |
| `/chaos/state` | Which layout is live, and whether flips persist. |
| `/chaos/truth` | Structured feed used to grade heals. |

## Running it

```bash
npm run dev -w @revenant/chaos-target      # http://localhost:4180
```

Local development keeps the layout in a module variable, which is correct for a
single long-lived process.

## Deploying

Bright Data has to *load* the page, so it must be publicly reachable — `localhost`
is invisible to their servers.

```bash
npx vercel deploy --prod
```

**Add a KV store before demoing.** Vercel runs each request in its own instance,
so an in-memory flag flips on one instance while the next request still serves
the old layout — it would look fine locally and behave randomly on camera. In the
Vercel dashboard: Storage → create a Redis/KV store → connect it to this project.
That injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

Confirm before recording:

```bash
curl https://<your-deployment>/chaos/state
# {"layout":"a","roles":6,"persistent":true}
```

`persistent: false` means flips will not hold. Fix that before you record.

## The demo

```bash
npm run heal -w @revenant/core -- chaos https://<your-deployment>   # baseline
curl https://<your-deployment>/chaos/flip                           # redesign
npm run heal -w @revenant/core -- chaos https://<your-deployment>   # detect, heal, grade
```

The second run detects which fields stopped extracting, asks Scraper Studio to
repair them, re-runs, grades the repair against `/chaos/truth`, and approves or
rejects on measured accuracy.
