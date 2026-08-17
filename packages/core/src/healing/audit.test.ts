import { describe, expect, it } from 'vitest';

import type { ExtractedField, RawPosting } from '../schema/posting.js';
import { auditAgainstOracle, healSucceeded, joinKey } from './audit.js';
import type { AuditReport } from './audit.js';

const GRADABLE = new Set<ExtractedField>([
  'title',
  'location',
  'postedAt',
  'applyUrl',
  'salaryMin',
]);

function posting(overrides: Partial<RawPosting> = {}): RawPosting {
  return {
    sourceKey: '1',
    sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    title: 'Staff Engineer',
    company: 'Acme',
    location: 'Remote, Italy',
    remotePolicy: 'remote',
    salaryMin: 150_000,
    salaryMax: 200_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: new Date('2026-08-01T09:30:00Z'),
    descriptionHtml: '<p>Build resilient data pipelines at scale.</p>',
    applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    ...overrides,
  };
}

function gradeFor(report: AuditReport, field: ExtractedField) {
  return report.grades.find((g) => g.field === field);
}

describe('joinKey', () => {
  it('ignores tracking params and host prefixes so both sides pair up', () => {
    const scraped = posting({ applyUrl: 'https://www.boards.greenhouse.io/acme/jobs/1?src=rss' });
    const truth = posting({ applyUrl: 'https://boards.greenhouse.io/acme/jobs/1/' });

    expect(joinKey(scraped)).toBe(joinKey(truth));
  });

  it('falls back to the title when no usable url is present', () => {
    expect(joinKey(posting({ applyUrl: null, sourceUrl: 'not-a-url' }))).toBe('staff engineer');
  });
});

describe('auditAgainstOracle', () => {
  it('scores a clean scrape as fully accurate', () => {
    const report = auditAgainstOracle([posting()], [posting()], GRADABLE);

    expect(report.paired).toBe(1);
    expect(report.missedPostings).toBe(0);
    expect(report.overallAccuracy).toBe(1);
  });

  // The case fill-rate monitoring cannot see: values are present but wrong.
  it('catches a heal that latched onto the wrong element', () => {
    const scraped = posting({ location: 'Engineering' });

    const report = auditAgainstOracle([scraped], [posting()], GRADABLE);

    expect(gradeFor(report, 'location')).toMatchObject({ match: 0, mismatch: 1, accuracy: 0 });
    expect(report.overallAccuracy).toBeLessThan(1);
  });

  it('separates a missed field from a wrong one', () => {
    const report = auditAgainstOracle(
      [posting({ salaryMin: null, title: 'Principal Engineer' })],
      [posting()],
      GRADABLE,
    );

    expect(gradeFor(report, 'salaryMin')).toMatchObject({ missed: 1, mismatch: 0 });
    expect(gradeFor(report, 'title')).toMatchObject({ missed: 0, mismatch: 1 });
  });

  it('never grades a field the oracle left empty', () => {
    const report = auditAgainstOracle(
      [posting({ salaryMin: 150_000 })],
      [posting({ salaryMin: null })],
      GRADABLE,
    );

    expect(gradeFor(report, 'salaryMin')).toMatchObject({ gradable: 0, accuracy: null });
  });

  it('counts postings the collector never saw', () => {
    const truth = [posting(), posting({ applyUrl: 'https://boards.greenhouse.io/acme/jobs/2' })];

    const report = auditAgainstOracle([posting()], truth, GRADABLE);

    expect(report.paired).toBe(1);
    expect(report.missedPostings).toBe(1);
  });

  it('reports scraped rows the oracle does not know about', () => {
    const scraped = [posting(), posting({ applyUrl: 'https://boards.greenhouse.io/acme/jobs/9' })];

    expect(auditAgainstOracle(scraped, [posting()], GRADABLE).unpairedScrapes).toBe(1);
  });

  it('treats a board location as agreeing with a broader feed location', () => {
    const report = auditAgainstOracle(
      [posting({ location: 'Remote, Italy' })],
      [posting({ location: 'Italy' })],
      new Set<ExtractedField>(['location']),
    );

    expect(gradeFor(report, 'location')?.accuracy).toBe(1);
  });

  it('accepts a same-day date despite differing timestamps', () => {
    const report = auditAgainstOracle(
      [posting({ postedAt: new Date('2026-08-01T00:00:00Z') })],
      [posting({ postedAt: new Date('2026-08-01T23:59:00Z') })],
      new Set<ExtractedField>(['postedAt']),
    );

    expect(gradeFor(report, 'postedAt')?.accuracy).toBe(1);
  });

  it('tolerates rounding in salary parsed from prose but not a real difference', () => {
    const salaryOnly = new Set<ExtractedField>(['salaryMin']);

    const rounded = auditAgainstOracle(
      [posting({ salaryMin: 150_500 })],
      [posting({ salaryMin: 150_000 })],
      salaryOnly,
    );
    const wrong = auditAgainstOracle(
      [posting({ salaryMin: 95_000 })],
      [posting({ salaryMin: 150_000 })],
      salaryOnly,
    );

    expect(gradeFor(rounded, 'salaryMin')?.accuracy).toBe(1);
    expect(gradeFor(wrong, 'salaryMin')?.accuracy).toBe(0);
  });

  it('matches prose that survived a markup change', () => {
    const report = auditAgainstOracle(
      [posting({ descriptionHtml: '<div><span>Build resilient data pipelines at scale.</span></div>' })],
      [posting({ descriptionHtml: '<p>Build resilient data pipelines at scale.</p>' })],
      new Set<ExtractedField>(['descriptionHtml']),
    );

    expect(gradeFor(report, 'descriptionHtml')?.accuracy).toBe(1);
  });

  it('reports no accuracy at all when nothing paired', () => {
    const report = auditAgainstOracle([], [posting()], GRADABLE);

    expect(report.overallAccuracy).toBeNull();
    expect(report.missedPostings).toBe(1);
  });
});

describe('healSucceeded', () => {
  function report(accuracy: number | null): AuditReport {
    return {
      paired: 100,
      missedPostings: 0,
      unpairedScrapes: 0,
      grades: [],
      overallAccuracy: accuracy,
    };
  }

  it('accepts a heal that restored accuracy above the bar', () => {
    expect(healSucceeded(report(0.1), report(0.98))).toBe(true);
  });

  // Values came back, but from the wrong node. Fill rate would call this fixed.
  it('rejects a heal that refilled the field with wrong values', () => {
    expect(healSucceeded(report(0.1), report(0.4))).toBe(false);
  });

  it('rejects a heal that did not improve on the broken state', () => {
    expect(healSucceeded(report(0.96), report(0.96))).toBe(false);
  });

  it('rejects a heal that left nothing gradable', () => {
    expect(healSucceeded(report(0.1), report(null))).toBe(false);
  });
});
