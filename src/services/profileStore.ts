/**
 * On-device persistence for the owner's business (and Gemma's latest read of it).
 *
 * The product centers on the USER'S real business — there is no bundled demo
 * business. What the owner tells Scout is captured once and cached locally
 * (document directory on iOS/Android, localStorage on web) so it survives
 * restarts, and NEVER leaves the device — persistence here is part of the
 * privacy story, not just convenience.
 *
 * Failures are soft everywhere: a broken cache read just means the app asks for
 * the business again.
 */

import { Platform } from 'react-native';

import {
  OPPORTUNITY_CATEGORIES,
  type BusinessAnalysis,
  type CustomerProfile,
  type BusinessProfileInput,
} from './gemmaTypes';

/** Everything we know about the owner's business, cached on device. */
export interface StoredBusiness {
  profile: BusinessProfileInput;
  /** Gemma's inferred ideal-customer picture, once an interview has run. */
  customer?: CustomerProfile;
  /** Gemma's latest analysis — lets Home show a real mission on relaunch. */
  analysis?: BusinessAnalysis;
  /** ISO timestamp of the last write. */
  updatedAt: string;
}

const FILE_NAME = 'business-profile.json';
const WEB_KEY = 'expansion-scout/business-profile';

function isStoredBusiness(v: unknown): v is StoredBusiness {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const p = o.profile as Record<string, unknown> | undefined;
  return !!p && typeof p.name === 'string' && typeof p.type === 'string' && typeof p.city === 'string';
}

async function fileUri(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.documentDirectory ? FileSystem.documentDirectory + FILE_NAME : null;
}

export async function loadBusiness(): Promise<StoredBusiness | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = globalThis.localStorage?.getItem(WEB_KEY) ?? null;
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      const uri = await fileUri();
      if (!uri) return null;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return null;
      raw = await FileSystem.readAsStringAsync(uri);
    }
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredBusiness(parsed)) return null;
    // A cached analysis written by an older build may use category values
    // outside today's closed set — drop it and let the next run re-analyze.
    if (parsed.analysis && !analysisIsCurrent(parsed.analysis)) {
      return { ...parsed, analysis: undefined };
    }
    return parsed;
  } catch {
    return null;
  }
}

function analysisIsCurrent(a: BusinessAnalysis): boolean {
  const cats = [
    ...(a.recommendedCategories ?? []),
    ...(a.targetSegments ?? []).map((s) => s.category),
  ];
  return cats.every((c) => (OPPORTUNITY_CATEGORIES as readonly string[]).includes(c));
}

export async function saveBusiness(next: Omit<StoredBusiness, 'updatedAt'>): Promise<void> {
  const record: StoredBusiness = { ...next, updatedAt: new Date().toISOString() };
  const raw = JSON.stringify(record);
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_KEY, raw);
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    const uri = await fileUri();
    if (!uri) return;
    await FileSystem.writeAsStringAsync(uri, raw);
  } catch {
    // Cache write failed — the in-memory copy still drives this session.
  }
}

export async function clearBusiness(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(WEB_KEY);
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    const uri = await fileUri();
    if (!uri) return;
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Nothing to clear.
  }
}
