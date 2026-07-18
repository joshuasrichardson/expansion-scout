import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { LocalAiStatus } from '@/components/local-ai-status';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
          nowhere to go — the model that reads them lives in this app. Deleting the app (or
          tapping &ldquo;Forget this business&rdquo; in your profile) removes everything.
        </ThemedText>
      </Card>

      <LocalAiStatus />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: { gap: Spacing.half },
});
