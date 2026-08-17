/**
 * Resolves company names to their public ATS boards.
 *
 *   npm run discover -w @halflife/core -- Stripe Vercel Ramp
 *   npm run discover -w @halflife/core -- --file companies.txt
 *
 * Costs no Bright Data credits: every probe hits the platform's own free feed.
 * Confirmed boards are what the collectors are then pointed at.
 */
import { readFile } from 'node:fs/promises';

import { discoverCompanies } from '../discovery/discover.js';

async function companyNames(argv: string[]): Promise<string[]> {
  const fileFlag = argv.indexOf('--file');
  if (fileFlag !== -1) {
    const path = argv[fileFlag + 1];
    if (path === undefined) throw new Error('--file needs a path');
    const contents = await readFile(path, 'utf8');
    return contents
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  }
  return argv.filter((arg) => !arg.startsWith('--'));
}

async function main(): Promise<void> {
  const names = await companyNames(process.argv.slice(2));

  if (names.length === 0) {
    console.error('usage: discover <company...> | --file <path>');
    process.exit(2);
  }

  const started = Date.now();
  const boards = await discoverCompanies(names);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const totalRoles = boards.reduce((sum, board) => sum + board.openRoles, 0);

  for (const board of boards) {
    console.log(
      `${board.platform.padEnd(10)} ${String(board.openRoles).padStart(4)} roles  ${board.url}`,
    );
  }

  const missed = names.filter((name) => !boards.some((b) => b.companyName === name));
  for (const name of missed) {
    console.log(`${'—'.padEnd(10)} ${'   -'} roles  ${name} (no reachable board)`);
  }

  console.log(
    `\n${boards.length}/${names.length} companies resolved, ${totalRoles} open roles, ${elapsed}s`,
  );
}

await main();
