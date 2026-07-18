import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, View } from 'react-native';

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
 * a timeline with numbered nodes (tap to mark done), time window, objective,
 * travel. Stops come only from "Add to today's plan" (deduped in plan state).
 * The value rollup and completion state close the demo's emotional arc:
 * "today could be worth $X" → "mission complete."
 */
export default function PlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { business } = useBusiness();
  const { stops, remove, toggleDone } = usePlan();
  const [shared, setShared] = useState(false);

  const completed = stops.filter((s) => s.done).length;
  const nextStop = stops.find((s) => !s.done);
  const allDone = stops.length > 0 && completed === stops.length;
  const value = useMemo(() => potentialValue(stops), [stops]);

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

  async function sharePlan() {
    const text = planAsText(stops, business?.profile.name);
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Share.share({ message: text });
      }
      setShared(true);
    } catch {
      // Owner cancelled the share sheet — nothing to do.
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Today&apos;s plan</ThemedText>
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.accent, width: `${(completed / stops.length) * 100}%` },
            ]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {completed} of {stops.length} done · built for {business?.profile.name ?? 'your business'}
        </ThemedText>
      </View>

      {allDone && (
        <Card style={{ backgroundColor: theme.accentSubtle, borderColor: theme.accent }}>
          <ThemedText type="bodyBold" style={{ color: theme.accent }}>
            🎉 Mission complete
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Every stop done. Scout folds what you learned today into tomorrow&apos;s mission.
          </ThemedText>
        </Card>
      )}

      <View>
        {stops.map((stop, i) => (
          <TimelineStop
            key={stop.id}
            stop={stop}
            index={i}
            last={i === stops.length - 1}
            onToggle={() => toggleDone(stop.id)}
            onRemove={() => remove(stop.id)}
          />
        ))}
      </View>

      {value && (
        <Card>
          <ThemedText type="label" themeColor="textMuted">
            IF EVERY STOP LANDS
          </ThemedText>
          <ThemedText type="subtitle" style={{ color: theme.warning }}>
            {value}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            Gemma&apos;s estimates from each opportunity&apos;s own data — direction, not a promise.
          </ThemedText>
        </Card>
      )}

      {nextStop && (
        <PrimaryButton
          label={`Start navigation · ${nextStop.name}`}
          onPress={() => openStop(nextStop, business?.profile.city)}
        />
      )}
      <PrimaryButton
        label={shared ? '✓ Plan copied' : Platform.OS === 'web' ? 'Copy plan' : 'Share plan'}
        variant="secondary"
        onPress={() => void sharePlan()}
      />
      <PrimaryButton
        label="Done for today"
        variant={allDone ? 'primary' : 'outlined'}
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}

/**
 * One stop on the timeline. The numbered node IS the done-toggle (28px target);
 * a rail line connects it to the next stop and turns green as stops complete.
 */
function TimelineStop({
  stop,
  index,
  last,
  onToggle,
  onRemove,
}: {
  stop: PlanStop;
  index: number;
  last: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.timelineRow}>
      <View style={styles.rail}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: stop.done }}
          accessibilityLabel={`Mark ${stop.name} ${stop.done ? 'not done' : 'done'}`}
          onPress={onToggle}
          hitSlop={8}
          style={[
            styles.node,
            {
              borderColor: theme.accent,
              backgroundColor: stop.done ? theme.accent : 'transparent',
            },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: stop.done ? theme.onAccent : theme.accent }}
          >
            {stop.done ? '✓' : index + 1}
          </ThemedText>
        </Pressable>
        {!last && (
          <View
            style={[
              styles.railLine,
              { backgroundColor: stop.done ? theme.accent : theme.border },
            ]}
          />
        )}
      </View>

      <Card style={last ? styles.stopCardLast : styles.stopCard}>
        <View style={styles.stopHead}>
          <View style={styles.stopText}>
            <ThemedText type="caption" themeColor="textMuted">
              {stop.time.toUpperCase()}
            </ThemedText>
            <ThemedText type="bodyBold" style={stop.done && styles.strikethrough}>
              {CATEGORY_ICON[stop.category]} {stop.name}
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
        <ThemedText type="small" themeColor="textSecondary">
          {stop.objective}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          🚗 {stop.travelMinutes} min{stop.estimatedValue ? ` · ${stop.estimatedValue}` : ''}
          {stop.phone ? ` · 📞 ${stop.phone}` : ''}
        </ThemedText>
      </Card>
    </View>
  );
}

/**
 * Roll the stops' Gemma-estimated values into one line, e.g.
 * "~$1,650/mo + ~$500 one-time". Only parseable dollar amounts count; mixed
 * cadences stay separate so the number never overstates. Null hides the card.
 */
function potentialValue(stops: PlanStop[]): string | null {
  let monthly = 0;
  let oneTime = 0;
  for (const stop of stops) {
    const raw = stop.estimatedValue;
    if (!raw) continue;
    const match = raw.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)?/i);
    if (!match) continue;
    const amount = parseFloat(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (/\/\s*mo|month/i.test(raw)) monthly += amount;
    else oneTime += amount;
  }
  const parts: string[] = [];
  if (monthly > 0) parts.push(`~$${Math.round(monthly).toLocaleString('en-US')}/mo`);
  if (oneTime > 0) parts.push(`~$${Math.round(oneTime).toLocaleString('en-US')} one-time`);
  return parts.length ? parts.join(' + ') : null;
}

/** The plan as plain text — for the share sheet / clipboard. */
function planAsText(stops: PlanStop[], businessName?: string): string {
  const lines = [`Today's growth plan${businessName ? ` — ${businessName}` : ''}`, ''];
  stops.forEach((stop, i) => {
    lines.push(`${i + 1}. ${stop.done ? '[done] ' : ''}${stop.name} · ${stop.time}`);
    lines.push(`   Goal: ${stop.objective}`);
    const extras = [
      stop.address,
      `${stop.travelMinutes} min drive`,
      stop.estimatedValue,
      stop.phone,
    ].filter(Boolean);
    if (extras.length) lines.push(`   ${extras.join(' · ')}`);
  });
  lines.push('', 'Planned with Expansion Scout — reasoned privately on-device by Gemma.');
  return lines.join('\n');
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
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  timelineRow: { flexDirection: 'row', gap: Spacing.three },
  rail: { width: 28, alignItems: 'center' },
  node: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: { flex: 1, width: 2, borderRadius: 1, marginVertical: Spacing.one },
  stopCard: { flex: 1, marginBottom: Spacing.three },
  stopCardLast: { flex: 1 },
  stopHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  stopText: { flex: 1, gap: Spacing.half },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.6 },
});
