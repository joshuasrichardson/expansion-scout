import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { LocalAiStatus } from '@/components/local-ai-status';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearPlacesCache } from '@/services/placesCache';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';
import { usePlan } from '@/state/plan-context';

/**
 * "What data is used" (T5b) — the in-app companion to DATA_FLOW.md, plus the
 * live locality proof (LocalAiStatus). The core distinction, stated exactly:
 * Google Maps discovers places; Gemma reasons about them privately on-device.
 */

const ROWS: { data: string; where: string; local: boolean }[] = [
  { data: 'Your business profile & interview answers', where: 'Processed by Gemma on this device · cached only on this device', local: true },
  { data: "Gemma's analysis, rankings & outreach drafts", where: 'Generated and kept on this device — never transmitted', local: true },
  { data: 'Nearby place lookups (optional)', where: 'Sent to Google Places — only a place-type query and a search area', local: false },
];

export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { clear } = useBusiness();
  const opportunities = useOpportunities();
  const plan = usePlan();
  const [confirmReset, setConfirmReset] = useState(false);

  /**
   * Wipe everything Scout stored on this device: the profile + inferred
   * customer + analysis (business-profile.json), the discovery cache
   * (places-cache.json), and the in-session plan/opportunities. Two taps —
   * the first arms it — so it can't be triggered by accident.
   */
  function resetAll() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clear();
    void clearPlacesCache();
    opportunities.reset();
    plan.reset();
    router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Your data, plainly</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Google Maps discovers places. Gemma reasons about those places privately, on your
          device. Nothing about your business strategy is ever uploaded.
        </ThemedText>
      </View>

      <Card>
        {ROWS.map((row, i) => (
          <View key={row.data} style={[styles.row, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three }]}>
            <ThemedText type="smallBold">{row.data}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {row.where}
            </ThemedText>
            <ThemedText type="caption" style={{ color: row.local ? theme.accent : theme.info }}>
              {row.local ? '⬤ Stays on device' : '○ Leaves device (no business details attached)'}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Card>
        <ThemedText type="label" themeColor="textMuted">
          WHAT IS NEVER COLLECTED
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          No account, no analytics, no backend. Your answers, goals, strategy, and drafts have
          nowhere to go — the model that reads them lives in this app. Deleting the app, tapping
          &ldquo;Forget this business,&rdquo; or &ldquo;Reset all local data&rdquo; below removes
          everything.
        </ThemedText>
      </Card>

      <LocalAiStatus />

      <Card>
        <ThemedText type="label" themeColor="textMuted">
          RESET
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Erase everything Scout keeps on this device — your business, Gemma&apos;s analysis, and
          cached place lookups. This can&apos;t be undone.
        </ThemedText>
        <PrimaryButton
          label={confirmReset ? 'Tap again to erase everything' : 'Reset all local data'}
          variant="outlined"
          onPress={resetAll}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: { gap: Spacing.half },
});
