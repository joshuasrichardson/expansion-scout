import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

/**
 * Expansion Scout brand logo.
 *
 * - `full`  — compass mark + "EXPANSION SCOUT" wordmark lockup (launch / hero).
 * - `mark`  — compass emblem only (headers, tight spaces).
 *
 * Source art is the Stitch-generated mark; app-icon variants live in
 * `assets/images/` and are wired through `app.json`.
 */
type LogoVariant = 'full' | 'mark';

const SOURCES = {
  full: require('@/assets/images/logo-full.png'),
  mark: require('@/assets/images/logo-mark.png'),
} as const;

/** Intrinsic aspect ratios (width / height) of each source asset. */
const ASPECT: Record<LogoVariant, number> = {
  full: 1, // square lockup (1134×1134)
  mark: 1, // square mark (512×512)
};

export function Logo({
  variant = 'full',
  width = 220,
}: {
  variant?: LogoVariant;
  width?: number;
}) {
  return (
    <Image
      source={SOURCES[variant]}
      style={[styles.image, { width, height: width / ASPECT[variant] }]}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="Expansion Scout"
    />
  );
}

const styles = StyleSheet.create({
  image: { alignSelf: 'center' },
});
