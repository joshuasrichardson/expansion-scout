import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ReasoningPulse } from '@/components/reasoning-pulse';
import { CATEGORY_ICON, CATEGORY_LABEL, ScoutMap } from '@/components/scout-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import type { RankedOpportunity } from '@/services/gemma';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';
import { travelMinutesFor, usePlan } from '@/state/plan-context';

/**
 * Today's Growth Plan (T7) — the hero screen. Map on top (~55%), swipeable
 * ranked cards below; tapping a pin scrolls to its card and swiping cards moves
 * the pin selection. Everything shown was reasoned on-device over the owner's
 * own business.
 */
export default function OpportunitiesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { business, hydrated, interviewProfile } = useBusiness();
  const { status, loadingDetail, ranked, readyAt, rankMeta, placesSource, selectedId, select, load } =
    useOpportunities();
  const { stops } = usePlan();

  const listRef = useRef<FlatList<RankedOpportunity>>(null);
  const cardWidth = Math.min(width, 800) - Spacing.four * 2;
  const snap = cardWidth + Spacing.three;

  const plannedIds = useMemo(() => new Set(stops.map((s) => s.opportunityId)), [stops]);

  // Deep link / relaunch: if the pipeline hasn't run this session, run it now
  // from the stored business (with any cached analysis). Never hangs — every
  // stage inside degrades deterministically.
  useEffect(() => {
    if (status === 'idle' && business) {
      void load(interviewProfile ?? business.profile, business.analysis);
    }
  }, [status, business, interviewProfile, load]);

  const scrollToId = useCallback(
    (id: string) => {
      const index = ranked.findIndex((o) => o.id === id);
      if (index >= 0) listRef.current?.scrollToOffset({ offset: index * snap, animated: true });
    },
    [ranked, snap],
  );

  const onPinPress = useCallback(
    (id: string) => {
      select(id);
      scrollToId(id);
    },
    [select, scrollToId],
  );

  // Must be referentially stable for FlatList; `select` is a stable callback.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as RankedOpportunity | undefined;
      if (first) select(first.id);
    },
    [select],
  );

  if (hydrated && !business) return <Redirect href="/profile" />;

  if (status !== 'ready' || ranked.length === 0) {
    return (
      <ThemedView style={styles.loadingRoot}>
        <ReasoningPulse size={48} />
        <ThemedText type="subtitle" style={{ color: theme.info }}>
          Assembling today&apos;s growth plan
        </ThemedText>
        {/* Live pipeline stage — real reports from discovery/ranking, not canned copy. */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.loadingDetail}>
          {loadingDetail ?? 'Lining up discovery and on-device reasoning…'}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          Google discovers places · Gemma reasons privately on your device
        </ThemedText>
      </ThemedView>
    );
  }

  const origin = { latitude: business!.profile.latitude, longitude: business!.profile.longitude };
  const avgTravel = Math.round(
    ranked.reduce((sum, o) => sum + travelMinutesFor(o.distanceMiles), 0) / ranked.length,
  );

  return (
    <ThemedView style={styles.root}>
      <View style={styles.map}>
        <ScoutMap
          opportunities={ranked}
          origin={origin}
          radiusMiles={business!.profile.serviceRadiusMiles}
          selectedId={selectedId}
          onSelect={onPinPress}
          plannedIds={plannedIds}
        />
        <View style={[styles.provenance, { backgroundColor: theme.background }]}>
          <ThemedText type="caption" style={{ color: theme.info }}>
            {rankMeta?.source === 'gemma'
              ? `⬤ Ranked by Gemma on this device · ${(rankMeta.latencyMs / 1000).toFixed(1)}s`
              : '○ Ranked on this device'}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            {placesSource === 'live' ? 'Places via Google' : 'Targets from your profile'}
          </ThemedText>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cards}>
        <ThemedText type="label" themeColor="textMuted" style={styles.cardsLabel}>
          {ranked.length} PLACES TO GROW · AVG {avgTravel} MIN AWAY · SWIPE
        </ThemedText>
        <FlatList
          ref={listRef}
          data={ranked}
          keyExtractor={(o) => o.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snap}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: Spacing.three }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          getItemLayout={(_, index) => ({ length: snap, offset: index * snap, index })}
          renderItem={({ item, index }) => (
            <OpportunityCard
              opportunity={item}
              width={cardWidth}
              selected={item.id === selectedId}
              planned={plannedIds.has(item.id)}
              topPick={index === 0 && ranked.length > 1 && rankMeta?.source === 'gemma'}
              entranceDelay={entranceDelayFor(index, readyAt)}
              onDetails={() =>
                router.push({ pathname: '/opportunity/[id]', params: { id: item.id } })
              }
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Stagger cards that mount during the reveal window (pins land first, then the
 * cards follow); anything mounted later — swiping, coming back — is instant.
 */
function entranceDelayFor(index: number, readyAt: number | null): number {
  if (readyAt === null || Date.now() - readyAt > 1500) return 0;
  return 250 + Math.min(index, 4) * 110;
}

function OpportunityCard({
  opportunity: o,
  width,
  selected,
  planned,
  topPick,
  entranceDelay,
  onDetails,
}: {
  opportunity: RankedOpportunity;
  width: number;
  selected: boolean;
  planned: boolean;
  topPick: boolean;
  entranceDelay: number;
  onDetails: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));
  const score = useCountUp(o.score, entranceDelay + 200, reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    const entrance = Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      delay: entranceDelay,
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
    // Entrance runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      <Card
        style={{
          width,
          borderColor: selected ? theme.accent : theme.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        }}
      >
        {topPick && (
          <ThemedText type="caption" style={[styles.topPick, { color: theme.accent }]}>
            ★ GEMMA&apos;S TOP PICK
          </ThemedText>
        )}

        <View style={styles.cardTop}>
          <ThemedText type="bodyBold" style={styles.cardName} numberOfLines={1}>
            {o.name}
          </ThemedText>
          {planned && (
            <View
              accessibilityLabel="On today's plan"
              style={[styles.plannedChip, { backgroundColor: theme.accentSubtle }]}
            >
              <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                ✓ Planned
              </ThemedText>
            </View>
          )}
          <View style={[styles.scoreBadge, { backgroundColor: theme.scoreSubtle }]}>
            <ThemedText type="smallBold" style={{ color: theme.warning }}>
              {score}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {CATEGORY_ICON[o.category]} {CATEGORY_LABEL[o.category]} · 🚗 {travelMinutesFor(o.distanceMiles)} min ·
          ⏰ {o.bestTime}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {o.reasons[0] ?? o.summary}
        </ThemedText>

        <PrimaryButton label="View details" variant="secondary" onPress={onDetails} />
      </Card>
    </Animated.View>
  );
}

/**
 * Count a score up from 0 as its card lands — decorative, so reduced motion
 * (or a late mount) shows the real number immediately.
 */
function useCountUp(target: number, delayMs: number, disabled: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (disabled) return;
    let raf = 0;
    let start: number | null = null;
    const DURATION_MS = 620;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs, disabled]);

  return disabled ? target : value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  loadingDetail: { textAlign: 'center' },
  map: { flex: 1.2 },
  provenance: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
    opacity: 0.94,
  },
  cards: { paddingVertical: Spacing.three, gap: Spacing.two },
  cardsLabel: { paddingHorizontal: Spacing.four },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardName: { flex: 1 },
  topPick: { letterSpacing: 1.2, fontWeight: '700' },
  plannedChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
    minWidth: 36,
    alignItems: 'center',
  },
});
