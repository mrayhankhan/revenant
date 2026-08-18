import { describe, expect, it } from 'vitest';

import { bestSalary, parseSalaryRange } from './salary.js';

describe('parseSalaryRange', () => {
  // Taken verbatim from a Vercel posting collected through Scraper Studio.
  it('reads a range out of real posting prose', () => {
    expect(
      parseSalaryRange(
        'The annual salary range for this position is $232,000 - $348,000. This position is eligible for equity.',
      ),
    ).toEqual({ min: 232_000, max: 348_000, currency: 'USD' });
  });

  it('handles the dash characters postings actually use', () => {
    for (const dash of ['-', '–', '—', 'to', 'through']) {
      expect(parseSalaryRange(`$120,000 ${dash} $160,000`).min).toBe(120_000);
    }
  });

  it('reads shorthand thousands', () => {
    expect(parseSalaryRange('$120k - $160k')).toMatchObject({ min: 120_000, max: 160_000 });
  });

  it('recognises non-dollar currencies', () => {
    expect(parseSalaryRange('£80,000 – £100,000').currency).toBe('GBP');
    expect(parseSalaryRange('€95,000 to €125,000').currency).toBe('EUR');
    expect(parseSalaryRange('CHF 130,000 - CHF 165,000').currency).toBe('CHF');
  });

  it('prefers an explicit currency code over a bare symbol', () => {
    expect(parseSalaryRange('CAD $90,000 - $120,000').currency).toBe('CAD');
  });

  it('reads a range written without any currency marker', () => {
    expect(parseSalaryRange('Salary: 95,000 - 125,000 annually')).toMatchObject({
      min: 95_000,
      max: 125_000,
      currency: null,
    });
  });

  // A wrong salary is worse than a missing one, so everything below yields null.
  it('declines a lone figure, which is usually not a salary at all', () => {
    expect(parseSalaryRange('We serve over 500,000 developers worldwide.')).toEqual({
      min: null,
      max: null,
      currency: null,
    });
  });

  it('declines the boilerplate that boards put in their salary field', () => {
    expect(
      parseSalaryRange('Competitive compensation package, including equity').min,
    ).toBeNull();
  });

  it('declines hourly and daily rates rather than mixing them with annual pay', () => {
    expect(parseSalaryRange('$45 - $60 per hour').min).toBeNull();
    expect(parseSalaryRange('Rate: $500 - $700 per day').min).toBeNull();
    expect(parseSalaryRange('$50/hr - $70/hr').min).toBeNull();
  });

  it('declines figures too small to be annual compensation', () => {
    expect(parseSalaryRange('a stipend of 500 - 900').min).toBeNull();
  });

  it('declines an implausibly large range', () => {
    expect(parseSalaryRange('$50,000,000 - $90,000,000 in funding').min).toBeNull();
  });

  // Two unrelated numbers that happen to sit together are not a range.
  it('declines a descending pair', () => {
    expect(parseSalaryRange('$200,000 - $100').min).toBeNull();
  });

  it('returns nothing for empty input', () => {
    expect(parseSalaryRange(null).min).toBeNull();
    expect(parseSalaryRange(undefined).min).toBeNull();
    expect(parseSalaryRange('').min).toBeNull();
  });
});

describe('bestSalary', () => {
  it('uses the dedicated field when it carries real numbers', () => {
    expect(bestSalary('$150,000 - $200,000', 'we raised $9,000,000 - $12,000,000')).toMatchObject({
      min: 150_000,
      max: 200_000,
    });
  });

  // The case that motivates the whole module: the field is a true sentence
  // worth nothing to someone filtering on pay, while the range sits in the body.
  it('falls back to the description when the field is boilerplate', () => {
    expect(
      bestSalary(
        'Competitive compensation package, including equity',
        'The annual salary range for this position is $232,000 - $348,000.',
      ),
    ).toMatchObject({ min: 232_000, max: 348_000, currency: 'USD' });
  });

  it('returns nothing when neither source carries a range', () => {
    expect(bestSalary('Competitive salary', 'A great place to work.').min).toBeNull();
  });
});
