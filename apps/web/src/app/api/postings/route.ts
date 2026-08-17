import { SAMPLE_POSTINGS } from '@revenant/core/fixtures/sample-postings';
import { scoreLiveness } from '@revenant/core/decay/liveness';
import type { DecaySignals } from '@revenant/core/decay/liveness';
import { NextResponse } from 'next/server';

// Mock liveness signals for each posting
const LIVENESS_SIGNALS: Record<string, Partial<DecaySignals>> = {
  'stripe-staff-eng-remote': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 0,
    unchangedVerifications: 0,
  },
  'vercel-frontend-lead': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 0,
    unchangedVerifications: 0,
  },
  'anthropic-security-eng': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 1,
    unchangedVerifications: 3,
  },
  'databricks-data-eng-old': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 2,
    unchangedVerifications: 8,
  },
  'ramp-business-ops': {
    presentInAuthoritative: false,
    absentSince: new Date(Date.now() - 12 * 86_400_000),
    applyUrlDead: false,
    repostCount: 0,
    unchangedVerifications: 0,
  },
  'figma-product-design-404': {
    presentInAuthoritative: true,
    applyUrlDead: true,
    repostCount: 0,
    unchangedVerifications: 2,
  },
  'notion-fullstack-mystery': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 0,
    unchangedVerifications: 1,
  },
  'discord-community-manager-churn': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 4,
    unchangedVerifications: 0,
  },
  'reddit-qa-eternal': {
    presentInAuthoritative: true,
    applyUrlDead: false,
    repostCount: 5,
    unchangedVerifications: 15,
  },
};

export async function GET() {
  const postings = SAMPLE_POSTINGS.map((posting) => {
    const signals: DecaySignals = {
      postedAt: posting.postedAt,
      observedAt: new Date(),
      repostCount: 0,
      unchangedVerifications: 0,
      ...(LIVENESS_SIGNALS[posting.sourceKey] || {}),
    };

    const liveness = scoreLiveness(signals);

    return {
      id: posting.sourceKey,
      title: posting.title,
      company: posting.company,
      location: posting.location,
      remotePolicy: posting.remotePolicy,
      salaryMin: posting.salaryMin,
      salaryMax: posting.salaryMax,
      salaryCurrency: posting.salaryCurrency,
      postedAt: posting.postedAt?.toISOString(),
      applyUrl: posting.applyUrl,
      liveness: {
        score: liveness.score,
        verdict: liveness.verdict,
        provenGhost: liveness.provenGhost,
        reasons: liveness.reasons,
      },
    };
  });

  return NextResponse.json(postings);
}
