'use client';

import clsx from 'clsx';

export type Verdict = 'live' | 'aging' | 'stale' | 'ghost';

export interface JobCardData {
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  remotePolicy: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  employmentType: string | null;
  postedAt: string | null;
  liveness: { score: number; verdict: Verdict; provenGhost: boolean; reasons: string[] };
  match?: { score: number; matched: string[]; missing: string[]; reasons: string[] } | undefined;
}

export const VERDICT_COLOR: Record<Verdict, string> = {
  live: 'var(--live)',
  aging: 'var(--aging)',
  stale: 'var(--stale)',
  ghost: 'var(--ghost)',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  live: 'Live',
  aging: 'Ageing',
  stale: 'Stale',
  ghost: 'Dead',
};

function matchColor(score: number): string {
  if (score >= 75) return 'var(--live)';
  if (score >= 50) return 'var(--aging)';
  return 'var(--stale)';
}

function formatSalary(job: JobCardData): string | null {
  const { salaryMin, salaryMax, salaryCurrency } = job;
  if (salaryMin === null && salaryMax === null) return null;

  const currency = salaryCurrency ?? '';
  const short = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

  if (salaryMin !== null && salaryMax !== null) {
    return `${currency} ${short(salaryMin)}–${short(salaryMax)}`.trim();
  }
  return `${currency} ${short((salaryMin ?? salaryMax) as number)}`.trim();
}

function relativeAge(iso: string | null): string {
  if (!iso) return 'undated';
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/**
 * Placeholders that boards use to mean "not stated". Rendering them verbatim
 * puts a literal "N/A" on the card, which reads as a bug rather than as an
 * absent value.
 */
const PLACEHOLDER_LOCATION = /^(n\/?a|none|-|—|tbd|unspecified|various)$/i;

function displayLocation(location: string | null): string | null {
  const trimmed = location?.trim();
  if (!trimmed || PLACEHOLDER_LOCATION.test(trimmed)) return null;
  return trimmed;
}

/** Deterministic hue per company, so the same logo colour follows it around. */
function companyHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

/**
 * A job as a card rather than a row.
 *
 * A row forces every attribute onto one line, so salary, arrangement, skills and
 * the reason for the score compete for the same horizontal space and most of them
 * lose. A card gives each its own line and fits three across, which means more
 * information per screen and far less scrolling — the layout every job board
 * converges on for exactly this reason.
 */
export function JobCard({ job, index }: { job: JobCardData; index: number }): React.ReactElement {
  const { liveness, match } = job;
  const salary = formatSalary(job);
  const headline = match?.score ?? liveness.score;
  const headlineColor = match ? matchColor(match.score) : VERDICT_COLOR[liveness.verdict];
  const reason = match?.reasons[0] ?? liveness.reasons[0];
  const company = job.company ?? 'Unknown';
  const hue = companyHue(company);

  return (
    <a
      href={`/listing/${job.id}`}
      className={clsx('card reveal group flex h-full flex-col gap-3', `is-${liveness.verdict}`)}
      style={{ '--i': Math.min(index, 11) } as React.CSSProperties}
    >
      {/* ---- Header: identity and the headline number ---------------------- */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[13px] font-semibold transition-transform duration-200 group-hover:scale-105"
          style={{
            background: `hsl(${hue} 45% 16%)`,
            color: `hsl(${hue} 70% 72%)`,
            border: `1px solid hsl(${hue} 40% 26%)`,
          }}
        >
          {company.slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-medium leading-snug">
            {job.title ?? 'Untitled role'}
          </h3>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">{company}</p>
        </div>

        <div className="shrink-0 text-right">
          <div className="tabular text-[19px] font-semibold leading-none" style={{ color: headlineColor }}>
            {headline}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            {match ? 'match' : 'live'}
          </div>
        </div>
      </div>

      <div className="meter">
        <span
          style={
            {
              '--to': `${headline}%`,
              '--i': Math.min(index, 11),
              background: headlineColor,
            } as React.CSSProperties
          }
        />
      </div>

      {/* ---- Facts, each on its own line so none of them get squeezed out --- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
        {displayLocation(job.location) && (
          <span className="inline-flex items-center gap-1 truncate">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="max-w-[150px] truncate">{displayLocation(job.location)}</span>
          </span>
        )}

        {job.remotePolicy && job.remotePolicy !== 'unstated' && (
          <span className="capitalize text-[var(--text-faint)]">{job.remotePolicy}</span>
        )}

        {salary ? (
          <span className="tabular font-medium text-[var(--live)]">{salary}</span>
        ) : (
          <span className="text-[var(--text-faint)]">Pay not listed</span>
        )}

        <span className="tabular ml-auto text-[var(--text-faint)]">{relativeAge(job.postedAt)}</span>
      </div>

      {/*
        Detail that expands on hover.

        Hiding the essentials until hover would mean less information per screen,
        which is the opposite of why cards were chosen. So identity, pay and
        status stay visible always, and this reveals the supporting detail —
        matched skills and the reason behind the score — for the one card being
        considered. It is expanded by default on touch, where there is no hover.
      */}
      <div className="card-detail">
        {match && match.matched.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {match.matched.slice(0, 5).map((skill) => (
              <span
                key={skill}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]"
              >
                {skill}
              </span>
            ))}
            {match.matched.length > 5 && (
              <span className="px-1 py-0.5 text-[11px] text-[var(--text-faint)]">
                +{match.matched.length - 5}
              </span>
            )}
          </div>
        )}

        {match && match.missing.length > 0 && (
          <p className="mb-2 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
            Missing: {match.missing.slice(0, 3).join(', ')}
          </p>
        )}

        {reason && (
          <p
            className={clsx(
              'line-clamp-3 text-[12px] leading-relaxed',
              liveness.provenGhost ? 'verdict-ghost font-medium' : 'text-[var(--text-muted)]',
            )}
          >
            {liveness.provenGhost && '✕ '}
            {reason}
          </p>
        )}
      </div>

      {/* ---- Status, always in the same corner so it can be scanned -------- */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-[11px]">
        <span className="inline-flex items-center gap-1.5" style={{ color: VERDICT_COLOR[liveness.verdict] }}>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: VERDICT_COLOR[liveness.verdict] }}
          />
          {VERDICT_LABEL[liveness.verdict]}
          {match && <span className="text-[var(--text-faint)]"> · {liveness.score}</span>}
        </span>

        <span className="text-[var(--text-faint)] transition-colors duration-200 group-hover:text-[var(--accent)]">
          View →
        </span>
      </div>
    </a>
  );
}
