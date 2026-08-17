import { z } from 'zod';

import type { CollectorTarget, Oracle } from '../collectors/base.js';
import type { AtsPlatform } from '../discovery/slugs.js';
import type { RawPosting } from '../schema/posting.js';

/**
 * Ground truth, taken from the ATS platforms' own public JSON feeds.
 *
 * These feeds are free, unmetered and do not go through Bright Data — they are
 * not a data source and must never be used as one. Scraper Studio scrapes the
 * rendered board HTML; this module exists only to grade that scrape and to
 * answer whether a company still lists a role.
 *
 * Using the feed as the data source would be the obvious shortcut and it would
 * quietly destroy the project: an API that never changes shape gives the heal
 * loop nothing to detect, and leaves no independent yardstick for whether a
 * heal recovered correct values or merely non-null ones.
 */

const greenhouseJob = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string().url(),
  updated_at: z.string(),
  first_published: z.string().nullish(),
  location: z.object({ name: z.string() }).nullish(),
  content: z.string().nullish(),
});

const greenhouseResponse = z.object({ jobs: z.array(greenhouseJob) });

const leverPosting = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string().url(),
  applyUrl: z.string().url().nullish(),
  createdAt: z.number().nullish(),
  workplaceType: z.string().nullish(),
  descriptionBody: z.string().nullish(),
  categories: z
    .object({
      location: z.string().nullish(),
      commitment: z.string().nullish(),
    })
    .nullish(),
  salaryRange: z
    .object({
      min: z.number().nullish(),
      max: z.number().nullish(),
      currency: z.string().nullish(),
    })
    .nullish(),
});

const leverResponse = z.array(leverPosting);

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  // A company that has moved off the platform 404s. That is an absent oracle,
  // not a failure — the caller must not treat it as "no jobs exist".
  if (!response.ok) return null;
  return response.json();
}

/**
 * Greenhouse returns job descriptions HTML-escaped — the `content` field holds
 * `&lt;p&gt;…` rather than `<p>…`. Rendered as-is it shows its own markup as
 * literal text, so the entities are resolved once here, at the boundary, rather
 * than left for every consumer to rediscover.
 */
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    hellip: '…',
    mdash: '—',
    ndash: '–',
    rsquo: '’',
    lsquo: '‘',
    ldquo: '“',
    rdquo: '”',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const codePoint = entity[1]?.toLowerCase() === 'x'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function remotePolicyFrom(value: string | null | undefined): RawPosting['remotePolicy'] {
  switch (value?.toLowerCase()) {
    case 'remote':
      return 'remote';
    case 'hybrid':
      return 'hybrid';
    case 'onsite':
    case 'on-site':
      return 'onsite';
    default:
      return null;
  }
}

function employmentTypeFrom(value: string | null | undefined): RawPosting['employmentType'] {
  switch (value?.toLowerCase()) {
    case 'full-time':
    case 'full time':
      return 'full_time';
    case 'part-time':
    case 'part time':
      return 'part_time';
    case 'contract':
      return 'contract';
    case 'intern':
    case 'internship':
      return 'internship';
    case 'temporary':
      return 'temporary';
    default:
      return null;
  }
}

/**
 * Greenhouse's feed carries no compensation or employment-type data at all
 * (measured 0/197 on GitLab's board), and no workplace-type flag. Salary that
 * pay-transparency law puts in the description prose is reachable only by
 * scraping, so those fields are ungradable here by construction.
 */
export const greenhouseOracle: Oracle = {
  authority: 'authoritative',
  gradableFields: new Set(['title', 'location', 'postedAt', 'applyUrl', 'descriptionHtml']),

  async truth(target: CollectorTarget): Promise<RawPosting[] | null> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${target.companySlug}/jobs?content=true`;
    const body = await fetchJson(url);
    if (body === null) return null;

    const parsed = greenhouseResponse.safeParse(body);
    if (!parsed.success) return null;

    return parsed.data.jobs.map((job) => ({
      sourceKey: String(job.id),
      sourceUrl: job.absolute_url,
      title: job.title,
      company: target.companySlug,
      location: job.location?.name ?? null,
      remotePolicy: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      employmentType: null,
      postedAt: job.first_published ? new Date(job.first_published) : new Date(job.updated_at),
      descriptionHtml: job.content ? decodeEntities(job.content) : null,
      applyUrl: job.absolute_url,
    }));
  },
};

/**
 * Lever publishes structured `salaryRange` and `workplaceType`, so it can grade
 * more than Greenhouse can — though it fills salary on only a small minority of
 * postings (9/388 on the reference board), which is precisely why drift is
 * judged against a per-source baseline rather than a global threshold.
 */
export const leverOracle: Oracle = {
  authority: 'authoritative',
  gradableFields: new Set([
    'title',
    'location',
    'postedAt',
    'applyUrl',
    'descriptionHtml',
    'remotePolicy',
    'employmentType',
    'salaryMin',
    'salaryMax',
    'salaryCurrency',
  ]),

  async truth(target: CollectorTarget): Promise<RawPosting[] | null> {
    const url = `https://api.lever.co/v0/postings/${target.companySlug}?mode=json`;
    const body = await fetchJson(url);
    if (body === null) return null;

    const parsed = leverResponse.safeParse(body);
    if (!parsed.success) return null;

    return parsed.data.map((post) => ({
      sourceKey: post.id,
      sourceUrl: post.hostedUrl,
      title: post.text,
      company: target.companySlug,
      location: post.categories?.location ?? null,
      remotePolicy: remotePolicyFrom(post.workplaceType),
      salaryMin: post.salaryRange?.min ?? null,
      salaryMax: post.salaryRange?.max ?? null,
      salaryCurrency: post.salaryRange?.currency ?? null,
      employmentType: employmentTypeFrom(post.categories?.commitment),
      postedAt: post.createdAt ? new Date(post.createdAt) : null,
      descriptionHtml: post.descriptionBody ?? null,
      applyUrl: post.applyUrl ?? post.hostedUrl,
    }));
  },
};

/**
 * Whether a company's board exists on a platform. Used by company discovery to
 * confirm a slug before it is added to the target list, so collectors never
 * spend Bright Data credits on a URL that was a guess.
 */
const ashbyResponse = z.object({ jobs: z.array(z.object({ id: z.string(), title: z.string() })) });

function feedUrl(platform: AtsPlatform, slug: string): string {
  switch (platform) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${slug}?mode=json`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  }
}

function parseFeed(platform: AtsPlatform, body: unknown): number | null {
  switch (platform) {
    case 'greenhouse': {
      const parsed = greenhouseResponse.safeParse(body);
      return parsed.success ? parsed.data.jobs.length : null;
    }
    case 'lever': {
      const parsed = leverResponse.safeParse(body);
      return parsed.success ? parsed.data.length : null;
    }
    case 'ashby': {
      const parsed = ashbyResponse.safeParse(body);
      return parsed.success ? parsed.data.jobs.length : null;
    }
  }
}

/**
 * How many jobs a company's board holds, or null if the board does not exist.
 *
 * Confirms a discovered slug is real before a collector spends a Bright Data
 * credit on it, and doubles as the open-role count shown during discovery.
 */
export async function boardSize(
  platform: AtsPlatform,
  slug: string,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const body = await fetchJson(feedUrl(platform, slug), signal);
    if (body === null) return null;
    return parseFeed(platform, body);
  } catch {
    return null;
  }
}

export async function boardExists(
  platform: AtsPlatform,
  slug: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return (await boardSize(platform, slug, signal)) !== null;
}
