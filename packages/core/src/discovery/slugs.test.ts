import { describe, expect, it } from 'vitest';

import { boardUrl, slugCandidates } from './slugs.js';

describe('slugCandidates', () => {
  it('offers the concatenated form before the hyphenated one', () => {
    expect(slugCandidates('Monzo Bank')).toEqual(['monzobank', 'monzo-bank', 'monzo']);
  });

  it('strips a trailing legal suffix but keeps the untrimmed form as a fallback', () => {
    const candidates = slugCandidates('Stripe Inc');

    expect(candidates[0]).toBe('stripe');
    expect(candidates).toContain('stripeinc');
  });

  // "Co" is a legal suffix at the end and an ordinary word anywhere else.
  it('only strips a legal suffix in final position', () => {
    expect(slugCandidates('Co-op Bank')).toContain('coopbank');
  });

  it('folds accents so the slug is reachable', () => {
    expect(slugCandidates('Klärna')).toContain('klarna');
  });

  it('drops punctuation and collapses whitespace', () => {
    expect(slugCandidates('  Acme,  Widgets & Co.  ')).toContain('acmewidgets');
  });

  it('never emits duplicates for a single-word name', () => {
    const candidates = slugCandidates('Vercel');

    expect(candidates).toEqual(['vercel']);
  });

  it('returns nothing for a name with no usable characters', () => {
    expect(slugCandidates('!!! ???')).toEqual([]);
  });

  it('discards single-character candidates that would match anything', () => {
    expect(slugCandidates('X Corp')).not.toContain('x');
  });
});

describe('boardUrl', () => {
  it('builds the public board url for each platform', () => {
    expect(boardUrl('greenhouse', 'gitlab')).toBe('https://job-boards.greenhouse.io/gitlab');
    expect(boardUrl('lever', 'netflix')).toBe('https://jobs.lever.co/netflix');
    expect(boardUrl('ashby', 'ramp')).toBe('https://jobs.ashbyhq.com/ramp');
  });
});
