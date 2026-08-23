import { EXTRACTED_FIELDS, presentFields } from '../schema/posting.js';
import type { ExtractedField, RawPosting } from '../schema/posting.js';

/**
 * Drift detection.
 *
 * The naive way to notice a broken scraper is to alert when a field comes back
 * null. That does not work on job postings, because null is the normal case for
 * most fields. Roughly 60% of postings advertise no salary at all. An alert on
 * "salary is null" fires constantly and gets muted within a day; an alert on
 * "every salary is null" never fires for a site that was always sparse.
 *
 * So we do not look at nulls. We look at the *rate* of nulls against what this
 * specific collector-field pair has historically produced. A salary fill rate
 * of 40% is healthy for Greenhouse and would be a catastrophic regression for
 * Lever, which publishes `salaryRange` on nearly everything. The baseline makes
 * that judgement per pair instead of globally.
 *
 * This is the difference between "the field is empty" and "the field broke",
 * and it is the only reason the heal loop can run unattended.
 */

/** A field's observed fill rate over one collection run. */
export interface FieldSample {
  field: ExtractedField;
  /** Rows where the field carried a value. */
  filled: number;
  /** Rows examined. */
  total: number;
}

export interface Baseline {
  field: ExtractedField;
  /** Historical fill rate in [0, 1]. */
  rate: number;
  /** Rows the baseline was computed from. Low counts are not trustworthy. */
  observations: number;
}

export type DriftVerdict =
  /** Not enough history, or not enough rows in this run, to judge. */
  | { kind: 'insufficient_data'; field: ExtractedField; reason: string }
  /** Fill rate is within tolerance of the baseline. */
  | { kind: 'healthy'; field: ExtractedField; rate: number; baseline: number }
  /** Fill rate fell materially below baseline. Extraction is suspect. */
  | { kind: 'degraded'; field: ExtractedField; rate: number; baseline: number; severity: number }
  /** Fill rate hit zero against a non-zero baseline. Extraction is broken. */
  | { kind: 'broken'; field: ExtractedField; rate: number; baseline: number };

export interface DriftOptions {
  /**
   * A run smaller than this cannot move a fill rate meaningfully — three rows
   * missing a salary is noise, not drift.
   */
  minRunSize: number;
  /** Baselines built from fewer rows than this are not trusted. */
  minBaselineObservations: number;
  /**
   * Fraction of baseline below which a field counts as degraded. 0.5 means a
   * field that used to fill 40% of the time is degraded once it drops under 20%.
   */
  degradedRatio: number;
  /**
   * Baselines at or below this are treated as "this field is essentially never
   * present here", so a zero run is not evidence of breakage.
   */
  negligibleBaseline: number;
}

export const DEFAULT_DRIFT_OPTIONS: DriftOptions = {
  minRunSize: 20,
  minBaselineObservations: 50,
  degradedRatio: 0.5,
  negligibleBaseline: 0.02,
};

/** Fill rates for every extracted field across one run's rows. */
export function sampleRun(postings: readonly RawPosting[]): FieldSample[] {
  const filled = new Map<ExtractedField, number>(EXTRACTED_FIELDS.map((f) => [f, 0]));

  for (const posting of postings) {
    for (const field of presentFields(posting)) {
      filled.set(field, (filled.get(field) ?? 0) + 1);
    }
  }

  return EXTRACTED_FIELDS.map((field) => ({
    field,
    filled: filled.get(field) ?? 0,
    total: postings.length,
  }));
}

/**
 * Fold a run's sample into an existing baseline as a running mean.
 *
 * Deliberately unweighted by recency: a baseline that drifts toward recent runs
 * would slowly absorb a slow breakage until the break looks normal. We want the
 * baseline anchored to how the collector behaved when it was known good.
 */
export function updateBaseline(previous: Baseline | undefined, sample: FieldSample): Baseline {
  if (sample.total === 0) {
    return previous ?? { field: sample.field, rate: 0, observations: 0 };
  }

  const priorObservations = previous?.observations ?? 0;
  const priorFilled = (previous?.rate ?? 0) * priorObservations;
  const observations = priorObservations + sample.total;

  return {
    field: sample.field,
    rate: (priorFilled + sample.filled) / observations,
    observations,
  };
}

/**
 * Compare one run's fill rate against the baseline for that field.
 */
export function detectDrift(
  sample: FieldSample,
  baseline: Baseline | undefined,
  options: DriftOptions = DEFAULT_DRIFT_OPTIONS,
): DriftVerdict {
  const { field } = sample;

  if (!baseline || baseline.observations < options.minBaselineObservations) {
    return {
      kind: 'insufficient_data',
      field,
      reason: `baseline has ${baseline?.observations ?? 0} observations, need ${options.minBaselineObservations}`,
    };
  }

  if (sample.total < options.minRunSize) {
    return {
      kind: 'insufficient_data',
      field,
      reason: `run had ${sample.total} rows, need ${options.minRunSize}`,
    };
  }

  const rate = sample.filled / sample.total;

  // A field this source essentially never fills tells us nothing when empty.
  if (baseline.rate <= options.negligibleBaseline) {
    return { kind: 'healthy', field, rate, baseline: baseline.rate };
  }

  if (sample.filled === 0) {
    return { kind: 'broken', field, rate, baseline: baseline.rate };
  }

  if (rate < baseline.rate * options.degradedRatio) {
    return {
      kind: 'degraded',
      field,
      rate,
      baseline: baseline.rate,
      severity: 1 - rate / baseline.rate,
    };
  }

  return { kind: 'healthy', field, rate, baseline: baseline.rate };
}

/**
 * Whether a run returned far fewer rows than the collector normally does.
 *
 * Field drift is measured across rows, so a run that returns *no* rows produces
 * no evidence about any field and every one of them reports insufficient data.
 * That leaves the worst failure — the collector matching nothing at all — as the
 * single case the detector cannot see. A live redesign of the chaos target broke
 * extraction completely and the loop reported "no drift, extraction is healthy".
 *
 * So the row count is judged separately, against how many rows previous runs
 * returned.
 */
export interface RowCountVerdict {
  kind: 'healthy' | 'degraded' | 'broken' | 'insufficient_data';
  returned: number;
  expected: number;
  reason: string;
}

export function detectRowCollapse(
  returned: number,
  expected: number,
  options: DriftOptions = DEFAULT_DRIFT_OPTIONS,
): RowCountVerdict {
  // Without a useful history there is nothing to call a collapse against — a
  // collector that has only ever returned three rows may simply scrape a small
  // board.
  if (expected < options.minRunSize) {
    return {
      kind: 'insufficient_data',
      returned,
      expected,
      reason: `previous runs averaged ${expected} rows, need ${options.minRunSize} to judge`,
    };
  }

  if (returned === 0) {
    return {
      kind: 'broken',
      returned,
      expected,
      reason: `returned nothing where previous runs averaged ${expected} rows`,
    };
  }

  if (returned < expected * options.degradedRatio) {
    return {
      kind: 'degraded',
      returned,
      expected,
      reason: `returned ${returned} rows where previous runs averaged ${expected}`,
    };
  }

  return { kind: 'healthy', returned, expected, reason: 'row count is normal' };
}

/** Fields whose extraction warrants a self-heal, worst first. */
export function fieldsNeedingHeal(verdicts: readonly DriftVerdict[]): ExtractedField[] {
  return verdicts
    .filter((v) => v.kind === 'broken' || v.kind === 'degraded')
    .sort((a, b) => severityOf(b) - severityOf(a))
    .map((v) => v.field);
}

function severityOf(verdict: DriftVerdict): number {
  if (verdict.kind === 'broken') return 1;
  if (verdict.kind === 'degraded') return verdict.severity;
  return 0;
}
