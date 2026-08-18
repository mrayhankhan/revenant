/**
 * Extracts a structured compensation range from prose.
 *
 * This is the reason Revenant scrapes rendered pages instead of consuming the
 * ATS JSON feeds. Measured on real boards:
 *
 *   Greenhouse structured feed   0 / 3,509 postings carry any salary field
 *   description prose           39 / 50    on Vercel's board carry a real range
 *
 * Pay-transparency law requires the range to appear in the posting, and it lands
 * in the body text rather than in a field. Nothing downstream of the API can
 * reach it; a page scrape plus this parser can.
 *
 * The parser is deliberately conservative. A wrong salary is worse than a
 * missing one — a job seeker filters on it — so anything ambiguous yields null
 * rather than a guess.
 */

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

const EMPTY: ParsedSalary = { min: null, max: null, currency: null };

const SYMBOL_CURRENCY: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '¥': 'JPY',
  '₹': 'INR',
};

/** Explicit codes win over symbols: "USD $150,000" and "CA$" are both common. */
const CODE_PATTERN = /\b(USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|INR|JPY|SGD|NZD|BRL|MXN)\b/i;

/**
 * Ranges only. A single figure in a job description is far more often a company
 * statistic, an equity number or a headcount than it is a salary, so requiring
 * two bounds removes most false positives at the cost of a few real ones.
 */
const RANGE_PATTERN = new RegExp(
  [
    '([$£€¥₹]|\\b(?:USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|INR|JPY|SGD|NZD|BRL|MXN)\\b)?',
    '\\s*',
    '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{4,7}(?:\\.\\d+)?|\\d{1,3}(?:\\.\\d+)?\\s*[kK]\\b)',
    '\\s*(?:-|–|—|to|through|up to|and)\\s*',
    '([$£€¥₹]|\\b(?:USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|INR|JPY|SGD|NZD|BRL|MXN)\\b)?',
    '\\s*',
    '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{4,7}(?:\\.\\d+)?|\\d{1,3}(?:\\.\\d+)?\\s*[kK]\\b)',
  ].join(''),
  'i',
);

/** Plausible annual compensation, in whatever currency. */
const MIN_PLAUSIBLE = 10_000;
const MAX_PLAUSIBLE = 10_000_000;

function toNumber(raw: string): number | null {
  const text = raw.trim().replace(/,/g, '');

  // "150k" and "150K" are common shorthand in postings.
  const shorthand = /^(\d+(?:\.\d+)?)\s*k$/i.exec(text);
  if (shorthand?.[1]) {
    const value = Number.parseFloat(shorthand[1]) * 1000;
    return Number.isFinite(value) ? value : null;
  }

  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : null;
}

function currencyFrom(...candidates: (string | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    const symbol = SYMBOL_CURRENCY[trimmed];
    if (symbol) return symbol;
    if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  }
  return null;
}

/**
 * Pull a compensation range out of arbitrary text.
 *
 * Returns nulls rather than a partial answer when the text carries no range, a
 * range outside plausible annual pay, or bounds in the wrong order — each of
 * which indicates the numbers meant something other than salary.
 */
export function parseSalaryRange(text: string | null | undefined): ParsedSalary {
  if (!text) return EMPTY;

  // Hourly and daily rates are real but not comparable with annual figures in
  // the same column, so they are declined rather than silently mixed in.
  if (/\bper\s+(hour|day)\b|\bhourly\b|\/\s*(hr|hour)\b/i.test(text)) return EMPTY;

  const match = RANGE_PATTERN.exec(text);
  if (!match) return EMPTY;

  const min = toNumber(match[2] ?? '');
  const max = toNumber(match[4] ?? '');
  if (min === null || max === null) return EMPTY;

  if (min < MIN_PLAUSIBLE || max > MAX_PLAUSIBLE) return EMPTY;
  // A descending "range" is two unrelated numbers that happened to sit together.
  if (max < min) return EMPTY;

  // An explicit code is checked before the symbols: "CAD $90,000" and "CA$" both
  // occur, and reading the bare "$" first would report every one of them as USD.
  const explicitCode = CODE_PATTERN.exec(text)?.[1];
  const currency = currencyFrom(explicitCode, match[1], match[3]);

  return { min, max, currency };
}

/**
 * Best available salary for a posting.
 *
 * Prefers a dedicated field, then falls back to the description. Boards often
 * fill their compensation field with a sentence like "Competitive compensation
 * package, including equity" — true, and worth nothing to someone filtering on
 * pay — while the real range sits further down the page in the body text.
 */
export function bestSalary(
  salaryField: string | null | undefined,
  description: string | null | undefined,
): ParsedSalary {
  const fromField = parseSalaryRange(salaryField);
  if (fromField.min !== null) return fromField;

  return parseSalaryRange(description);
}
