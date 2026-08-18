/**
 * Confirms credentials and collector ids are visible to the CLIs.
 *
 *   npm run env:check -w @revenant/core
 *
 * Reports only whether each value is present and how long it is — never the
 * value itself, so this is safe to run while screen-sharing or recording the
 * demo.
 */
import '../env.js';

const REQUIRED = ['BRIGHTDATA_API_KEY'] as const;

const OPTIONAL = [
  'BRIGHTDATA_COLLECTOR_GREENHOUSE',
  'BRIGHTDATA_COLLECTOR_LEVER',
  'BRIGHTDATA_COLLECTOR_ASHBY',
  'BRIGHTDATA_COLLECTOR_CAREERS',
  'BRIGHTDATA_COLLECTOR_CHAOS',
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
] as const;

function report(name: string, required: boolean): boolean {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    console.log(`  ${required ? 'MISSING ' : '—       '} ${name}`);
    return !required;
  }

  console.log(`  set      ${name}  (${value.trim().length} chars)`);
  return true;
}

console.log('required');
const ok = REQUIRED.map((name) => report(name, true)).every(Boolean);

console.log('\noptional');
for (const name of OPTIONAL) report(name, false);

if (!ok) {
  console.error('\nAdd the missing value to .env at the repo root, then re-run.');
  process.exit(1);
}

console.log('\nReady. Next: npm run scraper:create -w @revenant/core -- greenhouse <board-url>');
