import { collectionRuns, db, fieldBaselines, fieldSamples, healEvents } from '@revenant/core/db/index';
import { desc, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Collector health.
 *
 * Every figure here is queried. An earlier version of this endpoint returned
 * invented numbers — a 96% heal success rate and 99.8% uptime against a database
 * with no heal events in it at all. On a project whose entire claim is that it
 * reports what is actually true about data quality, a fabricated dashboard is
 * the one thing that cannot ship.
 *
 * Where there is nothing to report, this returns empty and the UI says so.
 */
export async function GET(): Promise<NextResponse> {
  const database = db();

  /*
   * Latest fill-rate sample per collector/field, with the baseline it is judged
   * against. The pair is the whole health signal: a rate means nothing without
   * the baseline it is being compared to.
   *
   * ROW_NUMBER rather than `where observed_at = max(observed_at)`, because a
   * single ingest writes one sample per company against the same collector with
   * an identical timestamp — fifteen boards produced fifteen rows per field that
   * all tied for "latest", and every field rendered fifteen times.
   */
  const fields = await database.all<{
    collector_id: string;
    field: string;
    filled: number;
    total: number;
    verdict: string;
    observed_at: number;
    baseline_rate: number | null;
    baseline_observations: number | null;
  }>(sql`
    with ranked as (
      select
        s.collector_id,
        s.field,
        s.filled,
        s.total,
        s.verdict,
        s.observed_at,
        row_number() over (
          partition by s.collector_id, s.field
          order by s.observed_at desc, s.id desc
        ) as rn
      from ${fieldSamples} s
    )
    select
      r.collector_id,
      r.field,
      r.filled,
      r.total,
      r.verdict,
      r.observed_at,
      b.rate as baseline_rate,
      b.observations as baseline_observations
    from ranked r
    left join ${fieldBaselines} b
      on b.collector_id = r.collector_id and b.field = r.field
    where r.rn = 1
    order by r.collector_id, r.field
  `);

  const heals = await database.select().from(healEvents).orderBy(desc(healEvents.succeededAt));

  const runs = await database
    .select()
    .from(collectionRuns)
    .orderBy(desc(collectionRuns.startedAt))
    .limit(20);

  const succeeded = heals.filter((heal) => heal.succeededAt !== null);
  const graded = heals.filter((heal) => heal.accuracy !== null);

  return NextResponse.json({
    collectors: groupByCollector(fields),
    heals: heals.map((heal) => ({
      id: heal.id,
      collectorId: heal.collectorId,
      field: heal.field,
      rowsAffected: heal.rowsAffected,
      rowsRecovered: heal.rowsRecovered,
      accuracy: heal.accuracy,
      succeededAt: heal.succeededAt?.toISOString() ?? null,
      failedAt: heal.failedAt?.toISOString() ?? null,
      beforeSelector: heal.beforeSelector,
      afterSelector: heal.afterSelector,
    })),
    summary: {
      totalHeals: heals.length,
      // null rather than 0: "no heals yet" and "every heal failed" are different
      // states and must not render as the same number.
      successRate: heals.length === 0 ? null : succeeded.length / heals.length,
      averageAccuracy:
        graded.length === 0
          ? null
          : graded.reduce((sum, heal) => sum + (heal.accuracy ?? 0), 0) / graded.length,
      lastHealAt: succeeded[0]?.succeededAt?.toISOString() ?? null,
    },
    runs: runs.map((run) => ({
      id: run.id,
      collectorId: run.collectorId,
      companySlug: run.companySlug,
      startedAt: run.startedAt.toISOString(),
      rowsReturned: run.rowsReturned,
      rowsRejected: run.rowsRejected,
      error: run.error,
    })),
  });
}

interface FieldRow {
  collector_id: string;
  field: string;
  filled: number;
  total: number;
  verdict: string;
  observed_at: number;
  baseline_rate: number | null;
  baseline_observations: number | null;
}

function groupByCollector(rows: FieldRow[]): unknown[] {
  const byCollector = new Map<string, FieldRow[]>();

  for (const row of rows) {
    const existing = byCollector.get(row.collector_id);
    if (existing) existing.push(row);
    else byCollector.set(row.collector_id, [row]);
  }

  return [...byCollector.entries()].map(([collectorId, fields]) => ({
    collectorId,
    observedAt: new Date(Math.max(...fields.map((f) => f.observed_at))).toISOString(),
    fields: fields.map((field) => ({
      field: field.field,
      filled: field.filled,
      total: field.total,
      rate: field.total === 0 ? 0 : field.filled / field.total,
      verdict: field.verdict,
      baselineRate: field.baseline_rate,
      baselineObservations: field.baseline_observations,
    })),
  }));
}
