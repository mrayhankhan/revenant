'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import { useProfile } from '../../lib/profile';

type Verdict = 'live' | 'aging' | 'stale' | 'ghost';

interface Posting {
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  remotePolicy: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string | null;
  applyUrl: string | null;
  liveness: { score: number; verdict: Verdict; provenGhost: boolean; reasons: string[] };
  match?: { score: number; matched: string[]; missing: string[]; reasons: string[] };
}

interface FeedResponse {
  counts: Record<Verdict | 'all', number>;
  companies: number;
  postings: Posting[];
}

const VERDICTS: Verdict[] = ['live', 'aging', 'stale', 'ghost'];

const VERDICT_COLOR: Record<Verdict, string> = {
  live: 'var(--live)',
  aging: 'var(--aging)',
  stale: 'var(--stale)',
  ghost: 'var(--ghost)',
};

const EMPTY_COUNTS: Record<Verdict | 'all', number> = {
  all: 0,
  live: 0,
  aging: 0,
  stale: 0,
  ghost: 0,
};

/**
 * Counts up to its value, so a changing number is seen to change.
 *
 * The animation is decoration; the number is information. Browsers do not run
 * requestAnimationFrame in a hidden or non-compositing tab, so a page opened in
 * a background tab would otherwise display a permanent zero next to a filter
 * that reads 40. A timer guarantees the final value lands either way, and the
 * frame loop only makes the journey there prettier.
 */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out, so the number decelerates into place rather than stopping dead.
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    if (document.visibilityState === 'visible') {
      setValue(0);
      frame = requestAnimationFrame(tick);
    }

    const settle = setTimeout(() => setValue(target), duration + 120);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
}

function formatSalary(posting: Posting): string | null {
  const { salaryMin, salaryMax, salaryCurrency } = posting;
  if (salaryMin === null && salaryMax === null) return null;

  const currency = salaryCurrency ?? '';
  const format = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

  if (salaryMin !== null && salaryMax !== null) {
    return `${currency} ${format(salaryMin)}–${format(salaryMax)}`.trim();
  }
  return `${currency} ${format((salaryMin ?? salaryMax) as number)}`.trim();
}

function relativeAge(iso: string | null): string {
  if (!iso) return 'no date';
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function FeedPage(): React.ReactElement {
  const { profile, ready } = useProfile();

  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [query, setQuery] = useState('');
  const [personalised, setPersonalised] = useState(false);

  useEffect(() => {
    if (!ready) return;

    const timer = setTimeout(
      () => {
        setLoading(true);

        // With a CV on hand the feed is ranked by fit; without one it is ranked
        // by freshness. Both paths exclude nothing — the filters stay honest.
        const request =
          profile && profile.resume.length >= 40
            ? fetch('/api/match', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ resume: profile.resume }),
              }).then(async (res) => {
                if (!res.ok) throw new Error(`feed unavailable (${res.status})`);
                const payload = (await res.json()) as {
                  results: Posting[];
                  scanned: number;
                };
                setPersonalised(true);
                const counts = { ...EMPTY_COUNTS, all: payload.results.length };
                for (const row of payload.results) counts[row.liveness.verdict] += 1;
                return {
                  counts,
                  companies: new Set(payload.results.map((r) => r.company)).size,
                  postings: payload.results,
                } satisfies FeedResponse;
              })
            : (() => {
                const params = new URLSearchParams({ limit: '300' });
                if (filter !== 'all') params.set('verdict', filter);
                if (query.trim()) params.set('q', query.trim());
                return fetch(`/api/postings?${params.toString()}`).then(async (res) => {
                  if (!res.ok) throw new Error(`feed unavailable (${res.status})`);
                  setPersonalised(false);
                  return (await res.json()) as FeedResponse;
                });
              })();

        request
          .then((payload) => {
            setData(payload);
            setError(null);
          })
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : 'failed'),
          )
          .finally(() => setLoading(false));
      },
      query ? 220 : 0,
    );

    return () => clearTimeout(timer);
  }, [ready, profile, filter, query]);

  const counts = data?.counts ?? EMPTY_COUNTS;

  // Personalised results are ranked server-side, so filtering happens here.
  const visible = useMemo(() => {
    const rows = data?.postings ?? [];
    if (!personalised) return rows;

    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.liveness.verdict !== filter) return false;
      if (!needle) return true;
      return `${row.title ?? ''} ${row.company ?? ''} ${row.location ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [data, personalised, filter, query]);

  const total = useCountUp(counts.all);
  const decaying = counts.ghost + counts.stale;

  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {personalised && profile?.name ? `Matches for ${profile.name}` : 'Job feed'}
          </h1>
          {ready && !profile && (
            <a href="/start" className="text-[13px] text-[var(--accent)] hover:underline">
              Personalise this feed →
            </a>
          )}
        </div>

        <p className="text-sm text-[var(--text-muted)]">
          {!data ? (
            'Loading postings…'
          ) : (
            <>
              <span className="tabular text-[var(--text)]">{total.toLocaleString()}</span>{' '}
              {personalised ? 'ranked against your CV' : 'postings'} across{' '}
              <span className="tabular text-[var(--text)]">{data.companies}</span> companies.{' '}
              {decaying > 0 && (
                <>
                  <span className="tabular verdict-stale">{decaying.toLocaleString()}</span> show
                  signs of decay.
                </>
              )}
            </>
          )}
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button className="pill" data-active={filter === 'all'} onClick={() => setFilter('all')}>
            All <span className="count">{counts.all.toLocaleString()}</span>
          </button>
          {VERDICTS.map((verdict) => (
            <button
              key={verdict}
              className="pill"
              data-active={filter === verdict}
              onClick={() => setFilter(verdict)}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: VERDICT_COLOR[verdict] }}
              />
              {verdict} <span className="count">{counts[verdict].toLocaleString()}</span>
            </button>
          ))}
        </div>

        <input
          className="field sm:max-w-xs"
          placeholder="Search title, company, location…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && (
        <div className="panel p-5 text-sm verdict-ghost">
          {error}. Run <code className="text-[var(--text)]">npm run ingest</code> to populate the
          database.
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-[104px] w-full" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && data && (
        <div className="panel p-8 text-center text-sm text-[var(--text-muted)]">
          No postings match this filter.
        </div>
      )}

      <div className={clsx('space-y-2.5 transition-opacity duration-300', loading && data && 'opacity-40')}>
        {visible.map((posting, index) => {
          const { liveness, match } = posting;
          const salary = formatSalary(posting);
          const reason = match?.reasons[0] ?? liveness.reasons[0];
          const headline = match?.score ?? liveness.score;
          const headlineColor = match
            ? match.score >= 75
              ? 'var(--live)'
              : match.score >= 50
                ? 'var(--aging)'
                : 'var(--stale)'
            : VERDICT_COLOR[liveness.verdict];

          return (
            <a
              key={posting.id}
              href={`/listing/${posting.id}`}
              className={clsx('card reveal', `is-${liveness.verdict}`)}
              // Capped so a long list does not take seconds to finish arriving.
              style={{ '--i': Math.min(index, 14) } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-medium">
                    {posting.title ?? 'Untitled role'}
                  </h3>
                  <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">
                    {posting.company}
                    {posting.location && (
                      <span className="text-[var(--text-faint)]"> · {posting.location}</span>
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className="tabular text-lg font-semibold" style={{ color: headlineColor }}>
                    {headline}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                    {match ? 'match' : liveness.verdict}
                  </div>
                </div>
              </div>

              <div className="meter mt-3">
                <span
                  style={
                    {
                      '--to': `${headline}%`,
                      '--i': Math.min(index, 14),
                      background: headlineColor,
                    } as React.CSSProperties
                  }
                />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {reason && (
                  <p className={clsx('reason', liveness.provenGhost && 'proof')}>
                    {liveness.provenGhost && '✕ '}
                    {reason}
                  </p>
                )}
                <span className="ml-auto flex items-center gap-3 text-[12px] text-[var(--text-faint)]">
                  {match && (
                    <span style={{ color: VERDICT_COLOR[liveness.verdict] }}>
                      {liveness.verdict}
                    </span>
                  )}
                  {salary && <span className="tabular text-[var(--text-muted)]">{salary}</span>}
                  {posting.remotePolicy && posting.remotePolicy !== 'unstated' && (
                    <span>{posting.remotePolicy}</span>
                  )}
                  <span className="tabular">{relativeAge(posting.postedAt)}</span>
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {data && visible.length >= 300 && (
        <p className="text-center text-xs text-[var(--text-faint)]">
          Showing the first 300 matches. Narrow with search or a verdict filter.
        </p>
      )}
    </div>
  );
}
