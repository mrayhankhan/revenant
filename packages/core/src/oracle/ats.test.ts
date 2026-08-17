import { describe, expect, it } from 'vitest';

import { greenhouseOracle, leverOracle } from './ats.js';

/**
 * These assert the shape contract we depend on, using no network. The live
 * reachability check lives in `cli/oracle-check.ts`.
 */
describe('oracle gradable fields', () => {
  // Greenhouse's feed carries no compensation data at all — measured 0/197 on
  // GitLab's board — so grading a scrape's salary against it would manufacture
  // failures for a field the oracle never had.
  it('excludes compensation from what Greenhouse may grade', () => {
    expect(greenhouseOracle.gradableFields.has('salaryMin')).toBe(false);
    expect(greenhouseOracle.gradableFields.has('salaryMax')).toBe(false);
    expect(greenhouseOracle.gradableFields.has('title')).toBe(true);
  });

  it('lets Lever grade compensation, which it publishes structurally', () => {
    expect(leverOracle.gradableFields.has('salaryMin')).toBe(true);
    expect(leverOracle.gradableFields.has('remotePolicy')).toBe(true);
  });

  it('treats both platforms as authoritative about their own roles', () => {
    expect(greenhouseOracle.authority).toBe('authoritative');
    expect(leverOracle.authority).toBe('authoritative');
  });
});
