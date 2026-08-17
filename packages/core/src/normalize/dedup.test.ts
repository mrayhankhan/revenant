import { describe, expect, it } from 'vitest';

import type { RawPosting } from '../schema/posting.js';
import { contentHash, dedupKey, deduplicate, normaliseLocation, normaliseTitle } from './dedup.js';

function posting(overrides: Partial<RawPosting> = {}): RawPosting {
  return {
    sourceKey: '1',
    sourceUrl: 'https://example.com/jobs/1',
    title: 'Staff Engineer',
    company: 'Acme',
    location: 'Berlin, Germany',
    remotePolicy: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: null,
    postedAt: null,
    descriptionHtml: null,
    applyUrl: null,
    ...overrides,
  };
}

describe('normaliseTitle', () => {
  it('strips bracketed work-arrangement noise', () => {
    expect(normaliseTitle('Staff Engineer (Remote)')).toBe('staff engineer');
    expect(normaliseTitle('Staff Engineer [EMEA]')).toBe('staff engineer');
  });

  it('strips a trailing arrangement suffix', () => {
    expect(normaliseTitle('Staff Engineer - Remote')).toBe('staff engineer');
  });

  it('strips requisition numbers', () => {
    expect(normaliseTitle('Staff Engineer Req #4821')).toBe('staff engineer');
  });

  // Seniority is the difference between two real, distinct openings.
  it('keeps seniority so distinct roles never collapse', () => {
    expect(normaliseTitle('Senior Engineer')).not.toBe(normaliseTitle('Staff Engineer'));
  });

  it('keeps characters that carry meaning in titles', () => {
    expect(normaliseTitle('C++ Developer')).toBe('c++ developer');
    expect(normaliseTitle('C# Engineer')).toBe('c# engineer');
  });
});

describe('normaliseLocation', () => {
  it('agrees across differing granularity for the same place', () => {
    expect(normaliseLocation('Remote, Italy')).toBe(normaliseLocation('Italy'));
  });

  it('drops work-arrangement words', () => {
    expect(normaliseLocation('Remote')).toBe('');
    expect(normaliseLocation('Hybrid — Berlin')).toBe('berlin');
  });

  it('treats a missing location as empty rather than throwing', () => {
    expect(normaliseLocation(null)).toBe('');
  });
});

describe('dedupKey', () => {
  it('matches the same role seen on two boards', () => {
    const board = posting({ title: 'Staff Engineer (Remote)', location: 'Remote, Germany' });
    const aggregator = posting({ title: 'Staff Engineer', location: 'Germany' });

    expect(dedupKey(board)).toBe(dedupKey(aggregator));
  });

  // The expensive mistake: a merge hides a real opening from the user.
  it('never merges the same title at different companies', () => {
    expect(dedupKey(posting({ company: 'Acme' }))).not.toBe(
      dedupKey(posting({ company: 'Globex' })),
    );
  });

  it('never merges the same role in different cities', () => {
    expect(dedupKey(posting({ location: 'Berlin, Germany' }))).not.toBe(
      dedupKey(posting({ location: 'Munich, Germany' })),
    );
  });

  it('never merges different seniorities', () => {
    expect(dedupKey(posting({ title: 'Senior Engineer' }))).not.toBe(
      dedupKey(posting({ title: 'Staff Engineer' })),
    );
  });
});

describe('deduplicate', () => {
  it('collapses duplicates while keeping every member', () => {
    const groups = deduplicate([
      posting({ sourceKey: 'gh-1', title: 'Staff Engineer (Remote)', location: 'Remote, Germany' }),
      posting({ sourceKey: 'in-9', title: 'Staff Engineer', location: 'Germany' }),
      posting({ sourceKey: 'gh-2', title: 'Product Designer' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.members).toHaveLength(2);
  });

  it('fills gaps from later members without overwriting known values', () => {
    const groups = deduplicate([
      posting({ salaryMin: null, remotePolicy: 'remote' }),
      posting({ salaryMin: 150_000, salaryCurrency: 'EUR', remotePolicy: 'hybrid' }),
    ]);

    expect(groups[0]?.merged.salaryMin).toBe(150_000);
    expect(groups[0]?.merged.salaryCurrency).toBe('EUR');
    // The first member already answered this, so it wins.
    expect(groups[0]?.merged.remotePolicy).toBe('remote');
  });

  it('returns nothing for no input', () => {
    expect(deduplicate([])).toEqual([]);
  });
});

describe('contentHash', () => {
  it('ignores markup changes that leave the text alone', () => {
    const before = posting({ descriptionHtml: '<p>Build things.</p>' });
    const after = posting({ descriptionHtml: '<div><span>Build things.</span></div>' });

    expect(contentHash(before)).toBe(contentHash(after));
  });

  it('changes when the wording changes', () => {
    expect(contentHash(posting({ descriptionHtml: '<p>Build things.</p>' }))).not.toBe(
      contentHash(posting({ descriptionHtml: '<p>Build other things.</p>' })),
    );
  });

  it('is null when there is no description', () => {
    expect(contentHash(posting({ descriptionHtml: null }))).toBeNull();
  });
});
