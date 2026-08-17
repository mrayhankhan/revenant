import { companies, db, livenessObservations, postings } from '@revenant/core/db/index';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * One posting, with the full history behind its verdict.
 *
 * The feed shows the latest verdict; this returns every observation, because
 * decay is a trajectory rather than a state. "Score 46" means little on its own;
 * "was 100 three weeks ago, now 46" is the thing worth showing a job seeker.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const database = db();

  const [posting] = await database
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
      descriptionHtml: postings.descriptionHtml,
      applyUrl: postings.applyUrl,
      sourceUrl: postings.sourceUrl,
      firstSeenAt: postings.firstSeenAt,
      lastSeenAt: postings.lastSeenAt,
      boardUrl: companies.boardUrl,
      platform: companies.platform,
    })
    .from(postings)
    .leftJoin(companies, eq(companies.slug, postings.companySlug))
    .where(eq(postings.id, id))
    .limit(1);

  if (!posting) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const history = await database
    .select({
      score: livenessObservations.score,
      verdict: livenessObservations.verdict,
      reasons: livenessObservations.reasons,
      provenGhost: livenessObservations.provenGhost,
      presentInAuthoritative: livenessObservations.presentInAuthoritative,
      absentSince: livenessObservations.absentSince,
      applyUrlDead: livenessObservations.applyUrlDead,
      repostCount: livenessObservations.repostCount,
      observedAt: livenessObservations.observedAt,
    })
    .from(livenessObservations)
    .where(eq(livenessObservations.postingId, id))
    .orderBy(desc(livenessObservations.observedAt));

  const latest = history[0];

  return NextResponse.json({
    ...posting,
    postedAt: posting.postedAt?.toISOString() ?? null,
    firstSeenAt: posting.firstSeenAt.toISOString(),
    lastSeenAt: posting.lastSeenAt.toISOString(),
    liveness: latest
      ? {
          score: latest.score,
          verdict: latest.verdict,
          provenGhost: latest.provenGhost,
          reasons: safeReasons(latest.reasons),
          presentInAuthoritative: latest.presentInAuthoritative,
          absentSince: latest.absentSince?.toISOString() ?? null,
          applyUrlDead: latest.applyUrlDead,
          repostCount: latest.repostCount,
        }
      : null,
    history: history.map((row) => ({
      score: row.score,
      verdict: row.verdict,
      observedAt: row.observedAt.toISOString(),
    })),
  });
}

function safeReasons(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}
