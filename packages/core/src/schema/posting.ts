import { z } from 'zod';

/**
 * The canonical shape every source normalises into.
 *
 * Two rules govern this file:
 *
 *  1. Every extractable field is nullable. A source that cannot supply a field
 *     yields `null`, never a fabricated value or an empty string. The healing
 *     engine reads these nulls as its drift signal, so a fake value here would
 *     silently blind it (see `healing/baseline.ts`).
 *
 *  2. `null` is ambiguous on purpose. It means "we do not have this", which
 *     covers both "the posting never advertised a salary" and "our extraction
 *     for salary just broke". Nothing at this layer can tell those apart —
 *     that is exactly what per-field baselines exist to resolve.
 */

export const REMOTE_POLICIES = ['remote', 'hybrid', 'onsite', 'unstated'] as const;
export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
  'unstated',
] as const;

export const remotePolicySchema = z.enum(REMOTE_POLICIES);
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);

/**
 * The field names the plain-language Scraper Studio spec describes. Ordering is
 * meaningful: it is the order used in the health dashboard and in heal reports.
 */
export const EXTRACTED_FIELDS = [
  'title',
  'company',
  'location',
  'remotePolicy',
  'salaryMin',
  'salaryMax',
  'salaryCurrency',
  'employmentType',
  'postedAt',
  'descriptionHtml',
  'applyUrl',
] as const;

export type ExtractedField = (typeof EXTRACTED_FIELDS)[number];

/**
 * A posting as extracted from a single source, before normalisation across
 * sources. This is what a collector returns.
 */
export const rawPostingSchema = z.object({
  /** Stable identifier within the source, used to detect re-posts. */
  sourceKey: z.string().min(1),
  sourceUrl: z.string().url(),

  title: z.string().min(1).nullable(),
  company: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  remotePolicy: remotePolicySchema.nullable(),
  salaryMin: z.number().positive().nullable(),
  salaryMax: z.number().positive().nullable(),
  salaryCurrency: z.string().length(3).nullable(),
  employmentType: employmentTypeSchema.nullable(),
  postedAt: z.coerce.date().nullable(),
  descriptionHtml: z.string().nullable(),
  applyUrl: z.string().url().nullable(),
});

export type RawPosting = z.infer<typeof rawPostingSchema>;

/**
 * A posting after normalisation and cross-source deduplication.
 */
export const postingSchema = rawPostingSchema.extend({
  id: z.string().uuid(),
  /** Canonical company slug, used to join against the careers-page oracle. */
  companySlug: z.string().min(1),
  contentHash: z.string().length(64),
  firstSeenAt: z.coerce.date(),
  lastSeenAt: z.coerce.date(),
});

export type Posting = z.infer<typeof postingSchema>;

/**
 * Returns the fields that carry a value, used to compute per-run fill rates.
 * Deliberately counts `null` and `undefined` only — `0` and `''` never reach
 * here because the schema rejects them upstream.
 */
export function presentFields(posting: RawPosting): Set<ExtractedField> {
  const present = new Set<ExtractedField>();
  for (const field of EXTRACTED_FIELDS) {
    if (posting[field] !== null && posting[field] !== undefined) present.add(field);
  }
  return present;
}
