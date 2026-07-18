/**
 * Google Places discovery adapter.
 *
 * The architecture boundary (CLAUDE.md): **Google Places *discovers* public
 * candidate places; Gemma *reasons* about them privately.** This file is the only
 * place that talks to Google. It never leaks a raw Places object upward — every
 * result is normalized into `PlaceCandidate` (`gemmaTypes.ts`) before anything
 * else, including Gemma, sees it.
 *
 * Resilience is a feature (CLAUDE.md): with **no API key** — or on any network /
 * parse error — this degrades to targets *derived from the owner's own profile*
 * (services/localCandidates.ts), so the whole flow still runs offline and stays
 * centered on their business. `getPlaceCandidates` never throws to its callers.
 *
 * Uses the **new Places API (v1)** Text Search endpoint
 * (`POST /v1/places:searchText`), which lets us issue one semantic query per
 * opportunity category, biased to a circle around the owner's location.
 */

import { coerceCategory } from './gemma';
import {
  OPPORTUNITY_CATEGORIES,
  type BusinessAnalysis,
  type BusinessProfileInput,
  type OpportunityCategory,
  type PlaceCandidate,
} from './gemmaTypes';
import { synthesizeCandidates } from './localCandidates';

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const METERS_PER_MILE = 1609.34;
/** Places API caps the locationBias circle radius at 50 km. */
const MAX_RADIUS_METERS = 50_000;

/**
 * All knobs come from `EXPO_PUBLIC_*` env (inlined by Metro; also readable in
 * Node for the eval harness). With no key the app is fully usable on demo data,
 * so this is genuinely optional config.
 */
export const PlacesConfig = {
  apiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '',
  baseUrl: process.env.EXPO_PUBLIC_GOOGLE_PLACES_BASE_URL ?? 'https://places.googleapis.com/v1',
  /** Live discovery only runs when a key is present AND it isn't force-disabled. */
  get enabled(): boolean {
    return this.apiKey.trim().length > 0 && process.env.EXPO_PUBLIC_PLACES_ENABLED !== 'false';
  },
  /** Per-request ceiling. Text Search is fast; keep this tight so it never hangs. */
  timeoutMs: Number(process.env.EXPO_PUBLIC_GOOGLE_PLACES_TIMEOUT_MS ?? 8000),
  /**
   * Results returned to the caller after dedupe + distance sort. Kept small
   * enough that an on-device model can rank ALL of them with full reasoning
   * (reasons + evidence + confidence per item) inside one bounded generation.
   */
  maxResults: Number(process.env.EXPO_PUBLIC_GOOGLE_PLACES_MAX_RESULTS ?? 6),
  /** How many hits to take from each per-category query before merging. */
  maxPerCategory: 4,
} as const;

/**
 * Default semantic Text Search query per opportunity category. When Gemma has
 * analyzed the business, its target segments override these with sharper,
 * business-specific queries (see `queriesFor`). The category we searched under
 * is what the resulting candidate is tagged with (Google's own `types` are a
 * fallback via `coerceCategory`).
 */
const CATEGORY_QUERIES: Record<OpportunityCategory, string> = {
  recurring: 'office park or car dealership or property management company',
  partnership: 'busy local business or apartment complex',
  event: 'sports complex or event venue or farmers market',
  direct: 'busy shopping center or plaza',
};

/**
 * One (category, query) pair per search. Priority: Gemma's target segments
 * (sharpest — written for THIS business) → the customer hangouts the owner
 * named in the interview → generic category defaults.
 */
function queriesFor(
  profile: BusinessProfileInput,
  analysis?: BusinessAnalysis,
): { category: OpportunityCategory; query: string }[] {
  const segments = analysis?.targetSegments ?? [];
  const fromSegments = segments
    // Gemma's explicit Maps phrase is the sharpest query; prose is last resort.
    .map((s) => ({ category: s.category, query: s.mapsQuery || stripSearchVerbs(s.discovery) || s.label }))
    .filter((q) => q.query.trim().length > 3)
    .slice(0, 4);
  if (fromSegments.length >= 2) return fromSegments;

  const categories = analysis?.recommendedCategories?.length
    ? analysis.recommendedCategories
    : [...OPPORTUNITY_CATEGORIES];

  const customer = 'customer' in profile ? (profile as { customer?: { locations?: string[] } }).customer : undefined;
  const fromLocations = (customer?.locations ?? [])
    .filter((l) => l.trim().length > 3)
    .slice(0, 4)
    .map((query, i) => ({ category: categories[i % categories.length], query }));
  if (fromLocations.length >= 2) return fromLocations;

  return categories.map((category) => ({ category, query: CATEGORY_QUERIES[category] }));
}

/** "Search Maps for office parks nearby" → "office parks" (better text query). */
function stripSearchVerbs(discovery: string): string {
  return discovery
    .replace(/^(search|check|look|browse|find)\b[^]*?\bfor\b/i, '')
    .replace(/\b(on|via|using)\s+(google\s*)?maps\b/gi, '')
    .replace(/\b(nearby|near you|in your (radius|area))\b\.?$/i, '')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Public result type                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Discovery provenance — deliberately NOT the reasoning-layer `InferenceMeta`.
 * Places *discovers*; it doesn't reason. `source` lets the UI honestly badge
 * "found via Google" vs "derived from your profile", keeping the layers distinct.
 */
export interface PlacesResult {
  candidates: PlaceCandidate[];
  source: 'live' | 'derived';
  /** Human-readable reason we derived targets locally, when we did. */
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Fetch (new Places API v1 Text Search)                                      */
/* -------------------------------------------------------------------------- */

/** Just the fields we normalize — a partial view of the v1 Place resource. */
interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

/** The comma-separated field mask — we only ever request what we normalize. */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.websiteUri',
].join(',');

/**
 * One Text Search call, biased to a circle around the owner. Mirrors the fetch
 * idiom in `gemma.ts` (AbortController + timeout in try/finally; throw on !ok).
 * Injectable via `setPlacesSearch` so the eval harness can exercise normalization
 * without the network.
 */
async function searchTextLive(query: string, profile: BusinessProfileInput): Promise<RawPlace[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PlacesConfig.timeoutMs);
  const radius = Math.min(profile.serviceRadiusMiles * METERS_PER_MILE, MAX_RADIUS_METERS);
  try {
    const res = await fetch(`${PlacesConfig.baseUrl}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PlacesConfig.apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      signal: controller.signal,
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: PlacesConfig.maxPerCategory,
        // No bias when the profile has no resolved location yet (e.g. geocoding).
        ...(radius > 0
          ? {
              locationBias: {
                circle: {
                  center: { latitude: profile.latitude, longitude: profile.longitude },
                  radius,
                },
              },
            }
          : {}),
      }),
    });
    if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
    const json = (await res.json()) as { places?: RawPlace[] };
    return json.places ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/** Swap this to route discovery through a fixture (eval harness / tests). */
let searchText: (query: string, profile: BusinessProfileInput) => Promise<RawPlace[]> = searchTextLive;
export function setPlacesSearch(next: typeof searchText) {
  searchText = next;
}

/* -------------------------------------------------------------------------- */
/* Normalization (raw Google → PlaceCandidate; the boundary)                  */
/* -------------------------------------------------------------------------- */

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in miles. No such helper existed in the repo. */
export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Turn a `primaryType` like "brewery" into a short grounding note. */
function contextFrom(raw: RawPlace): string | undefined {
  const t = raw.primaryType?.replace(/_/g, ' ').trim();
  return t ? t : undefined;
}

/**
 * Normalize a raw v1 place into our domain model. Returns null when the place is
 * missing anything we require (id, name, coords) — the boundary that guarantees
 * no partial/raw object ever escapes.
 */
export function normalizePlace(
  raw: RawPlace,
  category: OpportunityCategory,
  profile: BusinessProfileInput,
): PlaceCandidate | null {
  const id = raw.id?.trim();
  const name = raw.displayName?.text?.trim();
  const latitude = raw.location?.latitude;
  const longitude = raw.location?.longitude;
  if (!id || !name || typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const distanceMiles =
    Math.round(haversineMiles(profile.latitude, profile.longitude, latitude, longitude) * 10) / 10;

  return {
    id,
    name,
    // Trust the category we searched under; only override if Google's types map
    // onto a *different* one of our closed categories.
    category: coerceCategory(raw.primaryType) ?? coerceCategory(raw.types?.[0]) ?? category,
    latitude,
    longitude,
    address: raw.formattedAddress?.trim() ?? '',
    distanceMiles,
    context: contextFrom(raw),
    rating: typeof raw.rating === 'number' ? raw.rating : undefined,
    reviewCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : undefined,
    phone: raw.nationalPhoneNumber?.trim() || undefined,
    website: raw.websiteUri?.trim() || undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Discover candidate places for a business. Runs one Text Search per target
 * (segment-driven when Gemma has analyzed the business), normalizes, de-dupes
 * by id, sorts by distance, and caps. Degrades to targets synthesized from the
 * owner's own profile when there's no key or on any error — never throws.
 */
export async function getPlaceCandidates(
  profile: BusinessProfileInput,
  analysis?: BusinessAnalysis,
): Promise<PlacesResult> {
  if (!PlacesConfig.enabled) {
    return {
      candidates: synthesizeCandidates(profile, analysis),
      source: 'derived',
      note: 'No Google Places key configured; targets derived from your profile.',
    };
  }

  try {
    // One query per target, in parallel; a single failure can't sink the batch.
    const settled = await Promise.allSettled(
      queriesFor(profile, analysis).map(async ({ category, query }) => {
        const places = await searchText(query, profile);
        return places
          .map((p) => normalizePlace(p, category, profile))
          .filter((c): c is PlaceCandidate => c !== null);
      }),
    );

    const byId = new Map<string, PlaceCandidate>();
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      for (const candidate of outcome.value) {
        if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
      }
    }

    const candidates = [...byId.values()]
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, PlacesConfig.maxResults);

    if (!candidates.length) {
      return {
        candidates: synthesizeCandidates(profile, analysis),
        source: 'derived',
        note: 'Places returned no usable results; targets derived from your profile.',
      };
    }

    return { candidates, source: 'live' };
  } catch (err) {
    return {
      candidates: synthesizeCandidates(profile, analysis),
      source: 'derived',
      note: `Places discovery failed (${describeError(err)}); targets derived from your profile.`,
    };
  }
}

/**
 * Best-effort city → coordinates via the same Text Search endpoint. Returns
 * null without a key or on any failure — callers treat location as optional.
 */
export async function geocodeCity(
  city: string,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!PlacesConfig.enabled || !city.trim()) return null;
  try {
    const results = await searchText(city.trim(), {
      name: '',
      type: '',
      city,
      latitude: 0,
      longitude: 0,
      serviceRadiusMiles: 0,
      goals: [],
      capabilities: [],
    });
    const loc = results[0]?.location;
    return typeof loc?.latitude === 'number' && typeof loc?.longitude === 'number'
      ? { latitude: loc.latitude, longitude: loc.longitude }
      : null;
  } catch {
    return null;
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'AbortError' ? `timed out after ${PlacesConfig.timeoutMs}ms` : err.message;
  }
  return 'unknown error';
}
