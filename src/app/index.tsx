import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBusiness } from '@/state/business-context';

/**
 * Launch / Home (T3). Centered on the owner's own business: first run asks for
 * it, afterwards the screen opens with one decision — start today's mission.
 * The mission line comes from Gemma's cached analysis of THIS business when one
 * exists, never from canned copy about someone else's.
 */
export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { business, hydrated } = useBusiness();

  const profile = business?.profile;
  const analysis = business?.analysis;

  return (
    <Screen>
      <View style={styles.top}>
        <Logo variant="mark" width={48} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your business strategy stays on your device. Learn what data is used."
          onPress={() => router.push('/privacy')}
          style={[styles.aiBadge, { backgroundColor: theme.infoSubtle }]}
        >
          <View style={[styles.dot, { backgroundColor: theme.info }]} />
          <ThemedText type="caption" style={{ color: theme.info }}>
            On-device AI
          </ThemedText>
        </Pressable>
      </View>

      {!hydrated ? null : !profile ? (
        <>
          <View style={styles.header}>
            <ThemedText type="title">Find where your business should grow next.</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Tell Scout about your business once — an experienced growth consultant, reasoning
              privately in your pocket, takes it from there.
            </ThemedText>
          </View>
          <PrimaryButton label="Set up your business" onPress={() => router.push('/profile')} />
        </>
      ) : (
        <>
          <View style={styles.header}>
            <ThemedText type="title">Ready to grow today?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Your growth consultant has a mission for {profile.name}.
            </ThemedText>
          </View>

          <Card>
            <ThemedText type="label" themeColor="textMuted">
              TODAY&apos;S MISSION
            </ThemedText>
            <ThemedText type="subtitle">
              {analysis?.focus ?? missionFromGoals(profile.goals, profile.type)}
            </ThemedText>
            {analysis?.summary ? (
              <ThemedText type="small" themeColor="textSecondary">
                {analysis.summary}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                A few quick questions, then Gemma builds today&apos;s plan on your device.
              </ThemedText>
            )}
          </Card>

          <PrimaryButton label="Start today's mission" onPress={() => router.push('/daily-mission')} />
          {analysis ? (
            <PrimaryButton
              label="Skip to today's growth plan"
              variant="secondary"
              onPress={() => router.push('/opportunities')}
            />
          ) : null}
          <PrimaryButton label="Edit business" variant="outlined" onPress={() => router.push('/profile')} />
        </>
      )}

      <ThemedText type="caption" themeColor="textMuted" style={styles.privacyLine}>
        Powered locally by Gemma 4 · Your business strategy stays on your device.
      </ThemedText>
    </Screen>
  );
}

/** A goal-grounded mission line for before the first analysis has run. */
function missionFromGoals(goals: string[], type: string): string {
  const goal = goals[0]?.replace(/\.$/, '');
  return goal ? capitalize(goal) : `Find where your ${type || 'business'} should grow next`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { gap: Spacing.two },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  privacyLine: { textAlign: 'center' },
});
