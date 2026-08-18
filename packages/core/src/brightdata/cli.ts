import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Absolute path to the CLI's entry script.
 *
 * Resolved from the installed package rather than shelling out to `npx`. On
 * Windows `npx` is `npx.cmd`, which Node refuses to launch through `execFile`
 * without a shell — a deliberate guard against command injection. Enabling the
 * shell would work and would also put the scraper description, which is free
 * text, onto a command line the shell parses. Running the entry script under
 * `process.execPath` sidesteps both problems and pins the version we installed.
 */
function cliEntry(): string {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve('@brightdata/cli/package.json');
  return join(dirname(manifest), 'dist', 'index.js');
}

/**
 * Typed wrapper over the Bright Data CLI.
 *
 * Scraper Studio is driven through `bdata`, the same commands a person would
 * type. Shelling out rather than reimplementing the HTTP API keeps this honest:
 * whatever the CLI supports, Revenant supports, and the commands in the README
 * are the commands that actually run.
 *
 *   bdata scraper create <url> "<description>"   → collector id
 *   bdata scraper run <collector_id> <url>       → rows
 *   bdata scraper heal <collector_id> "<prompt>" → proposed fix, awaiting approval
 *   bdata scraper approve <collector_id>         → accept or --reject
 *
 * The approval gate is the important one. `heal` stops and waits by default,
 * which is exactly the seam Revenant needs: the proposed fix is graded against
 * the platform's own feed before anything is accepted. See `healing/orchestrator.ts`.
 */

export class BrightDataError extends Error {
  constructor(
    message: string,
    readonly command: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'BrightDataError';
  }
}

export interface BrightDataOptions {
  apiKey?: string;
  /** Seconds. Scraper generation genuinely takes 5–15 minutes on real sites. */
  timeoutSeconds?: number;
}

const DEFAULT_TIMEOUT_SECONDS = 900;

function baseArgs(options: BrightDataOptions): string[] {
  const args = [cliEntry()];
  const key = options.apiKey ?? process.env['BRIGHTDATA_API_KEY'];
  if (key) args.push('-k', key);
  return args;
}

async function invoke(
  args: string[],
  options: BrightDataOptions,
): Promise<unknown> {
  const timeout = (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;
  const command = `bdata ${args.join(' ')}`;

  try {
    const { stdout } = await run(process.execPath, [...baseArgs(options), ...args], {
      timeout,
      // Scraper output for a large board comfortably exceeds the default buffer.
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    return parseJson(stdout, command);
  } catch (cause) {
    if (cause instanceof BrightDataError) throw cause;
    const stderr = typeof cause === 'object' && cause !== null && 'stderr' in cause
      ? String((cause as { stderr: unknown }).stderr)
      : '';
    const message = cause instanceof Error ? cause.message : 'unknown failure';
    throw new BrightDataError(`${command} failed: ${message}`, command, stderr);
  }
}

/**
 * The CLI prints human-readable progress before its JSON payload, so the first
 * balanced JSON value in the stream is the result rather than the whole stdout.
 */
function parseJson(stdout: string, command: string): unknown {
  const start = stdout.search(/[[{]/);
  if (start === -1) {
    throw new BrightDataError('no JSON in CLI output', command, stdout.slice(0, 500));
  }

  for (let end = stdout.length; end > start; end -= 1) {
    const candidate = stdout.slice(start, end);
    const last = candidate.trimEnd().at(-1);
    if (last !== '}' && last !== ']') continue;
    try {
      return JSON.parse(candidate.trimEnd());
    } catch {
      // Keep shrinking; trailing prose after the payload is normal.
    }
  }

  throw new BrightDataError('could not parse CLI JSON', command, stdout.slice(0, 500));
}

/** Collector ids appear under different keys depending on the command. */
function findCollectorId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const record = payload as Record<string, unknown>;
  for (const key of ['collector_id', 'collectorId', 'id', 'collector']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }

  for (const nested of ['data', 'result', 'scraper']) {
    const child = record[nested];
    if (typeof child === 'object' && child !== null) {
      const found = findCollectorId(child);
      if (found) return found;
    }
  }

  return null;
}

export interface CreatedScraper {
  collectorId: string;
  raw: unknown;
}

/**
 * Build a scraper from a plain-language description of the fields.
 *
 * The description is the durable artefact — it stays true when the page moves,
 * which is what makes healing possible. Keep it about *what the data is*, never
 * about where it sits in the DOM.
 */
export async function createScraper(
  url: string,
  description: string,
  options: BrightDataOptions & { name?: string } = {},
): Promise<CreatedScraper> {
  if (description.length > 500) {
    throw new Error(`description is ${description.length} chars; the CLI caps it at 500`);
  }

  const args = ['scraper', 'create', url, description, '--json'];
  if (options.name) args.push('--name', options.name);

  const raw = await invoke(args, options);
  const collectorId = findCollectorId(raw);

  if (!collectorId) {
    throw new BrightDataError('create returned no collector id', 'scraper create', JSON.stringify(raw).slice(0, 500));
  }

  return { collectorId, raw };
}

/** Run a collector over one or many URLs and return the raw rows. */
export async function runScraper(
  collectorId: string,
  urls: string | readonly string[],
  options: BrightDataOptions = {},
): Promise<unknown[]> {
  const list = typeof urls === 'string' ? [urls] : urls;
  if (list.length === 0) return [];

  const args =
    list.length === 1
      ? ['scraper', 'run', collectorId, list[0] as string, '--json']
      : ['scraper', 'run', collectorId, '--urls', list.join(','), '--json'];

  const raw = await invoke(args, options);

  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object' && raw !== null) {
    for (const key of ['data', 'rows', 'results']) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export interface HealProposal {
  /** True when the heal is parked at the approval gate awaiting a decision. */
  awaitingApproval: boolean;
  raw: unknown;
}

/**
 * Ask Scraper Studio to repair a collector.
 *
 * Deliberately does *not* pass `--auto-approve`. Auto-approving accepts a fix on
 * the word of the thing that produced it; a heal that latches onto the wrong
 * element returns values and looks repaired. Revenant instead lets the heal park
 * at the gate, grades the result against the platform's own feed, and only then
 * approves. That decision lives in `healing/orchestrator.ts`.
 */
export async function healScraper(
  collectorId: string,
  prompt: string,
  options: BrightDataOptions & { url?: string } = {},
): Promise<HealProposal> {
  if (prompt.length > 1000) {
    throw new Error(`heal prompt is ${prompt.length} chars; the CLI caps it at 1000`);
  }

  const args = ['scraper', 'heal', collectorId, prompt, '--json'];
  if (options.url) args.push('--url', options.url);

  const raw = await invoke(args, options);
  const text = JSON.stringify(raw).toLowerCase();

  return {
    awaitingApproval: text.includes('approval') || text.includes('awaiting'),
    raw,
  };
}

/** Accept or reject a heal parked at the approval gate. */
export async function decideHeal(
  collectorId: string,
  decision: 'approve' | 'reject',
  options: BrightDataOptions = {},
): Promise<unknown> {
  const args = ['scraper', 'approve', collectorId, '--json'];
  if (decision === 'reject') args.push('--reject');
  // Only a fix we have already graded gets saved.
  else args.push('--auto-save');

  return invoke(args, options);
}

/** Whether credentials are present. Callers fall back to offline fixtures if not. */
export function hasCredentials(): boolean {
  return Boolean(process.env['BRIGHTDATA_API_KEY']);
}
