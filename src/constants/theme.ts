/**
 * Expansion Scout design system.
 *
 * Three layers, in dependency order:
 *   1. `Palette` — raw tonal ramps. The single source of truth for hue. Never
 *      reference these directly in a screen; go through `Colors`.
 *   2. `Colors`  — semantic, theme-aware tokens (light/dark). Screens read these
 *      via `useTheme()`. Renaming a hue only touches `Palette`.
 *   3. `Typography`, `Spacing`, `Radius`, `Fonts` — non-color primitives.
 *
 * Brand direction (see CLAUDE.md):
 *   • forest green  = primary brand accent
 *   • blue          = AI-reasoning accents ("Gemma is thinking")
 *   • amber         = opportunity scores ONLY
 *   • warm off-white backgrounds · deep charcoal type · muted gray secondary
 */

import '@/global.css';

import { Platform } from 'react-native';

/* -------------------------------------------------------------------------- */
/* 1. Palette — tonal ramps (10 steps, 50 → 900, plus base marker)            */
/* -------------------------------------------------------------------------- */

export const Palette = {
  /** Forest green — primary brand. Base = green.600 (#2D5A27). */
  green: {
    50: '#EDF5EC',
    100: '#D2E6CF',
    200: '#A6CDA0',
    300: '#79B370',
    400: '#4F9644',
    500: '#3B7A32',
    600: '#2D5A27', // base
    700: '#244A20',
    800: '#1B3818',
    900: '#12260F',
  },
  /** Blue — AI-reasoning accents. Base = blue.500 (#3B82F6). */
  blue: {
    50: '#EBF2FE',
    100: '#D6E4FD',
    200: '#AECAFB',
    300: '#85AFF9',
    400: '#5D96F8',
    500: '#3B82F6', // base
    600: '#1C6AF0',
    700: '#1553C1',
    800: '#103F92',
    900: '#0A2A61',
  },
  /** Amber — opportunity scores only. Base = amber.500 (#F59E0B). */
  amber: {
    50: '#FEF6E7',
    100: '#FDEBC4',
    200: '#FBD787',
    300: '#F9C34A',
    400: '#F7B01F',
    500: '#F59E0B', // base
    600: '#C67E08',
    700: '#955F06',
    800: '#644004',
    900: '#322002',
  },
  /** Warm charcoal neutral. Base = neutral.900 (#1A1A1A). */
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAF8', // warm off-white — app background
    100: '#F0F0EE',
    200: '#E2E2DF',
    300: '#C9C9C5',
    400: '#A3A3A0',
    500: '#7A7A77',
    600: '#575754',
    700: '#3D3D3B',
    800: '#262625',
    900: '#1A1A1A', // base
    950: '#0D0D0D',
  },
  /** Red — destructive actions only. */
  red: {
    50: '#FDECEC',
    100: '#FAD1D1',
    500: '#DC2626',
    600: '#B91C1C',
    700: '#991B1B',
  },
} as const;

/* -------------------------------------------------------------------------- */
/* 2. Colors — semantic, theme-aware tokens                                   */
/* -------------------------------------------------------------------------- */

const P = Palette;

export const Colors = {
  light: {
    // Surfaces
    background: P.neutral[50],
    backgroundElement: P.neutral[100],
    backgroundSelected: P.neutral[200],
    // Type
    text: P.neutral[900],
    textSecondary: P.neutral[600],
    textMuted: P.neutral[500],
    border: P.neutral[200],
    // Primary (forest green)
    accent: P.green[600],
    onAccent: P.neutral[0],
    accentSubtle: P.green[50],
    // AI reasoning (blue)
    info: P.blue[500],
    onInfo: P.neutral[0],
    infoSubtle: P.blue[50],
    // Opportunity score (amber)
    score: P.amber[500],
    onScore: P.neutral[900],
    scoreSubtle: P.amber[50],
    // Status
    success: P.green[500],
    warning: P.amber[600],
    danger: P.red[500],
    onDanger: P.neutral[0],
  },
  dark: {
    // Surfaces
    background: '#121210',
    backgroundElement: '#1E1E1B',
    backgroundSelected: '#2A2A26',
    // Type
    text: '#F5F5F2',
    textSecondary: '#B0B0AC',
    textMuted: '#84847F',
    border: '#2E2E2A',
    // Primary (forest green — brightened for dark)
    accent: P.green[400],
    onAccent: P.neutral[950],
    accentSubtle: 'rgba(79,150,68,0.16)',
    // AI reasoning (blue)
    info: P.blue[400],
    onInfo: P.neutral[950],
    infoSubtle: 'rgba(93,150,248,0.16)',
    // Opportunity score (amber)
    score: P.amber[400],
    onScore: P.neutral[950],
    scoreSubtle: 'rgba(247,176,31,0.16)',
    // Status
    success: P.green[300],
    warning: P.amber[400],
    danger: '#F87171',
    onDanger: P.neutral[950],
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/* -------------------------------------------------------------------------- */
/* 3a. Fonts — family stacks                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Design-system families:
 *   headline → Hanken Grotesk · body → Inter · label → Geist · mono.
 *
 * Web resolves the full fallback stacks from the CSS variables in `global.css`
 * (the real webfonts are @imported there, so `expo start --web` shows them).
 * Native currently falls back to the system font; to render the branded faces
 * on device, bundle them with `expo-font` / `@expo-google-fonts/*` and load via
 * `useFonts` in `_layout.tsx`, then swap the ios/android values below.
 */
export const Fonts = Platform.select({
  ios: {
    headline: 'system-ui',
    body: 'system-ui',
    label: 'system-ui',
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    headline: 'sans-serif',
    body: 'sans-serif',
    label: 'sans-serif',
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  default: {
    headline: 'normal',
    body: 'normal',
    label: 'normal',
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    headline: 'var(--font-headline)',
    body: 'var(--font-body)',
    label: 'var(--font-label)',
    sans: 'var(--font-body)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
})!;

/* -------------------------------------------------------------------------- */
/* 3b. Typography — named text styles                                         */
/* -------------------------------------------------------------------------- */

/**
 * The type scale. Keys map 1:1 to `ThemedText`'s `type` prop.
 * `family` picks the font role; `display`/`title`/`subtitle` use Hanken Grotesk,
 * body copy uses Inter, and `label`/UI chrome uses Geist.
 */
export const Typography = {
  display: { family: Fonts.headline, fontSize: 48, lineHeight: 52, fontWeight: '700' },
  title: { family: Fonts.headline, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  subtitle: { family: Fonts.headline, fontSize: 24, lineHeight: 30, fontWeight: '600' },
  body: { family: Fonts.body, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyBold: { family: Fonts.body, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  small: { family: Fonts.body, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  smallBold: { family: Fonts.body, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  label: { family: Fonts.label, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  caption: { family: Fonts.label, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  code: { family: Fonts.mono, fontSize: 12, lineHeight: 18, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof Typography;

/* -------------------------------------------------------------------------- */
/* 3c. Spacing, Radius, layout                                                */
/* -------------------------------------------------------------------------- */

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii. The design leans on large, friendly rounding. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
