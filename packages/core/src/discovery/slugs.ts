/**
 * Company discovery.
 *
 * The instinct to "scrape the whole internet" is right about the goal and wrong
 * about the method. Crawling to *find* career pages means loading mostly-empty
 * pages to discover the few that hold jobs, which burns a metered budget on
 * discovery rather than extraction, and needs a crawler before it needs a
 * scraper.
 *
 * ATS boards are addressable instead of discoverable: every Greenhouse board
 * lives at a known URL shape keyed by a company slug. So we generate candidate
 * slugs from a company name and confirm each against the platform's free JSON
 * feed before it ever reaches a collector. Confirmation costs no Bright Data
 * credits, and a collector never spends one on a URL that was a guess.
 *
 * What this buys is the hidden job market: roles that live on a company's own
 * board and are never posted to an aggregator at all.
 */

export const ATS_PLATFORMS = ['greenhouse', 'lever', 'ashby'] as const;
export type AtsPlatform = (typeof ATS_PLATFORMS)[number];

/** Legal suffixes that appear in company names but never in board slugs. */
const LEGAL_SUFFIXES = [
  'inc',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'gmbh',
  'bv',
  'plc',
  'co',
  'sa',
  'ag',
  'pty',
];

function words(companyName: string): string[] {
  return companyName
    .toLowerCase()
    .normalize('NFKD')
    // Drop accents so "Klarna Bank AB" and "Klärna" slug identically.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * Slug candidates for a company name, most likely first.
 *
 * Ordering matters: probes stop at the first confirmed hit, so a wrong guess
 * early costs an extra request and a wrong guess late costs nothing.
 */
export function slugCandidates(companyName: string): string[] {
  const tokens = words(companyName);
  if (tokens.length === 0) return [];

  const trimmed = tokens.filter((token, index) => {
    // Only strip a legal suffix at the end, so "Co-op Bank" keeps its "co".
    const isLast = index === tokens.length - 1;
    return !(isLast && tokens.length > 1 && LEGAL_SUFFIXES.includes(token));
  });

  const base = trimmed.length > 0 ? trimmed : tokens;

  const candidates = [
    base.join(''),
    base.join('-'),
    base[0] ?? '',
    // Some boards keep the legal suffix; try the untrimmed forms too.
    tokens.join(''),
    tokens.join('-'),
  ];

  return [...new Set(candidates.filter((slug) => slug.length > 1))];
}

/** Public board URL for a confirmed slug. This is what collectors scrape. */
export function boardUrl(platform: AtsPlatform, slug: string): string {
  switch (platform) {
    case 'greenhouse':
      return `https://job-boards.greenhouse.io/${slug}`;
    case 'lever':
      return `https://jobs.lever.co/${slug}`;
    case 'ashby':
      return `https://jobs.ashbyhq.com/${slug}`;
  }
}
