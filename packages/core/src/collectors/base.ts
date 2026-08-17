import type { ExtractedField, RawPosting } from '../schema/posting.js';

export const SOURCE_IDS = [
  'greenhouse',
  'lever',
  'ashby',
  'careers',
  'indeed',
  'chaos',
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/**
 * How much we trust a source to answer "does this job still exist?".
 *
 * `authoritative` sources are the company's own systems. If a role is absent
 * there, it is gone — no further evidence needed. Everything else is a claim
 * that a job exists, which the decay engine weighs but never treats as proof.
 */
export type SourceAuthority = 'authoritative' | 'reported';

export interface CollectorTarget {
  /** Company slug this target belongs to, e.g. `gitlab`. */
  companySlug: string;
  /** The page a collector actually loads. Always public, never authenticated. */
  url: string;
}

export interface CollectRun {
  postings: RawPosting[];
  /** Rows the collector saw but could not parse into the canonical schema. */
  rejected: number;
  startedAt: Date;
  finishedAt: Date;
}

/**
 * An independent source of truth used to grade extraction, never to populate it.
 *
 * Greenhouse, Lever and Ashby all publish stable JSON feeds. It is tempting to
 * read jobs straight from those feeds — but a stable API cannot break, so a
 * pipeline built on one has nothing to self-heal and no way to prove that a
 * heal restored *correct* values rather than merely non-null ones.
 *
 * So we scrape the rendered HTML like any other site, and keep the JSON feed
 * here as an oracle. It answers two questions no scraped page can:
 *
 *   - did a heal recover the right values? (`healing/audit.ts`)
 *   - does this job still exist according to the company itself? (`decay`)
 *
 * The scrape is also strictly richer than the feed, which is why this is not
 * merely a contrivance to have something to heal. Greenhouse's API carries no
 * compensation field whatsoever — measured at 0/197 on GitLab's board — while
 * pay-transparency law puts salary ranges in the description prose of many of
 * those same postings. Scraper Studio extracts structured salary from that
 * prose. The oracle cannot, which is exactly why it cannot grade every field.
 */
export interface Oracle {
  readonly authority: SourceAuthority;
  /**
   * Fields this oracle carries and may therefore grade. Fields outside this set
   * exist only in the scraped page, so a mismatch there is not evidence of a
   * bad extraction and must never be scored as one.
   */
  readonly gradableFields: ReadonlySet<ExtractedField>;
  /** Ground-truth postings for a target, or null if the oracle cannot answer. */
  truth(target: CollectorTarget): Promise<RawPosting[] | null>;
}

/**
 * Every source implements this, whether it is a structured ATS board, a
 * hand-rolled careers page, or a large aggregator. Six very different sites
 * behind one four-member contract is the point.
 */
export interface Collector {
  readonly id: SourceId;
  readonly authority: SourceAuthority;
  /** Human-readable, shown in the health dashboard. */
  readonly label: string;
  /** The public pages this collector is responsible for. */
  targets(): Promise<CollectorTarget[]>;
  /** Scrape one target via Scraper Studio and return canonical rows. */
  collect(target: CollectorTarget): Promise<CollectRun>;
  /** Present only where an independent ground truth exists. */
  readonly oracle?: Oracle;
}
