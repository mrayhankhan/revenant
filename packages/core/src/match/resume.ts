import { extractSkills, skillLabel } from './skills.js';
import type { RawPosting } from '../schema/posting.js';

/**
 * Matching a résumé against a posting, and saying why.
 *
 * The output that matters here is not the score — it is the sentence underneath
 * it. A job seeker cannot act on "72%", but can act on "asks for Kubernetes and
 * Terraform, neither of which your CV mentions". So every match carries the
 * skills that lined up, the ones that did not, and a plain-English summary.
 *
 * Nothing here calls a model. See `skills.ts` for why that is deliberate.
 */

export const SENIORITY_LEVELS = [
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'lead',
  'director',
] as const;

export type Seniority = (typeof SENIORITY_LEVELS)[number];

/** Rank used to measure distance between two levels. */
const SENIORITY_RANK: Record<Seniority, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  staff: 4,
  lead: 4,
  principal: 5,
  director: 6,
};

const SENIORITY_PATTERNS: [Seniority, RegExp][] = [
  ['intern', /\b(intern|internship|graduate|new grad|apprentice)\b/i],
  ['junior', /\b(junior|jr\.?|entry[- ]level|associate)\b/i],
  ['principal', /\b(principal|distinguished|fellow)\b/i],
  ['director', /\b(director|vp|head of|chief)\b/i],
  ['staff', /\b(staff)\b/i],
  ['lead', /\b(lead|leading a team|tech lead)\b/i],
  ['senior', /\b(senior|sr\.?)\b/i],
];

/** The level a title or résumé describes. Defaults to mid when unstated. */
export function detectSeniority(text: string | null | undefined): Seniority {
  if (!text) return 'mid';
  for (const [level, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(text)) return level;
  }
  return 'mid';
}

export interface ResumeProfile {
  skills: Set<string>;
  seniority: Seniority;
  /** Years of experience, if the résumé states it. */
  years: number | null;
  /** True when remote is explicitly preferred. */
  wantsRemote: boolean;
}

export function parseResume(text: string): ResumeProfile {
  const years = /(\d{1,2})\+?\s*years?(?:\s+of)?\s+experience/i.exec(text);
  const parsedYears = years?.[1] ? Number.parseInt(years[1], 10) : null;

  return {
    skills: extractSkills(text),
    seniority: detectSeniority(text),
    years: parsedYears !== null && Number.isFinite(parsedYears) ? parsedYears : null,
    wantsRemote: /\b(remote[- ]first|prefer(?:s|ring)? remote|remote only)\b/i.test(text),
  };
}

export interface MatchResult {
  /** 0–100. */
  score: number;
  /** Skills the posting asks for that the résumé has. */
  matched: string[];
  /** Skills the posting asks for that the résumé does not mention. */
  missing: string[];
  /** Plain-English, ordered by weight. The UI shows the first line. */
  reasons: string[];
  seniorityGap: number;
}

/**
 * Weights.
 *
 * Skill overlap dominates because it is the thing a résumé can actually be
 * changed to address. Seniority is a smaller penalty in both directions: being
 * over-levelled for a role is a real mismatch, not just an under-match.
 */
const SKILL_WEIGHT = 70;
const SENIORITY_WEIGHT = 20;
const REMOTE_WEIGHT = 10;

/**
 * How many named skills a posting needs before its coverage is taken at face
 * value. Below this the score is pulled toward neutral, because a short list is
 * weak evidence in either direction.
 */
const EVIDENCE_SATURATION = 5;

function listOf(skills: string[], limit = 3): string {
  const labels = skills.slice(0, limit).map(skillLabel);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0] as string;
  const rest = skills.length - labels.length;
  const joined = `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return rest > 0 ? `${joined} (+${rest} more)` : joined;
}

export function matchPosting(profile: ResumeProfile, posting: RawPosting): MatchResult {
  const required = extractSkills(`${posting.title ?? ''} ${posting.descriptionHtml ?? ''}`);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of required) {
    if (profile.skills.has(skill)) matched.push(skill);
    else missing.push(skill);
  }

  /*
   * Coverage, weighted by how much the posting actually told us.
   *
   * Ratio alone is badly wrong here. A posting that names one skill you happen
   * to have scores 1/1 — a perfect match — and outranks a posting naming eight
   * that you match all of. In a live run that put "Sr. Engagement Manager" at
   * the top of a backend engineer's results, on the strength of one mention
   * of AWS.
   *
   * So coverage is blended toward neutral in proportion to how little the
   * posting named. A vague posting lands near the middle, where it belongs,
   * and only a posting that lists real requirements can score at either
   * extreme.
   */
  const evidence = Math.min(1, required.size / EVIDENCE_SATURATION);
  const coverage = required.size === 0 ? 0.5 : matched.length / required.size;
  const skillScore = SKILL_WEIGHT * (coverage * evidence + 0.5 * (1 - evidence));

  const postingSeniority = detectSeniority(posting.title);
  const gap = SENIORITY_RANK[postingSeniority] - SENIORITY_RANK[profile.seniority];
  const seniorityScore = Math.max(0, SENIORITY_WEIGHT - Math.abs(gap) * 7);

  const remoteScore =
    !profile.wantsRemote || posting.remotePolicy === 'remote'
      ? REMOTE_WEIGHT
      : posting.remotePolicy === 'hybrid'
        ? REMOTE_WEIGHT / 2
        : 0;

  const reasons: string[] = [];

  if (matched.length > 0) {
    reasons.push(`Matches your ${listOf(matched)}.`);
  }
  if (missing.length > 0) {
    reasons.push(`Asks for ${listOf(missing)}, not mentioned on your CV.`);
  }
  if (gap >= 2) {
    reasons.push(`Pitched ${gap} level${gap === 1 ? '' : 's'} above your CV.`);
  } else if (gap <= -2) {
    reasons.push(`Pitched below your stated level.`);
  }
  if (profile.wantsRemote && posting.remotePolicy === 'onsite') {
    reasons.push('On-site, and your CV says you prefer remote.');
  }
  if (reasons.length === 0) {
    reasons.push('No specific skills named in this posting.');
  }

  return {
    score: Math.round(skillScore + seniorityScore + remoteScore),
    matched,
    missing,
    reasons,
    seniorityGap: gap,
  };
}

export interface TailoringSuggestion {
  skill: string;
  label: string;
  /** The sentence from the posting that asks for it. */
  evidence: string | null;
}

/**
 * What to change on the CV for this specific posting.
 *
 * Every suggestion is tied to the sentence in the posting that motivates it, so
 * the person can judge whether it is worth acting on. A rewrite the user cannot
 * trace back to the posting is a rewrite they have to take on faith.
 */
export function tailoringSuggestions(
  profile: ResumeProfile,
  posting: RawPosting,
  limit = 6,
): TailoringSuggestion[] {
  const description = stripHtml(posting.descriptionHtml ?? '');
  const sentences = description.split(/(?<=[.!?])\s+/);

  const required = extractSkills(`${posting.title ?? ''} ${description}`);
  const missing = [...required].filter((skill) => !profile.skills.has(skill));

  return missing.slice(0, limit).map((skill) => ({
    skill,
    label: skillLabel(skill),
    evidence: sentences.find((sentence) => extractSkills(sentence).has(skill))?.trim() ?? null,
  }));
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
