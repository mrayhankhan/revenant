import { z } from 'zod';

import type { CollectorTarget, Oracle } from '../collectors/base.js';
import type { RawPosting } from '../schema/posting.js';

/**
 * Ground truth from Ashby's public job board API.
 *
 * Like the Greenhouse and Lever readers, this exists to grade a scrape and to
 * answer whether a company still lists a role — never to supply the data. See
 * `collectors/base.ts` for why that separation matters.
 *
 * Ashby is the richest of the three feeds: it states the workplace type and the
 * employment type outright, where Greenhouse leaves both to be inferred. It
 * still carries no compensation field, which is the gap that makes scraping the
 * rendered page worthwhile on every platform.
 */

const ashbyJob = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  employmentType: z.string().nullish(),
  publishedAt: z.string().nullish(),
  isRemote: z.boolean().nullish(),
  workplaceType: z.string().nullish(),
  jobUrl: z.string().url().nullish(),
  applyUrl: z.string().url().nullish(),
  descriptionHtml: z.string().nullish(),
});

const ashbyResponse = z.object({ jobs: z.array(ashbyJob) });

function remotePolicyFrom(
  workplaceType: string | null | undefined,
  isRemote: boolean | null | undefined,
): RawPosting['remotePolicy'] {
  switch (workplaceType?.toLowerCase()) {
    case 'remote':
      return 'remote';
    case 'hybrid':
      return 'hybrid';
    case 'onsite':
    case 'on-site':
      return 'onsite';
    default:
      // `isRemote` is the older flag and still set on some boards, so it is a
      // fallback rather than the primary signal.
      return isRemote === true ? 'remote' : null;
  }
}

function employmentTypeFrom(value: string | null | undefined): RawPosting['employmentType'] {
  switch (value?.toLowerCase().replace(/[\s_-]/g, '')) {
    case 'fulltime':
      return 'full_time';
    case 'parttime':
      return 'part_time';
    case 'contract':
    case 'contractor':
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

export const ashbyOracle: Oracle = {
  authority: 'authoritative',
  gradableFields: new Set([
    'title',
    'location',
    'remotePolicy',
    'employmentType',
    'postedAt',
    'applyUrl',
    'descriptionHtml',
  ]),

  async truth(target: CollectorTarget): Promise<RawPosting[] | null> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${target.companySlug}`;

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    // A company that has moved off Ashby 404s. That is an absent oracle, not
    // evidence that the company has no open roles.
    if (!response.ok) return null;

    const parsed = ashbyResponse.safeParse(await response.json());
    if (!parsed.success) return null;

    return parsed.data.jobs.map((job) => {
      const link = job.applyUrl ?? job.jobUrl ?? target.url;

      return {
        sourceKey: job.id,
        sourceUrl: link,
        title: job.title,
        company: target.companySlug,
        location: job.location ?? null,
        remotePolicy: remotePolicyFrom(job.workplaceType, job.isRemote),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        employmentType: employmentTypeFrom(job.employmentType),
        postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
        descriptionHtml: job.descriptionHtml ?? null,
        applyUrl: link,
      };
    });
  },
};
