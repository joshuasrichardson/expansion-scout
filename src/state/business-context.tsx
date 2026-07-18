/**
 * The single source of truth for the owner's business.
 *
 * Everything in the app centers on this: the mission, the interview, analysis,
 * discovery, ranking, and outreach all read the profile from here. It hydrates
 * from the on-device cache at launch (services/profileStore.ts) and writes back
 * on every change — in memory for the session, cached on the device between
 * sessions, never transmitted anywhere.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type {
  BusinessAnalysis,
  BusinessProfileInput,
  InterviewProfile,
} from '@/services/gemma';
import { clearBusiness, loadBusiness, saveBusiness, type StoredBusiness } from '@/services/profileStore';

interface BusinessState {
  /** Null until the owner has set up their business. */
  business: StoredBusiness | null;
  /** False until the launch read of the device cache settles. */
  hydrated: boolean;
  /** The profile with the inferred customer attached, when an interview has run. */
  interviewProfile: InterviewProfile | null;
  /** Create or edit the core profile (profile screen). */
  saveProfile: (profile: BusinessProfileInput) => void;
  /** Persist a completed interview's inferred profile + customer picture. */
  completeInterview: (profile: InterviewProfile) => void;
  /** Persist Gemma's latest analysis so relaunches open with a real mission. */
  setAnalysis: (analysis: BusinessAnalysis) => void;
  /** Forget the business entirely (device cache included). */
  clear: () => void;
}

const BusinessContext = createContext<BusinessState | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [business, setBusiness] = useState<StoredBusiness | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadBusiness()
      .then((stored) => {
        if (!cancelled && stored) setBusiness(stored);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Merge-update against the freshest state, then write the cache. */
  const update = useCallback(
    (mutate: (prev: StoredBusiness | null) => Omit<StoredBusiness, 'updatedAt'> | null) => {
      setBusiness((prev) => {
        const next = mutate(prev);
        if (!next) return prev;
        void saveBusiness(next);
        return { ...next, updatedAt: new Date().toISOString() };
      });
    },
    [],
  );

  const saveProfile = useCallback(
    (profile: BusinessProfileInput) =>
      update((prev) => {
        // Tweaking details keeps Gemma's accumulated understanding; changing
        // WHAT the business is (name/type) must not leak the old business's
        // customer picture or analysis into the new one.
        const sameBusiness =
          !!prev && prev.profile.name === profile.name && prev.profile.type === profile.type;
        return {
          profile,
          customer: sameBusiness ? prev.customer : undefined,
          analysis: sameBusiness ? prev.analysis : undefined,
        };
      }),
    [update],
  );

  const completeInterview = useCallback(
    (profile: InterviewProfile) =>
      update((prev) => {
        const { customer, ...core } = profile;
        return { profile: core, customer, analysis: prev?.analysis };
      }),
    [update],
  );

  const setAnalysis = useCallback(
    (analysis: BusinessAnalysis) =>
      update((prev) => (prev ? { profile: prev.profile, customer: prev.customer, analysis } : null)),
    [update],
  );

  const clear = useCallback(() => {
    setBusiness(null);
    void clearBusiness();
  }, []);

  const interviewProfile = useMemo<InterviewProfile | null>(
    () => (business?.customer ? { ...business.profile, customer: business.customer } : null),
    [business],
  );

  const value = useMemo(
    () => ({ business, hydrated, interviewProfile, saveProfile, completeInterview, setAnalysis, clear }),
    [business, hydrated, interviewProfile, saveProfile, completeInterview, setAnalysis, clear],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness(): BusinessState {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within a BusinessProvider');
  return ctx;
}
