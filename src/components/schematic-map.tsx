/**
 * SchematicMap — the fully offline fallback map for the growth-plan hero screen.
 *
 * This is what renders when real map tiles can't (web, airplane mode, a dev
 * client built without react-native-maps, or any map render failure): the true
 * lat/lng of every opportunity (plus the owner's location) projected onto a
 * styled canvas with range rings. Relative positions and distances are real;
 * only the imagery is stylized. `ScoutMap` (scout-map.tsx) renders real Apple/
 * Google map tiles and falls back to this component.
 *
 * Pins distinguish category by ICON, not color alone (a11y — rubric §3), and the
 * selected pin swells + shows its score. Selection syncs both ways with the
 * card carousel via `selectedId` / `onSelect`.
 */

import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import type { OpportunityCategory, RankedOpportunity } from '@/services/gemma';

export const CATEGORY_ICON: Record<OpportunityCategory, string> = {
  recurring: '🔁',
  partnership: '🤝',
  event: '🎪',
  direct: '📍',
};

/** Owner-readable category names for cards, details, and plan stops. */
export const CATEGORY_LABEL: Record<OpportunityCategory, string> = {
  recurring: 'Standing account',
  partnership: 'Partnership',
  event: 'Event',
  direct: 'Walk-up spot',
};

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ScoutMapProps {
  opportunities: RankedOpportunity[];
  /** The owner's own location — rendered as the "You" marker. */
  origin: GeoPoint;
  /** The service radius, drawn as a ring around the owner when given. */
  radiusMiles?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Opportunity ids already on today's plan — their pins wear a check badge. */
  plannedIds?: ReadonlySet<string>;
}

/** Linear geo → pixel projection over the padded bounding box of all points. */
function projector(points: GeoPoint[], width: number, height: number) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  // Epsilon keeps a single point (or a straight line) from collapsing the box.
  const minLat = Math.min(...lats) - 0.004;
  const maxLat = Math.max(...lats) + 0.004;
  const minLng = Math.min(...lngs) - 0.004;
  const maxLng = Math.max(...lngs) + 0.004;
  const pad = 0.12;
  return (p: GeoPoint) => ({
    x: (pad + ((p.longitude - minLng) / (maxLng - minLng)) * (1 - 2 * pad)) * width,
    y: (pad + ((maxLat - p.latitude) / (maxLat - minLat)) * (1 - 2 * pad)) * height,
  });
}

export function SchematicMap({ opportunities, origin, selectedId, onSelect, plannedIds }: ScoutMapProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const ready = size.width > 0 && size.height > 0 && opportunities.length > 0;
  const project = ready ? projector([origin, ...opportunities], size.width, size.height) : null;
  const originXY = project?.(origin);

  return (
    <View
      onLayout={onLayout}
      style={[styles.canvas, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      accessibilityLabel={`Map of ${opportunities.length} nearby opportunities`}
    >
      {/* Range rings around the owner — stylized, not tiles, so it never fails offline. */}
      {originXY &&
        [0.28, 0.55, 0.85].map((r) => (
          <View
            key={r}
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderColor: theme.border,
                width: size.width * r * 2,
                height: size.width * r * 2,
                borderRadius: size.width * r,
                left: originXY.x - size.width * r,
                top: originXY.y - size.width * r,
              },
            ]}
          />
        ))}

      {/* The owner. */}
      {originXY && (
        <View pointerEvents="none" style={[styles.origin, { left: originXY.x - 22, top: originXY.y - 13 }]}>
          <View style={[styles.originDot, { backgroundColor: theme.accent, borderColor: theme.background }]} />
          <ThemedText type="caption" themeColor="textMuted">
            You
          </ThemedText>
        </View>
      )}

      {/* Opportunity pins — selected last so it stacks on top. */}
      {project &&
        [...opportunities]
          .sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0))
          .map((o) => (
            <SchematicPin
              key={o.id}
              opportunity={o}
              position={project(o)}
              selected={o.id === selectedId}
              planned={plannedIds?.has(o.id) ?? false}
              // Rank order (not render order) drives the drop-in stagger.
              rankIndex={opportunities.findIndex((r) => r.id === o.id)}
              onSelect={onSelect}
            />
          ))}
    </View>
  );
}

/**
 * One opportunity pin. Drops in on mount — staggered by rank so the reveal
 * reads "Gemma's picks landing, best first" — and wears a check badge once the
 * owner puts the place on today's plan.
 */
function SchematicPin({
  opportunity: o,
  position,
  selected,
  planned,
  rankIndex,
  onSelect,
}: {
  opportunity: RankedOpportunity;
  position: { x: number; y: number };
  selected: boolean;
  planned: boolean;
  rankIndex: number;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    const entrance = Animated.spring(anim, {
      toValue: 1,
      delay: Math.min(Math.max(rankIndex, 0), 8) * 90,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    });
    entrance.start();
    return () => entrance.stop();
    // Entrance runs once per mount; rank changes must not re-drop the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const half = selected ? 26 : 18;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: position.x - half,
        top: position.y - half,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${o.name}, ${CATEGORY_LABEL[o.category]}, score ${o.score}${planned ? ', on today’s plan' : ''}`}
        accessibilityState={{ selected }}
        onPress={() => onSelect(o.id)}
        style={[
          styles.pin,
          {
            width: half * 2,
            height: half * 2,
            borderRadius: half,
            backgroundColor: selected ? theme.accent : theme.background,
            borderColor: selected ? theme.accent : theme.border,
          },
        ]}
      >
        <ThemedText style={{ fontSize: selected ? 18 : 14, lineHeight: selected ? 22 : 18 }}>
          {CATEGORY_ICON[o.category]}
        </ThemedText>
        {selected && (
          <ThemedText type="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>
            {o.score}
          </ThemedText>
        )}
        {planned && <PlannedBadge />}
      </Pressable>
    </Animated.View>
  );
}

/** Tiny check badge for pins whose place is already on today's plan. */
export function PlannedBadge() {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.plannedBadge, { backgroundColor: theme.success, borderColor: theme.background }]}
    >
      <ThemedText style={styles.plannedCheck}>✓</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  ring: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  origin: { position: 'absolute', alignItems: 'center', width: 44, gap: 2 },
  originDot: { width: 14, height: 14, borderRadius: Radius.pill, borderWidth: 3 },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  plannedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannedCheck: { color: '#FFFFFF', fontSize: 9, lineHeight: 11, fontWeight: '700' },
});
