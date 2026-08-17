/**
 * Confirms the ground-truth oracles are reachable and parsing correctly.
 *
 * Run this before a collection run. If the oracle is down, heal audits cannot
 * be graded and ghost detection loses its authoritative signal — better to know
 * that up front than to discover it in the middle of a run.
 *
 *   npm run oracle:check -w @halflife/core
 */
import { boardExists, greenhouseOracle, leverOracle } from '../oracle/ats.js';
import type { Oracle } from '../collectors/base.js';

interface Probe {
  label: string;
  oracle: Oracle;
  slug: string;
}

const PROBES: Probe[] = [
  { label: 'greenhouse', oracle: greenhouseOracle, slug: 'gitlab' },
  { label: 'lever', oracle: leverOracle, slug: 'leverdemo' },
];

function fillRate(rows: { salaryMin: number | null }[]): string {
  if (rows.length === 0) return 'n/a';
  const filled = rows.filter((r) => r.salaryMin !== null).length;
  return `${((filled / rows.length) * 100).toFixed(1)}% (${filled}/${rows.length})`;
}

async function main(): Promise<void> {
  let failed = false;

  for (const probe of PROBES) {
    const rows = await probe.oracle.truth({ companySlug: probe.slug, url: '' });

    if (rows === null) {
      console.error(`FAIL  ${probe.label}/${probe.slug}: oracle returned null`);
      failed = true;
      continue;
    }

    const sample = rows[0];
    console.log(`OK    ${probe.label}/${probe.slug}: ${rows.length} postings`);
    console.log(`      salary fill rate: ${fillRate(rows)}`);
    if (sample) {
      console.log(`      sample: ${sample.title} — ${sample.location ?? 'no location'}`);
    }
  }

  // Discovery depends on being able to tell a real slug from a guess.
  const real = await boardExists('greenhouse', 'gitlab');
  const fake = await boardExists('greenhouse', 'not-a-real-company-9f3a2b');

  if (real && !fake) {
    console.log('OK    boardExists discriminates real slugs from guesses');
  } else {
    console.error(`FAIL  boardExists: real=${real} fake=${fake}`);
    failed = true;
  }

  process.exit(failed ? 1 : 0);
}

await main();
