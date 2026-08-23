/**
 * Counts postings by function and experience level.
 *
 *   npm run breakdown -w @revenant/core
 *
 * Answers the question the feed raises but cannot: is a filter empty because
 * nothing was collected, or because the classifier is not recognising what was?
 */
import { sql } from 'drizzle-orm';

import '../env.js';
import { db } from '../db/index.js';
import { classifyDomain, classifyLevel, DOMAIN_LABELS, JOB_DOMAINS } from '../match/classify.js';
import type { ExperienceLevel, JobDomain } from '../match/classify.js';

const LEVELS: ExperienceLevel[] = ['intern', 'entry', 'mid', 'senior', 'lead'];

async function main(): Promise<void> {
  const rows = await db().all<{ title: string | null; employment_type: string | null }>(
    sql`select title, employment_type from postings`,
  );

  const grid = new Map<string, number>();
  const levelTotals = new Map<ExperienceLevel, number>();
  const domainTotals = new Map<JobDomain, number>();

  for (const row of rows) {
    const domain = classifyDomain(row.title);
    const level = classifyLevel(row.title, row.employment_type);

    grid.set(`${domain}:${level}`, (grid.get(`${domain}:${level}`) ?? 0) + 1);
    levelTotals.set(level, (levelTotals.get(level) ?? 0) + 1);
    domainTotals.set(domain, (domainTotals.get(domain) ?? 0) + 1);
  }

  console.log(`${rows.length} postings\n`);

  const header = ['function'.padEnd(14), ...LEVELS.map((l) => l.padStart(8))].join('');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const domain of JOB_DOMAINS) {
    const total = domainTotals.get(domain) ?? 0;
    if (total === 0) continue;

    const cells = LEVELS.map((level) => String(grid.get(`${domain}:${level}`) ?? 0).padStart(8));
    console.log(`${DOMAIN_LABELS[domain].padEnd(14)}${cells.join('')}`);
  }

  console.log('-'.repeat(header.length));
  console.log(
    `${'total'.padEnd(14)}${LEVELS.map((l) => String(levelTotals.get(l) ?? 0).padStart(8)).join('')}`,
  );

  // The combination people ask for most, and the one most likely to be empty.
  const internEngineering = grid.get('engineering:intern') ?? 0;
  const entryEngineering = grid.get('engineering:entry') ?? 0;
  console.log(
    `\nengineering internships ${internEngineering}, engineering entry level ${entryEngineering}`,
  );
}

await main();
