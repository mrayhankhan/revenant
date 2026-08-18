import { describe, expect, it } from 'vitest';

import { BOARD_FIELD_SPEC, normaliseBoardRow } from './board.js';

const URL = 'https://job-boards.greenhouse.io/acme';

describe('BOARD_FIELD_SPEC', () => {
  // The CLI rejects anything longer, and the spec is the artefact healing
  // depends on, so it must survive being passed verbatim.
  it('fits inside the 500-character limit `scraper create` enforces', () => {
    expect(BOARD_FIELD_SPEC.length).toBeLessThanOrEqual(500);
  });

  it('describes fields by meaning rather than by position in the page', () => {
    expect(BOARD_FIELD_SPEC).not.toMatch(/css|selector|xpath|class=|<div|nth-child/i);
  });

  // Compensation is absent from the ATS feeds but present in description prose,
  // which is the reason this project scrapes the page at all.
  it('asks for salary anywhere in the posting, including the description text', () => {
    expect(BOARD_FIELD_SPEC).toMatch(/description text/i);
  });
});

describe('normaliseBoardRow', () => {
  it('maps a well-formed row onto the canonical schema', () => {
    const posting = normaliseBoardRow(
      {
        id: '42',
        title: 'Staff Engineer',
        company: 'Acme',
        location: 'Berlin, Germany',
        workplace_type: 'Hybrid',
        salary_min: 150000,
        salary_max: 200000,
        currency: 'EUR',
        job_type: 'Full-time',
        posted_at: '2026-08-01',
        description: '<p>Build things.</p>',
        apply_url: 'https://job-boards.greenhouse.io/acme/jobs/42',
      },
      URL,
    );

    expect(posting).toMatchObject({
      sourceKey: '42',
      title: 'Staff Engineer',
      remotePolicy: 'hybrid',
      salaryMin: 150000,
      salaryCurrency: 'EUR',
      employmentType: 'full_time',
    });
  });

  // Studio names fields from the description, and those names shift when the
  // scraper is rebuilt or healed.
  it('accepts alternative field names for the same value', () => {
    const posting = normaliseBoardRow(
      { job_title: 'Designer', job_url: 'https://x.co/j/1', office: 'Remote' },
      URL,
    );

    expect(posting?.title).toBe('Designer');
    expect(posting?.location).toBe('Remote');
    expect(posting?.remotePolicy).toBe('remote');
  });

  it('parses salary that arrives as prose rather than a number', () => {
    const posting = normaliseBoardRow(
      { title: 'Engineer', url: 'https://x.co/j/2', salary_min: '$150,000', salary_max: '$200,000' },
      URL,
    );

    expect(posting?.salaryMin).toBe(150000);
    expect(posting?.salaryMax).toBe(200000);
  });

  it('leaves a field null rather than inventing a value', () => {
    const posting = normaliseBoardRow({ title: 'Engineer', url: 'https://x.co/j/3' }, URL);

    expect(posting?.salaryMin).toBeNull();
    expect(posting?.postedAt).toBeNull();
    expect(posting?.descriptionHtml).toBeNull();
  });

  it('falls back to the board url when a row carries no link', () => {
    expect(normaliseBoardRow({ title: 'Engineer' }, URL)?.sourceUrl).toBe(URL);
  });

  // A coerced row would read as a healthy extraction and mask the breakage.
  it('rejects a row that is not an object', () => {
    expect(normaliseBoardRow('nonsense', URL)).toBeNull();
    expect(normaliseBoardRow(null, URL)).toBeNull();
  });

  it('rejects a row whose url cannot be parsed', () => {
    expect(normaliseBoardRow({ title: 'Engineer', url: 'not-a-url' }, 'also-not-a-url')).toBeNull();
  });

  it('discards an empty string instead of storing it as a value', () => {
    const posting = normaliseBoardRow({ title: 'Engineer', url: 'https://x.co/j/4', location: '   ' }, URL);

    expect(posting?.location).toBeNull();
  });
});
