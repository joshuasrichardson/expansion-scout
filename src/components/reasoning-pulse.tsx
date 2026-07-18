/**
 * The "Gemma is thinking" indicator — a calm, branded pulse instead of a stock
 * spinner. A solid core dot with rings that expand and fade on a loop, in the
 * AI-reasoning blue (CLAUDE.md: blue = AI accents). Honors reduced-motion by
 * rendering the core dot statically with a soft halo.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const RING_DURATION_MS = 1600;
const RING_STAGGER_MS = 800;

export function ReasoningPulse({ size = 44 }: { size?: number }) {
  const theme = useTheme();
  const [rings] = useState(() => [new Animated.Value(0), new Animated.Value(0)]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduceMotion(!!v))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const animations = rings.map((value, i) =>
      Animated.sequence([
        Animated.delay(i * RING_STAGGER_MS),
        Animated.loop(
          Animated.timing(value, {
            toValue: 1,
            duration: RING_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ),
      ]),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [reduceMotion, rings]);

  const core = size * 0.3;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Reasoning on your device"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {!reduceMotion &&
        rings.map((value, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: theme.info,
                opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
                transform: [
                  { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
                ],
              },
            ]}
          />
        ))}
      {reduceMotion && (
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: theme.info,
              opacity: 0.25,
            },
          ]}
        />
      )}
      <View style={{ width: core, height: core, borderRadius: core / 2, backgroundColor: theme.info }} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5 },
});
