import { runScraper } from '../brightdata/cli.js';
import { greenhouseOracle, leverOracle } from '../oracle/ats.js';
import { rawPostingSchema } from '../schema/posting.js';
import type { RawPosting } from '../schema/posting.js';
import type { Collector, CollectRun, CollectorTarget, Oracle, SourceId } from './base.js';

/**
 * A Scraper Studio collector over a rendered ATS job board.
 *
 * This scrapes the HTML page a candidate actually sees, not the platform's JSON
 * feed. That choice is the whole project:
 *
 *  - a stable API cannot break, so a pipeline built on one has nothing to
 *    self-heal and no way to demonstrate that it does;
 *  - the rendered page is strictly richer. Greenhouse's feed carries no
 *    compensation field at all — measured 0/3,509 across fifteen company boards
 *    — while pay-transparency law puts salary ranges in the description prose of
 *    many of those same postings. Only extraction from the page reaches it.
 *
 * The feed stays on as an oracle: it grades this collector's output and answers
 * whether a role still exists. See `oracle/ats.ts`.
 */

/**
 * The plain-language field spec handed to `bdata scraper create`.
 *
 * This is the durable artefact. It describes what each value *is*, never where
 * it sits, so it remains true after a redesign — which is precisely what lets
 * Scraper Studio re-locate the fields when the markup moves. Capped at 500
 * characters by the CLI.
 */
export const BOARD_FIELD_SPEC =
  'Every job posting on this board. For each: the job title as displayed; the ' +
  'hiring company name; where the role is based as written; whether it is ' +
  'remote, hybrid or on-site; the advertised salary range with its currency if ' +
  'stated anywhere in the posting including the description text; the ' +
  'employment type; the date it says it was posted; the full job description; ' +
  'and the link a candidate follows to apply.';

interface BoardConfig {
  id: SourceId;
  label: string;
  oracle: Oracle;
  /** Env var holding the collector id produced by `scraper:create`. */
  collectorEnvVar: string;
}

const CONFIGS: Record<'greenhouse' | 'lever', BoardConfig> = {
  greenhouse: {
    id: 'greenhouse',
    label: 'Greenhouse board (HTML)',
    oracle: greenhouseOracle,
    collectorEnvVar: 'BRIGHTDATA_COLLECTOR_GREENHOUSE',
  },
  lever: {
    id: 'lever',
    label: 'Lever board (HTML)',
    oracle: leverOracle,
    collectorEnvVar: 'BRIGHTDATA_COLLECTOR_LEVER',
  },
};

/** Pull a string off a scraped row under any of several plausible keys. */
function pick(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
      // Salary arrives as prose far more often than as a number: "$150,000".
      const digits = value.replace(/[^0-9.]/g, '');
      const parsed = Number.parseFloat(digits);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

function normaliseRemote(value: string | null): RawPosting['remotePolicy'] {
  const text = value?.toLowerCase() ?? '';
  if (text.includes('remote')) return 'remote';
  if (text.includes('hybrid')) return 'hybrid';
  if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office')) {
    return 'onsite';
  }
  return null;
}

function normaliseEmployment(value: string | null): RawPosting['employmentType'] {
  const text = value?.toLowerCase() ?? '';
  if (text.includes('intern')) return 'internship';
  if (text.includes('contract')) return 'contract';
  if (text.includes('part')) return 'part_time';
  if (text.includes('temp')) return 'temporary';
  if (text.includes('full')) return 'full_time';
  return null;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Map one scraped row onto the canonical schema.
 *
 * Scraper Studio names fields from the description, and those names shift as the
 * scraper is rebuilt or healed, so each field accepts several plausible keys.
 * A row that cannot yield a usable identity is rejected rather than coerced —
 * a fabricated value here would read as a healthy extraction to the drift
 * detector and hide the very breakage it exists to catch.
 */
export function normaliseBoardRow(raw: unknown, fallbackUrl: string): RawPosting | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const applyUrl = pick(row, 'apply_url', 'applyUrl', 'url', 'link', 'job_url');
  const sourceUrl = applyUrl ?? fallbackUrl;
  const location = pick(row, 'location', 'job_location', 'city', 'office');

  // Boards often state the work model only inside the location — "Remote, Italy"
  // — so fall back to the resolved location rather than re-reading raw keys,
  // which would miss whichever alias supplied it.
  const remotePolicy =
    normaliseRemote(pick(row, 'remote_policy', 'remotePolicy', 'workplace_type', 'work_model')) ??
    normaliseRemote(location);

  const candidate = {
    sourceKey:
      pick(row, 'id', 'job_id', 'requisition_id', 'sourceKey') ?? applyUrl ?? crypto.randomUUID(),
    sourceUrl,
    title: pick(row, 'title', 'job_title', 'name', 'position'),
    company: pick(row, 'company', 'company_name', 'employer'),
    location,
    remotePolicy,
    salaryMin: pickNumber(row, 'salary_min', 'salaryMin', 'min_salary', 'compensation_min'),
    salaryMax: pickNumber(row, 'salary_max', 'salaryMax', 'max_salary', 'compensation_max'),
    salaryCurrency: pick(row, 'salary_currency', 'salaryCurrency', 'currency')?.slice(0, 3) ?? null,
    employmentType: normaliseEmployment(
      pick(row, 'employment_type', 'employmentType', 'job_type', 'commitment'),
    ),
    postedAt: toDate(pick(row, 'posted_at', 'postedAt', 'date_posted', 'published_at')),
    descriptionHtml: pick(row, 'description_html', 'descriptionHtml', 'description', 'content'),
    applyUrl,
  };

  const parsed = rawPostingSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** A collector for one ATS platform's rendered boards. */
export function boardCollector(platform: 'greenhouse' | 'lever'): Collector {
  const config = CONFIGS[platform];

  return {
    id: config.id,
    authority: 'reported',
    label: config.label,
    oracle: config.oracle,

    async targets(): Promise<CollectorTarget[]> {
      // Targets come from the database in normal operation; the CLI passes them
      // explicitly, so an empty list here means "whatever you were handed".
      return [];
    },

    async collect(target: CollectorTarget): Promise<CollectRun> {
      const collectorId = process.env[config.collectorEnvVar];
      if (!collectorId) {
        throw new Error(
          `${config.collectorEnvVar} is not set. Run: npm run scraper:create -w @revenant/core -- ${platform} <board-url>`,
        );
      }

      const startedAt = new Date();
      const rows = await runScraper(collectorId, target.url);

      const postings: RawPosting[] = [];
      let rejected = 0;

      for (const row of rows) {
        const posting = normaliseBoardRow(row, target.url);
        if (posting) postings.push(posting);
        else rejected += 1;
      }

      return { postings, rejected, startedAt, finishedAt: new Date() };
    },
  };
}

export const greenhouseBoardCollector = boardCollector('greenhouse');
export const leverBoardCollector = boardCollector('lever');
