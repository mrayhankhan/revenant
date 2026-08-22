import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema.js';

export * from './schema.js';

const DEFAULT_RELATIVE_PATH = 'data/revenant.db';

/**
 * Walk up from `start` to the workspace root — the nearest package.json that
 * declares workspaces.
 *
 * Without this, the database path depends on where a process happens to be
 * started: the CLIs run from the repo root, Next runs from `apps/web`, and
 * vitest from wherever it was invoked. A relative `file:` URL would resolve to
 * three different files, and the UI would quietly show an empty feed against a
 * database that was never written to.
 */
function workspaceRoot(start: string): string {
  let current = resolve(start);

  for (;;) {
    const manifest = join(current, 'package.json');

    if (existsSync(manifest)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null && 'workspaces' in parsed) {
          return current;
        }
      } catch {
        // An unreadable package.json is not the root we are looking for.
      }
    }

    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

/** Committed sample used when the working database is not present. */
const SNAPSHOT_RELATIVE_PATH = 'data/demo.db';

/**
 * Absolute `file:` URL for the database, regardless of the current directory.
 *
 * Falls back to the committed snapshot when the working database is absent —
 * which is the case on a deployment, and on a fresh clone before anything has
 * been ingested. Both should show real postings rather than an empty feed.
 */
export function databaseUrl(): string {
  const configured = process.env['DATABASE_URL'];

  if (configured && !configured.startsWith('file:')) return configured;

  const root = workspaceRoot(process.cwd());
  const raw = configured?.slice('file:'.length) ?? DEFAULT_RELATIVE_PATH;

  if (isAbsolute(raw)) return `file:${raw}`;

  const working = join(root, raw);
  if (existsSync(working)) return `file:${working}`;

  const snapshot = join(root, SNAPSHOT_RELATIVE_PATH);
  if (existsSync(snapshot)) return `file:${snapshot}`;

  return `file:${working}`;
}

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * The database handle.
 *
 * libsql rather than better-sqlite3 so a fresh clone needs no native toolchain —
 * `npm install && npm run dev` has to work on a judge's machine on the first
 * try, and a node-gyp failure is the most common way that stops being true.
 */
export function db(): ReturnType<typeof drizzle<typeof schema>> {
  if (cached) return cached;

  const url = databaseUrl();

  if (url.startsWith('file:')) {
    mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
  }

  cached = drizzle(createClient({ url }), { schema });
  return cached;
}
