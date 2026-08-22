import { db, livenessObservations, postings } from '@revenant/core/db/index';
import { matchPosting, parseResume, tailoringSuggestions } from '@revenant/core/match/resume';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Cap the corpus scored per request so a paste stays interactive. */
const CANDIDATE_LIMIT = 1500;

/**
 * Rank live postings against a résumé.
 *
 * Two things this deliberately does not do.
 *
 * It does not call a model. Matching is a set intersection over a curated skill
 * vocabulary, which means it runs over the whole corpus in milliseconds, costs
 * nothing per posting, and can point at the exact skill behind every score. A
 * job seeker is being asked to act on this; an opaque similarity number is not
 * something you can act on.
 *
 * It does not rank dead jobs. Liveness gates the results before matching, so a
 * perfect skill match for a role that was filled in April never reaches the top
 * of the list — which is the entire reason this project exists.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);

  const resumeText =
    typeof body === 'object' && body !== null && 'resume' in body
      ? String((body as { resume: unknown }).resume)
      : '';

  if (resumeText.trim().length < 40) {
    return NextResponse.json(
      { error: 'Paste a little more of your CV — at least a couple of lines.' },
      { status: 400 },
    );
  }

  const profile = parseResume(resumeText);
  const database = db();

  const latest = database
    .select({
      postingId: livenessObservations.postingId,
      observedAt: sql<number>`max(${livenessObservations.observedAt})`.as('latest_observed_at'),
    })
    .from(livenessObservations)
    .groupBy(livenessObservations.postingId)
    .as('latest');

  const rows = await database
    .select({
      id: postings.id,
      title: postings.title,
      company: postings.company,
      location: postings.location,
      remotePolicy: postings.remotePolicy,
      salaryMin: postings.salaryMin,
      salaryMax: postings.salaryMax,
      salaryCurrency: postings.salaryCurrency,
      employmentType: postings.employmentType,
      postedAt: postings.postedAt,
      descriptionHtml: postings.descriptionHtml,
      applyUrl: postings.applyUrl,
      sourceKey: postings.sourceKey,
      sourceUrl: postings.sourceUrl,
      score: livenessObservations.score,
      verdict: livenessObservations.verdict,
      provenGhost: livenessObservations.provenGhost,
    })
    .from(postings)
    .innerJoin(latest, eq(latest.postingId, postings.id))
    .innerJoin(
      livenessObservations,
      sql`${livenessObservations.postingId} = ${postings.id} and ${livenessObservations.observedAt} = ${latest.observedAt}`,
    )
    .limit(CANDIDATE_LIMIT);

  const scored = rows
    // A proven ghost is never worth surfacing, however well it matches.
    .filter((row) => !row.provenGhost)
    .map((row) => {
      const raw = {
        sourceKey: row.sourceKey,
        sourceUrl: row.sourceUrl,
        title: row.title,
        company: row.company,
        location: row.location,
        remotePolicy: row.remotePolicy as never,
        salaryMin: row.salaryMin,
        salaryMax: row.salaryMax,
        salaryCurrency: row.salaryCurrency,
        employmentType: row.employmentType as never,
        postedAt: row.postedAt,
        descriptionHtml: row.descriptionHtml,
        applyUrl: row.applyUrl,
      };

      const match = matchPosting(profile, raw);

      return {
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        remotePolicy: row.remotePolicy,
        salaryMin: row.salaryMin,
        salaryMax: row.salaryMax,
        salaryCurrency: row.salaryCurrency,
        postedAt: row.postedAt?.toISOString() ?? null,
        applyUrl: row.applyUrl,
        liveness: { score: row.score, verdict: row.verdict },
        match: {
          score: match.score,
          matched: match.matched,
          missing: match.missing,
          reasons: match.reasons,
        },
        tailoring: tailoringSuggestions(profile, raw, 4),
      };
    })
    // Freshness breaks ties: between two equal matches, the one more likely to
    // still be open wins.
    .sort((a, b) => b.match.score - a.match.score || b.liveness.score - a.liveness.score);

  /*
   * Collapse repeats before returning.
   *
   * Cross-source dedup runs at ingest, but a company that lists the same role
   * in several offices produces genuinely distinct rows that are identical from
   * a candidate's point of view once ranked. Showing "Forward Deployed
   * Engineer" three times pushes real alternatives off the list.
   */
  const seen = new Set<string>();
  const unique = scored.filter((result) => {
    const key = `${result.company ?? ''}|${result.title ?? ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const results = unique.slice(0, 40);

  return NextResponse.json({
    profile: {
      skills: [...profile.skills],
      seniority: profile.seniority,
      years: profile.years,
      wantsRemote: profile.wantsRemote,
    },
    scanned: rows.length,
    results,
  });
}
