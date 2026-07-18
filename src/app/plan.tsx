import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayPlan } from '@/mockData';

export default function PlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(todayPlan.tasks.map((t) => [t.id, t.done])),
  );

  const completed = Object.values(done).filter(Boolean).length;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Today&apos;s plan</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {completed} of {todayPlan.tasks.length} done
        </ThemedText>
      </View>

      {todayPlan.tasks.map((task) => {
        const isDone = done[task.id];
        return (
          <Card key={task.id} onPress={() => setDone((d) => ({ ...d, [task.id]: !d[task.id] }))}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                onPress={() => setDone((d) => ({ ...d, [task.id]: !d[task.id] }))}
                style={[
                  styles.checkbox,
                  { borderColor: theme.accent, backgroundColor: isDone ? theme.accent : 'transparent' },
                ]}
              >
                {isDone ? (
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    ✓
                  </ThemedText>
                ) : null}
              </Pressable>
              <View style={styles.taskText}>
                <ThemedText
                  type="default"
                  style={[styles.taskTitle, isDone && styles.strikethrough]}
                >
                  {task.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {task.detail}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ⏱ {task.durationMinutes} min · {task.priority} priority
                </ThemedText>
              </View>
            </View>
          </Card>
        );
      })}

      <PrimaryButton
        label="Done for today"
        variant="secondary"
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.half,
  },
  taskText: { flex: 1, gap: Spacing.half },
  taskTitle: { fontWeight: '700' },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.6 },
});
