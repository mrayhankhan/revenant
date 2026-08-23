'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import { useProfile } from '../../lib/profile';
import {
  classifyDomain,
  classifyLevel,
  classifyWorkMode,
  DOMAIN_LABELS,
  WORK_MODES,
} from '@revenant/core/match/classify';
import type { ExperienceLevel, JobDomain, WorkMode } from '@revenant/core/match/classify';

import { JobCard, VERDICT_COLOR } from '../job-card';
import type { JobCardData, Verdict } from '../job-card';

type Posting = JobCardData & { applyUrl: string | null };

/** Labelled so the chips read the way a job seeker would say them. */
const LEVEL_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'intern', label: 'Internship' },
  { value: 'entry', label: 'Entry / fresher' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / staff' },
];

interface FeedResponse {
  counts: Record<Verdict | 'all', number>;
  companies: number;
  postings: Posting[];
}

const VERDICTS: Verdict[] = ['live', 'aging', 'stale', 'ghost'];

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

export default function FeedPage(): React.ReactElement {
  const { profile, ready } = useProfile();

  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [query, setQuery] = useState('');
  const [company, setCompany] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [domain, setDomain] = useState<JobDomain | null>(null);
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

  /** Functions present in the loaded set, most roles first. */
  const domains = useMemo(() => {
    const tally = new Map<JobDomain, number>();
    for (const row of data?.postings ?? []) {
      const value = classifyDomain(row.title);
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  /** Companies present in the loaded set, alphabetical so the list is scannable. */
  const companies = useMemo(() => {
    const tally = new Map<string, number>();
    for (const row of data?.postings ?? []) {
      if (!row.company) continue;
      tally.set(row.company, (tally.get(row.company) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const visible = useMemo(() => {
    let rows = data?.postings ?? [];

    // Personalised results are ranked server-side and returned whole, so verdict
    // and search filtering happen here rather than in the query.
    if (personalised) {
      const needle = query.trim().toLowerCase();
      rows = rows.filter((row) => {
        if (filter !== 'all' && row.liveness.verdict !== filter) return false;
        if (!needle) return true;
        return `${row.title ?? ''} ${row.company ?? ''} ${row.location ?? ''}`
          .toLowerCase()
          .includes(needle);
      });
    }

    if (company !== null) rows = rows.filter((row) => row.company === company);

    if (workMode !== null) {
      rows = rows.filter((row) => classifyWorkMode(row.remotePolicy, row.location) === workMode);
    }

    if (level !== null) {
      rows = rows.filter((row) => classifyLevel(row.title, row.employmentType) === level);
    }

    if (domain !== null) rows = rows.filter((row) => classifyDomain(row.title) === domain);

    return rows;
  }, [data, personalised, filter, query, company, workMode, level, domain]);

  const total = useCountUp(counts.all);
  const decaying = counts.ghost + counts.stale;

  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="display text-[2rem] sm:text-[2.5rem]">
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

      {/*
        Four selects on one line rather than fifty-odd chips.
        Function alone has twelve values and company thirty-eight; laid out as
        chips they filled the screen and pushed the jobs below the fold, which is
        the opposite of what a filter is for. Counts stay visible inside each
        option, so nothing is lost by collapsing them.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="select"
          value={domain ?? ''}
          onChange={(event) => setDomain((event.target.value || null) as JobDomain | null)}
        >
          <option value="">All functions</option>
          {domains.map(([value, count]) => (
            <option key={value} value={value}>
              {DOMAIN_LABELS[value]} ({count})
            </option>
          ))}
        </select>

        <select
          className="select"
          value={workMode ?? ''}
          onChange={(event) => setWorkMode((event.target.value || null) as WorkMode | null)}
        >
          <option value="">Anywhere</option>
          {WORK_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode[0]?.toUpperCase()}
              {mode.slice(1)}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={level ?? ''}
          onChange={(event) => setLevel((event.target.value || null) as ExperienceLevel | null)}
        >
          <option value="">Any level</option>
          {LEVEL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={company ?? ''}
          onChange={(event) => setCompany(event.target.value || null)}
        >
          <option value="">All companies</option>
          {companies.map(([name, count]) => (
            <option key={name} value={name}>
              {name} ({count})
            </option>
          ))}
        </select>

        {(workMode || level || company || domain) && (
          <button
            className="btn btn-quiet !py-1.5 !text-[12px]"
            onClick={() => {
              setWorkMode(null);
              setLevel(null);
              setCompany(null);
              setDomain(null);
            }}
          >
            Clear
          </button>
        )}

        <span className="tabular ml-auto text-[12px] text-[var(--text-faint)]">
          {visible.length.toLocaleString()} shown
        </span>
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

      {/* Three across on a wide screen: roughly nine roles visible without
          scrolling, against three as a list. */}
      <div
        className={clsx(
          'grid gap-3 transition-opacity duration-300 sm:grid-cols-2 xl:grid-cols-3',
          loading && data && 'opacity-40',
        )}
      >
        {visible.map((posting, index) => (
          <JobCard key={posting.id} job={posting} index={index} />
        ))}
      </div>

      {data && visible.length >= 300 && (
        <p className="text-center text-xs text-[var(--text-faint)]">
          Showing the first 300 matches. Narrow with search or a verdict filter.
        </p>
      )}
    </div>
  );
}
