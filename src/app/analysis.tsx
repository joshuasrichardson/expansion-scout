import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analysisResult } from '@/mockData';

export default function AnalysisScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.scoreRow}>
        <ThemedText type="title" style={{ color: theme.accent }}>
          {analysisResult.readinessScore}
        </ThemedText>
        <View style={styles.scoreLabel}>
          <ThemedText type="smallBold">Expansion readiness</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            out of 100
          </ThemedText>
        </View>
      </View>

      <ThemedText type="default" themeColor="textSecondary">
        {analysisResult.summary}
      </ThemedText>

      <Card>
        <ThemedText type="smallBold" style={{ color: theme.success }}>
          STRENGTHS
        </ThemedText>
        {analysisResult.strengths.map((s) => (
          <ThemedText key={s} type="small">
            • {s}
          </ThemedText>
        ))}
      </Card>

      <Card>
        <ThemedText type="smallBold" style={{ color: theme.warning }}>
          GAPS TO CLOSE
        </ThemedText>
        {analysisResult.gaps.map((g) => (
          <ThemedText key={g} type="small">
            • {g}
          </ThemedText>
        ))}
      </Card>

      <PrimaryButton
        label="See opportunities"
        onPress={() => router.push('/opportunities')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  scoreLabel: { gap: Spacing.half },
});
