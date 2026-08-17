/**
 * Ghost-job detection.
 *
 * A ghost job is live but not real: filled, cancelled, or an evergreen req kept
 * open to collect résumés. Aggregators cannot tell — they only know the listing
 * is still on their own page, which is the one fact that stays true longest.
 *
 * We can tell, because we read two things aggregators do not read together: the
 * aggregator's copy *and* the company's own ATS board. When a role is gone from
 * the company's board but still on Indeed, that is not a heuristic — the company
 * itself has stopped listing it.
 *
 * Everything else here is circumstantial and weighted accordingly. The output is
 * a score plus the reasons behind it, because a bare number persuades nobody; a
 * job seeker needs "removed from Acme's board 12 days ago" to act on it.
 */

export type Verdict = 'live' | 'aging' | 'stale' | 'ghost';

export interface DecaySignals {
  /** When the listing claims it was posted. */
  postedAt: Date | null;
  /** When these signals were gathered. */
  observedAt: Date;
  /**
   * Whether the company's own ATS board still carries this role.
   * `null` means no authoritative source was reachable — never treat that as absence.
   */
  presentInAuthoritative: boolean | null;
  /** First observation of the role missing from the authoritative source. */
  absentSince: Date | null;
  /** Apply link 404s or redirects to a generic careers index. `null` if unchecked. */
  applyUrlDead: boolean | null;
  /** Times this role was re-posted with a fresh date. Churn signals an evergreen req. */
  repostCount: number;
  /** Consecutive verifications where the description was byte-identical. */
  unchangedVerifications: number;
}

export interface LivenessScore {
  /** 0 (certainly dead) to 100 (freshly posted and confirmed by the company). */
  score: number;
  verdict: Verdict;
  /** Plain-English, ordered by weight. The UI shows the first one. */
  reasons: string[];
  /**
   * True when the company's own systems contradict the listing. This is proof
   * rather than inference, and the UI is allowed to say so outright.
   */
  provenGhost: boolean;
}

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Age penalty. Deliberately gentle for the first month — plenty of real senior
 * roles sit open that long — then steep, because a genuinely open role that has
 * gone 90 days without being filled is usually not a real opening any more.
 */
function agePenalty(ageDays: number): number {
  if (ageDays <= 30) return 0;
  if (ageDays <= 60) return (ageDays - 30) * 0.4;
  if (ageDays <= 90) return 12 + (ageDays - 60) * 0.8;
  return Math.min(55, 36 + (ageDays - 90) * 0.5);
}

/**
 * `ghost` requires proof and is never reached by inference alone.
 *
 * Age, churn and a dead apply link can pile up to near-certainty, but telling a
 * job seeker a role is dead when it is merely old costs them a real opportunity
 * — a worse error than leaving a dead role in the feed marked `stale`. So the
 * strongest claim available to circumstantial evidence is `stale`, and `ghost`
 * is reserved for the case where the company's own board contradicts the
 * listing. That keeps the word meaning exactly one thing wherever it appears.
 */
function verdictFor(score: number, provenGhost: boolean): Verdict {
  if (provenGhost) return 'ghost';
  if (score >= 75) return 'live';
  if (score >= 50) return 'aging';
  return 'stale';
}

export function scoreLiveness(signals: DecaySignals): LivenessScore {
  const reasons: string[] = [];
  let score = 100;

  // ---- Conclusive: the company itself no longer lists the role. --------------
  const provenGhost = signals.presentInAuthoritative === false;

  if (provenGhost) {
    const days = signals.absentSince ? daysBetween(signals.absentSince, signals.observedAt) : null;
    reasons.push(
      days === null
        ? 'Removed from the company’s own job board, but still listed here.'
        : `Removed from the company’s own job board ${plural(days, 'day')} ago, but still listed here.`,
    );
    // Absence is proof, so the score collapses rather than being nudged. Time
    // since removal only decides how far below the ghost line it lands.
    score = days === null ? 15 : Math.max(0, 15 - days);
  }

  // ---- Circumstantial signals, applied only when not already proven dead. ----
  if (!provenGhost) {
    if (signals.postedAt) {
      const ageDays = daysBetween(signals.postedAt, signals.observedAt);
      const penalty = agePenalty(ageDays);
      if (penalty > 0) {
        score -= penalty;
        reasons.push(`Open for ${plural(ageDays, 'day')}.`);
      }
    } else {
      // No date at all is mildly suspicious and blocks the strongest positive signal.
      score -= 5;
      reasons.push('No posting date given.');
    }

    if (signals.applyUrlDead === true) {
      score -= 35;
      reasons.push('The apply link no longer resolves to this role.');
    }

    if (signals.repostCount >= 3) {
      score -= 20;
      reasons.push(`Re-posted ${plural(signals.repostCount, 'time')} with a fresh date.`);
    } else if (signals.repostCount > 0) {
      score -= signals.repostCount * 5;
      reasons.push(`Re-posted ${plural(signals.repostCount, 'time')}.`);
    }

    if (signals.unchangedVerifications >= 10) {
      score -= 8;
      reasons.push('Description unchanged across every check.');
    }

    // Confirmed by the company's own board and recently posted: say so, since a
    // feed full of unexplained scores reads as arbitrary.
    if (signals.presentInAuthoritative === true && reasons.length === 0) {
      reasons.push('Confirmed live on the company’s own job board.');
    }
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: bounded,
    verdict: verdictFor(bounded, provenGhost),
    reasons,
    provenGhost,
  };
}
