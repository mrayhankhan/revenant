/**
 * Measures whether a posting date can be trusted.
 *
 *   npm run date:honesty -w @revenant/core
 *
 * The obvious objection to this project is that anyone can look at a posting
 * date and judge for themselves. That holds only if the date means what it
 * appears to mean.
 *
 * Two things break it. Companies re-post a role and the date resets, so a
 * listing filled months ago reads as days old. And plenty of genuinely open
 * senior roles sit for months, so an old date is not evidence of death either.
 *
 * This counts both against the collected corpus, so the claim is measured rather
 * than argued.
 */
import { sql } from 'drizzle-orm';

import '../env.js';
import { db } from '../db/index.js';

const DAY = 86_400_000;

async function main(): Promise<void> {
  const database = db();

  const total = await database.get<{ n: number }>(sql`select count(*) as n from postings`);

  /*
   * A repost is the same role — same company, title and location, which is what
   * dedup_key encodes — appearing more than once with different dates. The newest
   * copy carries a fresh date while describing a vacancy that is not new.
   */
  const reposted = await database.all<{ dedup_key: string; copies: number; span_days: number }>(sql`
    select
      dedup_key,
      count(*) as copies,
      (max(posted_at) - min(posted_at)) / ${DAY} as span_days
    from (
      select
        lower(company_slug) || '|' || lower(trim(title)) as dedup_key,
        posted_at
      from postings
      where posted_at is not null and title is not null
    )
    group by dedup_key
    having count(*) > 1
    order by span_days desc
  `);

  const withSpan = reposted.filter((row) => row.span_days >= 30);

  console.log(`${total?.n ?? 0} postings\n`);
  console.log('reposting');
  console.log(`  roles listed more than once            ${reposted.length}`);
  console.log(`  ...where the copies are 30+ days apart ${withSpan.length}`);

  if (withSpan[0]) {
    console.log(
      `  widest gap                             ${Math.round(withSpan[0].span_days)} days`,
    );
  }

  console.log('\nage distribution');
  const ages = await database.all<{ bucket: string; n: number }>(sql`
    select
      case
        when (${Date.now()} - posted_at) / ${DAY} < 7   then '  under a week'
        when (${Date.now()} - posted_at) / ${DAY} < 30  then '  under a month'
        when (${Date.now()} - posted_at) / ${DAY} < 90  then '  1-3 months'
        when (${Date.now()} - posted_at) / ${DAY} < 180 then '  3-6 months'
        else '  over 6 months'
      end as bucket,
      count(*) as n
    from postings
    where posted_at is not null
    group by bucket
  `);
  for (const row of ages) console.log(`${row.bucket.padEnd(24)} ${row.n}`);

  /*
   * The point of the exercise: how many postings would a date-based rule get
   * wrong in each direction. Old-but-real cannot be counted without a ground
   * truth for every role, but fresh-but-reposted can, and it is the direction
   * that costs a job seeker an application.
   */
  const freshButReposted = await database.get<{ n: number }>(sql`
    select count(*) as n from postings p
    where p.posted_at is not null
      and p.title is not null
      and (${Date.now()} - p.posted_at) / ${DAY} < 14
      and exists (
        select 1 from postings q
        where lower(q.company_slug) = lower(p.company_slug)
          and lower(trim(q.title)) = lower(trim(p.title))
          and q.posted_at is not null
          and (p.posted_at - q.posted_at) / ${DAY} > 30
      )
  `);

  console.log(
    `\npostings under two weeks old that are re-listings of a role first posted 30+ days earlier: ${freshButReposted?.n ?? 0}`,
  );
  console.log('a date-based filter reads every one of these as new.');
}

await main();
