import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const postings = sqliteTable(
  'postings',
  {
    id: text('id').primaryKey(),
    companySlug: text('company_slug').notNull(),
    title: text('title'),
    company: text('company'),
    location: text('location'),
    remotePolicy: text('remote_policy'),
    salaryMin: real('salary_min'),
    salaryMax: real('salary_max'),
    salaryCurrency: text('salary_currency'),
    employmentType: text('employment_type'),
    postedAt: integer('posted_at', { mode: 'timestamp_ms' }),
    descriptionHtml: text('description_html'),
    applyUrl: text('apply_url'),
    sourceKey: text('source_key').notNull(),
    sourceUrl: text('source_url').notNull(),
    contentHash: text('content_hash').notNull(),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    uniqueIndex('postings_company_source_key').on(t.companySlug, t.sourceKey),
    index('postings_company_slug').on(t.companySlug),
    index('postings_last_seen').on(t.lastSeenAt),
  ],
);

export const livenessObservations = sqliteTable(
  'liveness_observations',
  {
    id: text('id').primaryKey(),
    postingId: text('posting_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    verdict: text('verdict').notNull(), // live, aging, stale, ghost
    reasons: text('reasons').notNull(), // JSON array
    provenGhost: integer('proven_ghost', { mode: 'boolean' }).notNull(),
    presentInAuthoritative: integer('present_in_authoritative', { mode: 'boolean' }),
    absentSince: integer('absent_since', { mode: 'timestamp_ms' }),
    applyUrlDead: integer('apply_url_dead', { mode: 'boolean' }),
    repostCount: integer('repost_count').notNull().default(0),
    unchangedVerifications: integer('unchanged_verifications').notNull().default(0),
    observedAt: integer('observed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('liveness_observations_posting_id').on(t.postingId)],
);

export const fieldBaselines = sqliteTable(
  'field_baselines',
  {
    id: text('id').primaryKey(),
    collectorId: text('collector_id').notNull(),
    field: text('field').notNull(),
    rate: real('rate').notNull(),
    observations: integer('observations').notNull(),
    lastUpdatedAt: integer('last_updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    uniqueIndex('field_baselines_collector_field').on(t.collectorId, t.field),
    index('field_baselines_collector_id').on(t.collectorId),
  ],
);

export const healEvents = sqliteTable(
  'heal_events',
  {
    id: text('id').primaryKey(),
    collectorId: text('collector_id').notNull(),
    field: text('field').notNull(),
    beforeSelector: text('before_selector'),
    afterSelector: text('after_selector'),
    rowsAffected: integer('rows_affected').notNull(),
    rowsRecovered: integer('rows_recovered').notNull(),
    accuracy: real('accuracy'),
    succeededAt: integer('succeeded_at', { mode: 'timestamp_ms' }),
    failedAt: integer('failed_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('heal_events_collector_id').on(t.collectorId),
    index('heal_events_succeeded_at').on(t.succeededAt),
  ],
);

export const duplicates = sqliteTable(
  'duplicates',
  {
    id: text('id').primaryKey(),
    canonicalId: text('canonical_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    duplicateId: text('duplicate_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(), // url_match, title_and_company, etc.
    detectedAt: integer('detected_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('duplicates_canonical_id').on(t.canonicalId),
    index('duplicates_duplicate_id').on(t.duplicateId),
  ],
);

/**
 * Companies whose boards we track, resolved by `discovery/`.
 *
 * A board is confirmed against the platform's free feed before it is stored, so
 * every row here is a real board rather than a guessed slug — collectors never
 * spend a Bright Data credit discovering that a URL was wrong.
 */
export const companies = sqliteTable(
  'companies',
  {
    slug: text('slug').primaryKey(),
    name: text('name').notNull(),
    platform: text('platform').notNull(), // greenhouse, lever, ashby
    boardUrl: text('board_url').notNull(),
    /**
     * The employer's own domain, used to find their logo.
     *
     * Listed in `companies.txt` rather than derived, because the apply link is
     * often still on the ATS and guessing `company.com` is wrong often enough
     * to show another company's mark on a job.
     */
    domain: text('domain'),
    openRoles: integer('open_roles').notNull().default(0),
    discoveredAt: integer('discovered_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('companies_platform').on(t.platform)],
);

/** One row per collector invocation. Gives every field sample a run to belong to. */
export const collectionRuns = sqliteTable(
  'collection_runs',
  {
    id: text('id').primaryKey(),
    collectorId: text('collector_id').notNull(),
    companySlug: text('company_slug'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    rowsReturned: integer('rows_returned').notNull().default(0),
    rowsRejected: integer('rows_rejected').notNull().default(0),
    error: text('error'),
  },
  (t) => [index('collection_runs_collector_id').on(t.collectorId, t.startedAt)],
);

/**
 * Per-run fill rate for one field.
 *
 * `fieldBaselines` holds the rolling anchor; this holds each individual
 * observation, which is what the health dashboard draws as a sparkline and what
 * drift detection compares against the baseline.
 */
export const fieldSamples = sqliteTable(
  'field_samples',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => collectionRuns.id, { onDelete: 'cascade' }),
    collectorId: text('collector_id').notNull(),
    field: text('field').notNull(),
    filled: integer('filled').notNull(),
    total: integer('total').notNull(),
    verdict: text('verdict').notNull(), // healthy, degraded, broken, insufficient_data
    observedAt: integer('observed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('field_samples_collector_field').on(t.collectorId, t.field, t.observedAt)],
);

export const tailorings = sqliteTable(
  'tailorings',
  {
    id: text('id').primaryKey(),
    postingId: text('posting_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    originalResume: text('original_resume').notNull(),
    tailoredResume: text('tailored_resume').notNull(),
    tailorPromptVersion: text('tailor_prompt_version').notNull(),
    generatedAt: integer('generated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('tailorings_posting_id').on(t.postingId)],
);
