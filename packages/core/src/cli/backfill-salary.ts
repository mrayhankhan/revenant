/**
 * Extracts compensation from descriptions already in the database.
 *
 *   npm run backfill:salary -w @revenant/core
 *   npm run backfill:salary -w @revenant/core -- --dry-run
 *
 * Postings seeded from an ATS feed arrive with no salary at all, because those
 * feeds carry no compensation field — 0 of 3,509 measured. The number is still
 * in the posting, written into the description prose by pay-transparency law.
 * The scrape already stored that prose, so the range can be recovered without
 * re-scraping anything.
 *
 * This is the same parser the Scraper Studio collector uses, applied to rows
 * that were collected before it existed.
 */
import { eq, isNotNull, isNull, and } from 'drizzle-orm';

import '../env.js';
import { db, postings } from '../db/index.js';
import { bestSalary } from '../normalize/salary.js';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const database = db();

  const rows = await database
    .select({
      id: postings.id,
      title: postings.title,
      company: postings.company,
      descriptionHtml: postings.descriptionHtml,
    })
    .from(postings)
    .where(and(isNull(postings.salaryMin), isNotNull(postings.descriptionHtml)));

  console.log(`${rows.length} postings with a description but no salary\n`);

  let found = 0;
  const samples: string[] = [];

  for (const row of rows) {
    const salary = bestSalary(null, row.descriptionHtml);
    if (salary.min === null || salary.max === null) continue;

    found += 1;

    if (samples.length < 6) {
      samples.push(
        `  ${row.company} — ${row.title}\n    ${salary.currency ?? ''} ${salary.min.toLocaleString()} – ${salary.max.toLocaleString()}`,
      );
    }

    if (!dryRun) {
      await database
        .update(postings)
        .set({
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: salary.currency,
        })
        .where(eq(postings.id, row.id));
    }
  }

  console.log(samples.join('\n'));

  const rate = rows.length === 0 ? 0 : (found / rows.length) * 100;
  console.log(
    `\n${found}/${rows.length} recovered (${rate.toFixed(1)}%)${dryRun ? ' — dry run, nothing written' : ''}`,
  );
}

await main();
