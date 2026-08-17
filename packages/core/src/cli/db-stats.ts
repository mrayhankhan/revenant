/**
 * Quick health read on what is actually in the database.
 *
 *   npm run db:stats -w @revenant/core
 */
import { sql } from 'drizzle-orm';

import { databaseUrl, db } from '../db/index.js';

async function main(): Promise<void> {
  const database = db();
  console.log(`database: ${databaseUrl()}\n`);

  const counts = await database.all<{ name: string; n: number }>(sql`
    select 'postings' as name, count(*) as n from postings
    union all select 'liveness_observations', count(*) from liveness_observations
    union all select 'companies', count(*) from companies
    union all select 'field_baselines', count(*) from field_baselines
    union all select 'field_samples', count(*) from field_samples
    union all select 'collection_runs', count(*) from collection_runs
    union all select 'heal_events', count(*) from heal_events
  `);
  for (const row of counts) console.log(`${row.name.padEnd(24)} ${row.n}`);

  console.log('\nverdict distribution');
  const verdicts = await database.all<{ verdict: string; n: number }>(sql`
    select verdict, count(*) as n from liveness_observations group by verdict order by n desc
  `);
  for (const row of verdicts) console.log(`  ${row.verdict.padEnd(10)} ${row.n}`);

  console.log('\nposted_at spread');
  const dates = await database.all<{ day: string; n: number }>(sql`
    select date(posted_at / 1000, 'unixepoch') as day, count(*) as n
    from postings where posted_at is not null
    group by day order by day desc limit 8
  `);
  for (const row of dates) console.log(`  ${row.day} ${row.n}`);

  const nulls = await database.get<{ n: number }>(
    sql`select count(*) as n from postings where posted_at is null`,
  );
  console.log(`  (null)     ${nulls?.n ?? 0}`);

  console.log('\nsalary fill');
  const salary = await database.get<{ filled: number; total: number }>(
    sql`select sum(case when salary_min is not null then 1 else 0 end) as filled, count(*) as total from postings`,
  );
  console.log(`  ${salary?.filled ?? 0}/${salary?.total ?? 0}`);
}

await main();
