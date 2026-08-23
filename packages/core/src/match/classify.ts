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
const LEAD = /\b(lead|principal|staff|director|head of|vp|chief|manager|architect|distinguished)\b/i;
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

/** Whether a posting is an internship, by either signal. */
export function isInternship(
  title: string | null | undefined,
  employmentType: string | null | undefined,
): boolean {
  return employmentType === 'internship' || INTERN.test(title ?? '');
}
