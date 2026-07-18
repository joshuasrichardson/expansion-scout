import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { CATEGORY_ICON } from '@/components/scout-map';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBusiness } from '@/state/business-context';
import { usePlan, type PlanStop } from '@/state/plan-context';

/**
 * Today's Plan (T11) — the stops the owner committed to, as a field itinerary:
 * time window, place, objective, travel. Stops come only from "Add to today's
 * plan" (deduped in plan state); removing one is a tap. Start Navigation opens
 * the first unfinished stop.
 */
export default function PlanScreen() {
  const router = useRouter();
  const { business } = useBusiness();
  const { stops, remove, toggleDone } = usePlan();

  const completed = stops.filter((s) => s.done).length;
  const nextStop = stops.find((s) => !s.done);

  if (stops.length === 0) {
    return (
      <Screen>
        <ThemedText type="subtitle">Nothing planned yet</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Add stops from today&apos;s growth plan — each opportunity&apos;s detail screen has an
          &ldquo;Add to today&apos;s plan&rdquo; button.
        </ThemedText>
        <PrimaryButton label="Open today's growth plan" onPress={() => router.push('/opportunities')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Today&apos;s plan</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {completed} of {stops.length} done · built for {business?.profile.name ?? 'your business'}
        </ThemedText>
      </View>

      {stops.map((stop, i) => (
        <StopCard
          key={stop.id}
          stop={stop}
          index={i}
          onToggle={() => toggleDone(stop.id)}
          onRemove={() => remove(stop.id)}
        />
      ))}

      {nextStop && (
        <PrimaryButton
          label={`Start navigation · ${nextStop.name}`}
          onPress={() => openStop(nextStop, business?.profile.city)}
        />
      )}
      <PrimaryButton label="Done for today" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}

function StopCard({
  stop,
  index,
  onToggle,
  onRemove,
}: {
  stop: PlanStop;
  index: number;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: stop.done }}
          accessibilityLabel={`Mark ${stop.name} ${stop.done ? 'not done' : 'done'}`}
          onPress={onToggle}
          style={[
            styles.checkbox,
            { borderColor: theme.accent, backgroundColor: stop.done ? theme.accent : 'transparent' },
          ]}
        >
          {stop.done ? (
            <ThemedText type="small" style={{ color: theme.onAccent }}>
              ✓
            </ThemedText>
          ) : null}
        </Pressable>

        <View style={styles.stopText}>
          <ThemedText type="caption" themeColor="textMuted">
            STOP {index + 1} · {stop.time}
          </ThemedText>
          <ThemedText type="bodyBold" style={stop.done && styles.strikethrough}>
            {CATEGORY_ICON[stop.category]} {stop.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {stop.objective}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            🚗 {stop.travelMinutes} min{stop.estimatedValue ? ` · ${stop.estimatedValue}` : ''}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${stop.name} from plan`}
          onPress={onRemove}
          hitSlop={8}
        >
          <ThemedText type="small" themeColor="textMuted">
            ✕
          </ThemedText>
        </Pressable>
      </View>
    </Card>
  );
}

/** Same navigation contract as the details screen: real pin, or honest search. */
function openStop(stop: PlanStop, city?: string) {
  const search = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${stop.name} near ${city ?? 'me'}`,
  )}`;
  const pin =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${stop.latitude},${stop.longitude}`
      : `geo:${stop.latitude},${stop.longitude}?q=${stop.latitude},${stop.longitude}(${encodeURIComponent(stop.name)})`;
  const url = stop.opportunityId.startsWith('local-') || Platform.OS === 'web' ? search : pin;
  Linking.openURL(url).catch(() => {
    Linking.openURL(search).catch(() => {});
  });
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.half,
  },
  stopText: { flex: 1, gap: Spacing.half },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.6 },
});
