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
 * parse error — this degrades to the bundled `demoCandidates`, so the whole flow
 * still runs offline. `getPlaceCandidates` never throws to its callers.
 *
 * Uses the **new Places API (v1)** Text Search endpoint
 * (`POST /v1/places:searchText`), which lets us issue one semantic query per
 * opportunity category, biased to a circle around the owner's location.
 */

import { demoCandidates } from '@/data/demo';

import { coerceCategory } from './gemma';
import {
  OPPORTUNITY_CATEGORIES,
  type BusinessProfileInput,
  type OpportunityCategory,
  type PlaceCandidate,
} from './gemmaTypes';

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
  /** Results returned to the caller after dedupe + distance sort. */
  maxResults: Number(process.env.EXPO_PUBLIC_GOOGLE_PLACES_MAX_RESULTS ?? 10),
  /** How many hits to take from each per-category query before merging. */
  maxPerCategory: 4,
} as const;

/**
 * One semantic Text Search query per opportunity category, tuned for the taco
 * truck persona. The category we searched under is what the resulting candidate
 * is tagged with (Google's own `types` are a fallback via `coerceCategory`).
 */
const CATEGORY_QUERIES: Record<OpportunityCategory, string> = {
  lunch: 'office park or corporate campus',
  partnership: 'brewery or taproom or apartment complex',
  catering: 'corporate event venue or conference center',
  event: 'sports complex or recreation center or event venue',
};

/* -------------------------------------------------------------------------- */
/* Public result type                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Discovery provenance — deliberately NOT the reasoning-layer `InferenceMeta`.
 * Places *discovers*; it doesn't reason. `source` lets the UI honestly badge
 * "found via Google" vs "demo data", keeping the two layers distinct.
 */
export interface PlacesResult {
  candidates: PlaceCandidate[];
  source: 'live' | 'demo';
  /** Human-readable reason we used demo data, when we did. */
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
}

/** The comma-separated field mask — we only ever request what we normalize. */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
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
        locationBias: {
          circle: {
            center: { latitude: profile.latitude, longitude: profile.longitude },
            radius,
          },
        },
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
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Discover candidate places for a business. Runs one Text Search per category,
 * normalizes, de-dupes by id, sorts by distance, and caps. Degrades to the
 * bundled demo candidates when there's no key or on any error — never throws.
 */
export async function getPlaceCandidates(profile: BusinessProfileInput): Promise<PlacesResult> {
  if (!PlacesConfig.enabled) {
    return {
      candidates: demoCandidates,
      source: 'demo',
      note: 'No Google Places key configured; using bundled demo candidates.',
    };
  }

  try {
    // One query per category, in parallel; a single failure can't sink the batch.
    const settled = await Promise.allSettled(
      OPPORTUNITY_CATEGORIES.map(async (category) => {
        const places = await searchText(CATEGORY_QUERIES[category], profile);
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
        candidates: demoCandidates,
        source: 'demo',
        note: 'Places returned no usable candidates; using demo data.',
      };
    }

    return { candidates, source: 'live' };
  } catch (err) {
    return {
      candidates: demoCandidates,
      source: 'demo',
      note: `Places discovery failed (${describeError(err)}); using demo data.`,
    };
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'AbortError' ? `timed out after ${PlacesConfig.timeoutMs}ms` : err.message;
  }
  return 'unknown error';
}
