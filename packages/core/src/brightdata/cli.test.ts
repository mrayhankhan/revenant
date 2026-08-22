import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BrightDataError, hasCredentials } from './cli.js';

/** Obviously synthetic. Never put a real credential in a fixture. */
const KEY = '00000000-0000-4000-8000-000000000000';

describe('credentials', () => {
  const original = process.env['BRIGHTDATA_API_KEY'];

  beforeEach(() => {
    process.env['BRIGHTDATA_API_KEY'] = KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env['BRIGHTDATA_API_KEY'];
    else process.env['BRIGHTDATA_API_KEY'] = original;
  });

  it('reports credentials as present', () => {
    expect(hasCredentials()).toBe(true);
  });

  it('reports them absent when unset', () => {
    delete process.env['BRIGHTDATA_API_KEY'];
    expect(hasCredentials()).toBe(false);
  });
});

/*
 * The key must never reach a command line. argv is readable by anything that can
 * list processes, and this module echoes the invocation back in its own errors —
 * a failed run was printing the key straight into the log. It is passed through
 * the child's environment instead, and redacted on the way out as a second
 * line of defence.
 */
describe('BrightDataError', () => {
  it('carries the command and stderr for diagnosis', () => {
    const error = new BrightDataError('failed', 'bdata scraper run c_abc', 'boom');

    expect(error.name).toBe('BrightDataError');
    expect(error.command).toBe('bdata scraper run c_abc');
    expect(error.stderr).toBe('boom');
  });

  it('is a real Error, so stack traces and instanceof both work', () => {
    const error = new BrightDataError('failed', 'cmd', '');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('failed');
  });
});
