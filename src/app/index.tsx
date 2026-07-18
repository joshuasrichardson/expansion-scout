import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { businessProfile, todaysMission } from '@/mockData';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen>
      <Logo variant="full" width={240} />

      <View style={styles.header}>
        <ThemedText type="subtitle">Good morning 👋</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Your on-device growth consultant for {businessProfile.name}.
        </ThemedText>
      </View>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          TODAY&apos;S MISSION
        </ThemedText>
        <ThemedText type="default" style={styles.missionTitle}>
          {todaysMission.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {todaysMission.summary}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ⏱ About {todaysMission.estimatedMinutes} min
        </ThemedText>
      </Card>

      <PrimaryButton label="Start today's mission" onPress={() => router.push('/daily-mission')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  missionTitle: { fontWeight: '700' },
});
