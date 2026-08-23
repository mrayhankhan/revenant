import { companies, db, livenessObservations, postings } from '@revenant/core/db/index';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The feed.
 *
 * Reads real postings collected by `npm run ingest`, joined to their most
 * recent liveness observation. Liveness is stored rather than recomputed per
 * request because the decay engine needs history — "absent from the company's
 * own board for 12 days" cannot be derived from a single row at read time.
 *
 * Verdict counts are computed over the whole corpus, not the returned page.
 * Counting the page instead would make every filter report the size of the
 * page, which is both wrong and specifically hides the decayed listings the
 * product exists to surface: they sort last, so a score-ordered page never
 * contains any.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 300), 1000);
  const verdict = url.searchParams.get('verdict');
  const search = url.searchParams.get('q')?.trim();
  const sort = url.searchParams.get('sort') ?? 'recent';

  const database = db();

  // The newest observation per posting. A posting is verified repeatedly and
  // only its latest verdict belongs in the feed.
  const latest = database
    .select({
      postingId: livenessObservations.postingId,
      observedAt: sql<number>`max(${livenessObservations.observedAt})`.as('latest_observed_at'),
    })
    .from(livenessObservations)
    .groupBy(livenessObservations.postingId)
    .as('latest');

  const conditions = [];
  if (verdict) conditions.push(eq(livenessObservations.verdict, verdict));
  if (search) {
    const needle = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${postings.title})`, needle),
        like(sql`lower(${postings.company})`, needle),
        like(sql`lower(${postings.location})`, needle),
      ),
    );
  }

  const base = database
    .select({
      id: postings.id,
      title: postings.title,
      company: postings.company,
      companySlug: postings.companySlug,
      location: postings.location,
      remotePolicy: postings.remotePolicy,
      salaryMin: postings.salaryMin,
      salaryMax: postings.salaryMax,
      salaryCurrency: postings.salaryCurrency,
      employmentType: postings.employmentType,
      postedAt: postings.postedAt,
      applyUrl: postings.applyUrl,
      score: livenessObservations.score,
      verdict: livenessObservations.verdict,
      provenGhost: livenessObservations.provenGhost,
      reasons: livenessObservations.reasons,
      companyDomain: companies.domain,
    })
    .from(postings)
    .innerJoin(latest, eq(latest.postingId, postings.id))
    .innerJoin(
      livenessObservations,
      sql`${livenessObservations.postingId} = ${postings.id} and ${livenessObservations.observedAt} = ${latest.observedAt}`,
    )
    .leftJoin(companies, eq(companies.slug, postings.companySlug));

  const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;

  const rows = await filtered
    .orderBy(sort === 'decay' ? livenessObservations.score : desc(postings.postedAt))
    .limit(limit);

  // Counts over every posting, independent of the page above.
  const tally = await database.all<{ verdict: string; n: number }>(sql`
    select o.verdict as verdict, count(*) as n
    from postings p
    join liveness_observations o on o.posting_id = p.id
    where o.observed_at = (
      select max(observed_at) from liveness_observations where posting_id = p.id
    )
    group by o.verdict
  `);

  const counts: Record<string, number> = { all: 0, live: 0, aging: 0, stale: 0, ghost: 0 };
  for (const row of tally) {
    counts[row.verdict] = row.n;
    counts['all'] = (counts['all'] ?? 0) + row.n;
  }

  // Named for what it holds, not for the table — `companies` is the imported
  // schema object in this file.
  const companyCount = await database.get<{ n: number }>(
    sql`select count(distinct company_slug) as n from postings`,
  );

  return NextResponse.json({
    counts,
    companies: companyCount?.n ?? 0,
    total: rows.length,
    postings: rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      companySlug: row.companySlug,
      location: row.location,
      remotePolicy: row.remotePolicy,
      salaryMin: row.salaryMin,
      salaryMax: row.salaryMax,
      salaryCurrency: row.salaryCurrency,
      employmentType: row.employmentType,
      postedAt: row.postedAt?.toISOString() ?? null,
      applyUrl: row.applyUrl,
      companyDomain: row.companyDomain,
      liveness: {
        score: row.score,
        verdict: row.verdict,
        provenGhost: row.provenGhost,
        reasons: safeReasons(row.reasons),
      },
    })),
  });
}

/** Reasons are stored as a JSON array; never let a malformed row break the feed. */
function safeReasons(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}
