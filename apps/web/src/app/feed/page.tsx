'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface Posting {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  liveness: {
    score: number;
    verdict: 'live' | 'aging' | 'stale' | 'ghost';
    provenGhost: boolean;
  };
  applyUrl: string | null;
  postedAt: string | null;
}

export default function FeedPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [filter, setFilter] = useState<'all' | 'live' | 'aging' | 'stale' | 'ghost'>('all');

  useEffect(() => {
    fetch('/api/postings')
      .then((res) => res.json())
      .then(setPostings)
      .catch(console.error);
  }, []);

  const filtered =
    filter === 'all' ? postings : postings.filter((p) => p.liveness.verdict === filter);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Job Feed</h1>
        <div className="flex gap-2">
          {(['all', 'live', 'aging', 'stale', 'ghost'] as const).map((verdict) => (
            <button
              key={verdict}
              onClick={() => setFilter(verdict)}
              className={clsx(
                'liveness-badge',
                filter === verdict ? `${verdict} ring-2` : 'bg-gray-100 text-gray-700',
              )}
            >
              {verdict === 'all' ? 'All' : verdict} ({filtered.length})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
            No postings in this filter.
          </div>
        ) : (
          filtered.map((posting) => (
            <a
              key={posting.id}
              href={`/listing/${posting.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-6 transition hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{posting.title}</h3>
                  <p className="text-sm text-gray-600">
                    {posting.company}
                    {posting.location && ` • ${posting.location}`}
                  </p>
                </div>
                <span className={clsx('liveness-badge', posting.liveness.verdict)}>
                  {posting.liveness.score}
                </span>
              </div>

              <div className="decay-bar mb-3" className={clsx('decay-bar', posting.liveness.verdict)} />

              {posting.salaryMin && posting.salaryMax && (
                <p className="mb-2 text-sm font-medium text-gray-700">
                  {posting.salaryCurrency} ${posting.salaryMin.toLocaleString()} –{' '}
                  {posting.salaryMax.toLocaleString()}
                </p>
              )}

              {posting.liveness.provenGhost && (
                <p className="text-xs font-semibold text-red-700">
                  ⚠️ Proven dead: removed from {posting.company}'s own job board
                </p>
              )}

              {posting.postedAt && (
                <p className="text-xs text-gray-500">
                  Posted {new Date(posting.postedAt).toLocaleDateString()}
                </p>
              )}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
