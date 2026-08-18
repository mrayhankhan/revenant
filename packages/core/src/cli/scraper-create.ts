/**
 * Creates the Scraper Studio collectors Revenant runs on.
 *
 *   npm run scraper:create -w @revenant/core -- greenhouse https://job-boards.greenhouse.io/stripe
 *   npm run scraper:create -w @revenant/core -- lever https://jobs.lever.co/leverdemo
 *
 * Wraps `bdata scraper create <url> "<description>"`. The description passed is
 * BOARD_FIELD_SPEC — the same plain-language spec for every platform, which is
 * the point: one description of *what the data is*, resolved by Studio against
 * three unrelated page structures, and re-resolved whenever one of them moves.
 *
 * Generation takes 5–15 minutes on a real board. That is normal, not a hang.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import '../env.js';
import { createScraper, hasCredentials } from '../brightdata/cli.js';
import { BOARD_FIELD_SPEC } from '../collectors/board.js';

const ENV_VAR: Record<string, string> = {
  greenhouse: 'BRIGHTDATA_COLLECTOR_GREENHOUSE',
  lever: 'BRIGHTDATA_COLLECTOR_LEVER',
  ashby: 'BRIGHTDATA_COLLECTOR_ASHBY',
  careers: 'BRIGHTDATA_COLLECTOR_CAREERS',
  chaos: 'BRIGHTDATA_COLLECTOR_CHAOS',
};

/**
 * Record the new collector id in .env.
 *
 * Fills a blank placeholder — `.env.example` ships these keys empty — but never
 * overwrites a value that is already there: silently replacing a working
 * collector id is not something a script should decide on its own.
 */
async function recordCollectorId(envVar: string, collectorId: string): Promise<void> {
  const path = '.env';
  const line = `${envVar}=${collectorId}`;

  if (!existsSync(path)) {
    await writeFile(path, `${line}\n`);
    console.log(`\n  wrote ${envVar} to .env`);
    return;
  }

  const contents = await readFile(path, 'utf8');
  const existing = new RegExp(`^${envVar}=(.*)$`, 'm').exec(contents);

  if (existing && (existing[1] ?? '').trim().length > 0) {
    console.log(`\n  ${envVar} already holds a value. Update it by hand if you meant to replace it:`);
    console.log(`  ${line}`);
    return;
  }

  if (existing) {
    await writeFile(path, contents.replace(existing[0], line));
    console.log(`\n  set ${envVar} in .env`);
    return;
  }

  const separator = contents.length === 0 || contents.endsWith('\n') ? '' : '\n';
  await appendFile(path, `${separator}${line}\n`);
  console.log(`\n  wrote ${envVar} to .env`);
}

async function main(): Promise<void> {
  const [platform, url] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

  if (!platform || !url) {
    console.error('usage: scraper:create <greenhouse|lever|ashby|careers|chaos> <board-url>');
    process.exit(2);
  }

  const envVar = ENV_VAR[platform];
  if (!envVar) {
    console.error(`unknown platform "${platform}". Expected one of: ${Object.keys(ENV_VAR).join(', ')}`);
    process.exit(2);
  }

  if (!hasCredentials()) {
    console.error('BRIGHTDATA_API_KEY is not set.');
    console.error('Run `npx -p @brightdata/cli bdata login`, then put the key in .env');
    process.exit(1);
  }

  console.log(`Creating a ${platform} scraper against:\n  ${url}\n`);
  console.log(`Field spec (${BOARD_FIELD_SPEC.length}/500 chars):`);
  console.log(`  ${BOARD_FIELD_SPEC}\n`);
  console.log('This usually takes 5–15 minutes. A slow response is not a failure.\n');

  const started = Date.now();
  const { collectorId } = await createScraper(url, BOARD_FIELD_SPEC, {
    name: `revenant-${platform}`,
  });
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);

  console.log(`\n  collector: ${collectorId}   (${minutes} min)`);
  await recordCollectorId(envVar, collectorId);
  console.log(`\n  test it:  npm run collect -w @revenant/core -- ${platform} ${url}`);
}

await main();
