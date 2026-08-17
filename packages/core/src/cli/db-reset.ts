/**
 * Clears collected data, keeping the schema.
 *
 *   npm run db:reset -w @revenant/core
 *
 * Useful after an extraction fix: rows already in the database were written by
 * the old code, so re-ingesting on top of them would leave a mix of the two.
 */
import { sql } from 'drizzle-orm';

import { databaseUrl, db } from '../db/index.js';

const TABLES = [
  'liveness_observations',
  'duplicates',
  'tailorings',
  'field_samples',
  'postings',
  'collection_runs',
  'field_baselines',
  'heal_events',
  'companies',
] as const;

async function main(): Promise<void> {
  const database = db();
  console.log(`clearing ${databaseUrl()}`);

  for (const table of TABLES) {
    // Ordered so children go before parents; a missing table is not an error
    // because the schema may predate one of them.
    try {
      await database.run(sql.raw(`delete from ${table}`));
      console.log(`  cleared ${table}`);
    } catch (cause) {
      console.log(`  skipped ${table} (${cause instanceof Error ? cause.message : 'unknown'})`);
    }
  }
}

await main();
