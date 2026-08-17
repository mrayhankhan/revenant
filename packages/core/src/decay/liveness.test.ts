import { describe, expect, it } from 'vitest';

import { scoreLiveness } from './liveness.js';
import type { DecaySignals } from './liveness.js';

const OBSERVED = new Date('2026-08-17T12:00:00Z');

function daysAgo(days: number): Date {
  return new Date(OBSERVED.getTime() - days * 86_400_000);
}

function signals(overrides: Partial<DecaySignals> = {}): DecaySignals {
  return {
    postedAt: daysAgo(3),
    observedAt: OBSERVED,
    presentInAuthoritative: true,
    absentSince: null,
    applyUrlDead: false,
    repostCount: 0,
    unchangedVerifications: 0,
    ...overrides,
  };
}

describe('scoreLiveness', () => {
  it('scores a fresh, company-confirmed role as live', () => {
    const result = scoreLiveness(signals());

    expect(result.verdict).toBe('live');
    expect(result.score).toBe(100);
    expect(result.reasons[0]).toContain('Confirmed live');
  });

  // The signal no aggregator has: the company itself stopped listing the role.
  it('proves a ghost when the company board no longer carries the role', () => {
    const result = scoreLiveness(
      signals({ presentInAuthoritative: false, absentSince: daysAgo(12) }),
    );

    expect(result.provenGhost).toBe(true);
    expect(result.verdict).toBe('ghost');
    expect(result.reasons[0]).toContain('12 days ago');
  });

  it('does not let a recent posting date rescue a proven ghost', () => {
    const result = scoreLiveness(
      signals({ postedAt: daysAgo(1), presentInAuthoritative: false, absentSince: daysAgo(20) }),
    );

    expect(result.verdict).toBe('ghost');
    expect(result.score).toBe(0);
  });

  // An unreachable oracle must never be read as "the company removed it".
  it('treats an unreachable authoritative source as unknown, not as absence', () => {
    const result = scoreLiveness(signals({ presentInAuthoritative: null }));

    expect(result.provenGhost).toBe(false);
    expect(result.verdict).toBe('live');
  });

  it('leaves a role open a month alone', () => {
    expect(scoreLiveness(signals({ postedAt: daysAgo(30) })).verdict).toBe('live');
  });

  it('degrades a role that has been open for months', () => {
    const ninety = scoreLiveness(signals({ postedAt: daysAgo(90) }));
    const year = scoreLiveness(signals({ postedAt: daysAgo(365) }));

    expect(ninety.score).toBeLessThan(75);
    expect(year.score).toBeLessThan(ninety.score);
    expect(year.reasons[0]).toContain('365 days');
  });

  it('penalises a dead apply link heavily', () => {
    const result = scoreLiveness(signals({ applyUrlDead: true }));

    expect(result.score).toBe(65);
    expect(result.reasons).toContain('The apply link no longer resolves to this role.');
  });

  it('flags repeated re-posting as evergreen churn', () => {
    const once = scoreLiveness(signals({ repostCount: 1 }));
    const many = scoreLiveness(signals({ repostCount: 4 }));

    expect(many.score).toBeLessThan(once.score);
    expect(many.reasons.some((r) => r.includes('4 times'))).toBe(true);
  });

  it('combines weak signals into a stale verdict', () => {
    const result = scoreLiveness(
      signals({ postedAt: daysAgo(120), repostCount: 3, unchangedVerifications: 12 }),
    );

    expect(result.verdict).toBe('stale');
    expect(result.provenGhost).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });

  // Calling a merely-old role dead costs a job seeker a real opportunity, so
  // the strongest claim inference can make is `stale`.
  it('never reaches a ghost verdict on circumstantial evidence alone', () => {
    const result = scoreLiveness(
      signals({
        postedAt: daysAgo(2000),
        applyUrlDead: true,
        repostCount: 20,
        unchangedVerifications: 99,
      }),
    );

    expect(result.score).toBe(0);
    expect(result.provenGhost).toBe(false);
    expect(result.verdict).toBe('stale');
  });

  it('notes a missing posting date instead of assuming freshness', () => {
    const result = scoreLiveness(signals({ postedAt: null }));

    expect(result.score).toBe(95);
    expect(result.reasons).toContain('No posting date given.');
  });

  it('keeps the score inside 0..100 under every combination', () => {
    const worst = scoreLiveness(
      signals({
        postedAt: daysAgo(2000),
        applyUrlDead: true,
        repostCount: 20,
        unchangedVerifications: 99,
      }),
    );

    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it('uses singular wording for a single day', () => {
    const result = scoreLiveness(
      signals({ presentInAuthoritative: false, absentSince: daysAgo(1) }),
    );

    expect(result.reasons[0]).toContain('1 day ago');
  });
});
