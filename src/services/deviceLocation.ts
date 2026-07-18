/**
 * On-device location — the fast path for setup.
 *
 * A field-working owner shouldn't thumb-type their city and street on a phone in
 * a truck. One tap reads the GPS fix and resolves it to a city (and street, when
 * available) using the *OS* geocoder — Apple/Android, on the device. No Google
 * Places key, no network round-trip, nothing transmitted. This fits the privacy
 * framing (CLAUDE.md): the owner's location stays on their device.
 *
 * Resilience is a feature (CLAUDE.md): permission denial, a disabled locator, or
 * an offline reverse-geocode never throw to the caller. We return a discriminated
 * result so the profile screen can fall back to manual entry with a clear reason,
 * and — critically — we still hand back raw coordinates even when the reverse
 * geocode can't name the place, so the map can center regardless.
 */

/**
 * `expo-location` is a *native* module: it only exists in a dev build compiled
 * after it was added to the project. On an older build (or Expo Go) importing it
 * eagerly throws "Cannot find native module 'ExpoLocation'" and red-screens the
 * app. We load it lazily behind a try/catch so a missing native module simply
 * disables GPS and the profile screen falls back to manual entry — resilience is
 * a feature (CLAUDE.md), and one optional convenience must never crash setup.
 */
type LocationModule = typeof import('expo-location');
let locationModule: LocationModule | null | undefined;
function loadLocation(): LocationModule | null {
  if (locationModule !== undefined) return locationModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load so a missing native module degrades instead of crashing at import
    locationModule = require('expo-location') as LocationModule;
  } catch {
    locationModule = null; // native module absent — GPS unavailable this build
  }
  return locationModule;
}

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  /** e.g. "Provo, UT" — best-effort; absent if the reverse geocode failed. */
  city?: string;
  /** e.g. "400 W Center St" — best-effort; absent when unavailable. */
  address?: string;
}

export type DeviceLocationResult =
  | { ok: true; location: DeviceLocation }
  /** Permission refused — the caller should keep manual entry available. */
  | { ok: false; reason: 'denied' }
  /** Location services off, no fix, or the module errored. */
  | { ok: false; reason: 'unavailable' };

/**
 * Ask for permission (if needed), read one GPS fix, and resolve it to a place.
 * Balanced accuracy: a service-radius pin doesn't need meter precision, and the
 * lower accuracy returns faster — setup should feel instant.
 */
export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  const Location = loadLocation();
  if (!Location) return { ok: false, reason: 'unavailable' };
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return { ok: false, reason: 'denied' };

    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = fix.coords;

    // Reverse geocode is best-effort: name the place when we can, but never let
    // its failure cost us the coordinates the map needs.
    const place = await reverseGeocode(latitude, longitude);
    return { ok: true, location: { latitude, longitude, ...place } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** OS reverse geocode → { city, address }; {} on any failure. */
async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ city?: string; address?: string }> {
  const Location = loadLocation();
  if (!Location) return {};
  try {
    const [hit] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!hit) return {};
    const city = [hit.city, hit.region].filter(Boolean).join(', ') || undefined;
    const address = [hit.streetNumber, hit.street].filter(Boolean).join(' ') || undefined;
    return { city, address };
  } catch {
    return {};
  }
}
