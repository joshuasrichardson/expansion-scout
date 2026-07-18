import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getTodayWeather, type DayWeather } from '@/services/weather';
import { useBusiness } from '@/state/business-context';

/**
 * Daily Mission (T3) — the signature screen. A coach handing you ONE goal for
 * the day, grounded in the owner's own goals and Gemma's latest read of their
 * business (cached on device). The "look for" preview hints at where the plan
 * will point without revealing the ranked list — that's the analysis reveal.
 */
export default function DailyMissionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { business, hydrated } = useBusiness();
  const [weather, setWeather] = useState<DayWeather | null>(null);

  // Field work depends on the sky — fetch once, render only if it resolves.
  const lat = business?.profile.latitude;
  const lng = business?.profile.longitude;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let cancelled = false;
    getTodayWeather(lat, lng).then((w) => {
      if (!cancelled) setWeather(w);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (hydrated && !business) return <Redirect href="/profile" />;
  if (!business) return <Screen>{null}</Screen>;

  const { profile, analysis, customer } = business;
  const objective = analysis?.focus ?? profile.goals[0] ?? `Grow ${profile.name} today`;
  const why =
    analysis?.summary ??
    `You told Scout: ${profile.goals.join('; ') || 'grow revenue'}. Today is about turning that into specific nearby places to pursue.`;
  const lookFor = (analysis?.targetSegments ?? []).map((s) => s.label).slice(0, 3);
  const hangouts = lookFor.length ? lookFor : (customer?.locations ?? []).slice(0, 3);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="label" style={{ color: theme.accent }}>
          YOUR MISSION TODAY
        </ThemedText>
        <ThemedText type="title">{capitalize(objective)}</ThemedText>
      </View>

      <Card>
        <ThemedText type="label" themeColor="textMuted">
          WHY THIS MATTERS
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {why}
        </ThemedText>
      </Card>

      {weather && (
        <View style={[styles.weather, { backgroundColor: weather.goodForFieldWork ? theme.accentSubtle : theme.scoreSubtle }]}>
          <ThemedText type="small" style={{ color: weather.goodForFieldWork ? theme.accent : theme.warning }}>
            {weather.goodForFieldWork ? '☀️' : '🌧'} {weather.hint}
          </ThemedText>
        </View>
      )}

      <Card>
        <ThemedText type="label" themeColor="textMuted">
          YOUR BUSINESS
        </ThemedText>
        <ThemedText type="bodyBold">{profile.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {capitalize(profile.type)} · {profile.city} · {profile.serviceRadiusMiles} mi radius
        </ThemedText>
        {profile.capabilities.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Strengths: {profile.capabilities.join(' · ')}
          </ThemedText>
        )}
      </Card>

      {hangouts.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="label" themeColor="textMuted">
            SCOUT WILL LOOK FOR
          </ThemedText>
          {hangouts.map((label) => (
            <View key={label} style={styles.previewRow}>
              <View style={[styles.previewDot, { backgroundColor: theme.accent }]} />
              <ThemedText type="small" style={styles.previewName}>
                {capitalize(label)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      <PrimaryButton label="Start mission" onPress={() => router.push('/interview')} />
      <ThemedText type="caption" themeColor="textMuted" style={styles.footnote}>
        Scout asks a few quick questions, then Gemma 4 reasons privately on your device.
      </ThemedText>
    </Screen>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  section: { gap: Spacing.two },
  weather: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  previewDot: { width: 8, height: 8, borderRadius: Radius.pill },
  previewName: { flex: 1 },
  footnote: { textAlign: 'center' },
});
