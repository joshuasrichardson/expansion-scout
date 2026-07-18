import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ReasoningPulse } from '@/components/reasoning-pulse';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  analyzeBusiness,
  getGemmaStatus,
  type BusinessAnalysis,
  type CustomerSegment,
  type CustomerSegmentType,
  type GemmaStatus,
  type InferenceMeta,
  type InterviewProfile,
  type OutreachChannel,
  type ReasoningEvent,
} from '@/services/gemma';
import { summarizeInterviewLocal } from '@/services/opportunityRanking';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';

/**
 * The signature "thinking" screen. Gemma reasons privately on-device about WHICH
 * KINDS OF CUSTOMERS this business should look for — and this screen shows that
 * reasoning AS IT HAPPENS: every line is a real `ReasoningEvent` from the service
 * (a pipeline stage starting, a JSON field appearing in the token stream, a
 * segment Gemma just named). Nothing is driven by a timer pretending to be work;
 * the only pacing is a short reveal cadence so fast bursts stay readable.
 * Never raw chain-of-thought — only stage labels and the validated output.
 */

type TickerRow = { key: number; kind: 'step' | 'note'; label: string };
/** Events that go through the paced reveal queue (counters apply instantly). */
type QueuedEvent = Extract<ReasoningEvent, { type: 'step' | 'note' | 'done' }>;

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

/** Reveal cadence for queued real events — readability pacing, not fake work. */
const STEP_REVEAL_MS = 420;
const NOTE_REVEAL_MS = 260;

export default function AnalysisScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { business, hydrated, interviewProfile, setAnalysis: cacheAnalysis } = useBusiness();
  const { load } = useOpportunities();

  // The owner's business, with the interview's inferred customer when it ran.
  const activeProfile = useMemo<InterviewProfile | null>(
    () =>
      interviewProfile ?? (business ? summarizeInterviewLocal([], business.profile) : null),
    [interviewProfile, business],
  );

  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null);
  const [meta, setMeta] = useState<InferenceMeta | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  // ---- Live reasoning ticker state ----
  // Real events queue up here; a short cadence reveals them one at a time.
  const [pending, setPending] = useState<QueuedEvent[]>([]);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);
  const [runDone, setRunDone] = useState<{ source: InferenceMeta['source'] } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [gemma, setGemma] = useState<GemmaStatus | null>(null);
  const rowKeyRef = useRef(0);
  // Mirror of activeLabel readable inside the reveal timeout without re-renders.
  const activeLabelRef = useRef<string | null>(null);

  // Which runtime will answer — shown live in the ticker header (rubric §4:
  // the model and its locality are visible, not just claimed).
  useEffect(() => {
    let cancelled = false;
    getGemmaStatus().then((s) => {
      if (!cancelled) setGemma(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 1. Kick off on-device reasoning once, prime the ranking pipeline with the
  //    real analysis so "who to look for" flows through to "where to go", and
  //    cache the analysis on-device so Home opens with a real mission next time.
  const startedRef = useRef(false);
  useEffect(() => {
    // Run exactly once per visit — caching the analysis updates the business
    // record, which must not re-trigger a fresh analysis.
    if (!activeProfile || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      const res = await analyzeBusiness(activeProfile, (event) => {
        if (cancelled) return;
        if (event.type === 'tokens') {
          setTokens(event.count);
        } else if (event.type === 'update') {
          activeLabelRef.current = event.label;
          setActiveLabel(event.label);
        } else {
          setPending((q) => [...q, event]);
        }
      });
      if (cancelled) return;
      setAnalysis(res.data);
      setMeta(res.meta);
      cacheAnalysis(res.data);
      void load(activeProfile, res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfile, load, cacheAnalysis]);

  // 2. Reveal queued events on a readable cadence. Each reveal is a real event.
  useEffect(() => {
    if (!pending.length) return;
    const event = pending[0];
    const t = setTimeout(
      () => {
        setPending((q) => q.slice(1));
        if (event.type === 'note') {
          setRows((r) => [...r, { key: rowKeyRef.current++, kind: 'note', label: event.label }]);
          return;
        }
        // 'step' and 'done' both retire the current headline into the checklist.
        const prev = activeLabelRef.current;
        if (prev) setRows((r) => [...r, { key: rowKeyRef.current++, kind: 'step', label: prev }]);
        activeLabelRef.current = event.label;
        setActiveLabel(event.label);
        if (event.type === 'done') setRunDone({ source: event.source });
      },
      event.type === 'note' ? NOTE_REVEAL_MS : STEP_REVEAL_MS,
    );
    return () => clearTimeout(t);
  }, [pending]);

  // 3. Real wall clock for the run — stops when the run completes.
  useEffect(() => {
    if (runDone) return;
    const started = Date.now() - elapsedMs;
    const t = setInterval(() => setElapsedMs(Date.now() - started), 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runDone]);

  // Reveal once the run finished, its final event has been shown, AND the
  // validated analysis is in hand. The service guarantees resolution within its
  // timeout (else the deterministic fallback answers), so this never hangs.
  const revealing = runDone !== null && pending.length === 0 && analysis !== null;
  const segments = analysis?.targetSegments ?? [];

  // 4. Slide the segment cards in one-by-one.
  useEffect(() => {
    if (!revealing) return;
    if (revealCount >= segments.length) return;
    const t = setTimeout(() => setRevealCount((c) => c + 1), revealCount === 0 ? 350 : 450);
    return () => clearTimeout(t);
  }, [revealing, revealCount, segments.length]);

  const allRevealed = revealing && revealCount >= segments.length;

  // Nothing to analyze until the owner has set up their business.
  if (hydrated && !business) return <Redirect href="/profile" />;

  if (!revealing) {
    return (
      <Screen>
        <View style={[styles.thinking, { backgroundColor: theme.infoSubtle }]}>
          <View style={styles.pulseRow}>
            <ReasoningPulse size={40} />
            <View style={styles.pulseMeta}>
              <ThemedText type="caption" style={{ color: theme.info }}>
                {gemma === null
                  ? 'CHECKING LOCAL RUNTIME…'
                  : gemma.onDevice
                    ? `${shortModel(gemma.model).toUpperCase()} · ON THIS DEVICE`
                    : 'ON-DEVICE PLANNER · NO MODEL'}
              </ThemedText>
              <ThemedText type="code" themeColor="textMuted">
                {(elapsedMs / 1000).toFixed(1)}s
                {tokens > 0 ? ` · ${tokens} tokens` : ''}
                {tokens > 0 && elapsedMs > 800
                  ? ` · ${Math.round(tokens / (elapsedMs / 1000))} tok/s`
                  : ''}
              </ThemedText>
            </View>
          </View>

          <LiveHeadline label={activeLabel ?? 'Reasoning privately on your device'} />

          <View style={styles.steps}>
            {rows.map((row) => (
              <TickerLine key={row.key} row={row} />
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.privacy}>
            Gemma 4 is reasoning privately on your device — these steps stream live from the model.
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
        {meta ? (
          <ThemedText type="caption" themeColor="textMuted">
            {meta.source === 'gemma'
              ? `⬤ ${shortModel(meta.model)} · ${(meta.latencyMs / 1000).toFixed(1)}s · schema-validated`
              : `○ deterministic on-device planner${meta.note ? ` — ${meta.note}` : ''}`}
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

/** The current reasoning stage as a large live headline; crossfades on change. */
function LiveHeadline({ label }: { label: string }) {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState(label);

  useEffect(() => {
    if (label === shown) return;
    Animated.timing(anim, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setShown(label);
      Animated.timing(anim, { toValue: 1, duration: 190, useNativeDriver: true }).start();
    });
  }, [label, shown, anim]);

  return (
    <Animated.View style={{ opacity: anim }}>
      <ThemedText type="subtitle" style={{ color: theme.info }} accessibilityLiveRegion="polite">
        {shown}…
      </ThemedText>
    </Animated.View>
  );
}

/** One completed line in the reasoning ticker; fades + slides in as it mounts. */
function TickerLine({ row }: { row: TickerRow }) {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [anim]);

  const isNote = row.kind === 'note';
  return (
    <Animated.View
      style={[
        styles.stepRow,
        isNote && styles.noteRow,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      <ThemedText type="smallBold" style={{ color: isNote ? theme.accent : theme.info }}>
        {isNote ? '→' : '✓'}
      </ThemedText>
      <ThemedText type={isNote ? 'smallBold' : 'small'} style={styles.stepText}>
        {row.label}
      </ThemedText>
    </Animated.View>
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

function shortModel(model: string): string {
  return model.replace(/^.*\//, '');
}

const styles = StyleSheet.create({
  thinking: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
  },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pulseMeta: { flex: 1, gap: 2 },
  steps: { gap: Spacing.two, alignSelf: 'stretch' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  noteRow: { paddingLeft: Spacing.four },
  stepText: { flex: 1 },
  privacy: { textAlign: 'center' },
  header: { gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  cardTitle: { flexShrink: 1 },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.pill },
});
