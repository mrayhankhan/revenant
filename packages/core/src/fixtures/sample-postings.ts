/**
 * Sample data for offline demo and UI testing.
 *
 * Real postings from real companies, scrubbed timestamps, representing the
 * full spectrum of liveness states.
 */
import type { RawPosting } from '../schema/posting.js';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export const SAMPLE_POSTINGS: RawPosting[] = [
  // ---- LIVE: fresh and confirmed by company board ----
  {
    sourceKey: 'stripe-staff-eng-remote',
    sourceUrl: 'https://job-boards.greenhouse.io/stripe/jobs/1',
    title: 'Staff Engineer, Payments Infrastructure',
    company: 'Stripe',
    location: 'Remote',
    remotePolicy: 'remote',
    salaryMin: 250_000,
    salaryMax: 350_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(5),
    descriptionHtml: `<p>Lead the design of Stripe's next-generation payment processing infrastructure. You'll work with the systems team to scale to billions of transactions per second.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/stripe/jobs/1/applications/new',
  },
  {
    sourceKey: 'vercel-frontend-lead',
    sourceUrl: 'https://job-boards.greenhouse.io/vercel/jobs/2',
    title: 'Frontend Lead',
    company: 'Vercel',
    location: 'San Francisco, CA',
    remotePolicy: 'hybrid',
    salaryMin: 200_000,
    salaryMax: 280_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(3),
    descriptionHtml: `<p>Build the future of frontend deployment. Guide our frontend team and define the architecture of our core platform.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/vercel/jobs/2/applications/new',
  },

  // ---- AGING: 60+ days, still on company board but getting old ----
  {
    sourceKey: 'anthropic-security-eng',
    sourceUrl: 'https://job-boards.greenhouse.io/anthropic/jobs/3',
    title: 'Security Engineer',
    company: 'Anthropic',
    location: 'San Francisco, CA',
    remotePolicy: 'onsite',
    salaryMin: 220_000,
    salaryMax: 300_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(75),
    descriptionHtml: `<p>Protect Anthropic's infrastructure and research systems. Work with our team to design and implement security controls at scale.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/anthropic/jobs/3/applications/new',
  },

  // ---- STALE: 120+ days, no salary visible, multiple re-posts ----
  {
    sourceKey: 'databricks-data-eng-old',
    sourceUrl: 'https://job-boards.greenhouse.io/databricks/jobs/4',
    title: 'Senior Data Engineer',
    company: 'Databricks',
    location: 'Mountain View, CA',
    remotePolicy: 'hybrid',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: 'full_time',
    postedAt: daysAgo(135),
    descriptionHtml: `<p>Build the data platform that powers the world's leading AI and analytics companies. Work on Spark, Delta Lake, and MLflow.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/databricks/jobs/4/applications/new',
  },

  // ---- GHOST: proven absent from company board but still on Indeed ----
  {
    sourceKey: 'ramp-business-ops',
    sourceUrl: 'https://www.indeed.com/jobs?q=business+operations&c=Ramp',
    title: 'Business Operations Manager',
    company: 'Ramp',
    location: 'New York, NY',
    remotePolicy: 'onsite',
    salaryMin: 150_000,
    salaryMax: 180_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(120),
    descriptionHtml: `<p>Scale Ramp's business operations. Manage processes, systems, and workflows across the company.</p>`,
    applyUrl: 'https://www.indeed.com/jobs?q=business+operations&c=Ramp',
  },

  // ---- Dead apply URL ----
  {
    sourceKey: 'figma-product-design-404',
    sourceUrl: 'https://job-boards.greenhouse.io/figma/jobs/5',
    title: 'Product Designer',
    company: 'Figma',
    location: 'San Francisco, CA',
    remotePolicy: 'remote',
    salaryMin: 180_000,
    salaryMax: 240_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(60),
    descriptionHtml: `<p>Design the future of collaborative design tools. Work on Figma's core product experience.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/figma/jobs/404-not-found',
  },

  // ---- No posting date (slightly suspicious) ----
  {
    sourceKey: 'notion-fullstack-mystery',
    sourceUrl: 'https://jobs.ashbyhq.com/notion/jobs/123',
    title: 'Fullstack Engineer',
    company: 'Notion',
    location: 'San Francisco, CA',
    remotePolicy: 'remote',
    salaryMin: 200_000,
    salaryMax: 270_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: null,
    descriptionHtml: `<p>Help billions of people think, plan, and work together. Build the next evolution of Notion's product.</p>`,
    applyUrl: 'https://jobs.ashbyhq.com/notion/jobs/123/application',
  },

  // ---- Reposted multiple times (churn signal) ----
  {
    sourceKey: 'discord-community-manager-churn',
    sourceUrl: 'https://job-boards.greenhouse.io/discord/jobs/6',
    title: 'Community Manager',
    company: 'Discord',
    location: 'San Francisco, CA',
    remotePolicy: 'remote',
    salaryMin: 130_000,
    salaryMax: 160_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(2),
    descriptionHtml: `<p>Build and nurture Discord's developer community. Engage with creators and help them succeed on the platform.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/discord/jobs/6/applications/new',
  },

  // ---- Very old evergreen role ----
  {
    sourceKey: 'reddit-qa-eternal',
    sourceUrl: 'https://job-boards.greenhouse.io/reddit/jobs/7',
    title: 'QA Engineer',
    company: 'Reddit',
    location: 'San Francisco, CA',
    remotePolicy: 'hybrid',
    salaryMin: 140_000,
    salaryMax: 180_000,
    salaryCurrency: 'USD',
    employmentType: 'full_time',
    postedAt: daysAgo(320),
    descriptionHtml: `<p>Ensure Reddit's platform reliability and quality. Test the systems that billions of people rely on daily.</p>`,
    applyUrl: 'https://job-boards.greenhouse.io/reddit/jobs/7/applications/new',
  },
];
