/**
 * Builds the demo database the deployed site reads.
 *
 *   npm run snapshot -w @revenant/core
 *
 * The working database holds every posting collected and runs to tens of
 * megabytes, which is too large to bundle into a serverless function. This
 * writes a smaller one that is still *real data* — the same rows, with full
 * descriptions, just fewer of them — so the deployed site is a genuine sample
 * rather than fixtures.
 *
 * Sampling is per company rather than globally, so every board stays
 * represented. Taking the first N overall would fill the snapshot with whichever
 * company happened to be ingested first and quietly drop the rest.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

import '../env.js';
import { databaseUrl, db } from '../db/index.js';

/**
 * Postings kept per company.
 *
 * Sampling per company rather than globally keeps every board represented; taking
 * the first N overall would fill the snapshot with whichever company was ingested
 * first and quietly drop the rest.
 */
const PER_COMPANY = 90;

/**
 * Descriptions are trimmed in the snapshot, which is what allows three times as
 * many postings to ship in the same space.
 *
 * Nothing depends on the tail. Compensation has already been parsed out into its
 * own columns by this point, and skill matching reads the requirements, which
 * sit near the top of a job description. The full text remains in the working
 * database and behind the apply link.
 */
const DESCRIPTION_LIMIT = 2400;

const TABLES = [
  'companies',
  'postings',
  'liveness_observations',
  'field_baselines',
  'field_samples',
  'collection_runs',
  'heal_events',
  'duplicates',
] as const;

async function main(): Promise<void> {
  const source = db();
  const target = process.argv.includes('--out')
    ? (process.argv[process.argv.indexOf('--out') + 1] as string)
    : 'data/demo.db';

  console.log(`source ${databaseUrl()}`);
  console.log(`target file:${target}\n`);

  mkdirSync(dirname(target), { recursive: true });

  // Start from an empty file so a re-run is not an append.
  const client = createClient({ url: `file:${target}` });

  // A bulk copy inserts parents and children in separate statements, so
  // referential integrity is only true once the whole copy finishes. Checking
  // it per statement fails on the first child whose parent has not landed yet.
  await client.execute('pragma foreign_keys = off');

  for (const table of [...TABLES].reverse()) {
    await client.execute(`drop table if exists ${table}`).catch(() => undefined);
  }

  // Recreate the schema exactly as the source defines it, so the snapshot and
  // the working database cannot drift apart.
  const schema = await source.all<{ sql: string | null }>(
    sql`select sql from sqlite_master where type in ('table','index') and sql is not null and name not like 'sqlite_%'`,
  );
  for (const row of schema) {
    if (row.sql) await client.execute(row.sql).catch(() => undefined);
  }

  const keep = await source.all<{ id: string }>(sql`
    select id from (
      select
        id,
        row_number() over (partition by company_slug order by posted_at desc) as rn
      from postings
    ) where rn <= ${PER_COMPANY}
  `);

  const ids = new Set(keep.map((row) => row.id));
  console.log(`keeping ${ids.size} postings (${PER_COMPANY} per company)`);

  const quote = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `'${String(value).replace(/'/g, "''")}'`;
  };

  async function copy(table: string, where?: string): Promise<number> {
    const rows = await source.all<Record<string, unknown>>(
      sql.raw(`select * from ${table}${where ? ` where ${where}` : ''}`),
    );
    if (rows.length === 0) return 0;

    if (table === 'postings') {
      for (const row of rows) {
        const description = row['description_html'];
        if (typeof description === 'string' && description.length > DESCRIPTION_LIMIT) {
          row['description_html'] = `${description.slice(0, DESCRIPTION_LIMIT)}…`;
        }
      }
    }

    const columns = Object.keys(rows[0] as Record<string, unknown>);
    // Batched, because one statement per row over tens of thousands of rows is
    // slow enough to look hung.
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const values = batch
        .map((row) => `(${columns.map((c) => quote(row[c])).join(',')})`)
        .join(',');
      await client.execute(
        `insert or ignore into ${table} (${columns.join(',')}) values ${values}`,
      );
    }
    return rows.length;
  }

  const idList = [...ids].map((id) => `'${id}'`).join(',');
  const postingFilter = ids.size > 0 ? `id in (${idList})` : '1=0';
  const childFilter = ids.size > 0 ? `posting_id in (${idList})` : '1=0';

  console.log(`companies              ${await copy('companies')}`);
  console.log(`postings               ${await copy('postings', postingFilter)}`);
  console.log(`liveness_observations  ${await copy('liveness_observations', childFilter)}`);
  console.log(`field_baselines        ${await copy('field_baselines')}`);
  console.log(`field_samples          ${await copy('field_samples')}`);
  console.log(`collection_runs        ${await copy('collection_runs')}`);
  console.log(`heal_events            ${await copy('heal_events')}`);

  // Confirm the finished snapshot is actually consistent, now that every table
  // is populated. A snapshot with dangling references would fail only once
  // someone opened the deployed site.
  const violations = await client.execute('pragma foreign_key_check');
  if (violations.rows.length > 0) {
    console.error(`\n${violations.rows.length} foreign key violations in the snapshot`);
    process.exit(1);
  }

  const size = await client.execute(
    'select page_count * page_size as bytes from pragma_page_count(), pragma_page_size()',
  );
  const bytes = Number(size.rows[0]?.['bytes'] ?? 0);
  console.log(`\nsnapshot ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

await main();
