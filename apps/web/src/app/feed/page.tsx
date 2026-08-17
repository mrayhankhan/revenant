'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

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
  liveness: {
    score: number;
    verdict: Verdict;
    provenGhost: boolean;
    reasons: string[];
  };
}

const VERDICTS: Verdict[] = ['live', 'aging', 'stale', 'ghost'];

const VERDICT_COLOR: Record<Verdict, string> = {
  live: 'var(--live)',
  aging: 'var(--aging)',
  stale: 'var(--stale)',
  ghost: 'var(--ghost)',
};

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

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}

function relativeAge(iso: string | null): string {
  const days = daysSince(iso);
  if (days === null) return 'no date';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

interface FeedResponse {
  counts: Record<Verdict | 'all', number>;
  companies: number;
  postings: Posting[];
}

const EMPTY_COUNTS: Record<Verdict | 'all', number> = {
  all: 0,
  live: 0,
  aging: 0,
  stale: 0,
  ghost: 0,
};

export default function FeedPage(): React.ReactElement {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ limit: '300' });
    if (filter !== 'all') params.set('verdict', filter);
    if (query.trim()) params.set('q', query.trim());

    // Filtering happens server-side so a verdict with thousands of matches is
    // reachable even though only a page is ever transferred.
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/postings?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`feed unavailable (${res.status})`);
          return res.json() as Promise<FeedResponse>;
        })
        .then((payload) => {
          setData(payload);
          setError(null);
        })
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'failed'))
        .finally(() => setLoading(false));
    }, query ? 220 : 0);

    return () => clearTimeout(timer);
  }, [filter, query]);

  const counts = data?.counts ?? EMPTY_COUNTS;
  const visible = useMemo(() => data?.postings ?? [], [data]);
  const decaying = counts.ghost + counts.stale;

  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Job feed</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {!data ? (
            'Loading postings…'
          ) : (
            <>
              <span className="tabular text-[var(--text)]">{counts.all.toLocaleString()}</span>{' '}
              postings across{' '}
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
            <div key={i} className="skeleton h-[92px] w-full" />
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="panel p-8 text-center text-sm text-[var(--text-muted)]">
          No postings match this filter.
        </div>
      )}

      <div className={clsx('space-y-2.5 transition-opacity', loading && 'opacity-50')}>
        {visible.map((posting) => {
          const { liveness } = posting;
          const salary = formatSalary(posting);
          const reason = liveness.reasons[0];

          return (
            <a
              key={posting.id}
              href={`/listing/${posting.id}`}
              className={clsx('card', `is-${liveness.verdict}`)}
            >
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-medium">
                    {posting.title ?? 'Untitled role'}
                  </h3>
                  <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">
                    {posting.company}
                    {posting.location && <span className="text-[var(--text-faint)]"> · {posting.location}</span>}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className={clsx('tabular text-lg font-semibold', `verdict-${liveness.verdict}`)}>
                    {liveness.score}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                    {liveness.verdict}
                  </div>
                </div>
              </div>

              <div className="meter mt-3">
                <span
                  style={{
                    width: `${liveness.score}%`,
                    background: VERDICT_COLOR[liveness.verdict],
                  }}
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
