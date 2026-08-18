/**
 * The self-healing loop, run against a live collector.
 *
 *   npm run heal -w @revenant/core -- chaos <url>            # observe, or repair
 *   npm run heal -w @revenant/core -- chaos <url> --dry-run  # detect only
 *
 * Run it once against a healthy board and it records the per-field fill rates
 * as a baseline. Run it again after the page changes and it compares against
 * that baseline, asks Scraper Studio to repair whatever broke, grades the repair
 * against the platform's own feed, and approves or rejects on the result.
 *
 * The demo is those two runs with a layout flip between them.
 */
import { randomUUID } from 'node:crypto';

import '../env.js';
import { boardCollector } from '../collectors/board.js';
import type { BoardPlatform } from '../collectors/board.js';
import { assessDrift, healField } from '../healing/orchestrator.js';
import { sampleRun, updateBaseline } from '../healing/baseline.js';
import type { Baseline } from '../healing/baseline.js';
import { collectionRuns, db, fieldBaselines, fieldSamples, healEvents } from '../db/index.js';
import { and, eq } from 'drizzle-orm';
import type { ExtractedField, RawPosting } from '../schema/posting.js';

function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

async function loadBaselines(collectorId: string): Promise<Map<ExtractedField, Baseline>> {
  const rows = await db()
    .select()
    .from(fieldBaselines)
    .where(eq(fieldBaselines.collectorId, collectorId));

  return new Map(
    rows.map((row) => [
      row.field as ExtractedField,
      { field: row.field as ExtractedField, rate: row.rate, observations: row.observations },
    ]),
  );
}

async function saveBaselines(
  collectorId: string,
  postings: readonly RawPosting[],
  existing: Map<ExtractedField, Baseline>,
): Promise<void> {
  const database = db();
  const now = new Date();

  for (const sample of sampleRun(postings)) {
    const updated = updateBaseline(existing.get(sample.field), sample);

    const current = await database
      .select()
      .from(fieldBaselines)
      .where(
        and(eq(fieldBaselines.collectorId, collectorId), eq(fieldBaselines.field, sample.field)),
      );

    if (current.length > 0) {
      await database
        .update(fieldBaselines)
        .set({ rate: updated.rate, observations: updated.observations, lastUpdatedAt: now })
        .where(
          and(eq(fieldBaselines.collectorId, collectorId), eq(fieldBaselines.field, sample.field)),
        );
    } else {
      await database.insert(fieldBaselines).values({
        id: randomUUID(),
        collectorId,
        field: sample.field,
        rate: updated.rate,
        observations: updated.observations,
        lastUpdatedAt: now,
      });
    }
  }
}

function bar(rate: number): string {
  const filled = Math.round(rate * 20);
  return `${'█'.repeat(filled)}${'·'.repeat(20 - filled)}`;
}

function pct(value: number | null): string {
  return value === null ? '  n/a' : `${(value * 100).toFixed(1)}%`;
}

function slugFromUrl(url: string): string {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts.at(-1) ?? new URL(url).hostname;
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const [platform, url] = positional;

  if (platform !== 'greenhouse' && platform !== 'lever' && platform !== 'chaos') {
    console.error('usage: heal <greenhouse|lever|chaos> <board-url> [--dry-run]');
    process.exit(2);
  }
  if (!url) {
    console.error('a board URL is required');
    process.exit(2);
  }

  const collector = boardCollector(platform as BoardPlatform);
  const target = { companySlug: slugFromUrl(url), url };
  const collectorId = `${platform}-board`;
  const database = db();
  const runId = randomUUID();
  const startedAt = new Date();

  console.log(`${collector.label}\n  ${url}\n`);

  const run = await collector.collect(target);
  console.log(`  ${run.postings.length} rows, ${run.rejected} rejected\n`);

  await database.insert(collectionRuns).values({
    id: runId,
    collectorId,
    companySlug: target.companySlug,
    startedAt,
    finishedAt: new Date(),
    rowsReturned: run.postings.length,
    rowsRejected: run.rejected,
  });

  const baselines = await loadBaselines(collectorId);
  const samples = sampleRun(run.postings);

  console.log('field                fill        baseline');
  for (const sample of samples) {
    const rate = sample.total === 0 ? 0 : sample.filled / sample.total;
    const baseline = baselines.get(sample.field);
    console.log(
      `  ${sample.field.padEnd(16)} ${bar(rate)} ${(rate * 100).toFixed(0).padStart(3)}%   ` +
        (baseline ? `${(baseline.rate * 100).toFixed(0).padStart(3)}%` : '   —'),
    );
  }

  // First run against a collector: nothing to compare with, so record and stop.
  if (baselines.size === 0) {
    await saveBaselines(collectorId, run.postings, baselines);
    for (const sample of samples) {
      await database.insert(fieldSamples).values({
        id: randomUUID(),
        runId,
        collectorId,
        field: sample.field,
        filled: sample.filled,
        total: sample.total,
        verdict: 'insufficient_data',
        observedAt: new Date(),
      });
    }
    console.log('\nBaseline recorded. Change the page, then run this again.');
    return;
  }

  const drifted = assessDrift(run.postings, baselines);

  for (const sample of samples) {
    const match = drifted.find((d) => d.field === sample.field);
    await database.insert(fieldSamples).values({
      id: randomUUID(),
      runId,
      collectorId,
      field: sample.field,
      filled: sample.filled,
      total: sample.total,
      verdict: match ? match.verdict.kind : 'healthy',
      observedAt: new Date(),
    });
  }

  if (drifted.length === 0) {
    // Only a healthy run folds into the baseline. Letting a broken run in would
    // drag the anchor down until the breakage looked normal and healing stopped.
    await saveBaselines(collectorId, run.postings, baselines);
    console.log('\nNo drift. Extraction is healthy and the baseline was updated.');
    return;
  }

  console.log(`\n${drifted.length} field(s) drifted, worst first:`);
  for (const { field, verdict } of drifted) {
    console.log(`  ${field.padEnd(16)} ${verdict.kind}`);
  }

  if (has('dry-run')) {
    console.log('\n--dry-run: no heal requested.');
    return;
  }

  for (const { field, verdict } of drifted) {
    console.log(`\n─── healing ${field} ───`);

    const detectedAt = new Date();
    const decision = await healField(field, verdict, run.postings, {
      collectorId: process.env[`BRIGHTDATA_COLLECTOR_${platform.toUpperCase()}`] ?? '',
      target,
      oracle: collector.oracle,
      recollect: async () => (await collector.collect(target)).postings,
      baselines,
    });

    console.log(`  accuracy before  ${pct(decision.accuracyBefore)}`);
    console.log(`  accuracy after   ${pct(decision.accuracyAfter)}`);
    console.log(`  ${decision.approved ? 'APPROVED' : 'REJECTED'} — ${decision.reason}`);

    await database.insert(healEvents).values({
      id: randomUUID(),
      collectorId,
      field,
      beforeSelector: null,
      afterSelector: null,
      rowsAffected: run.postings.length,
      rowsRecovered: decision.auditAfter?.paired ?? 0,
      accuracy: decision.accuracyAfter,
      succeededAt: decision.approved ? new Date() : null,
      failedAt: decision.approved ? null : new Date(),
    });

    console.log(`  recorded heal event (detected ${detectedAt.toISOString()})`);
  }
}

await main();
