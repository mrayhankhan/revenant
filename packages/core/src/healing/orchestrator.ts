import { decideHeal, healScraper } from '../brightdata/cli.js';
import { auditAgainstOracle, healSucceeded } from './audit.js';
import type { AuditReport } from './audit.js';
import { detectDrift, fieldsNeedingHeal, sampleRun } from './baseline.js';
import type { Baseline, DriftVerdict } from './baseline.js';
import type { CollectorTarget, Oracle } from '../collectors/base.js';
import type { ExtractedField, RawPosting } from '../schema/posting.js';

/**
 * The heal loop, end to end.
 *
 *   observe → detect drift → ask Scraper Studio to heal → re-run
 *           → grade against ground truth → approve or reject
 *
 * The last two steps are the point. `bdata scraper heal` parks a proposed fix at
 * an approval gate rather than applying it, and the obvious move is to pass
 * `--auto-approve` and be done. That would accept a fix on the word of the thing
 * that produced it.
 *
 * A heal that re-binds to the wrong element restores the fill rate perfectly
 * while returning a job's department where its location used to be. Fill rate
 * calls that fixed. Only a comparison against an independent source — the ATS
 * platform's own feed — can tell the difference, and that comparison is what
 * decides the gate here.
 */

export interface HealDecision {
  field: ExtractedField;
  prompt: string;
  /** Accuracy against the oracle before the heal, if it could be measured. */
  accuracyBefore: number | null;
  accuracyAfter: number | null;
  approved: boolean;
  reason: string;
  auditBefore: AuditReport | null;
  auditAfter: AuditReport | null;
}

export interface HealContext {
  collectorId: string;
  target: CollectorTarget;
  oracle: Oracle | undefined;
  /** Re-runs the collector and returns normalised rows. */
  recollect: () => Promise<RawPosting[]>;
  baselines: Map<ExtractedField, Baseline>;
  /** Minimum ground-truth accuracy a heal must reach to be approved. */
  minimumAccuracy?: number;
  dryRun?: boolean;
}

/**
 * Describe the breakage in the terms the scraper was built from.
 *
 * The heal prompt talks about *what the field is*, never about selectors. The
 * plain-language description is still true after a redesign; a selector is the
 * thing that just stopped being true, so repeating it would anchor the fix to
 * the broken page.
 */
export function healPrompt(field: ExtractedField, verdict: DriftVerdict): string {
  const observed =
    verdict.kind === 'broken'
      ? `is now empty on every row (it previously had a value on ${Math.round(verdict.baseline * 100)}% of rows)`
      : verdict.kind === 'degraded'
        ? `is empty on most rows (${Math.round(verdict.rate * 100)}% filled, was ${Math.round(verdict.baseline * 100)}%)`
        : 'stopped returning values';

  const meaning = FIELD_MEANING[field];

  return `The "${field}" field ${observed}. ${meaning} The page layout appears to have changed. Re-locate this field on the page and extract it again.`.slice(
    0,
    1000,
  );
}

/** What each field *is*, independent of where it sits. Mirrors the create spec. */
const FIELD_MEANING: Record<ExtractedField, string> = {
  title: 'It is the job title as displayed on the posting.',
  company: 'It is the name of the hiring company.',
  location: 'It is where the role is based, written as the page writes it.',
  remotePolicy: 'It states whether the role is remote, hybrid or on-site.',
  salaryMin: 'It is the lower bound of the advertised compensation range.',
  salaryMax: 'It is the upper bound of the advertised compensation range.',
  salaryCurrency: 'It is the currency of the advertised compensation.',
  employmentType: 'It states whether the role is full-time, contract, an internship and so on.',
  postedAt: 'It is the date the listing says it was posted.',
  descriptionHtml: 'It is the full job description body.',
  applyUrl: 'It is the link a candidate follows to apply.',
};

/**
 * Fields whose extraction has drifted far enough to warrant a repair, worst
 * first.
 *
 * The ordering is load-bearing rather than cosmetic: each heal costs a round
 * trip and credits, and a run may be cut short, so the totally broken field has
 * to be attempted before the merely degraded one. `fieldsNeedingHeal` already
 * ranks by severity — this walks that ranking instead of the schema's field
 * order, which would otherwise silently put `location` ahead of `salaryMin`.
 */
export function assessDrift(
  rows: readonly RawPosting[],
  baselines: Map<ExtractedField, Baseline>,
): { field: ExtractedField; verdict: DriftVerdict }[] {
  const verdicts = sampleRun(rows).map((sample) =>
    detectDrift(sample, baselines.get(sample.field)),
  );

  const byField = new Map(verdicts.map((verdict) => [verdict.field, verdict]));

  return fieldsNeedingHeal(verdicts).flatMap((field) => {
    const verdict = byField.get(field);
    return verdict ? [{ field, verdict }] : [];
  });
}

async function gradeAgainstOracle(
  rows: readonly RawPosting[],
  context: HealContext,
): Promise<AuditReport | null> {
  if (!context.oracle) return null;

  const truth = await context.oracle.truth(context.target);
  if (truth === null) return null;

  return auditAgainstOracle(rows, truth, context.oracle.gradableFields);
}

/**
 * Repair one field and decide whether to keep the repair.
 *
 * Returns the decision rather than throwing on a bad heal: a rejected fix is a
 * normal, recordable outcome, and the heal event is worth persisting either way.
 */
export async function healField(
  field: ExtractedField,
  verdict: DriftVerdict,
  rowsBefore: readonly RawPosting[],
  context: HealContext,
): Promise<HealDecision> {
  const prompt = healPrompt(field, verdict);
  const auditBefore = await gradeAgainstOracle(rowsBefore, context);

  if (context.dryRun) {
    return {
      field,
      prompt,
      accuracyBefore: auditBefore?.overallAccuracy ?? null,
      accuracyAfter: null,
      approved: false,
      reason: 'dry run — no heal requested',
      auditBefore,
      auditAfter: null,
    };
  }

  // Deliberately without --auto-approve; the gate is where the grading happens.
  await healScraper(context.collectorId, prompt, { url: context.target.url });

  const rowsAfter = await context.recollect();
  const auditAfter = await gradeAgainstOracle(rowsAfter, context);

  // Without an oracle we cannot tell a real repair from a confident wrong one.
  // Rejecting is the safe default: a rejected heal leaves the collector as it
  // was, while a wrong one silently poisons every row it touches.
  if (!auditBefore || !auditAfter) {
    await decideHeal(context.collectorId, 'reject');
    return {
      field,
      prompt,
      accuracyBefore: auditBefore?.overallAccuracy ?? null,
      accuracyAfter: auditAfter?.overallAccuracy ?? null,
      approved: false,
      reason: 'no ground truth available to grade the fix, so it was not accepted',
      auditBefore,
      auditAfter,
    };
  }

  const ok = healSucceeded(auditBefore, auditAfter, context.minimumAccuracy ?? 0.95);
  await decideHeal(context.collectorId, ok ? 'approve' : 'reject');

  const before = auditBefore.overallAccuracy;
  const after = auditAfter.overallAccuracy;

  return {
    field,
    prompt,
    accuracyBefore: before,
    accuracyAfter: after,
    approved: ok,
    reason: ok
      ? `accuracy against ${context.target.companySlug}'s own feed rose from ${pct(before)} to ${pct(after)}`
      : `fix rejected: accuracy ${pct(after)} did not clear the bar (was ${pct(before)})`,
    auditBefore,
    auditAfter,
  };
}

function pct(value: number | null): string {
  return value === null ? 'unknown' : `${(value * 100).toFixed(1)}%`;
}
