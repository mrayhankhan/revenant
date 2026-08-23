'use client';

import { useState } from 'react';
import clsx from 'clsx';

interface Suggestion {
  skill: string;
  label: string;
  evidence: string | null;
}

interface MatchedPosting {
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
  liveness: { score: number; verdict: string };
  match: { score: number; matched: string[]; missing: string[]; reasons: string[] };
  tailoring: Suggestion[];
}

interface MatchResponse {
  profile: { skills: string[]; seniority: string; years: number | null; wantsRemote: boolean };
  scanned: number;
  results: MatchedPosting[];
}

const SAMPLE = `Senior Backend Engineer with 8 years of experience.

Built distributed services in Python and Go, running on Kubernetes across AWS.
Owned the data platform: PostgreSQL, Kafka and Airflow, with dbt for modelling.
Strong on testing and CI/CD; mentored two engineers.
Prefer remote roles.`;

function verdictColor(verdict: string): string {
  return (
    { live: 'var(--live)', aging: 'var(--aging)', stale: 'var(--stale)', ghost: 'var(--ghost)' }[
      verdict
    ] ?? 'var(--stale)'
  );
}

function matchColor(score: number): string {
  if (score >= 75) return 'var(--live)';
  if (score >= 50) return 'var(--aging)';
  return 'var(--stale)';
}

export default function MatchPage(): React.ReactElement {
  const [resume, setResume] = useState('');
  const [data, setData] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function run(text: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resume: text }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : 'Matching failed.',
        );
      }
      setData(payload as MatchResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Matching failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="display text-[2rem] sm:text-[2.5rem]">Match against your CV</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          Paste your CV. Every live posting is scored against it, and each result says which of your
          skills it matched and which it asked for that you did not mention. Nothing is submitted on
          your behalf.
        </p>
      </header>

      <div className="space-y-3">
        <textarea
          className="field min-h-[180px] font-mono text-[13px] leading-relaxed"
          placeholder="Paste your CV here…"
          value={resume}
          onChange={(event) => setResume(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-2.5 text-sm font-medium transition hover:border-[var(--accent)] disabled:opacity-50"
            disabled={loading || resume.trim().length < 40}
            onClick={() => void run(resume)}
          >
            {loading ? 'Scoring…' : 'Match my CV'}
          </button>
          <button
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            onClick={() => {
              setResume(SAMPLE);
              void run(SAMPLE);
            }}
          >
            Use a sample CV
          </button>
          {/* Never demo with a real employment history; this is synthetic. */}
          <span className="text-xs text-[var(--text-faint)]">
            Your CV is scored locally and never stored.
          </span>
        </div>
      </div>

      {error && <div className="panel p-5 text-sm verdict-ghost">{error}</div>}

      {loading && !data && (
        <div className="space-y-3">
          {/* A skill-by-skill scan is fast, but a blank screen makes it feel
              slower than it is. */}
          <div className="panel flex items-center gap-3 p-5">
            <span className="spinner" />
            <span className="text-sm text-[var(--text-muted)]">
              Scoring live postings against your CV…
            </span>
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-[104px] w-full" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      )}

      {data && (
        <>
          <section className="panel reveal p-5">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              What we read from your CV
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span>
                Level <span className="text-[var(--text)]">{data.profile.seniority}</span>
              </span>
              {data.profile.years !== null && (
                <span>
                  <span className="tabular text-[var(--text)]">{data.profile.years}</span> years
                </span>
              )}
              <span>
                <span className="tabular text-[var(--text)]">{data.profile.skills.length}</span>{' '}
                skills recognised
              </span>
              <span className="text-[var(--text-faint)]">
                scanned {data.scanned.toLocaleString()} live postings
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.profile.skills.map((skill, index) => (
                <span
                  key={skill}
                  className="reveal rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[12px] text-[var(--text-muted)] transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--text)]"
                  style={{ '--i': Math.min(index, 20) } as React.CSSProperties}
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <div className="space-y-2.5">
            {data.results.map((result, index) => {
              const expanded = open === result.id;
              return (
                <div
                  key={result.id}
                  className={clsx('card reveal', `is-${result.liveness.verdict}`)}
                  style={{ '--i': Math.min(index, 14) } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-medium">{result.title}</h3>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">
                        {result.company}
                        {result.location && (
                          <span className="text-[var(--text-faint)]"> · {result.location}</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className="tabular text-lg font-semibold"
                        style={{ color: matchColor(result.match.score) }}
                      >
                        {result.match.score}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                        match
                      </div>
                    </div>
                  </div>

                  <div className="meter mt-3">
                    <span
                      style={
                        {
                          '--to': `${result.match.score}%`,
                          '--i': Math.min(index, 14),
                          background: matchColor(result.match.score),
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  <div className="mt-2.5 space-y-1">
                    {result.match.reasons.map((reason) => (
                      <p key={reason} className="reason">
                        {reason}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                    <span style={{ color: verdictColor(result.liveness.verdict) }}>
                      {result.liveness.verdict} · {result.liveness.score}
                    </span>
                    {result.salaryMin !== null && (
                      <span className="tabular text-[var(--text-muted)]">
                        {result.salaryCurrency} {result.salaryMin.toLocaleString()}
                        {result.salaryMax !== null && `–${result.salaryMax.toLocaleString()}`}
                      </span>
                    )}
                    {result.tailoring.length > 0 && (
                      <button
                        className="text-[var(--accent)] hover:underline"
                        onClick={() => setOpen(expanded ? null : result.id)}
                      >
                        {expanded ? 'Hide' : `What to add (${result.tailoring.length})`}
                      </button>
                    )}
                    <a
                      href={`/listing/${result.id}`}
                      className="ml-auto text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      Open →
                    </a>
                  </div>

                  {/*
                    Every suggestion carries the sentence from the posting that
                    motivates it, so the change can be judged rather than trusted.
                  */}
                  {expanded && (
                    <div className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
                      {result.tailoring.map((suggestion) => (
                        <div key={suggestion.skill}>
                          <p className="text-[13px]">
                            Add <span className="font-medium">{suggestion.label}</span> if you have
                            it.
                          </p>
                          {suggestion.evidence && (
                            <p className="mt-0.5 border-l-2 border-[var(--border-strong)] pl-3 text-[12px] italic leading-relaxed text-[var(--text-faint)]">
                              “{suggestion.evidence}”
                            </p>
                          )}
                        </div>
                      ))}
                      <p className="pt-1 text-[11px] text-[var(--text-faint)]">
                        Only claim what is true. These are prompts to surface experience you already
                        have, not lines to invent.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
