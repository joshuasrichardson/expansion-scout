/**
 * On-device cache for Places discovery results.
 *
 * Two jobs:
 *   1. Speed + cost: owners reopen the app several times a day — identical
 *      searches shouldn't re-hit Google (Text Search has a small daily quota).
 *   2. Resilience: when discovery fails (offline, quota, key trouble), the last
 *      REAL results for this business beat synthetic derived targets.
 *
 * One entry — the most recent discovery — keyed by location + queries. Fresh
 * within FRESH_MS is served instead of the network; anything newer than
 * STALE_MS is still preferred over derived targets after a failure.
 * Same storage split as profileStore: document directory on native,
 * localStorage on web. All failures are soft.
 */

import { Platform } from 'react-native';

import type { PlaceCandidate } from './gemmaTypes';

export interface PlacesCacheEntry {
  key: string;
  candidates: PlaceCandidate[];
  savedAt: string;
}

const FILE_NAME = 'places-cache.json';
const WEB_KEY = 'expansion-scout/places-cache';
export const FRESH_MS = 12 * 60 * 60 * 1000; // serve without searching
export const STALE_MS = 7 * 24 * 60 * 60 * 1000; // still beats derived targets

/** Stable key: rounded location + radius + the queries that produced it. */
export function cacheKeyFor(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  queries: string[],
): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)},${radiusMiles}|${[...queries].sort().join(';')}`;
}

function isEntry(v: unknown): v is PlacesCacheEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.key === 'string' && Array.isArray(o.candidates) && typeof o.savedAt === 'string';
}

export async function loadPlacesCache(): Promise<PlacesCacheEntry | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = globalThis.localStorage?.getItem(WEB_KEY) ?? null;
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      if (!FileSystem.documentDirectory) return null;
      const uri = FileSystem.documentDirectory + FILE_NAME;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return null;
      raw = await FileSystem.readAsStringAsync(uri);
    }
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePlacesCache(key: string, candidates: PlaceCandidate[]): Promise<void> {
  const entry: PlacesCacheEntry = { key, candidates, savedAt: new Date().toISOString() };
  try {
    const raw = JSON.stringify(entry);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_KEY, raw);
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + FILE_NAME, raw);
  } catch {
    // Cache write failed — discovery still worked; nothing user-facing.
  }
}

/** Age in ms, or Infinity if unparsable. */
export function entryAgeMs(entry: PlacesCacheEntry): number {
  const t = Date.parse(entry.savedAt);
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}
