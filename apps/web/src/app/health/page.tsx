'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface FieldHealth {
  field: string;
  filled: number;
  total: number;
  rate: number;
  verdict: string;
  baselineRate: number | null;
  baselineObservations: number | null;
}

interface CollectorHealth {
  collectorId: string;
  observedAt: string;
  fields: FieldHealth[];
}

interface HealEvent {
  id: string;
  collectorId: string;
  field: string;
  rowsAffected: number;
  rowsRecovered: number;
  accuracy: number | null;
  succeededAt: string | null;
  failedAt: string | null;
  beforeSelector: string | null;
  afterSelector: string | null;
}

interface HealthResponse {
  collectors: CollectorHealth[];
  heals: HealEvent[];
  summary: {
    totalHeals: number;
    successRate: number | null;
    averageAccuracy: number | null;
    lastHealAt: string | null;
  };
  runs: {
    id: string;
    collectorId: string;
    companySlug: string | null;
    startedAt: string;
    rowsReturned: number;
    rowsRejected: number;
    error: string | null;
  }[];
}

const VERDICT_COLOR: Record<string, string> = {
  healthy: 'var(--live)',
  degraded: 'var(--aging)',
  broken: 'var(--ghost)',
  insufficient_data: 'var(--stale)',
};

function Stat({
  label,
  value,
  hint,
  index = 0,
}: {
  label: string;
  value: string;
  // Explicitly `| undefined`: the repo runs with exactOptionalPropertyTypes, so
  // "may be omitted" and "may be passed as undefined" are different contracts.
  hint?: string | undefined;
  index?: number;
}): React.ReactElement {
  return (
    <div className="panel reveal px-5 py-4" style={{ '--i': index } as React.CSSProperties}>
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}

export default function HealthPage(): React.ReactElement {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`health unavailable (${res.status})`);
        return res.json() as Promise<HealthResponse>;
      })
      .then(setData)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'failed'));
  }, []);

  if (error) {
    return (
      <div className="panel p-6 text-sm verdict-ghost">
        {error}. Run <code className="text-[var(--text)]">npm run ingest</code> first.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-24 w-full" />
        ))}
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Collector health</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Per-field extraction rates against the baseline each collector established when it was
          known good, and every heal that has been attempted.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Collectors" value={String(data.collectors.length)} index={0} />
        <Stat label="Runs recorded" value={String(data.runs.length)} index={1} />
        <Stat
          label="Heals attempted"
          value={String(summary.totalHeals)}
          hint={summary.totalHeals === 0 ? 'nothing has broken yet' : undefined}
          index={2}
        />
        <Stat
          label="Heal accuracy"
          value={summary.averageAccuracy === null ? '—' : `${(summary.averageAccuracy * 100).toFixed(1)}%`}
          hint={summary.averageAccuracy === null ? 'no graded heals' : 'measured against ground truth'}
          index={3}
        />
      </div>

      {/* ---- Field health -------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Extraction by field
        </h2>

        {data.collectors.length === 0 ? (
          <div className="panel p-6 text-sm text-[var(--text-muted)]">
            No collector runs recorded yet.
          </div>
        ) : (
          data.collectors.map((collector) => (
            <div key={collector.collectorId} className="panel overflow-hidden">
              <div className="flex items-baseline justify-between border-b border-[var(--border)] px-5 py-3">
                <span className="text-sm font-medium">{collector.collectorId}</span>
                <span className="text-[12px] text-[var(--text-faint)]">
                  {new Date(collector.observedAt).toLocaleString()}
                </span>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {collector.fields.map((field, index) => (
                  <div
                    key={field.field}
                    className="flex items-center gap-4 px-5 py-2.5 transition-colors duration-200 hover:bg-[var(--surface-raised)]"
                  >
                    <span className="w-40 shrink-0 text-[13px]">{field.field}</span>

                    <div className="meter flex-1">
                      <span
                        style={
                          {
                            '--to': `${field.rate * 100}%`,
                            '--i': Math.min(index, 12),
                            background: VERDICT_COLOR[field.verdict] ?? 'var(--stale)',
                          } as React.CSSProperties
                        }
                      />
                    </div>

                    <span className="tabular w-16 shrink-0 text-right text-[13px]">
                      {(field.rate * 100).toFixed(0)}%
                    </span>

                    <span className="tabular w-28 shrink-0 text-right text-[12px] text-[var(--text-faint)]">
                      {field.baselineRate === null
                        ? 'no baseline'
                        : `base ${(field.baselineRate * 100).toFixed(0)}%`}
                    </span>

                    <span
                      className="w-32 shrink-0 text-right text-[11px] uppercase tracking-wide"
                      style={{ color: VERDICT_COLOR[field.verdict] ?? 'var(--text-faint)' }}
                    >
                      {field.verdict.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <p className="text-xs leading-relaxed text-[var(--text-faint)]">
          A low rate is not automatically a fault. Most postings advertise no salary, so the number
          that matters is the gap between the current rate and the baseline — which is how
          &ldquo;never advertised&rdquo; is told apart from &ldquo;extraction broke&rdquo;.
        </p>
      </section>

      {/* ---- Heals --------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Heal events
        </h2>

        {data.heals.length === 0 ? (
          <div className="panel p-6">
            <p className="text-sm text-[var(--text-muted)]">
              No heals attempted yet — nothing has broken.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-faint)]">
              A heal is triggered when a field&rsquo;s fill rate drops below its baseline. The fix
              Scraper Studio proposes is then graded against the platform&rsquo;s own feed and only
              approved if accuracy actually improved — a repair that refills a field with values
              from the wrong element is rejected.
            </p>
          </div>
        ) : (
          <div className="panel divide-y divide-[var(--border)]">
            {data.heals.map((heal) => {
              const ok = heal.succeededAt !== null;
              return (
                <div key={heal.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[11px] font-medium uppercase tracking-wide"
                        style={{ color: ok ? 'var(--live)' : 'var(--ghost)' }}
                      >
                        {ok ? 'approved' : 'rejected'}
                      </span>
                      <span className="text-sm">{heal.field}</span>
                      <span className="text-[12px] text-[var(--text-faint)]">
                        {heal.collectorId}
                      </span>
                    </div>
                    <span className="tabular text-sm">
                      {heal.accuracy === null ? '—' : `${(heal.accuracy * 100).toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="mt-1 text-[12px] text-[var(--text-faint)]">
                    {heal.rowsRecovered}/{heal.rowsAffected} rows recovered ·{' '}
                    {new Date(heal.succeededAt ?? heal.failedAt ?? Date.now()).toLocaleString()}
                  </div>

                  {(heal.beforeSelector ?? heal.afterSelector) && (
                    <div className="mt-2 space-y-1 font-mono text-[11px]">
                      {heal.beforeSelector && (
                        <div className="verdict-ghost">− {heal.beforeSelector}</div>
                      )}
                      {heal.afterSelector && (
                        <div className="verdict-live">+ {heal.afterSelector}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Runs ---------------------------------------------------------- */}
      {data.runs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Recent runs
          </h2>
          <div className="panel divide-y divide-[var(--border)]">
            {data.runs.slice(0, 10).map((run) => (
              <div key={run.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                <span className="flex items-center gap-3">
                  <span>{run.collectorId}</span>
                  {run.companySlug && (
                    <span className="text-[var(--text-faint)]">{run.companySlug}</span>
                  )}
                </span>
                <span className="flex items-center gap-4 text-[12px]">
                  {run.error ? (
                    <span className="verdict-ghost">{run.error}</span>
                  ) : (
                    <span className={clsx('tabular', run.rowsRejected > 0 && 'verdict-aging')}>
                      {run.rowsReturned} rows
                      {run.rowsRejected > 0 && ` · ${run.rowsRejected} rejected`}
                    </span>
                  )}
                  <span className="tabular text-[var(--text-faint)]">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
