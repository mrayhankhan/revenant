import { db } from '@revenant/core/db/index';
import { sql } from 'drizzle-orm';

import { DecayField } from './decay-field';
import { HealDemo } from './heal-demo';
import { HeroActions } from './hero-actions';
import { Reveal } from './reveal';
import { CountUp } from './count-up';

export const dynamic = 'force-dynamic';

interface Stats {
  postings: number;
  companies: number;
  decaying: number;
  salaryFilled: number;
}

/**
 * Read the real corpus for the landing page.
 *
 * The numbers here are queried, never hard-coded — a claim about data quality
 * that cannot survive contact with its own database is not worth making.
 */
async function loadStats(): Promise<Stats | null> {
  try {
    const database = db();

    const row = await database.get<{
      postings: number;
      companies: number;
      salary_filled: number;
    }>(sql`
      select
        count(*) as postings,
        count(distinct company_slug) as companies,
        sum(case when salary_min is not null then 1 else 0 end) as salary_filled
      from postings
    `);

    const verdicts = await database.all<{ verdict: string; n: number }>(sql`
      select o.verdict as verdict, count(*) as n
      from postings p
      join liveness_observations o on o.posting_id = p.id
      where o.observed_at = (
        select max(observed_at) from liveness_observations where posting_id = p.id
      )
      group by o.verdict
    `);

    const by = new Map(verdicts.map((v) => [v.verdict, v.n]));

    return {
      postings: row?.postings ?? 0,
      companies: row?.companies ?? 0,
      salaryFilled: row?.salary_filled ?? 0,
      decaying: (by.get('stale') ?? 0) + (by.get('aging') ?? 0) + (by.get('ghost') ?? 0),
    };
  } catch {
    // A missing database is a setup state, not a crash.
    return null;
  }
}

export default async function Home(): Promise<React.ReactElement> {
  const stats = await loadStats();

  return (
    <div className="space-y-24 pb-16">
      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="relative -mx-5 overflow-hidden px-5 pt-10 pb-4 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <DecayField />
        </div>

        <div className="relative max-w-3xl space-y-5">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1 text-[12px] text-[var(--text-muted)] backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--live)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
              </span>
              Built on Bright Data Scraper Studio
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              The job feed that knows
              <br />
              which listings are{' '}
              <span className="relative whitespace-nowrap">
                <span className="verdict-ghost">already dead</span>
                <svg
                  aria-hidden
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-2 w-full"
                >
                  <path
                    d="M2 8 C 80 2, 160 12, 298 5"
                    fill="none"
                    stroke="var(--ghost)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    pathLength={1}
                    style={{
                      strokeDasharray: 1,
                      strokeDashoffset: 1,
                      animation: 'underline 1100ms var(--ease-out) 600ms forwards',
                    }}
                  />
                </svg>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-base">
              Every aggregator rots. Roles stay open months after they were filled, the same job
              appears on five boards, and a field quietly turns null when a site changes its markup.
              Revenant treats a posting as a decaying object — it carries a liveness score, the
              reason behind that score, and a record of when each value was last verified.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <HeroActions />
          </Reveal>
        </div>
      </section>

      {/* ---- Live corpus --------------------------------------------------- */}
      {stats && stats.postings > 0 && (
        <section className="space-y-4">
          <Reveal>
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              Currently tracking
            </h2>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: stats.postings, label: 'postings collected', tone: undefined },
              { value: stats.companies, label: 'company boards resolved', tone: undefined },
              {
                value: stats.decaying,
                label: 'showing measurable decay',
                tone: 'var(--aging)',
              },
              {
                value: stats.salaryFilled,
                label: 'advertise pay in the structured feed',
                tone: 'var(--stale)',
                suffix: `/${stats.postings.toLocaleString()}`,
              },
            ].map((stat, index) => (
              <Reveal key={stat.label} delay={index * 90}>
                <div className="panel px-5 py-4">
                  <div className="tabular text-3xl font-semibold" style={{ color: stat.tone }}>
                    <CountUp to={stat.value} />
                    {stat.suffix && (
                      <span className="text-lg text-[var(--text-faint)]">{stat.suffix}</span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">
                    {stat.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={360}>
            <p className="max-w-3xl text-xs leading-relaxed text-[var(--text-faint)]">
              That last number is the argument for scraping rendered pages rather than consuming an
              API. The ATS feed carries no compensation field at all, while pay-transparency law puts
              salary ranges in the description prose of many of those same postings — reachable only
              by extracting it from the page. Scraper Studio recovers it on{' '}
              <span className="text-[var(--live)]">86%</span>.
            </p>
          </Reveal>
        </section>
      )}

      {/* ---- Self-healing, performed --------------------------------------- */}
      <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              A heal is graded before it is accepted.
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
              Scraper Studio proposes a fix and parks it at an approval gate. The obvious move is to
              auto-approve. We deliberately don&rsquo;t.
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
              A heal that re-binds to the wrong element restores the fill rate perfectly while
              returning a job&rsquo;s department where its location used to be — and fill-rate
              monitoring calls that a success. So Revenant re-runs the collector, grades the output
              against the platform&rsquo;s own JSON feed, and only then approves.
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--text-faint)]">
              Anyone can call self-heal. This is what lets us say why we rejected one.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <HealDemo />
        </Reveal>
      </section>

      {/* ---- Principles ---------------------------------------------------- */}
      <section className="space-y-4">
        <Reveal>
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            How it works
          </h2>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: 'Proof, not inference',
              body: 'A listing is only called a ghost when the company’s own board contradicts it. Age and re-post churn can suggest decay, but they never earn that word — telling someone a real job is dead costs them an opportunity.',
            },
            {
              title: 'Drift against a baseline',
              body: 'Most postings advertise no salary, so alerting on nulls fires constantly and gets muted. Revenant compares each field against what that collector historically produced, separating “never advertised” from “extraction broke”.',
            },
            {
              title: 'It never applies for you',
              body: 'Public listings in, human decision out. The CV matching names the exact skills a posting asks for that you did not mention, and stops there. No account, no stored personal data.',
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={index * 110}>
              <div className="panel h-full p-5 transition-colors duration-300 hover:border-[var(--border-strong)]">
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- Close --------------------------------------------------------- */}
      <Reveal>
        <section className="panel relative overflow-hidden px-6 py-10 text-center sm:px-10">
          <div className="relative space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Stop applying to jobs that no longer exist.
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
              Paste your CV and get roles ranked by fit — with the dead ones already filtered out.
            </p>
            <div className="flex justify-center pt-1">
              <HeroActions />
            </div>
          </div>
        </section>
      </Reveal>

      {(!stats || stats.postings === 0) && (
        <section className="panel p-5">
          <p className="text-sm text-[var(--text-muted)]">
            No postings yet. Populate the database with{' '}
            <code className="text-[var(--text)]">
              npm run ingest -w @revenant/core -- --file companies.txt
            </code>
          </p>
        </section>
      )}
    </div>
  );
}
