import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getOpportunity } from '@/mockData';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export default function OpportunityDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const opportunity = getOpportunity(id);

  if (!opportunity) {
    return (
      <Screen>
        <ThemedText type="subtitle">Opportunity not found</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{opportunity.title}</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {opportunity.market} · {opportunity.category}
        </ThemedText>
      </View>

      <Card>
        <View style={styles.stats}>
          <Stat label="Fit score" value={`${opportunity.matchScore}%`} />
          <Stat label="Est. value" value={`$${opportunity.estimatedValueUsd.toLocaleString()}/yr`} />
          <Stat label="Effort" value={opportunity.effort} />
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          WHY THIS FITS
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {opportunity.rationale}
        </ThemedText>
      </View>

      <PrimaryButton
        label="Draft outreach"
        onPress={() => router.push({ pathname: '/outreach', params: { id: opportunity.id } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: Spacing.half, alignItems: 'flex-start' },
  section: { gap: Spacing.two },
});
