import { z } from 'zod';

import type { CollectorTarget, Oracle } from '../collectors/base.js';
import type { RawPosting } from '../schema/posting.js';

/**
 * Ground truth for the chaos target.
 *
 * The chaos target publishes a structured feed at `/chaos/truth` alongside its
 * rendered board, exactly as Greenhouse, Lever and Ashby do. That is what makes
 * it a fair rehearsal rather than a rigged one: the heal loop grades a repair
 * against this feed using the same code path it uses on a real platform.
 *
 * The feed deliberately does not change when the layout flips. It is ground
 * truth precisely because the redesign under test cannot touch it.
 */

const chaosJob = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  workplace: z.string().nullable(),
  employment_type: z.string().nullable(),
  posted: z.string(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  currency: z.string().nullable(),
  description: z.string(),
  apply_url: z.string(),
});

const chaosResponse = z.object({ jobs: z.array(chaosJob) });

function remotePolicyFrom(value: string | null): RawPosting['remotePolicy'] {
  switch (value?.toLowerCase()) {
    case 'remote':
      return 'remote';
    case 'hybrid':
      return 'hybrid';
    case 'on-site':
    case 'onsite':
      return 'onsite';
    default:
      return null;
  }
}

function employmentTypeFrom(value: string | null): RawPosting['employmentType'] {
  switch (value?.toLowerCase()) {
    case 'full-time':
      return 'full_time';
    case 'part-time':
      return 'part_time';
    case 'contract':
      return 'contract';
    case 'internship':
      return 'internship';
    default:
      return null;
  }
}

export const chaosOracle: Oracle = {
  authority: 'authoritative',
  gradableFields: new Set([
    'title',
    'location',
    'remotePolicy',
    'employmentType',
    'postedAt',
    'salaryMin',
    'salaryMax',
    'salaryCurrency',
    'applyUrl',
  ]),

  async truth(target: CollectorTarget): Promise<RawPosting[] | null> {
    const base = new URL(target.url);
    const feed = new URL('/chaos/truth', base);

    const response = await fetch(feed, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;

    const parsed = chaosResponse.safeParse(await response.json());
    if (!parsed.success) return null;

    return parsed.data.jobs.map((job) => ({
      sourceKey: job.id,
      sourceUrl: new URL(job.apply_url, base).toString(),
      title: job.title,
      company: 'Northwind Robotics',
      location: job.location,
      remotePolicy: remotePolicyFrom(job.workplace),
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      salaryCurrency: job.currency,
      employmentType: employmentTypeFrom(job.employment_type),
      postedAt: new Date(job.posted),
      descriptionHtml: job.description,
      applyUrl: new URL(job.apply_url, base).toString(),
    }));
  },
};
