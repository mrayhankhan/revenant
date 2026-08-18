import { describe, expect, it } from 'vitest';

import { assessDrift, healPrompt } from './orchestrator.js';
import type { Baseline } from './baseline.js';
import type { ExtractedField, RawPosting } from '../schema/posting.js';

function posting(overrides: Partial<RawPosting> = {}): RawPosting {
  return {
    sourceKey: '1',
    sourceUrl: 'https://job-boards.greenhouse.io/acme/jobs/1',
    title: 'Staff Engineer',
    company: 'Acme',
    location: 'Berlin',
    remotePolicy: 'remote',
    salaryMin: 150_000,
    salaryMax: 200_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: new Date('2026-08-01'),
    descriptionHtml: '<p>Build things.</p>',
    applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/1',
    ...overrides,
  };
}

function baselines(entries: Partial<Record<ExtractedField, number>>): Map<ExtractedField, Baseline> {
  const map = new Map<ExtractedField, Baseline>();
  for (const [field, rate] of Object.entries(entries)) {
    map.set(field as ExtractedField, {
      field: field as ExtractedField,
      rate: rate as number,
      observations: 500,
    });
  }
  return map;
}

describe('healPrompt', () => {
  // A selector is precisely the thing that just stopped being true. Anchoring
  // the fix to it would point the repair at the broken page.
  it('describes the field by meaning and never mentions a selector', () => {
    const prompt = healPrompt('salaryMin', {
      kind: 'broken',
      field: 'salaryMin',
      rate: 0,
      baseline: 0.4,
    });

    expect(prompt).toContain('lower bound of the advertised compensation');
    expect(prompt).not.toMatch(/css|selector|xpath|class=|div|span/i);
  });

  it('carries the observed numbers so the fix has evidence to work from', () => {
    const prompt = healPrompt('location', {
      kind: 'degraded',
      field: 'location',
      rate: 0.1,
      baseline: 0.95,
      severity: 0.89,
    });

    expect(prompt).toContain('10%');
    expect(prompt).toContain('95%');
  });

  it('stays inside the CLI prompt limit', () => {
    for (const field of ['title', 'descriptionHtml', 'employmentType'] as ExtractedField[]) {
      const prompt = healPrompt(field, { kind: 'broken', field, rate: 0, baseline: 1 });
      expect(prompt.length).toBeLessThanOrEqual(1000);
    }
  });
});

describe('assessDrift', () => {
  it('flags a field that stopped extracting', () => {
    const rows = Array.from({ length: 100 }, () => posting({ salaryMin: null }));

    const drifted = assessDrift(rows, baselines({ salaryMin: 0.4 }));

    expect(drifted.map((d) => d.field)).toContain('salaryMin');
  });

  // The distinction the whole loop rests on: a sparse field is not a broken one.
  it('leaves a field alone that this source never filled', () => {
    const rows = Array.from({ length: 100 }, () => posting({ salaryMin: null }));

    const drifted = assessDrift(rows, baselines({ salaryMin: 0.005 }));

    expect(drifted).toHaveLength(0);
  });

  it('reports nothing when extraction is healthy', () => {
    const rows = Array.from({ length: 100 }, () => posting());

    expect(assessDrift(rows, baselines({ salaryMin: 0.9, title: 1 }))).toHaveLength(0);
  });

  it('ranks a total break above a partial one', () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      posting({ salaryMin: null, location: i < 12 ? 'Berlin' : null }),
    );

    const drifted = assessDrift(rows, baselines({ salaryMin: 0.6, location: 0.95 }));

    expect(drifted[0]?.field).toBe('salaryMin');
  });

  it('will not act without enough history to judge against', () => {
    const rows = Array.from({ length: 100 }, () => posting({ salaryMin: null }));
    const thin = new Map<ExtractedField, Baseline>([
      ['salaryMin', { field: 'salaryMin', rate: 0.4, observations: 5 }],
    ]);

    expect(assessDrift(rows, thin)).toHaveLength(0);
  });
});
