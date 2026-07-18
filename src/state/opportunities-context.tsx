/**
 * Shared state for today's ranked growth plan — the live discovery→reasoning
 * pipeline behind one store.
 *
 * `load()` is the whole architecture in miniature: **Google Places discovers**
 * candidate places, then **Gemma privately reasons** over them to produce a
 * ranked list. Screens read `ranked` here instead of the legacy mock, and can
 * prove provenance from `placesSource` (live vs demo) and `rankMeta` (on-device
 * Gemma vs deterministic fallback). In-memory only; no persistence (CLAUDE.md).
 *
 * Resilience: any unexpected failure degrades to the deterministic ranker over
 * demo candidates and still lands in `ready` — the UI never hangs.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
  analyzeBusiness,
  rankOpportunities,
  type BusinessAnalysis,
  type BusinessProfileInput,
  type InferenceMeta,
  type RankedOpportunity,
} from '@/services/gemma';
import { synthesizeCandidates } from '@/services/localCandidates';
import { analyzeBusinessLocal, rankOpportunitiesLocal } from '@/services/opportunityRanking';
import { getPlaceCandidates, type PlacesResult } from '@/services/places';

interface OpportunitiesState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  ranked: RankedOpportunity[];
  /** Where the candidate places came from (Google vs bundled demo). */
  placesSource: PlacesResult['source'] | null;
  /** Provenance of the ranking (on-device Gemma vs deterministic fallback). */
  rankMeta: InferenceMeta | null;
  /** The currently focused opportunity (card ↔ pin selection). */
  selectedId: string | null;
  /**
   * Run discovery → reasoning for a profile. Pass a precomputed `analysis` (e.g.
   * from the analysis screen) to skip the extra `analyzeBusiness` call.
   */
  load: (profile: BusinessProfileInput, analysis?: BusinessAnalysis) => Promise<void>;
  select: (id: string) => void;
  reset: () => void;
}

const OpportunitiesContext = createContext<OpportunitiesState | null>(null);

export function OpportunitiesProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<OpportunitiesState['status']>('idle');
  const [ranked, setRanked] = useState<RankedOpportunity[]>([]);
  const [placesSource, setPlacesSource] = useState<PlacesResult['source'] | null>(null);
  const [rankMeta, setRankMeta] = useState<InferenceMeta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (profile: BusinessProfileInput, analysis?: BusinessAnalysis) => {
    setStatus('loading');
    try {
      // 1. Gemma reads the business (unless the caller already did) — its target
      //    segments sharpen what discovery searches for.
      const businessAnalysis = analysis ?? (await analyzeBusiness(profile)).data;

      // 2. Google discovers candidate places (falls back to profile-derived
      //    targets on its own).
      const { candidates, source } = await getPlaceCandidates(profile, businessAnalysis);
      setPlacesSource(source);

      // 3. Gemma privately ranks the discovered places.
      const { data, meta } = await rankOpportunities(profile, businessAnalysis, candidates);
      setRanked(data);
      setRankMeta(meta);
      setSelectedId(data[0]?.id ?? null);
      setStatus('ready');
    } catch {
      // Last-resort safety net: deterministic ranking over profile-derived
      // targets so the plan still renders. The individual services already fall
      // back internally; this guards against anything unexpected in orchestration.
      const localAnalysis = analysis ?? analyzeBusinessLocal(profile);
      const fallback = rankOpportunitiesLocal(
        profile,
        localAnalysis,
        synthesizeCandidates(profile, localAnalysis),
      );
      setRanked(fallback);
      setPlacesSource('derived');
      setRankMeta(null);
      setSelectedId(fallback[0]?.id ?? null);
      setStatus('ready');
    }
  }, []);

  const select = useCallback((id: string) => setSelectedId(id), []);

  const reset = useCallback(() => {
    setStatus('idle');
    setRanked([]);
    setPlacesSource(null);
    setRankMeta(null);
    setSelectedId(null);
  }, []);

  const value = useMemo(
    () => ({ status, ranked, placesSource, rankMeta, selectedId, load, select, reset }),
    [status, ranked, placesSource, rankMeta, selectedId, load, select, reset],
  );

  return <OpportunitiesContext.Provider value={value}>{children}</OpportunitiesContext.Provider>;
}

export function useOpportunities(): OpportunitiesState {
  const ctx = useContext(OpportunitiesContext);
  if (!ctx) throw new Error('useOpportunities must be used within an OpportunitiesProvider');
  return ctx;
}
