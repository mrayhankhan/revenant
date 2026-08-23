'use client';

import { use, useEffect, useState } from 'react';
import clsx from 'clsx';

type Verdict = 'live' | 'aging' | 'stale' | 'ghost';

interface Listing {
  id: string;
  title: string | null;
  company: string | null;
  companySlug: string;
  location: string | null;
  remotePolicy: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  employmentType: string | null;
  postedAt: string | null;
  descriptionHtml: string | null;
  applyUrl: string | null;
  sourceUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  boardUrl: string | null;
  platform: string | null;
  liveness: {
    score: number;
    verdict: Verdict;
    provenGhost: boolean;
    reasons: string[];
    presentInAuthoritative: boolean | null;
    absentSince: string | null;
    applyUrlDead: boolean | null;
    repostCount: number;
  } | null;
  history: { score: number; verdict: Verdict; observedAt: string }[];
}

const VERDICT_COLOR: Record<Verdict, string> = {
  live: 'var(--live)',
  aging: 'var(--aging)',
  stale: 'var(--stale)',
  ghost: 'var(--ghost)',
};

/** Hostname without the www, for labelling an outbound link. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'the original posting';
  }
}

function Fact({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text)]">{value}</dd>
    </div>
  );
}

function formatSalary(listing: Listing): string {
  const { salaryMin, salaryMax, salaryCurrency } = listing;
  if (salaryMin === null && salaryMax === null) {
    return 'Not advertised';
  }
  const currency = salaryCurrency ?? '';
  // Pinned to en-US: the default follows the host locale, so the same salary
  // renders as 182,208 on one machine and 1,82,208 on another.
  const fmt = (v: number): string => v.toLocaleString('en-US');
  if (salaryMin !== null && salaryMax !== null) {
    return `${currency} ${fmt(salaryMin)} – ${fmt(salaryMax)}`.trim();
  }
  return `${currency} ${fmt((salaryMin ?? salaryMax) as number)}`.trim();
}

export default function ListingPage({
  params,
}: {
  // Next 15 delivers route params as a promise.
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/postings/${id}`)
      .then((res) => {
        if (res.status === 404) throw new Error('This posting is not in the database.');
        if (!res.ok) throw new Error(`Could not load posting (${res.status}).`);
        return res.json() as Promise<Listing>;
      })
      .then(setListing)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="space-y-4">
        <a href="/feed" className="text-sm text-[var(--accent)]">
          ← Back to feed
        </a>
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">{error ?? 'Posting not found.'}</p>
        </div>
      </div>
    );
  }

  const liveness = listing.liveness;
  const verdict = liveness?.verdict ?? 'stale';

  return (
    <div className="space-y-7">
      <a href="/feed" className="inline-block text-sm text-[var(--accent)] hover:underline">
        ← Back to feed
      </a>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {listing.title ?? 'Untitled role'}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              {listing.company}
              {listing.location && (
                <span className="text-[var(--text-faint)]"> · {listing.location}</span>
              )}
            </p>
          </div>

          {liveness && (
            <div className="shrink-0 text-right">
              <div className={clsx('tabular text-3xl font-semibold', `verdict-${verdict}`)}>
                {liveness.score}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                {verdict}
              </div>
            </div>
          )}
        </div>

        {liveness && (
          <div className="meter">
            <span style={{ width: `${liveness.score}%`, background: VERDICT_COLOR[verdict] }} />
          </div>
        )}
      </header>

      {/*
       * The assessment sits above the job description on purpose. Whether the
       * role still exists decides whether the description is worth reading.
       */}
      {liveness && (
        <section className="panel p-5">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Liveness assessment
          </h2>

          {liveness.provenGhost ? (
            <p className="mt-3 text-sm font-medium verdict-ghost">
              ✕ Proven dead — {listing.company} removed this from their own job board
              {liveness.absentSince &&
                ` on ${new Date(liveness.absentSince).toLocaleDateString()}`}
              , but it is still listed here.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {liveness.presentInAuthoritative
                ? `Confirmed against ${listing.company}'s own board. Not a ghost.`
                : 'No authoritative source was reachable, so absence cannot be proven.'}
            </p>
          )}

          <ul className="mt-3 space-y-1.5">
            {liveness.reasons.map((reason) => (
              <li key={reason} className="reason flex gap-2">
                <span className="text-[var(--text-faint)]">·</span>
                {reason}
              </li>
            ))}
          </ul>

          {listing.history.length > 1 && (
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-faint)]">
              <span className="tabular">{listing.history.length}</span> observations · earliest score{' '}
              <span className="tabular">{listing.history.at(-1)?.score}</span>, latest{' '}
              <span className="tabular">{listing.history[0]?.score}</span>
            </p>
          )}
        </section>
      )}

      <section className="panel p-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Location" value={listing.location ?? '—'} />
          <Fact
            label="Remote policy"
            value={
              listing.remotePolicy && listing.remotePolicy !== 'unstated' ? (
                <span className="capitalize">{listing.remotePolicy}</span>
              ) : (
                <span className="text-[var(--text-faint)]">Unstated</span>
              )
            }
          />
          <Fact
            label="Compensation"
            value={
              listing.salaryMin === null && listing.salaryMax === null ? (
                <span className="text-[var(--text-faint)]" title="This platform's feed carries no compensation field">
                  Not advertised
                </span>
              ) : (
                <span className="tabular">{formatSalary(listing)}</span>
              )
            }
          />
          <Fact
            label="Posted"
            value={
              listing.postedAt ? (
                <span className="tabular">{new Date(listing.postedAt).toLocaleDateString()}</span>
              ) : (
                <span className="text-[var(--text-faint)]">Unknown</span>
              )
            }
          />
        </dl>
      </section>

      {listing.descriptionHtml && (
        <section className="panel p-5">
          <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Description
          </h2>
          <div
            className="prose-invert max-w-none space-y-3 text-sm leading-relaxed text-[var(--text-muted)] [&_a]:text-[var(--accent)] [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-medium [&_h1]:text-[var(--text)] [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-medium [&_h2]:text-[var(--text)] [&_h3]:mt-3 [&_h3]:font-medium [&_h3]:text-[var(--text)] [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:text-[var(--text)] [&_ul]:space-y-1"
            dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }}
          />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {listing.applyUrl && (
          <a
            href={listing.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            {/*
              Naming the destination host matters here. Greenhouse returns each
              company's canonical URL, and most white-label it — so the link
              lands on careers.duolingo.com rather than greenhouse.io, which
              looks like a broken redirect unless the button says so.
            */}
            Apply on {hostOf(listing.applyUrl)} ↗
          </a>
        )}
        {listing.boardUrl && (
          <a
            href={listing.boardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {listing.company}&rsquo;s board{listing.platform && ` (${listing.platform})`} ↗
          </a>
        )}
      </div>

      {/*
       * Stated plainly, because it is a deliberate product boundary rather than
       * an unfinished feature: Revenant reads public data and stops before submit.
       */}
      <p className="text-xs text-[var(--text-faint)]">
        Revenant never submits an application for you. It reads public listings and hands you the
        decision.
      </p>
    </div>
  );
}
