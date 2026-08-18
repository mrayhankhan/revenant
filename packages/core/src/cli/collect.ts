/**
 * Runs a Scraper Studio collector over a board and reports what came back.
 *
 *   npm run collect -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/vercel
 *   npm run collect -w @revenant/core -- greenhouse <url> --out docs/sample-output.json
 *
 * Prints per-field fill rates, because the fill rate *is* the health signal: it
 * is what drift detection compares against a baseline, and seeing it here is how
 * you tell a sparse field from a broken one before the heal loop has to.
 *
 * With an oracle available it also grades the scrape against the platform's own
 * feed, which is the number that says whether extraction is actually correct
 * rather than merely non-empty.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import '../env.js';
import { boardCollector } from '../collectors/board.js';
import { auditAgainstOracle } from '../healing/audit.js';
import { sampleRun } from '../healing/baseline.js';
import { EXTRACTED_FIELDS } from '../schema/posting.js';
import type { RawPosting } from '../schema/posting.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function bar(rate: number): string {
  const filled = Math.round(rate * 20);
  return `${'█'.repeat(filled)}${'·'.repeat(20 - filled)}`;
}

/** Companies appear in the board URL for these platforms. */
function slugFromUrl(url: string): string {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts.at(-1) ?? 'unknown';
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter((arg, index, all) => {
    if (arg.startsWith('--')) return false;
    const previous = all[index - 1];
    return !(previous && previous.startsWith('--'));
  });

  const [platform, url] = positional;

  if (platform !== 'greenhouse' && platform !== 'lever') {
    console.error('usage: collect <greenhouse|lever> <board-url> [--out <path>]');
    process.exit(2);
  }
  if (!url) {
    console.error('a board URL is required');
    process.exit(2);
  }

  const collector = boardCollector(platform);
  const target = { companySlug: slugFromUrl(url), url };

  console.log(`Running ${collector.label} against\n  ${url}\n`);

  const started = Date.now();
  const run = await collector.collect(target);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`  ${run.postings.length} rows returned, ${run.rejected} rejected  (${seconds}s)\n`);

  if (run.postings.length === 0) {
    console.error('No rows came back. Check the collector id and that the board URL still loads.');
    process.exit(1);
  }

  // ---- Fill rates -----------------------------------------------------------
  console.log('field fill rates');
  const samples = sampleRun(run.postings);
  for (const sample of samples) {
    const rate = sample.total === 0 ? 0 : sample.filled / sample.total;
    console.log(
      `  ${sample.field.padEnd(16)} ${bar(rate)} ${(rate * 100).toFixed(0).padStart(3)}%  ${sample.filled}/${sample.total}`,
    );
  }

  // ---- Accuracy against ground truth ---------------------------------------
  if (collector.oracle) {
    const truth = await collector.oracle.truth(target);

    if (truth === null) {
      console.log('\nGround truth unavailable — accuracy not graded this run.');
    } else {
      const report = auditAgainstOracle(run.postings, truth, collector.oracle.gradableFields);
      console.log(`\naccuracy vs ${platform}'s own feed`);
      console.log(
        `  paired ${report.paired}, missed ${report.missedPostings}, unmatched ${report.unpairedScrapes}`,
      );
      for (const grade of report.grades) {
        if (grade.gradable === 0) continue;
        console.log(
          `  ${grade.field.padEnd(16)} ${((grade.accuracy ?? 0) * 100).toFixed(1).padStart(5)}%  ` +
            `(${grade.match} ok, ${grade.mismatch} wrong, ${grade.missed} missed)`,
        );
      }
      if (report.overallAccuracy !== null) {
        console.log(`  overall          ${(report.overallAccuracy * 100).toFixed(1)}%`);
      }
    }
  }

  const out = flag('out');
  if (out) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(serialise(run.postings), null, 2));
    console.log(`\nwrote ${run.postings.length} postings to ${out}`);
  }
}

/** Dates as ISO strings so the sample output is stable and readable. */
function serialise(postings: readonly RawPosting[]): unknown[] {
  return postings.map((posting) => {
    const row: Record<string, unknown> = {};
    row['sourceKey'] = posting.sourceKey;
    row['sourceUrl'] = posting.sourceUrl;
    for (const field of EXTRACTED_FIELDS) {
      const value = posting[field];
      row[field] = value instanceof Date ? value.toISOString() : value;
    }
    return row;
  });
}

await main();
