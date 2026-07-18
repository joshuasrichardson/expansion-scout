import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import {
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
import { useTheme } from '@/hooks/use-theme';
import type { RankedOpportunity } from '@/services/gemma';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';
import { travelMinutesFor } from '@/state/plan-context';

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
  const { status, loadingDetail, ranked, rankMeta, placesSource, selectedId, select, load } =
    useOpportunities();

  const listRef = useRef<FlatList<RankedOpportunity>>(null);
  const cardWidth = Math.min(width, 800) - Spacing.four * 2;
  const snap = cardWidth + Spacing.three;

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

  return (
    <ThemedView style={styles.root}>
      <View style={styles.map}>
        <ScoutMap
          opportunities={ranked}
          origin={origin}
          radiusMiles={business!.profile.serviceRadiusMiles}
          selectedId={selectedId}
          onSelect={onPinPress}
        />
        <View style={[styles.provenance, { backgroundColor: theme.background }]}>
          <ThemedText type="caption" style={{ color: theme.info }}>
            {rankMeta?.source === 'gemma' ? '⬤ Ranked by Gemma on this device' : '○ Ranked on this device'}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            {placesSource === 'live' ? 'Places via Google' : 'Targets from your profile'}
          </ThemedText>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cards}>
        <ThemedText type="label" themeColor="textMuted" style={styles.cardsLabel}>
          {ranked.length} PLACES TO GROW · SWIPE TO EXPLORE
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
          renderItem={({ item }) => (
            <OpportunityCard
              opportunity={item}
              width={cardWidth}
              selected={item.id === selectedId}
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

function OpportunityCard({
  opportunity: o,
  width,
  selected,
  onDetails,
}: {
  opportunity: RankedOpportunity;
  width: number;
  selected: boolean;
  onDetails: () => void;
}) {
  const theme = useTheme();
  return (
    <Card
      style={{
        width,
        borderColor: selected ? theme.accent : theme.border,
        borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
      }}
    >
      <View style={styles.cardTop}>
        <ThemedText type="bodyBold" style={styles.cardName} numberOfLines={1}>
          {o.name}
        </ThemedText>
        <View style={[styles.scoreBadge, { backgroundColor: theme.scoreSubtle }]}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>
            {o.score}
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
  );
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
  scoreBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
    minWidth: 36,
    alignItems: 'center',
  },
});
