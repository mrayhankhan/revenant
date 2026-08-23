/**
 * Checks that apply links point at a specific posting.
 *
 *   npm run inspect:links -w @revenant/core
 *
 * A board that returns its careers index instead of the job is worse than no
 * link: the candidate lands somewhere plausible and has to find the role again,
 * with no signal that anything went wrong.
 */
import { sql } from 'drizzle-orm';

import '../env.js';
import { db } from '../db/index.js';

interface Row {
  company: string | null;
  company_slug: string;
  apply_url: string | null;
  source_key: string;
}

/**
 * A link is specific if it carries the posting's own id, or ends in something
 * that is plainly a job path rather than a listing index.
 */
function isSpecific(row: Row): boolean {
  const url = row.apply_url;
  if (!url) return false;
  if (row.source_key && url.includes(row.source_key)) return true;
  return /\/(jobs?|careers?|positions?|openings?)\/[^/]+\/?$/i.test(url) && !/\/jobs\/?$/i.test(url);
}

async function main(): Promise<void> {
  const rows = await db().all<Row>(sql`
    select company, company_slug, apply_url, source_key from postings
  `);

  const generic = rows.filter((row) => !isSpecific(row));

  const byCompany = new Map<string, { total: number; generic: number; sample: string }>();
  for (const row of rows) {
    const key = row.company ?? row.company_slug;
    const entry = byCompany.get(key) ?? { total: 0, generic: 0, sample: '' };
    entry.total += 1;
    if (!isSpecific(row)) {
      entry.generic += 1;
      entry.sample = row.apply_url ?? '(none)';
    }
    byCompany.set(key, entry);
  }

  console.log('companies whose links do not identify the posting:\n');
  for (const [company, entry] of [...byCompany.entries()].sort(
    (a, b) => b[1].generic - a[1].generic,
  )) {
    if (entry.generic === 0) continue;
    console.log(`  ${company.padEnd(14)} ${entry.generic}/${entry.total}`);
    console.log(`    ${entry.sample}`);
  }

  console.log(`\n${generic.length}/${rows.length} apply links do not identify a specific posting`);
}

await main();
