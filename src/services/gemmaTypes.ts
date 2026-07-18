/**
 * Domain types for the on-device reasoning layer.
 *
 * These are the *target* domain models from IMPLEMENTATION_PLAN.md — the reasoning
 * layer speaks them directly so the rest of the app can migrate onto them screen by
 * screen without waiting on a big-bang type change in `src/types.ts`.
 *
 * Nothing here is a raw Google Places object: Places *discovers* candidates, which
 * we normalize into `PlaceCandidate` before Gemma ever sees them. Gemma *reasons*
 * about those candidates privately. Keep that boundary intact.
 */

export type OpportunityCategory = 'partnership' | 'lunch' | 'catering' | 'event';

export const OPPORTUNITY_CATEGORIES: readonly OpportunityCategory[] = [
  'partnership',
  'lunch',
  'catering',
  'event',
] as const;

export type OutreachChannel = 'email' | 'phone' | 'walk-in';
export type OutreachTone = 'friendly' | 'professional' | 'direct';

/** The user's business — captured in the interview, reused everywhere. */
export interface BusinessProfileInput {
  name: string;
  /** e.g. "taco truck", "mobile detailer". */
  type: string;
  description?: string;
  city: string;
  latitude: number;
  longitude: number;
  serviceRadiusMiles: number;
  /** Free text, e.g. "weekdays 10a–8p, some weekends". */
  availability?: string;
  goals: string[];
  capabilities: string[];
}

/**
 * A candidate place, already normalized out of Google Places (or seeded demo
 * data). This is the grounding Gemma reasons over — never a raw API object.
 */
export interface PlaceCandidate {
  id: string;
  name: string;
  category: OpportunityCategory;
  latitude: number;
  longitude: number;
  address: string;
  distanceMiles: number;
  /** Optional grounding context, e.g. "office park · ~400 employees". */
  context?: string;
}

/** Gemma's read on the business — feeds opportunity ranking. */
export interface BusinessAnalysis {
  summary: string;
  strengths: string[];
  /** The single growth focus for today, in the owner's language. */
  focus: string;
  recommendedCategories: OpportunityCategory[];
}

/** One ranked, reasoned opportunity. Surfaced to the UI; no chain-of-thought. */
export interface RankedOpportunity {
  id: string;
  name: string;
  category: OpportunityCategory;
  /** 0–100. */
  score: number;
  latitude: number;
  longitude: number;
  address: string;
  distanceMiles: number;
  bestTime: string;
  summary: string;
  reasons: string[];
  risks: string[];
  recommendedAction: string;
  estimatedValue?: string;
}

export interface OutreachDraft {
  channel: OutreachChannel;
  tone: OutreachTone;
  subject?: string;
  body: string;
}

/**
 * Provenance stamped on every reasoning result so the UI can prove *where* the
 * answer came from (rubric §4 on-device verification) and the eval harness can
 * report metrics (rubric §5).
 */
export interface InferenceMeta {
  /** Did real on-device Gemma answer, or the deterministic fallback? */
  source: 'gemma' | 'fallback';
  model: string;
  /** Wall-clock for the reasoning call, milliseconds. */
  latencyMs: number;
  /** Did the model's JSON pass schema validation? (false ⇒ we repaired/fell back.) */
  validated: boolean;
  /** Human-readable reason we fell back, when we did. */
  note?: string;
}

export type WithMeta<T> = { data: T; meta: InferenceMeta };
