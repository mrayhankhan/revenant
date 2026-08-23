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
  applyUrl?: string | null;
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
 * Placeholders boards use to mean "not stated". Printed verbatim they read as a
 * bug rather than an absent value.
 */
const PLACEHOLDER_LOCATION = /^(n\/?a|none|-|—|tbd|unspecified|various)$/i;

function displayLocation(location: string | null): string | null {
  const trimmed = location?.trim();
  if (!trimmed || PLACEHOLDER_LOCATION.test(trimmed)) return null;
  return trimmed;
}

/** Deterministic hue per company, so its mark is the same colour everywhere. */
function companyHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

/** Hosts that belong to the ATS, not to the employer. */
const ATS_HOSTS = /(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|myworkdayjobs\.com)$/i;

/**
 * A favicon for the employer, or null.
 *
 * Many companies white-label their board, so the apply link points at their own
 * domain — which is a reliable way to find their mark. Where the link stays on
 * the ATS there is nothing to derive, and the lettered mark is used instead.
 * Guessing `company.com` was rejected: it is wrong often enough (notion.so,
 * ramp.com vs ramp.co) to put the wrong logo on a job, which is worse than none.
 */
function logoUrl(applyUrl: string | null | undefined): string | null {
  if (!applyUrl) return null;

  try {
    const host = new URL(applyUrl).hostname.replace(/^www\./, '');
    if (ATS_HOSTS.test(host)) return null;
    return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
  } catch {
    return null;
  }
}

/**
 * A job as a flip card.
 *
 * The front carries only what identifies the role — company and title — so a
 * grid of these scans as a list of jobs rather than a wall of statistics. The
 * back holds everything used to judge it: match score, pay, location, matched
 * skills and the reason behind the liveness verdict.
 *
 * Both faces occupy the same box, so the grid never reflows as cards turn.
 */
export function JobCard({ job, index }: { job: JobCardData; index: number }): React.ReactElement {
  const { liveness, match } = job;
  const salary = formatSalary(job);
  const headline = match?.score ?? liveness.score;
  const headlineColor = match ? matchColor(match.score) : VERDICT_COLOR[liveness.verdict];
  const reason = match?.reasons[0] ?? liveness.reasons[0];
  const company = job.company ?? 'Unknown';
  const location = displayLocation(job.location);
  const hue = companyHue(company);
  const logo = logoUrl(job.applyUrl);

  return (
    <a
      href={`/listing/${job.id}`}
      className="flip reveal"
      style={{ '--i': Math.min(index, 11) } as React.CSSProperties}
      aria-label={`${job.title ?? 'Role'} at ${company}`}
    >
      <div className="flip-inner">
        {/* ---- Front: identity only ------------------------------------- */}
        <div className={clsx('flip-face card flex flex-col', `is-${liveness.verdict}`)}>
          {/* The lettered mark sits underneath; the logo covers it when it
              loads, and simply never appears when it does not. No flash of a
              broken image, no layout shift. */}
          <span
            aria-hidden
            className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg text-[14px] font-semibold"
            style={{
              background: `hsl(${hue} 45% 16%)`,
              color: `hsl(${hue} 70% 72%)`,
              border: `1px solid hsl(${hue} 40% 26%)`,
            }}
          >
            {company.slice(0, 2).toUpperCase()}
            {logo && (
              <img
                src={logo}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full bg-white/95 object-contain p-1.5"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </span>

          <h3 className="mt-3 line-clamp-3 text-[15px] font-medium leading-snug">
            {job.title ?? 'Untitled role'}
          </h3>
          <p className="mt-1 truncate text-[13px] text-[var(--text-muted)]">{company}</p>

          {/* A single dot is the only status on the front: enough to spot a
              dead listing while scanning, not enough to become a statistic. */}
          <div className="mt-auto flex items-center justify-between pt-3">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: VERDICT_COLOR[liveness.verdict] }}
              title={VERDICT_LABEL[liveness.verdict]}
            />
            <span className="text-[11px] text-[var(--text-faint)]">Hover for detail</span>
          </div>
        </div>

        {/* ---- Back: everything used to judge the role -------------------- */}
        <div className={clsx('flip-face flip-back card flex flex-col', `is-${liveness.verdict}`)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-medium">{job.title ?? 'Untitled role'}</h3>
              <p className="truncate text-[11.5px] text-[var(--text-faint)]">{company}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular text-[18px] font-semibold leading-none" style={{ color: headlineColor }}>
                {headline}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                {match ? 'match' : 'live'}
              </div>
            </div>
          </div>

          <div className="meter mt-2">
            <span
              style={
                { '--to': `${headline}%`, '--i': 0, background: headlineColor } as React.CSSProperties
              }
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
            {location && <span className="max-w-[140px] truncate">{location}</span>}
            {job.remotePolicy && job.remotePolicy !== 'unstated' && (
              <span className="capitalize text-[var(--text-faint)]">{job.remotePolicy}</span>
            )}
            {salary ? (
              <span className="tabular font-medium text-[var(--live)]">{salary}</span>
            ) : (
              <span className="text-[var(--text-faint)]">Pay not listed</span>
            )}
            <span className="tabular ml-auto text-[var(--text-faint)]">
              {relativeAge(job.postedAt)}
            </span>
          </div>

          {match && match.matched.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {match.matched.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]"
                >
                  {skill}
                </span>
              ))}
              {match.matched.length > 4 && (
                <span className="px-1 text-[10.5px] text-[var(--text-faint)]">
                  +{match.matched.length - 4}
                </span>
              )}
            </div>
          )}

          {reason && (
            <p
              className={clsx(
                'mt-2 line-clamp-2 text-[11.5px] leading-relaxed',
                liveness.provenGhost ? 'verdict-ghost font-medium' : 'text-[var(--text-muted)]',
              )}
            >
              {liveness.provenGhost && '✕ '}
              {reason}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-2 text-[11px]">
            <span
              className="inline-flex items-center gap-1.5"
              style={{ color: VERDICT_COLOR[liveness.verdict] }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: VERDICT_COLOR[liveness.verdict] }}
              />
              {VERDICT_LABEL[liveness.verdict]}
              {match && <span className="text-[var(--text-faint)]"> · {liveness.score}</span>}
            </span>
            <span className="text-[var(--accent)]">View →</span>
          </div>
        </div>
      </div>
    </a>
  );
}
