/**
 * Derived candidate targets — the offline fallback for place discovery.
 *
 * There is no bundled demo dataset: when Google Places can't answer (no key,
 * airplane mode, error), we synthesize search TARGETS from what the owner has
 * told us — Gemma's target segments, the inferred customer hangouts, or the
 * business's recommended categories. Each is honestly labeled as a kind of
 * place to scout near them ("Office parks near you"), never a fabricated
 * specific business.
 *
 * Placement is deterministic: targets fan out around the owner's location
 * within their service radius, so the schematic map and distances stay
 * meaningful even fully offline.
 */

import {
  OPPORTUNITY_CATEGORIES,
  type BusinessAnalysis,
  type BusinessProfileInput,
  type InterviewProfile,
  type OpportunityCategory,
  type PlaceCandidate,
} from './gemmaTypes';

const MILES_PER_DEGREE_LAT = 69;

/** Generic per-category target labels, used when we know nothing richer. */
const CATEGORY_TARGET: Record<OpportunityCategory, { label: string; context: string }> = {
  recurring: { label: 'Standing-account prospects', context: 'offices, fleets and managed properties that rebook' },
  partnership: { label: 'Partner businesses', context: 'local spots whose customers overlap yours' },
  event: { label: 'Weekend events & gatherings', context: 'high-volume crowds in a short window' },
  direct: { label: 'High-traffic spots', context: 'places your customers already cluster' },
};

interface TargetSeed {
  label: string;
  category: OpportunityCategory;
  context?: string;
}

function seedsFrom(
  profile: BusinessProfileInput | InterviewProfile,
  analysis?: BusinessAnalysis,
): TargetSeed[] {
  // Richest source: Gemma's target segments (who to look for → where to go).
  const fromSegments = (analysis?.targetSegments ?? []).map((s) => ({
    label: s.label,
    category: s.category,
    context: s.discovery || s.whoTheyAre,
  }));
  if (fromSegments.length >= 3) return fromSegments.slice(0, 6);

  // Next: the customer hangouts inferred in the interview.
  const customer = 'customer' in profile ? profile.customer : undefined;
  const categories = analysis?.recommendedCategories?.length
    ? analysis.recommendedCategories
    : [...OPPORTUNITY_CATEGORIES];
  const fromLocations = (customer?.locations ?? []).map((loc, i) => ({
    label: capitalize(loc),
    category: categories[i % categories.length],
    context: customer?.description,
  }));
  const merged = [...fromSegments, ...fromLocations];
  if (merged.length >= 3) return dedupeByLabel(merged).slice(0, 6);

  // Least: one honest target per recommended category.
  const fromCategories = categories.map((c) => ({ ...CATEGORY_TARGET[c], category: c }));
  return dedupeByLabel([...merged, ...fromCategories]).slice(0, 6);
}

/**
 * Synthesize scoutable targets around the owner. `analysis` sharpens the labels
 * when available; without it the targets follow the profile's goals alone.
 */
export function synthesizeCandidates(
  profile: BusinessProfileInput | InterviewProfile,
  analysis?: BusinessAnalysis,
): PlaceCandidate[] {
  const seeds = seedsFrom(profile, analysis);
  const radius = Math.max(profile.serviceRadiusMiles, 2);
  const lngScale = Math.max(0.2, Math.cos((profile.latitude * Math.PI) / 180));

  return seeds.map((seed, i) => {
    // Fan out deterministically: varied bearings, distances inside the radius.
    const bearing = (i * 137.5 * Math.PI) / 180; // golden angle — no clustering
    const distanceMiles = Math.round(radius * (0.25 + 0.55 * ((i % 3) / 2)) * 10) / 10;
    return {
      id: `local-${i + 1}`,
      name: seed.label,
      category: seed.category,
      latitude: profile.latitude + (distanceMiles * Math.cos(bearing)) / MILES_PER_DEGREE_LAT,
      longitude:
        profile.longitude + (distanceMiles * Math.sin(bearing)) / (MILES_PER_DEGREE_LAT * lngScale),
      address: `Within ${Math.max(1, Math.ceil(distanceMiles))} mi of ${profile.city || 'you'}`,
      distanceMiles,
      context: seed.context,
    };
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dedupeByLabel(seeds: TargetSeed[]): TargetSeed[] {
  const seen = new Set<string>();
  return seeds.filter((s) => {
    const key = s.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
