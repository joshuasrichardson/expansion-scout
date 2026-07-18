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

/**
 * Opportunity categories are keyed by the SHAPE of the revenue, not by any one
 * industry, so they hold for a taco truck and a mobile detailer alike:
 *   • recurring   — standing accounts/contracts (fleets, offices, property mgrs)
 *   • partnership — venues/orgs to co-serve or co-market with
 *   • event       — gatherings with high volume in a short window
 *   • direct      — high-traffic spots to serve individuals on the spot
 */
export type OpportunityCategory = 'recurring' | 'partnership' | 'event' | 'direct';

export const OPPORTUNITY_CATEGORIES: readonly OpportunityCategory[] = [
  'recurring',
  'partnership',
  'event',
  'direct',
] as const;

export type OutreachChannel = 'email' | 'phone' | 'walk-in';
export type OutreachTone = 'friendly' | 'professional' | 'direct';

/** The user's business — captured in the interview, reused everywhere. */
export interface BusinessProfileInput {
  name: string;
  /** The owner's name — how outreach introduces the person (not the company). */
  ownerName?: string;
  /** e.g. "taco truck", "mobile detailer". */
  type: string;
  description?: string;
  city: string;
  /** Street address, when given — geocoded to center the map precisely. */
  address?: string;
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
  /** Public reputation signals from discovery — real evidence for the ranking. */
  rating?: number;
  reviewCount?: number;
  /** Contactability — lets "recommended action" become a one-tap call. */
  phone?: string;
  website?: string;
}

/**
 * Bounds on the adaptive interview, enforced in code (not just the prompt) so a
 * small model can never quit after one answer or loop forever. Below MIN we ask
 * again even if Gemma says done; at MAX we force done. MIN == MAX pins the
 * interview to an exact length — the demo-friendly setting, since every run
 * takes the same, predictable number of turns.
 */
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 3;

/** One completed Q/A exchange in the adaptive discovery interview. */
export interface InterviewTurn {
  question: string;
  answer: string;
}

/**
 * Gemma's decision after each answer: ask one more focused question, or stop
 * because it can already infer the business and its ideal customer well enough
 * to run good place searches.
 */
export interface InterviewDecision {
  done: boolean;
  /** The next question to ask, when `done` is false. */
  question?: string;
  /** Example-answer hint for the input, when `done` is false. */
  placeholder?: string;
}

/**
 * Gemma's inferred picture of the ideal customer — the bridge from the interview
 * to good place searches. `locations` are the physical-place search seeds.
 */
export interface CustomerProfile {
  /** Who needs this — the ideal customer in one line. */
  description: string;
  /** How to recognize them / signals they need help now. */
  signals: string[];
  /** Where they physically congregate — seeds for place discovery. */
  locations: string[];
  /** How to reach them (channels, venues, intros). */
  outreach: string[];
}

/**
 * What a completed interview yields: a full business profile plus the inferred
 * customer picture, ready to feed `analyzeBusiness` and place search.
 */
export interface InterviewProfile extends BusinessProfileInput {
  customer: CustomerProfile;
}

/**
 * Curated prospect archetypes for field/local operators, keyed by HOW a customer
 * is *found* and *reached* (discoverability + contactability) rather than by
 * industry. This is what lets Gemma pick a discovery strategy and an outreach
 * channel per kind of customer.
 */
export type CustomerSegmentType =
  | 'physical-business' // offices, breweries, retail — find on Maps, reach walk-in/phone
  | 'residential-community' // apartments, HOAs — find on Maps, reach the property manager
  | 'event-venue' // sports complexes, resorts, wedding venues — Maps/listings, reach email/phone
  | 'public-gathering' // farmers markets, festivals, tournaments — event calendars/social, reach organizer
  | 'partner-org'; // complementary local orgs to co-market with — Maps, reach walk-in

export const CUSTOMER_SEGMENT_TYPES: readonly CustomerSegmentType[] = [
  'physical-business',
  'residential-community',
  'event-venue',
  'public-gathering',
  'partner-org',
] as const;

/**
 * One *kind* of customer Gemma decides to look for, with the discovery and reach
 * strategy that follows from its type. `category` bridges the segment to the
 * place-search + ranking layer so "who to look for" shapes "where to go."
 */
export interface CustomerSegment {
  /** Human label, e.g. "Nearby office campuses". */
  label: string;
  type: CustomerSegmentType;
  /** Who they are, in one line. */
  whoTheyAre: string;
  /** How to FIND them (Maps / event calendars / social) — discoverability. */
  discovery: string;
  /**
   * The literal 2–5 word phrase to type into Google Maps to find this segment
   * nearby (e.g. "property management offices"). Drives live discovery.
   */
  mapsQuery?: string;
  /** How to REACH them — contactability. */
  reach: OutreachChannel;
  /** Why they fit this business right now. */
  why: string;
  category: OpportunityCategory;
}

/** Gemma's read on the business — feeds opportunity ranking. */
export interface BusinessAnalysis {
  summary: string;
  strengths: string[];
  /** The single growth focus for today, in the owner's language. */
  focus: string;
  recommendedCategories: OpportunityCategory[];
  /** The kinds of customers to look for, typed by how they're found & reached. */
  targetSegments: CustomerSegment[];
}

/**
 * One ranked, reasoned opportunity. Surfaced to the UI; no chain-of-thought —
 * instead a simple, transparent trail: WHY it fits (`reasons`), WHAT that rests
 * on (`evidence` — only facts present in the candidate/profile data), what
 * could go wrong (`risks`), and how sure Scout is (`confidence`).
 */
export interface RankedOpportunity {
  id: string;
  name: string;
  category: OpportunityCategory;
  /** 0–100 — how strong the opportunity is. */
  score: number;
  /** 0–100 — how sure the reasoning is, given the data it had. */
  confidence: number;
  latitude: number;
  longitude: number;
  address: string;
  distanceMiles: number;
  bestTime: string;
  summary: string;
  /** Why it fits — the argument. */
  reasons: string[];
  /** The observable data points the argument rests on — never invented. */
  evidence: string[];
  risks: string[];
  recommendedAction: string;
  estimatedValue?: string;
  /** Carried through from discovery — enables one-tap call / website actions. */
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
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

/**
 * Live progress events emitted while a reasoning call runs. Every event marks
 * something that ACTUALLY happened — a pipeline stage starting, a JSON field
 * appearing in the model's token stream, a segment name streaming in — never a
 * timer-driven animation pretending to be work. The thinking screens render
 * these as they arrive, which is what makes "watch Gemma reason live" honest.
 */
export type ReasoningEvent =
  /** A new stage began; any previous stage is implicitly complete. */
  | { type: 'step'; label: string }
  /** The current stage's label changed in place (e.g. a live counter). */
  | { type: 'update'; label: string }
  /** A discovery inside the current stage (e.g. a target segment Gemma just named). */
  | { type: 'note'; label: string }
  /** Cumulative model tokens streamed so far in this call. */
  | { type: 'tokens'; count: number }
  /** The call finished; `source` says who actually answered. */
  | { type: 'done'; source: InferenceMeta['source']; latencyMs: number; label: string };

export type ReasoningProgress = (event: ReasoningEvent) => void;
