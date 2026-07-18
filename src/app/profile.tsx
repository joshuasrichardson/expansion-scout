import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BusinessProfileInput } from '@/services/gemma';
import { geocodeCity } from '@/services/places';
import { useBusiness } from '@/state/business-context';

/**
 * Business Profile (T12) — where the app learns whose growth it's planning.
 * First run this is setup; afterwards it's editing. Everything stays on the
 * device (see services/profileStore.ts).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { business, saveProfile, clear } = useBusiness();
  const existing = business?.profile;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState(existing?.type ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [radius, setRadius] = useState(String(existing?.serviceRadiusMiles ?? 10));
  const [availability, setAvailability] = useState(existing?.availability ?? '');
  const [goals, setGoals] = useState((existing?.goals ?? []).join(', '));
  const [capabilities, setCapabilities] = useState((existing?.capabilities ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() && type.trim() && city.trim() && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    // Best-effort geocode so the map and distances are real; without a Places
    // key (or offline) the profile still works — targets derive from the radius.
    const cityChanged = city.trim() !== existing?.city;
    const location =
      cityChanged || !existing ? await geocodeCity(city) : null;

    const profile: BusinessProfileInput = {
      name: name.trim(),
      type: type.trim().toLowerCase(),
      description: description.trim() || undefined,
      city: city.trim(),
      latitude: location?.latitude ?? existing?.latitude ?? 0,
      longitude: location?.longitude ?? existing?.longitude ?? 0,
      serviceRadiusMiles: Math.max(1, Number(radius) || 10),
      availability: availability.trim() || undefined,
      goals: splitList(goals),
      capabilities: splitList(capabilities),
    };
    saveProfile(profile);
    setSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{existing ? 'Your business' : 'Tell Scout about your business'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          This stays on your device — it&apos;s what Gemma reasons about, privately.
        </ThemedText>
      </View>

      <Card>
        <Field label="BUSINESS NAME" value={name} onChangeText={setName} placeholder="e.g. Tacos La Familia" />
        <Field label="WHAT KIND OF BUSINESS" value={type} onChangeText={setType} placeholder="e.g. taco truck, mobile detailer" />
        <Field label="CITY" value={city} onChangeText={setCity} placeholder="e.g. Provo, UT" />
        <Field
          label="SERVICE RADIUS (MILES)"
          value={radius}
          onChangeText={setRadius}
          placeholder="10"
          keyboardType="number-pad"
        />
      </Card>

      <Card>
        <Field
          label="WHAT YOU'RE GREAT AT"
          value={capabilities}
          onChangeText={setCapabilities}
          placeholder="e.g. catering up to 150, fast service"
          multiline
        />
        <Field
          label="GROWTH GOALS"
          value={goals}
          onChangeText={setGoals}
          placeholder="e.g. steady recurring revenue, fill weekday afternoons"
          multiline
        />
        <Field
          label="AVAILABILITY"
          value={availability}
          onChangeText={setAvailability}
          placeholder="e.g. weekdays 10a–8p, some Saturdays"
        />
        <Field
          label="ANYTHING ELSE"
          value={description}
          onChangeText={setDescription}
          placeholder="One line about the business"
          multiline
        />
      </Card>

      <PrimaryButton
        label={saving ? 'Saving…' : existing ? 'Save changes' : 'Save & continue'}
        onPress={handleSave}
        disabled={!canSave}
      />

      {existing ? (
        <PrimaryButton
          label="Forget this business"
          variant="outlined"
          onPress={() => {
            clear();
            router.replace('/');
          }}
        />
      ) : null}
    </Screen>
  );
}

function splitList(text: string): string[] {
  return text
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
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
});
