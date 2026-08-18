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
import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

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
 * Append the new collector id to .env, but never rewrite an existing one —
 * silently replacing a working collector id is not a thing a script should do
 * on its own.
 */
async function recordCollectorId(envVar: string, collectorId: string): Promise<void> {
  const path = '.env';
  const line = `${envVar}=${collectorId}`;

  if (existsSync(path)) {
    const contents = await readFile(path, 'utf8');
    if (new RegExp(`^${envVar}=`, 'm').test(contents)) {
      console.log(`\n  ${envVar} is already set in .env. Update it by hand if you meant to replace it:`);
      console.log(`  ${line}`);
      return;
    }
    const separator = contents.endsWith('\n') || contents.length === 0 ? '' : '\n';
    await appendFile(path, `${separator}${line}\n`);
  } else {
    await appendFile(path, `${line}\n`);
  }

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
