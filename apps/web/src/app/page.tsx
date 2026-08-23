import { db } from '@revenant/core/db/index';
import { sql } from 'drizzle-orm';

import { HeroActions } from './hero-actions';

export const dynamic = 'force-dynamic';

interface Stats {
  postings: number;
  companies: number;
  decaying: number;
  ghosts: number;
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
      ghosts: by.get('ghost') ?? 0,
      decaying: (by.get('stale') ?? 0) + (by.get('aging') ?? 0) + (by.get('ghost') ?? 0),
    };
  } catch {
    // A missing database is a setup state, not a crash. Show the copy without numbers.
    return null;
  }
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: string;
}): React.ReactElement {
  return (
    <div className="panel px-5 py-4">
      <div className="tabular text-2xl font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

export default async function Home(): Promise<React.ReactElement> {
  const stats = await loadStats();

  return (
    <div className="space-y-12 py-6">
      <section className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          The job feed that knows which listings are already dead.
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
          Every aggregator rots. Roles stay open months after they were filled, the same job appears
          on five boards, and a field quietly turns null when a site changes its markup. Revenant
          treats a posting as a decaying object: it carries a liveness score, the reason behind that
          score, and a per-field record of when each value was last verified.
        </p>
        <HeroActions />
      </section>

      {stats && stats.postings > 0 && (
        <section className="space-y-3">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Currently tracking
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={stats.postings.toLocaleString()} label="postings collected" />
            <Stat value={String(stats.companies)} label="company boards resolved" />
            <Stat
              value={stats.decaying.toLocaleString()}
              label="showing measurable decay"
              tone="var(--aging)"
            />
            <Stat
              value={`${stats.salaryFilled}/${stats.postings.toLocaleString()}`}
              label="advertise compensation in the structured feed"
              tone="var(--stale)"
            />
          </div>
          <p className="pt-1 text-xs leading-relaxed text-[var(--text-faint)]">
            That last number is the argument for scraping rendered pages rather than consuming an
            API. The ATS feed carries no compensation field at all, while pay-transparency law puts
            salary ranges in the description prose of many of those same postings — reachable only by
            extracting it from the page.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          How it works
        </h2>
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
              title: 'Heals are graded',
              body: 'A repaired collector is scored against the platform’s own feed. A heal that refills a field with values off the wrong element looks healthy by fill rate and is rejected here.',
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className="panel reveal p-5"
              style={{ '--i': index } as React.CSSProperties}
            >
              <h3 className="text-sm font-medium">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {(!stats || stats.postings === 0) && (
        <section className="panel p-5">
          <p className="text-sm text-[var(--text-muted)]">
            No postings yet. Populate the database with{' '}
            <code className="text-[var(--text)]">npm run ingest -w @revenant/core -- --file companies.txt</code>
          </p>
        </section>
      )}
    </div>
  );
}
