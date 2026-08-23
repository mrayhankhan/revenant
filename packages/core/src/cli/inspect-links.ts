/**
 * Prints the links stored against a few postings.
 *
 *   npm run inspect:links -w @revenant/core
 *
 * Used to check that the apply link actually points at the posting a candidate
 * would open, rather than at the board index or a redirect.
 */
import { sql } from 'drizzle-orm';

import '../env.js';
import { db } from '../db/index.js';

interface Row {
  company: string | null;
  company_slug: string;
  apply_url: string | null;
  source_url: string;
}

async function main(): Promise<void> {
  const rows = await db().all<Row>(sql`
    select company, company_slug, apply_url, source_url
    from postings
    order by random()
    limit 8
  `);

  for (const row of rows) {
    console.log(`${row.company ?? row.company_slug}`);
    console.log(`  apply : ${row.apply_url ?? '(none)'}`);
    console.log(`  source: ${row.source_url}`);
  }

  const mismatched = await db().get<{ n: number }>(sql`
    select count(*) as n from postings
    where apply_url is null or apply_url not like '%' || company_slug || '%'
  `);

  console.log(`\n${mismatched?.n ?? 0} postings whose apply link does not contain their slug`);
}

await main();
