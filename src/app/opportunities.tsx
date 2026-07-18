import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { opportunities } from '@/mockData';
import type { Opportunity } from '@/types';

export default function OpportunitiesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const ranked = [...opportunities].sort((a, b) => b.matchScore - a.matchScore);

  return (
    <Screen>
      <ThemedText type="default" themeColor="textSecondary">
        Scout found {opportunities.length} expansion opportunities near you.
      </ThemedText>

      {/* Map placeholder — swap for react-native-maps with the pin coordinates. */}
      <ThemedView type="backgroundSelected" style={[styles.map, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          🗺 Opportunities map
        </ThemedText>
        <View style={styles.pins}>
          {ranked.map((o) => (
            <View key={o.id} style={[styles.pin, { backgroundColor: theme.accent }]}>
              <ThemedText type="small" style={{ color: theme.onAccent }}>
                {o.matchScore}
              </ThemedText>
            </View>
          ))}
        </View>
      </ThemedView>

      {ranked.map((o) => (
        <OpportunityRow
          key={o.id}
          opportunity={o}
          onPress={() => router.push({ pathname: '/opportunity/[id]', params: { id: o.id } })}
        />
      ))}
    </Screen>
  );
}

function OpportunityRow({
  opportunity,
  onPress,
}: {
  opportunity: Opportunity;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={styles.rowTop}>
        <ThemedText type="default" style={styles.rowTitle}>
          {opportunity.title}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {opportunity.matchScore}% fit
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {opportunity.market} · {opportunity.category}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 160,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  pins: { flexDirection: 'row', gap: Spacing.two },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  rowTitle: { flex: 1, fontWeight: '700' },
});
