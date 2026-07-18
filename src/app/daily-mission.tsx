import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { businessProfile, todaysMission } from '@/mockData';

export default function DailyMissionScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{todaysMission.title}</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {todaysMission.summary}
        </ThemedText>
      </View>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          YOUR BUSINESS
        </ThemedText>
        <ThemedText type="default" style={styles.bold}>
          {businessProfile.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {businessProfile.industry} · {businessProfile.homeMarket}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {businessProfile.description}
        </ThemedText>
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        Scout will ask a few quick questions, then analyze your answers entirely on your device.
      </ThemedText>

      <PrimaryButton label="Begin interview" onPress={() => router.push('/interview')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  bold: { fontWeight: '700' },
});
