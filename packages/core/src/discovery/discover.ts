import { boardSize } from '../oracle/ats.js';
import { ATS_PLATFORMS, boardUrl, slugCandidates } from './slugs.js';
import type { AtsPlatform } from './slugs.js';

export interface DiscoveredBoard {
  companyName: string;
  platform: AtsPlatform;
  slug: string;
  /** Open roles at discovery time. Used to skip empty boards. */
  openRoles: number;
  /** The public page a collector will scrape. */
  url: string;
}

export interface DiscoveryOptions {
  /** Boards with fewer roles than this are not worth a collector run. */
  minOpenRoles: number;
  /** Parallel companies in flight. Kept low to stay polite to free feeds. */
  concurrency: number;
  signal?: AbortSignal;
}

export const DEFAULT_DISCOVERY_OPTIONS: DiscoveryOptions = {
  minOpenRoles: 1,
  concurrency: 6,
};

/**
 * Resolve one company name to its board, or null if it has none we can reach.
 *
 * Probes platform-major rather than candidate-major: a company is far more
 * likely to be on Greenhouse under an odd slug than on Ashby under its most
 * obvious one, and stopping at the first hit keeps the request count near one
 * per company for the common case.
 */
export async function discoverCompany(
  companyName: string,
  signal?: AbortSignal,
): Promise<DiscoveredBoard | null> {
  const candidates = slugCandidates(companyName);

  for (const platform of ATS_PLATFORMS) {
    for (const slug of candidates) {
      const openRoles = await boardSize(platform, slug, signal);
      if (openRoles === null) continue;

      return {
        companyName,
        platform,
        slug,
        openRoles,
        url: boardUrl(platform, slug),
      };
    }
  }

  return null;
}

/** Resolve many company names, bounded concurrency, order preserved. */
export async function discoverCompanies(
  companyNames: readonly string[],
  options: Partial<DiscoveryOptions> = {},
): Promise<DiscoveredBoard[]> {
  const config = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };
  const results: (DiscoveredBoard | null)[] = new Array(companyNames.length).fill(null);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < companyNames.length) {
      const index = cursor;
      cursor += 1;
      const name = companyNames[index];
      if (name === undefined) continue;
      results[index] = await discoverCompany(name, config.signal);
    }
  }

  const workers = Array.from({ length: Math.min(config.concurrency, companyNames.length) }, worker);
  await Promise.all(workers);

  return results.filter(
    (board): board is DiscoveredBoard => board !== null && board.openRoles >= config.minOpenRoles,
  );
}
