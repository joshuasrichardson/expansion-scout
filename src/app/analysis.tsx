import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { demoBusiness } from '@/data/demo';
import { useTheme } from '@/hooks/use-theme';
import {
  analyzeBusiness,
  type BusinessAnalysis,
  type CustomerSegment,
  type CustomerSegmentType,
  type InferenceMeta,
  type InterviewProfile,
  type OutreachChannel,
} from '@/services/gemma';
import { summarizeInterviewLocal } from '@/services/opportunityRanking';
import { useInterview } from '@/state/interview-context';
import { useOpportunities } from '@/state/opportunities-context';

/**
 * The signature "thinking" screen. Gemma reasons privately on-device about WHICH
 * KINDS OF CUSTOMERS this business should look for — classifying each into a
 * discovery + reach archetype. We surface that reasoning simply: animated step
 * labels play while `analyzeBusiness` runs, then the identified customer segments
 * slide in one-by-one. Never raw chain-of-thought — only the validated output.
 */

const STEPS = [
  'Understanding your business',
  'Mapping who needs you nearby',
  'Choosing how to find them',
  'Ranking who to pursue first',
] as const;

/** How each segment type reads as a short chip. */
const TYPE_LABEL: Record<CustomerSegmentType, string> = {
  'physical-business': 'Business',
  'residential-community': 'Residential',
  'event-venue': 'Event venue',
  'public-gathering': 'Public event',
  'partner-org': 'Partner',
};

/** Icon + verb per contact channel (contactability). */
const REACH_META: Record<OutreachChannel, { icon: string; label: string }> = {
  'walk-in': { icon: '🚶', label: 'Walk in' },
  phone: { icon: '📞', label: 'Call' },
  email: { icon: '✉️', label: 'Email' },
};

export default function AnalysisScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useInterview();
  const { load } = useOpportunities();

  // Always have input: fall back to a demo profile on a deep-link / cold start.
  const activeProfile = useMemo<InterviewProfile>(
    () => profile ?? summarizeInterviewLocal([], demoBusiness),
    [profile],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null);
  const [meta, setMeta] = useState<InferenceMeta | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  // 1. Kick off on-device reasoning once, and prime the ranking pipeline with the
  //    real analysis so "who to look for" flows through to "where to go".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await analyzeBusiness(activeProfile);
      if (cancelled) return;
      setAnalysis(res.data);
      setMeta(res.meta);
      void load(activeProfile, res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfile, load]);

  // 2. Advance the animated step checklist on a gentle cadence.
  useEffect(() => {
    if (stepIndex >= STEPS.length) return;
    const t = setTimeout(() => setStepIndex((i) => i + 1), stepIndex === 0 ? 400 : 700);
    return () => clearTimeout(t);
  }, [stepIndex]);

  const stepsDone = stepIndex >= STEPS.length;
  // Reveal only once the steps have played AND real reasoning has returned. The
  // service guarantees resolution within its timeout (else the deterministic
  // fallback answers), so this never hangs.
  const revealing = stepsDone && analysis !== null;
  const segments = analysis?.targetSegments ?? [];

  // 3. Slide the segment cards in one-by-one.
  useEffect(() => {
    if (!revealing) return;
    if (revealCount >= segments.length) return;
    const t = setTimeout(() => setRevealCount((c) => c + 1), revealCount === 0 ? 150 : 450);
    return () => clearTimeout(t);
  }, [revealing, revealCount, segments.length]);

  const allRevealed = revealing && revealCount >= segments.length;

  if (!revealing) {
    return (
      <Screen>
        <View style={[styles.thinking, { backgroundColor: theme.infoSubtle }]}>
          <ActivityIndicator color={theme.info} />
          <ThemedText type="subtitle" style={{ color: theme.info }}>
            Reasoning about who to look for…
          </ThemedText>

          <View style={styles.steps}>
            {STEPS.map((label, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <View key={label} style={styles.stepRow}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: done ? theme.info : active ? theme.text : theme.textMuted }}
                  >
                    {done ? '✓' : active ? '›' : '•'}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: done || active ? theme.text : theme.textMuted }}
                  >
                    {label}
                  </ThemedText>
                </View>
              );
            })}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.privacy}>
            Gemma 4 is reasoning privately on your device.
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.info }}>
          {meta?.source === 'gemma' ? 'REASONED ON YOUR DEVICE' : 'PREPARED ON YOUR DEVICE'}
        </ThemedText>
        <ThemedText type="subtitle">Who to look for</ThemedText>
        {analysis?.focus ? (
          <ThemedText type="default" themeColor="textSecondary">
            {analysis.focus}
          </ThemedText>
        ) : null}
      </View>

      {segments.slice(0, revealCount).map((segment, i) => (
        <SegmentCard key={`${segment.label}-${i}`} segment={segment} />
      ))}

      {allRevealed ? (
        <PrimaryButton label="See where to go" onPress={() => router.push('/opportunities')} />
      ) : null}
    </Screen>
  );
}

/** A single customer-segment card that fades + slides in as it mounts. */
function SegmentCard({ segment }: { segment: CustomerSegment }) {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [anim]);

  const reach = REACH_META[segment.reach];

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Card>
        <View style={styles.cardHead}>
          <ThemedText type="bodyBold" style={styles.cardTitle}>
            {segment.label}
          </ThemedText>
          <View style={[styles.chip, { backgroundColor: theme.accentSubtle }]}>
            <ThemedText type="caption" style={{ color: theme.accent }}>
              {TYPE_LABEL[segment.type]}
            </ThemedText>
          </View>
        </View>

        {segment.whoTheyAre ? (
          <ThemedText type="small" themeColor="textSecondary">
            {segment.whoTheyAre}
          </ThemedText>
        ) : null}

        {segment.discovery ? (
          <ThemedText type="small">
            🔎 Find: <ThemedText type="smallBold">{segment.discovery}</ThemedText>
          </ThemedText>
        ) : null}

        <ThemedText type="small">
          {reach.icon} Reach: <ThemedText type="smallBold">{reach.label}</ThemedText>
        </ThemedText>

        {segment.why ? (
          <ThemedText type="caption" themeColor="textMuted">
            {segment.why}
          </ThemedText>
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  thinking: {
    gap: Spacing.three,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
  },
  steps: { gap: Spacing.two, alignSelf: 'stretch' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  privacy: { textAlign: 'center' },
  header: { gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  cardTitle: { flexShrink: 1 },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.pill },
});
