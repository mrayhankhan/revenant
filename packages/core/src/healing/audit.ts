import { EXTRACTED_FIELDS } from '../schema/posting.js';
import type { ExtractedField, RawPosting } from '../schema/posting.js';

/**
 * Grades a scrape against ground truth.
 *
 * Fill-rate drift (`baseline.ts`) can tell that a field started coming back
 * empty. It cannot tell whether a heal put the *right* values back. A collector
 * that repairs itself onto the wrong DOM node looks perfectly healthy by fill
 * rate while returning the job's department where the location used to be.
 *
 * So every heal is scored against the ATS platform's own JSON feed. That turns
 * "it healed" into a number — field-level accuracy against an independent
 * source — which is the difference between a demo and an evaluation.
 *
 * Only fields the oracle actually carries are graded; see `Oracle.gradableFields`.
 */

export type FieldOutcome =
  /** Both sides carried a value and they agree. */
  | 'match'
  /** Both sides carried a value and they disagree. Extraction is wrong. */
  | 'mismatch'
  /** Truth carried a value, the scrape did not. Extraction missed it. */
  | 'missed'
  /** Truth carried nothing, so there is nothing to grade against. */
  | 'ungradable';

export interface FieldGrade {
  field: ExtractedField;
  match: number;
  mismatch: number;
  missed: number;
  /** Rows where truth held a value, i.e. `match + mismatch + missed`. */
  gradable: number;
  /** `match / gradable`, or null when nothing was gradable. */
  accuracy: number | null;
}

export interface AuditReport {
  /** Postings found in both the scrape and the oracle. */
  paired: number;
  /** In the oracle but never scraped — the collector did not see them at all. */
  missedPostings: number;
  /** Scraped but absent from the oracle. Stale rows, or a bad join. */
  unpairedScrapes: number;
  grades: FieldGrade[];
  /** Match rate across every gradable field-value in the run. */
  overallAccuracy: number | null;
}

/** Fold a URL down to something comparable across sources. */
function normaliseUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    // Tracking params differ between the board HTML and the API; the path does not.
    const path = url.pathname.replace(/\/+$/, '').toLowerCase();
    return `${url.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return null;
  }
}

function normaliseText(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Join key for pairing a scraped row with its ground-truth row.
 *
 * The board HTML and the JSON feed rarely share an id, but they do link to the
 * same posting URL. Title is the fallback, which is why pairing is reported
 * separately in the audit — a collapse in `paired` is itself a drift signal.
 */
export function joinKey(posting: RawPosting): string | null {
  return (
    normaliseUrl(posting.applyUrl) ?? normaliseUrl(posting.sourceUrl) ?? normaliseText(posting.title)
  );
}

/** Token overlap, used for prose where an exact match is not meaningful. */
function similarity(a: string, b: string): number {
  const left = new Set(a.split(' ').filter(Boolean));
  const right = new Set(b.split(' ').filter(Boolean));
  if (left.size === 0 && right.size === 0) return 1;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  return shared / (left.size + right.size - shared);
}

/** How close two prose bodies must be to count as the same content. */
const PROSE_SIMILARITY_THRESHOLD = 0.6;

/** Salary parsed from prose may round differently than the structured feed. */
const SALARY_TOLERANCE = 0.02;

function compareField(
  field: ExtractedField,
  scraped: RawPosting[ExtractedField],
  truth: RawPosting[ExtractedField],
): FieldOutcome {
  if (truth === null || truth === undefined) return 'ungradable';
  if (scraped === null || scraped === undefined) return 'missed';

  switch (field) {
    case 'descriptionHtml': {
      const overlap = similarity(stripHtml(String(scraped)), stripHtml(String(truth)));
      return overlap >= PROSE_SIMILARITY_THRESHOLD ? 'match' : 'mismatch';
    }

    case 'postedAt': {
      const a = scraped as Date;
      const b = truth as Date;
      // Feeds report timestamps, boards usually report a date. Same day is agreement.
      return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10) ? 'match' : 'mismatch';
    }

    case 'salaryMin':
    case 'salaryMax': {
      const a = scraped as number;
      const b = truth as number;
      const drift = Math.abs(a - b) / Math.max(Math.abs(b), 1);
      return drift <= SALARY_TOLERANCE ? 'match' : 'mismatch';
    }

    case 'applyUrl': {
      return normaliseUrl(String(scraped)) === normaliseUrl(String(truth)) ? 'match' : 'mismatch';
    }

    case 'location': {
      // Boards render "Remote, Italy" where feeds may say "Italy". Containment
      // in either direction is agreement; anything else is a real mismatch.
      const a = normaliseText(String(scraped)) ?? '';
      const b = normaliseText(String(truth)) ?? '';
      return a === b || a.includes(b) || b.includes(a) ? 'match' : 'mismatch';
    }

    default: {
      if (scraped instanceof Date || truth instanceof Date) {
        return String(scraped) === String(truth) ? 'match' : 'mismatch';
      }
      if (typeof scraped === 'number' || typeof truth === 'number') {
        return scraped === truth ? 'match' : 'mismatch';
      }
      return normaliseText(String(scraped)) === normaliseText(String(truth)) ? 'match' : 'mismatch';
    }
  }
}

/**
 * Score a scraped run against ground truth, restricted to the fields the oracle
 * can actually speak to.
 */
export function auditAgainstOracle(
  scraped: readonly RawPosting[],
  truth: readonly RawPosting[],
  gradableFields: ReadonlySet<ExtractedField>,
): AuditReport {
  const scrapedByKey = new Map<string, RawPosting>();
  for (const posting of scraped) {
    const key = joinKey(posting);
    if (key !== null) scrapedByKey.set(key, posting);
  }

  const tally = new Map<ExtractedField, { match: number; mismatch: number; missed: number }>(
    EXTRACTED_FIELDS.map((field) => [field, { match: 0, mismatch: 0, missed: 0 }]),
  );

  let paired = 0;
  let missedPostings = 0;
  const pairedKeys = new Set<string>();

  for (const truthRow of truth) {
    const key = joinKey(truthRow);
    const scrapedRow = key === null ? undefined : scrapedByKey.get(key);

    if (!scrapedRow || key === null) {
      missedPostings += 1;
      continue;
    }

    paired += 1;
    pairedKeys.add(key);

    for (const field of gradableFields) {
      const outcome = compareField(field, scrapedRow[field], truthRow[field]);
      if (outcome === 'ungradable') continue;
      const counts = tally.get(field);
      if (counts) counts[outcome] += 1;
    }
  }

  const grades: FieldGrade[] = [...gradableFields].map((field) => {
    const counts = tally.get(field) ?? { match: 0, mismatch: 0, missed: 0 };
    const gradable = counts.match + counts.mismatch + counts.missed;
    return {
      field,
      ...counts,
      gradable,
      accuracy: gradable === 0 ? null : counts.match / gradable,
    };
  });

  const totalGradable = grades.reduce((sum, g) => sum + g.gradable, 0);
  const totalMatch = grades.reduce((sum, g) => sum + g.match, 0);

  return {
    paired,
    missedPostings,
    unpairedScrapes: scrapedByKey.size - pairedKeys.size,
    grades,
    overallAccuracy: totalGradable === 0 ? null : totalMatch / totalGradable,
  };
}

/**
 * Whether a heal actually improved things.
 *
 * Fill rate alone would call a heal successful the moment values reappear, even
 * if they are values from the wrong element. A heal only counts if accuracy
 * against ground truth improved and cleared the bar.
 */
export function healSucceeded(
  before: AuditReport,
  after: AuditReport,
  minimumAccuracy = 0.95,
): boolean {
  if (after.overallAccuracy === null) return false;
  if (before.overallAccuracy !== null && after.overallAccuracy <= before.overallAccuracy) {
    return false;
  }
  return after.overallAccuracy >= minimumAccuracy;
}
