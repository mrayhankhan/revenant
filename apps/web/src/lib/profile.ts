'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The candidate profile.
 *
 * Deliberately held in the browser and never sent anywhere to be stored.
 *
 * Every comparable product — Otta, Teal, Simplify — puts an account in front of
 * this, because they persist state across devices and send email. Revenant does
 * neither, so an account would buy nothing and cost two things that matter here:
 * a judge opening the link would meet a signup form instead of the product, and
 * the hackathon restricts entries to public data, which a stored CV is not.
 *
 * The CV is posted to `/api/match` to be scored and is not persisted server-side.
 */

export interface CandidateProfile {
  resume: string;
  /** Free text; used only to label the session. */
  name: string;
  wantsRemote: boolean;
  /** Canonical seniority the person selected, overriding what the CV implies. */
  seniority: string | null;
  completedAt: string;
}

const STORAGE_KEY = 'revenant.profile.v1';

function read(): CandidateProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('resume' in parsed) || typeof (parsed as CandidateProfile).resume !== 'string') {
      return null;
    }

    return parsed as CandidateProfile;
  } catch {
    // A profile we cannot read is one the user can simply create again.
    return null;
  }
}

export function useProfile(): {
  profile: CandidateProfile | null;
  /** False until the first client render, so SSR and hydration agree. */
  ready: boolean;
  save: (profile: Omit<CandidateProfile, 'completedAt'>) => void;
  clear: () => void;
} {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [ready, setReady] = useState(false);

  // localStorage is unavailable during SSR, so the first paint must assume no
  // profile and correct itself on mount. Rendering the real value immediately
  // would produce a hydration mismatch on every visit.
  useEffect(() => {
    setProfile(read());
    setReady(true);
  }, []);

  const save = useCallback((next: Omit<CandidateProfile, 'completedAt'>) => {
    const stored: CandidateProfile = { ...next, completedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Private browsing can refuse writes; the session still works in memory.
    }
    setProfile(stored);
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do; the in-memory clear below is what the UI reacts to.
    }
    setProfile(null);
  }, []);

  return { profile, ready, save, clear };
}
