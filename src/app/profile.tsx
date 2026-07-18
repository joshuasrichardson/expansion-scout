import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDeviceLocation } from '@/services/deviceLocation';
import type { BusinessProfileInput } from '@/services/gemma';
import { geocodeLocation } from '@/services/places';
import { clearPlacesCache } from '@/services/placesCache';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';
import { usePlan } from '@/state/plan-context';

/**
 * Business Profile (T12) — where the app learns whose growth it's planning.
 * First run this is setup; afterwards it's editing.
 *
 * Deliberately kept to the bare identity + location the app needs to search:
 * name, type, where, how far. The *subjective* picture — goals, strengths,
 * availability — is elicited conversationally in the interview, which is better
 * at it than a wall of form fields (and where Gemma already reasons). We only
 * carry those fields through on save so editing details never erases what the
 * interview learned.
 *
 * Everything stays on the device (see services/profileStore.ts). The form waits
 * for the device-cache read (`hydrated`) and remounts per business identity —
 * otherwise a cold start races hydration and shows an empty form for a business
 * that exists.
 */
export default function ProfileScreen() {
  const { business, hydrated } = useBusiness();
  if (!hydrated) return <Screen>{null}</Screen>;
  return <ProfileForm key={business ? `${business.profile.name}-${business.profile.type}` : 'new'} />;
}

/** Service-radius presets — tap one instead of thumbing a number pad. */
const RADIUS_PRESETS = [5, 10, 25, 50];

function ProfileForm() {
  const router = useRouter();
  const theme = useTheme();
  const { business, saveProfile, clear } = useBusiness();
  const opportunities = useOpportunities();
  const plan = usePlan();
  const existing = business?.profile;

  const [ownerName, setOwnerName] = useState(existing?.ownerName ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState(existing?.type ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [radius, setRadius] = useState(existing?.serviceRadiusMiles ?? 10);
  // A GPS fix, when the owner tapped "Use my location". Present means we already
  // have exact coordinates and can skip geocoding on save. Cleared the moment
  // they hand-edit city/address, so a manual change re-geocodes.
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  const canSave = Boolean(ownerName.trim() && name.trim() && type.trim() && city.trim()) && !saving;

  /** One tap: GPS fix → OS reverse geocode → fill city/address, on device. */
  async function captureLocation() {
    setLocating(true);
    setLocationNote(null);
    const result = await getDeviceLocation();
    setLocating(false);
    if (!result.ok) {
      setLocationNote(
        result.reason === 'denied'
          ? 'Location is off — just type your city below.'
          : "Couldn't read your location — type your city below.",
      );
      return;
    }
    const { latitude, longitude, city: foundCity, address: foundAddress } = result.location;
    setGpsCoords({ latitude, longitude });
    if (foundCity) setCity(foundCity);
    if (foundAddress) setAddress(foundAddress);
    setLocationNote(foundCity ? `Pinned to ${foundCity}` : 'Location captured — add your city name');
  }

  // Hand-editing the location invalidates the GPS fix: geocode the text on save.
  function editCity(next: string) {
    setCity(next);
    setGpsCoords(null);
  }
  function editAddress(next: string) {
    setAddress(next);
    setGpsCoords(null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    // Coordinates center the map and make distances real. Prefer the exact GPS
    // fix; otherwise geocode the typed address/city. Without a Places key (or
    // offline, with no GPS) the profile still works — targets derive from the
    // radius, keeping the last known coords.
    const textChanged =
      address.trim() !== (existing?.address ?? '') || city.trim() !== (existing?.city ?? '');
    let coords = gpsCoords;
    if (!coords && (textChanged || !existing)) {
      coords = await geocodeLocation([address.trim(), city.trim()].filter(Boolean).join(', '));
    }
    const locationChanged = Boolean(gpsCoords) || textChanged;

    const profile: BusinessProfileInput = {
      name: name.trim(),
      ownerName: ownerName.trim(),
      type: type.trim().toLowerCase(),
      address: address.trim() || undefined,
      city: city.trim(),
      latitude: coords?.latitude ?? existing?.latitude ?? 0,
      longitude: coords?.longitude ?? existing?.longitude ?? 0,
      serviceRadiusMiles: Math.max(1, radius),
      // Subjective fields live in the interview now — carry the existing values
      // through untouched so editing identity/location never erases them.
      description: existing?.description,
      availability: existing?.availability,
      goals: existing?.goals ?? [],
      capabilities: existing?.capabilities ?? [],
    };
    saveProfile(profile);

    // A different business means the old session's plan, ranked list, and cached
    // place lookups are about someone else — start those clean. Moving an
    // existing business's location invalidates the ranked plan + cache too (both
    // are keyed to coordinates), but keeps the committed plan stops.
    const sameBusiness =
      !!existing && existing.name === profile.name && existing.type === profile.type;
    if (!sameBusiness) {
      opportunities.reset();
      plan.reset();
      void clearPlacesCache();
    } else if (locationChanged) {
      opportunities.reset();
      void clearPlacesCache();
    }
    setSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">
          {existing ? 'Your business' : 'Tell Scout about your business'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Just the basics — Scout asks about your goals next. This stays on your device.
        </ThemedText>
      </View>

      <Card>
        <Field label="YOUR NAME" value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Maria" />
        <Field
          label="BUSINESS NAME"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Tacos La Familia"
        />
        <Field
          label="WHAT KIND OF BUSINESS"
          value={type}
          onChangeText={setType}
          placeholder="e.g. taco truck, mobile detailer"
        />
      </Card>

      <Card>
        <Pressable
          onPress={() => void captureLocation()}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="use my current location"
          style={({ pressed }) => [
            styles.locationButton,
            { borderColor: theme.accent, backgroundColor: theme.infoSubtle },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="bodyBold" style={{ color: theme.accent }}>
            {locating ? 'Finding you…' : '📍  Use my current location'}
          </ThemedText>
        </Pressable>
        {locationNote ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.locationNote}>
            {locationNote}
          </ThemedText>
        ) : null}

        <Field
          label="CITY"
          value={city}
          onChangeText={editCity}
          placeholder="e.g. Provo, UT"
        />
        <Field
          label="STREET ADDRESS (OPTIONAL)"
          value={address}
          onChangeText={editAddress}
          placeholder="e.g. 400 W Center St — centers the map on you"
        />

        <View style={styles.field}>
          <ThemedText type="label" themeColor="textMuted">
            SERVICE RADIUS
          </ThemedText>
          <View style={styles.chipRow}>
            {radiusOptions(radius).map((miles) => {
              const selected = miles === radius;
              return (
                <Pressable
                  key={miles}
                  onPress={() => setRadius(miles)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${miles} mile radius`}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: selected ? theme.accent : theme.border,
                      backgroundColor: selected ? theme.accent : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText
                    type="bodyBold"
                    style={{ color: selected ? theme.onAccent : theme.text }}
                  >
                    {miles} mi
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <PrimaryButton
        label={saving ? 'Saving…' : existing ? 'Save changes' : 'Save & continue'}
        onPress={handleSave}
        disabled={!canSave}
      />

      {existing ? (
        // Destructive: first tap arms it, second tap actually forgets.
        <PrimaryButton
          label={confirmForget ? 'Tap again to erase everything' : 'Forget this business'}
          variant="outlined"
          onPress={() => {
            if (!confirmForget) {
              setConfirmForget(true);
              return;
            }
            clear();
            void clearPlacesCache();
            opportunities.reset();
            plan.reset();
            router.replace('/');
          }}
        />
      ) : null}
    </Screen>
  );
}

/** Presets, plus the saved value when it isn't one (e.g. a legacy 15-mi radius). */
function radiusOptions(current: number): number[] {
  return RADIUS_PRESETS.includes(current)
    ? RADIUS_PRESETS
    : [...RADIUS_PRESETS, current].sort((a, b) => a - b);
}

function Field({
  label,
  ...input
}: { label: string } & Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'multiline' | 'keyboardType'
>) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textMuted">
        {label}
      </ThemedText>
      <TextInput
        {...input}
        accessibilityLabel={label.toLowerCase()}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border },
          input.multiline && styles.multiline,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  field: { gap: Spacing.one },
  input: {
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  locationButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  locationNote: { marginTop: -Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  pressed: { opacity: 0.6 },
});
