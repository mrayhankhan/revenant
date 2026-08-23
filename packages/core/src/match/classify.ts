/**
 * Classifies a posting into the buckets people actually filter on.
 *
 * Job boards ask "remote?", "entry level?", "internship?" — questions the raw
 * fields do not answer directly. `employmentType` is filled on a minority of
 * postings, and seniority is only ever stated in the title. So both are inferred
 * from the title and the stated location, which are almost always present.
 *
 * Inference is conservative in one direction on purpose: it is better to leave a
 * junior role out of the "entry level" filter than to send someone with no
 * experience to a staff position.
 */

export const EXPERIENCE_LEVELS = ['intern', 'entry', 'mid', 'senior', 'lead'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

const INTERN = /\b(intern|internship|co-?op|apprentice|placement|working student)\b/i;
const ENTRY =
  /\b(junior|jr\.?|entry[- ]level|new ?grad(uate)?|graduate|fresher|associate|trainee|early career|university)\b/i;
/*
 * "Manager" and "architect" are deliberately absent.
 *
 * Including them promoted every Account Manager, Product Manager and Solutions
 * Architect to lead — 3,718 of 7,569 postings landed there, and Product showed
 * 448 lead roles against zero mid, which is not a thing that happens at a real
 * company. Manager is a job word, not a level word: it means seniority only in
 * the compounds spelled out here.
 */
const LEAD =
  /\b(lead|principal|staff|director|head of|vp|chief|distinguished|senior manager|engineering manager|group manager|manager, engineering)\b/i;
const SENIOR = /\b(senior|sr\.?|experienced)\b/i;

/**
 * Experience level implied by a title.
 *
 * Checked most-specific first: "Senior Staff Engineer" is a lead role, and an
 * "Engineering Intern" is an internship regardless of anything else in the title.
 */
export function classifyLevel(
  title: string | null | undefined,
  employmentType?: string | null,
): ExperienceLevel {
  if (employmentType === 'internship') return 'intern';
  if (!title) return 'mid';

  if (INTERN.test(title)) return 'intern';
  if (ENTRY.test(title)) return 'entry';
  if (LEAD.test(title)) return 'lead';
  if (SENIOR.test(title)) return 'senior';

  return 'mid';
}

const REMOTE = /\b(remote|distributed|work from home|wfh|anywhere)\b/i;
const HYBRID = /\b(hybrid|flexible)\b/i;
const ONSITE = /\b(on-?site|in-?office|in-?person)\b/i;

/**
 * Work mode, preferring the stated policy and falling back to the location.
 *
 * Boards very often encode the arrangement only in the location — "Remote,
 * Italy" or "Hybrid - San Francisco" — so a policy field that is empty does not
 * mean the posting failed to say.
 */
export function classifyWorkMode(
  remotePolicy: string | null | undefined,
  location: string | null | undefined,
): WorkMode | null {
  const policy = remotePolicy?.toLowerCase();
  if (policy === 'remote' || policy === 'hybrid' || policy === 'onsite') return policy;

  const text = location ?? '';
  if (REMOTE.test(text)) return 'remote';
  if (HYBRID.test(text)) return 'hybrid';
  if (ONSITE.test(text)) return 'onsite';

  return null;
}

export const JOB_DOMAINS = [
  'engineering',
  'data',
  'product',
  'design',
  'sales',
  'marketing',
  'operations',
  'finance',
  'people',
  'legal',
  'support',
  'other',
] as const;

export type JobDomain = (typeof JOB_DOMAINS)[number];

export const DOMAIN_LABELS: Record<JobDomain, string> = {
  engineering: 'Engineering',
  data: 'Data & AI',
  product: 'Product',
  design: 'Design',
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  people: 'People',
  legal: 'Legal',
  support: 'Support',
  other: 'Other',
};

/**
 * Function a role belongs to, matched against the title.
 *
 * Order is the whole design here, because titles routinely satisfy several
 * patterns at once and only the first match survives. "Sales Engineer" belongs
 * to sales, "Data Engineer" to data, "Product Designer" to design — each of
 * which the generic engineering rule would otherwise swallow. So the compound
 * and qualified cases are tested before the broad ones.
 */
/*
 * Stems are left open at the end rather than closed with `\b`, because a
 * trailing boundary blocks exactly the forms these words appear in: `\brecruit\b`
 * never matches "Recruiter", and `\bdesign\b` never matches "Designer". Where a
 * bare stem would be too greedy the suffixes are spelled out instead.
 */
const DOMAIN_PATTERNS: [JobDomain, RegExp][] = [
  // Compounds first: each contains a word a later, broader rule would claim.
  ['sales', /\b(sales engineer|solutions? engineer|solutions? architect|pre-?sales)/i],
  ['support', /\b(support engineer|customer engineer|technical support)/i],
  ['design', /\b(product design|ux\b|ui design|design system)/i],
  [
    'data',
    /\b(data (engineer|scientist|analyst|platform)|machine learning|ml engineer|ai (engineer|research)|analytic|research scientist|bioinformatic)/i,
  ],

  [
    'engineering',
    /\b(engineer|developer|programmer|sre\b|devops|architect|technical lead|infrastructure|platform|security|qa\b|test automation|robotic|firmware)/i,
  ],
  ['product', /\b(product manager|product owner|product lead|program manager|technical program|tpm\b)/i],
  ['design', /\b(design|creative|brand studio|illustrat|motion)/i],
  [
    'sales',
    /\b(sales|account executive|account manager|business development|partnership|revenue|customer success|renewal)/i,
  ],
  [
    'marketing',
    /\b(marketing|growth|demand gen|content|seo\b|communication|social media|brand|pr manager|events)/i,
  ],
  ['finance', /\b(finance|financial|accounting|accountant|controller|treasury|tax\b|audit|fp&a|payroll)/i],
  [
    'people',
    /\b(recruit|talent|people|human resources|hr\b|onboarding specialist|compensation|benefits)/i,
  ],
  ['legal', /\b(legal|counsel|attorney|paralegal|compliance|privacy|regulatory)/i],
  ['support', /\b(support|customer service|help desk|technical writer|documentation)/i],
  [
    'operations',
    /\b(operations|ops\b|logistics|supply chain|facilities|office manager|procurement|strategy|chief of staff|business analyst)/i,
  ],
];

export function classifyDomain(title: string | null | undefined): JobDomain {
  if (!title) return 'other';

  for (const [domain, pattern] of DOMAIN_PATTERNS) {
    if (pattern.test(title)) return domain;
  }

  return 'other';
}

/** Whether a posting is an internship, by either signal. */
export function isInternship(
  title: string | null | undefined,
  employmentType: string | null | undefined,
): boolean {
  return employmentType === 'internship' || INTERN.test(title ?? '');
}
