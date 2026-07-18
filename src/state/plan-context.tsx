/**
 * Shared state for Today's Plan (T11) — the stops the owner has committed to.
 *
 * Stops are added from the opportunity-details screen ("Add to Today's Plan"),
 * keyed by opportunity id so the same place can never be added twice. Each stop
 * carries a suggested time window and the objective (the opportunity's
 * recommended action), so the plan screen reads as a field itinerary, not a
 * todo list. In-memory only; no persistence (CLAUDE.md).
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { OpportunityCategory, RankedOpportunity } from '@/services/gemma';

export interface PlanStop {
  id: string;
  opportunityId: string;
  name: string;
  category: OpportunityCategory;
  /** Suggested window, e.g. "11:30a – 1:00p". Comes from the opportunity's bestTime. */
  time: string;
  /** What to do there — the opportunity's recommended action. */
  objective: string;
  address: string;
  latitude: number;
  longitude: number;
  travelMinutes: number;
  estimatedValue?: string;
  phone?: string;
  done: boolean;
}

interface PlanState {
  stops: PlanStop[];
  /** True if this opportunity is already on the plan (drives button state). */
  has: (opportunityId: string) => boolean;
  /** Add an opportunity as a stop. No-op if it's already planned. */
  add: (opportunity: RankedOpportunity) => void;
  remove: (stopId: string) => void;
  toggleDone: (stopId: string) => void;
  reset: () => void;
}

const PlanContext = createContext<PlanState | null>(null);

/** ~3 min per mile of city driving — same heuristic as the ranking layer. */
export function travelMinutesFor(distanceMiles: number): number {
  return Math.max(4, Math.round(distanceMiles * 3));
}

function stopFrom(o: RankedOpportunity): PlanStop {
  return {
    id: `stop-${o.id}`,
    opportunityId: o.id,
    name: o.name,
    category: o.category,
    time: o.bestTime,
    objective: o.recommendedAction,
    address: o.address,
    latitude: o.latitude,
    longitude: o.longitude,
    travelMinutes: travelMinutesFor(o.distanceMiles),
    estimatedValue: o.estimatedValue,
    phone: o.phone,
    done: false,
  };
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [stops, setStops] = useState<PlanStop[]>([]);

  const has = useCallback(
    (opportunityId: string) => stops.some((s) => s.opportunityId === opportunityId),
    [stops],
  );

  const add = useCallback((opportunity: RankedOpportunity) => {
    setStops((prev) =>
      prev.some((s) => s.opportunityId === opportunity.id) ? prev : [...prev, stopFrom(opportunity)],
    );
  }, []);

  const remove = useCallback((stopId: string) => {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }, []);

  const toggleDone = useCallback((stopId: string) => {
    setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, done: !s.done } : s)));
  }, []);

  const reset = useCallback(() => setStops([]), []);

  const value = useMemo(
    () => ({ stops, has, add, remove, toggleDone, reset }),
    [stops, has, add, remove, toggleDone, reset],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}
