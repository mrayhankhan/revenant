'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';

interface Posting {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remotePolicy: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string | null;
  applyUrl: string | null;
  liveness: {
    score: number;
    verdict: 'live' | 'aging' | 'stale' | 'ghost';
    provenGhost: boolean;
    reasons: string[];
  };
}

export default function ListingPage({ params }: { params: { id: string } }) {
  const [posting, setPosting] = useState<Posting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from the postings API and filter by ID
    fetch('/api/postings')
      .then((res) => res.json())
      .then((postings) => {
        const found = postings.find((p: Posting) => p.id === params.id);
        setPosting(found || null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  if (!posting) return <div>Posting not found</div>;

  return (
    <div className="space-y-8">
      <Link href="/feed" className="text-sm font-medium text-live hover:underline">
        ← Back to feed
      </Link>

      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold">{posting.title}</h1>
              <p className="mt-2 text-xl text-gray-600">{posting.company}</p>
            </div>
            <span className={clsx('liveness-badge text-lg', posting.liveness.verdict)}>
              {posting.liveness.score}
            </span>
          </div>

          <div className="decay-bar mb-4" className={clsx('decay-bar', posting.liveness.verdict)} />

          <div className="grid gap-4 sm:grid-cols-2">
            {posting.location && (
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-medium">{posting.location}</p>
              </div>
            )}
            {posting.remotePolicy && (
              <div>
                <p className="text-sm text-gray-600">Remote Policy</p>
                <p className="font-medium capitalize">{posting.remotePolicy}</p>
              </div>
            )}
            {posting.salaryMin && posting.salaryMax && (
              <div>
                <p className="text-sm text-gray-600">Compensation</p>
                <p className="font-medium">
                  {posting.salaryCurrency} ${posting.salaryMin.toLocaleString()} –{' '}
                  {posting.salaryMax.toLocaleString()}
                </p>
              </div>
            )}
            {posting.postedAt && (
              <div>
                <p className="text-sm text-gray-600">Posted</p>
                <p className="font-medium">{new Date(posting.postedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-3 font-semibold">Liveness Assessment</h2>
          <div className="space-y-2">
            {posting.liveness.provenGhost && (
              <p className="text-sm font-semibold text-red-700">
                ⚠️ Proven dead: removed from the company's own job board
              </p>
            )}
            {posting.liveness.reasons.map((reason, i) => (
              <p key={i} className="text-sm text-gray-700">
                • {reason}
              </p>
            ))}
          </div>
        </div>

        {posting.applyUrl && (
          <a
            href={posting.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-live px-6 py-3 font-semibold text-white hover:bg-green-600"
          >
            Apply Now →
          </a>
        )}
      </div>
    </div>
  );
}
