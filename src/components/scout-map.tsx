/**
 * ScoutMap — the growth-plan hero map, on REAL map tiles.
 *
 * Native renders react-native-maps (Apple Maps on iOS — no API key; Google Maps
 * on Android with a key), with our own pin design on top: category icon, score
 * on the selected pin, a "You" marker, and the service-radius ring. Selection
 * syncs both ways with the card carousel, and the camera glides to the selected
 * pin as the owner swipes.
 *
 * Resilience (CLAUDE.md: guard against map render failure): if the native map
 * module is missing (e.g. a dev client built before react-native-maps was
 * added) or the map throws while rendering, an error boundary drops to the
 * fully offline SchematicMap — same props, same pins, real relative positions.
 * Web always uses the schematic via scout-map.web.tsx.
 */

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type MapViewType from 'react-native-maps';
import type { Region } from 'react-native-maps';

import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  PlannedBadge,
  SchematicMap,
  type GeoPoint,
  type ScoutMapProps,
} from '@/components/schematic-map';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export { CATEGORY_ICON, CATEGORY_LABEL };

const METERS_PER_MILE = 1609.34;

/** The maps module, when this binary actually contains its native views. */
type RNMapsModule = typeof import('react-native-maps');
let RNMaps: RNMapsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RNMaps = require('react-native-maps');
} catch {
  RNMaps = null;
}

export function ScoutMap(props: ScoutMapProps) {
  if (!RNMaps) return <SchematicMap {...props} />;
  return (
    <MapFallbackBoundary fallback={<SchematicMap {...props} />}>
      <TileMap {...props} maps={RNMaps} />
    </MapFallbackBoundary>
  );
}

/**
 * A missing/broken native map view throws during render (not at require time —
 * e.g. a dev client that predates react-native-maps). Catch and show the
 * schematic instead of a crash; the demo keeps moving.
 */
class MapFallbackBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Fit the camera to the owner + every opportunity, with breathing room. */
function regionFor(points: GeoPoint[]): Region {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.03, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.03, (maxLng - minLng) * 1.6),
  };
}

function TileMap({
  opportunities,
  origin,
  radiusMiles,
  selectedId,
  onSelect,
  plannedIds,
  maps,
}: ScoutMapProps & { maps: RNMapsModule }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const MapView = maps.default;
  const { Marker, Circle } = maps;
  const mapRef = useRef<MapViewType | null>(null);

  // Fit once per plan — the joined ids capture "a different set of places".
  const planKey = opportunities.map((o) => o.id).join(',');
  const initialRegion = useMemo(
    () => regionFor([origin, ...opportunities]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.latitude, origin.longitude, planKey],
  );

  // The reveal: markers MOUNT one by one in rank order, so Gemma's picks land
  // on the map best-first. Mount-staggering (instead of animating the marker
  // view) stays reliable on providers that snapshot marker children. State is
  // keyed by plan so a new set of places restarts the landing by derivation.
  const [pinReveal, setPinReveal] = useState<{ key: string; count: number }>({
    key: planKey,
    count: 0,
  });
  const visiblePins = reduceMotion
    ? opportunities.length
    : pinReveal.key === planKey
      ? pinReveal.count
      : 0;
  useEffect(() => {
    if (reduceMotion || visiblePins >= opportunities.length) return;
    const timer = setTimeout(() => setPinReveal({ key: planKey, count: visiblePins + 1 }), 110);
    return () => clearTimeout(timer);
  }, [planKey, reduceMotion, visiblePins, opportunities.length]);

  // Card ↔ pin sync: glide the camera to the selected place (zoom unchanged).
  useEffect(() => {
    const selected = opportunities.find((o) => o.id === selectedId);
    if (!selected) return;
    mapRef.current?.animateCamera(
      { center: { latitude: selected.latitude, longitude: selected.longitude } },
      { duration: 350 },
    );
  }, [selectedId, opportunities]);

  return (
    <View style={styles.container} accessibilityLabel={`Map of ${opportunities.length} nearby opportunities`}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {radiusMiles ? (
          <Circle
            center={origin}
            radius={radiusMiles * METERS_PER_MILE}
            strokeColor={theme.accent}
            strokeWidth={1}
            fillColor="rgba(45,90,39,0.05)"
          />
        ) : null}

        <Marker coordinate={origin} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.origin}>
            <View style={[styles.originDot, { backgroundColor: theme.accent, borderColor: theme.background }]} />
            <View style={[styles.originLabel, { backgroundColor: theme.background }]}>
              <ThemedText type="caption" themeColor="textSecondary">
                You
              </ThemedText>
            </View>
          </View>
        </Marker>

        {opportunities.slice(0, visiblePins).map((o) => {
          const selected = o.id === selectedId;
          const planned = plannedIds?.has(o.id) ?? false;
          return (
            <Marker
              // Selection/plan state changes the pin's content — re-keying
              // forces the marker view to refresh reliably on both providers.
              key={`${o.id}-${selected ? 'sel' : 'idle'}-${planned ? 'plan' : 'open'}`}
              coordinate={{ latitude: o.latitude, longitude: o.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={selected ? 2 : 1}
              tracksViewChanges={false}
              onPress={() => onSelect(o.id)}
              accessibilityLabel={`${o.name}, ${CATEGORY_LABEL[o.category]}, score ${o.score}${planned ? ', on today’s plan' : ''}`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.pin,
                  {
                    width: selected ? 52 : 36,
                    height: selected ? 52 : 36,
                    borderRadius: selected ? 26 : 18,
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
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  origin: { alignItems: 'center', gap: 2 },
  originDot: { width: 14, height: 14, borderRadius: Radius.pill, borderWidth: 3 },
  originLabel: {
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    opacity: 0.9,
  },
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
});
