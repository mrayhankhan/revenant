import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Loads `.env` from the workspace root into `process.env`.
 *
 * Node does not read `.env` on its own, and the CLIs are started from several
 * different directories, so without this a key sitting correctly in `.env` is
 * simply invisible and every Bright Data command reports missing credentials.
 *
 * Next.js does its own loading for `apps/web`, so this is only for the CLIs.
 * Values already present in the real environment always win — an explicitly
 * exported variable should never be silently overridden by a file.
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
        // Not the manifest we are looking for.
      }
    }
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const path = join(workspaceRoot(process.cwd()), '.env');
  if (!existsSync(path)) return;

  // Editors on Windows routinely save .env with a byte order mark, which would
  // otherwise become part of the first variable's name — the key would be
  // present in the file and invisible to the process.
  const contents = readFileSync(path, 'utf8').replace(/^﻿/, '');

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (key.length === 0 || process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    // Tolerate quoted values without importing them literally.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnv();
