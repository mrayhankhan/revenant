/**
 * Populates the database with real postings end to end.
 *
 *   npm run ingest -w @revenant/core -- --file ../../companies.txt
 *
 * IMPORTANT — where this data comes from.
 *
 * Until Bright Data credentials are present, rows are seeded from the ATS
 * platforms' own free JSON feeds so the pipeline, the decay engine and the UI
 * all run on real jobs rather than fixtures. That is a bootstrap, not the
 * design: the feed is the *oracle*, and a pipeline whose data source is a feed
 * that never changes shape has nothing to self-heal.
 *
 * Once BRIGHTDATA_API_KEY is set, Scraper Studio collectors scrape the rendered
 * board HTML and become the data source, the feed returns to grading them, and
 * `collectorId` changes from `*-feed` to the collector's id.
 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { discoverCompanies } from '../discovery/discover.js';
import type { DiscoveredBoard } from '../discovery/discover.js';
import { greenhouseOracle, leverOracle } from '../oracle/ats.js';
import { ashbyOracle } from '../oracle/ashby.js';
import { scoreLiveness } from '../decay/liveness.js';
import { contentHash, deduplicate } from '../normalize/dedup.js';
import { sampleRun, updateBaseline } from '../healing/baseline.js';
import {
  collectionRuns,
  companies,
  db,
  duplicates,
  fieldBaselines,
  fieldSamples,
  livenessObservations,
  postings,
} from '../db/index.js';
import type { Oracle } from '../collectors/base.js';

const ORACLES: Record<DiscoveredBoard['platform'], Oracle> = {
  greenhouse: greenhouseOracle,
  lever: leverOracle,
  ashby: ashbyOracle,
};

async function companyNames(argv: string[]): Promise<string[]> {
  const fileFlag = argv.indexOf('--file');
  if (fileFlag !== -1) {
    const path = argv[fileFlag + 1];
    if (path === undefined) throw new Error('--file needs a path');
    return (await readFile(path, 'utf8'))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  }
  return argv.filter((arg) => !arg.startsWith('--'));
}

async function main(): Promise<void> {
  const names = await companyNames(process.argv.slice(2));
  if (names.length === 0) {
    console.error('usage: ingest <company...> | --file <path>');
    process.exit(2);
  }

  const database = db();
  const now = new Date();

  console.log(`Discovering ${names.length} companies…`);
  const boards = await discoverCompanies(names);
  console.log(`  ${boards.length} boards resolved\n`);

  let totalRows = 0;
  let stored = 0;
  let collapsed = 0;

  for (const board of boards) {
    const oracle = ORACLES[board.platform];
    if (!oracle) {
      console.log(`${board.companyName.padEnd(14)} skipped (no ${board.platform} reader yet)`);
      continue;
    }

    const collectorId = `${board.platform}-feed`;
    const runId = randomUUID();
    const startedAt = new Date();

    const rows = await oracle.truth({ companySlug: board.slug, url: board.url });

    if (rows === null) {
      await database.insert(collectionRuns).values({
        id: runId,
        collectorId,
        companySlug: board.slug,
        startedAt,
        finishedAt: new Date(),
        error: 'oracle unreachable',
      });
      console.log(`${board.companyName.padEnd(14)} unreachable`);
      continue;
    }

    await database
      .insert(companies)
      .values({
        slug: board.slug,
        name: board.companyName,
        platform: board.platform,
        boardUrl: board.url,
        openRoles: board.openRoles,
        discoveredAt: now,
      })
      .onConflictDoUpdate({
        target: companies.slug,
        set: { openRoles: board.openRoles, boardUrl: board.url },
      });

    await database.insert(collectionRuns).values({
      id: runId,
      collectorId,
      companySlug: board.slug,
      startedAt,
      finishedAt: new Date(),
      rowsReturned: rows.length,
    });

    totalRows += rows.length;
    const groups = deduplicate(rows);

    for (const group of groups) {
      const posting = group.merged;
      const id = randomUUID();
      const hash = contentHash(posting);

      await database
        .insert(postings)
        .values({
          id,
          companySlug: board.slug,
          title: posting.title,
          company: board.companyName,
          location: posting.location,
          remotePolicy: posting.remotePolicy,
          salaryMin: posting.salaryMin,
          salaryMax: posting.salaryMax,
          salaryCurrency: posting.salaryCurrency,
          employmentType: posting.employmentType,
          postedAt: posting.postedAt,
          descriptionHtml: posting.descriptionHtml,
          applyUrl: posting.applyUrl,
          sourceKey: posting.sourceKey,
          sourceUrl: posting.sourceUrl,
          // Postings with no description still need a stable hash so the unique
          // index and the "unchanged since last check" signal both keep working.
          contentHash: hash ?? `no-description:${posting.sourceKey}`,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoNothing();

      // Seeded straight from the authoritative feed, so presence is confirmed by
      // construction. Ghosts appear once scraped aggregator rows arrive and
      // disagree with it — that contradiction is the detection mechanism.
      const liveness = scoreLiveness({
        postedAt: posting.postedAt,
        observedAt: now,
        presentInAuthoritative: true,
        absentSince: null,
        applyUrlDead: null,
        repostCount: group.members.length - 1,
        unchangedVerifications: 0,
      });

      await database.insert(livenessObservations).values({
        id: randomUUID(),
        postingId: id,
        score: liveness.score,
        verdict: liveness.verdict,
        reasons: JSON.stringify(liveness.reasons),
        provenGhost: liveness.provenGhost,
        presentInAuthoritative: true,
        absentSince: null,
        applyUrlDead: null,
        repostCount: group.members.length - 1,
        unchangedVerifications: 0,
        observedAt: now,
      });

      // Record what collapsed, rather than silently dropping it, so a dedup
      // mistake stays visible and reversible.
      for (const member of group.members.slice(1)) {
        collapsed += 1;
        await database.insert(duplicates).values({
          id: randomUUID(),
          canonicalId: id,
          duplicateId: id,
          reason: `same company, title and location as ${member.sourceKey}`,
          detectedAt: now,
        });
      }

      stored += 1;
    }

    // Establish the per-field fill-rate anchor that drift is judged against.
    for (const sample of sampleRun(rows)) {
      await database.insert(fieldSamples).values({
        id: randomUUID(),
        runId,
        collectorId,
        field: sample.field,
        filled: sample.filled,
        total: sample.total,
        verdict: 'insufficient_data',
        observedAt: now,
      });

      const baseline = updateBaseline(undefined, sample);
      await database
        .insert(fieldBaselines)
        .values({
          id: randomUUID(),
          collectorId,
          field: sample.field,
          rate: baseline.rate,
          observations: baseline.observations,
          lastUpdatedAt: now,
        })
        .onConflictDoUpdate({
          target: [fieldBaselines.collectorId, fieldBaselines.field],
          set: { rate: baseline.rate, observations: baseline.observations, lastUpdatedAt: now },
        });
    }

    console.log(
      `${board.companyName.padEnd(14)} ${String(rows.length).padStart(4)} rows → ${String(groups.length).padStart(4)} unique`,
    );
  }

  console.log(
    `\n${stored} postings stored from ${totalRows} rows, ${collapsed} duplicates collapsed`,
  );
}

await main();
