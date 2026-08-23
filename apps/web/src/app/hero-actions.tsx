'use client';

import { useProfile } from '../lib/profile';

/**
 * The entry point, which depends on whether this browser already holds a CV.
 *
 * A returning visitor should land in their feed rather than be asked to
 * introduce themselves again, and a judge with no interest in onboarding should
 * be one click from the product. Neither path involves an account.
 */
export function HeroActions(): React.ReactElement {
  const { profile, ready } = useProfile();

  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <a href={ready && profile ? '/feed' : '/start'} className="btn">
        {ready && profile ? 'Back to your matches' : 'Get started'}
      </a>
      <a href="/feed" className="btn btn-quiet">
        Browse without a CV
      </a>
      <a href="/health" className="btn btn-quiet">
        Collector health
      </a>
    </div>
  );
}
