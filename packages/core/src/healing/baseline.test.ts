import { describe, expect, it } from 'vitest';

import type { RawPosting } from '../schema/posting.js';
import {
  DEFAULT_DRIFT_OPTIONS,
  detectDrift,
  fieldsNeedingHeal,
  sampleRun,
  updateBaseline,
} from './baseline.js';
import type { Baseline } from './baseline.js';

function posting(overrides: Partial<RawPosting> = {}): RawPosting {
  return {
    sourceKey: 'k',
    sourceUrl: 'https://example.com/jobs/1',
    title: 'Staff Engineer',
    company: 'Acme',
    location: 'Remote',
    remotePolicy: 'remote',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: 'full_time',
    postedAt: new Date('2026-08-01'),
    descriptionHtml: '<p>Build things.</p>',
    applyUrl: 'https://example.com/apply/1',
    ...overrides,
  };
}

/** `total` rows, of which `withSalary` advertise a salary. */
function run(total: number, withSalary: number): RawPosting[] {
  return Array.from({ length: total }, (_, i) =>
    posting(
      i < withSalary
        ? { salaryMin: 150_000, salaryMax: 200_000, salaryCurrency: 'USD' }
        : {},
    ),
  );
}

function baselineOf(rate: number, observations = 500): Baseline {
  return { field: 'salaryMin', rate, observations };
}

describe('sampleRun', () => {
  it('counts a field as filled only when it carries a value', () => {
    const samples = sampleRun(run(10, 4));
    const salary = samples.find((s) => s.field === 'salaryMin');

    expect(salary).toEqual({ field: 'salaryMin', filled: 4, total: 10 });
  });

  it('reports every extracted field, including ones nothing filled', () => {
    const samples = sampleRun(run(10, 0));

    expect(samples.find((s) => s.field === 'salaryMax')?.filled).toBe(0);
    expect(samples.find((s) => s.field === 'title')?.filled).toBe(10);
  });
});

describe('detectDrift', () => {
  // The central case. Both runs return zero salaries; only one is a break.
  it('separates "never advertised a salary" from "salary extraction broke"', () => {
    const emptyRun = sampleRun(run(100, 0));
    const salary = emptyRun.find((s) => s.field === 'salaryMin')!;

    const sparseSource = detectDrift(salary, baselineOf(0.01));
    const richSource = detectDrift(salary, baselineOf(0.4));

    expect(sparseSource.kind).toBe('healthy');
    expect(richSource.kind).toBe('broken');
  });

  it('flags a partial collapse as degraded', () => {
    const samples = sampleRun(run(100, 10));
    const salary = samples.find((s) => s.field === 'salaryMin')!;

    const verdict = detectDrift(salary, baselineOf(0.4));

    expect(verdict.kind).toBe('degraded');
    if (verdict.kind === 'degraded') {
      expect(verdict.severity).toBeCloseTo(0.75);
    }
  });

  it('leaves a fill rate within tolerance alone', () => {
    const samples = sampleRun(run(100, 35));
    const salary = samples.find((s) => s.field === 'salaryMin')!;

    expect(detectDrift(salary, baselineOf(0.4)).kind).toBe('healthy');
  });

  it('refuses to judge a run too small to move the rate', () => {
    const samples = sampleRun(run(5, 0));
    const salary = samples.find((s) => s.field === 'salaryMin')!;

    const verdict = detectDrift(salary, baselineOf(0.4));

    expect(verdict.kind).toBe('insufficient_data');
    if (verdict.kind === 'insufficient_data') {
      expect(verdict.reason).toContain('5 rows');
    }
  });

  it('refuses to judge against a baseline built from too little history', () => {
    const samples = sampleRun(run(100, 0));
    const salary = samples.find((s) => s.field === 'salaryMin')!;

    const verdict = detectDrift(salary, baselineOf(0.4, 10));

    expect(verdict.kind).toBe('insufficient_data');
  });

  it('treats an absent baseline as unjudgeable rather than broken', () => {
    const samples = sampleRun(run(100, 0));
    const salary = samples.find((s) => s.field === 'salaryMin')!;

    expect(detectDrift(salary, undefined).kind).toBe('insufficient_data');
  });
});

describe('updateBaseline', () => {
  it('starts a baseline from the first run', () => {
    const [sample] = sampleRun(run(100, 40)).filter((s) => s.field === 'salaryMin');

    const baseline = updateBaseline(undefined, sample!);

    expect(baseline.rate).toBeCloseTo(0.4);
    expect(baseline.observations).toBe(100);
  });

  it('folds runs together as a running mean', () => {
    const first = sampleRun(run(100, 40)).find((s) => s.field === 'salaryMin')!;
    const second = sampleRun(run(100, 60)).find((s) => s.field === 'salaryMin')!;

    const baseline = updateBaseline(updateBaseline(undefined, first), second);

    expect(baseline.rate).toBeCloseTo(0.5);
    expect(baseline.observations).toBe(200);
  });

  // A baseline that chased recent runs would absorb a slow break until the
  // break looked normal, and the heal loop would stop firing.
  it('does not let a single broken run drag the baseline to zero', () => {
    const healthy = sampleRun(run(500, 200)).find((s) => s.field === 'salaryMin')!;
    const broken = sampleRun(run(100, 0)).find((s) => s.field === 'salaryMin')!;

    const baseline = updateBaseline(updateBaseline(undefined, healthy), broken);

    expect(baseline.rate).toBeGreaterThan(DEFAULT_DRIFT_OPTIONS.negligibleBaseline);
    expect(detectDrift(broken, baseline).kind).toBe('broken');
  });

  it('ignores an empty run', () => {
    const before = baselineOf(0.4, 500);
    const empty = { field: 'salaryMin' as const, filled: 0, total: 0 };

    expect(updateBaseline(before, empty)).toEqual(before);
  });
});

describe('fieldsNeedingHeal', () => {
  it('ranks broken fields above degraded ones and ignores healthy fields', () => {
    const fields = fieldsNeedingHeal([
      { kind: 'degraded', field: 'location', rate: 0.1, baseline: 0.9, severity: 0.89 },
      { kind: 'healthy', field: 'title', rate: 1, baseline: 1 },
      { kind: 'broken', field: 'salaryMin', rate: 0, baseline: 0.4 },
      { kind: 'insufficient_data', field: 'applyUrl', reason: 'no baseline' },
    ]);

    expect(fields).toEqual(['salaryMin', 'location']);
  });

  it('returns nothing when every field is healthy', () => {
    expect(fieldsNeedingHeal([{ kind: 'healthy', field: 'title', rate: 1, baseline: 1 }])).toEqual(
      [],
    );
  });
});
