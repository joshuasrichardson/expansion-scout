import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing, Typography, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Living style guide for the Expansion Scout design system.
 * Renders the color ramps, type scale, and button variants straight from the
 * tokens in constants/theme.ts, so it stays truthful as the system evolves.
 */
export default function DesignSystemScreen() {
  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="title">Design System</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Expansion Scout — find where your business should grow next.
        </ThemedText>
      </View>

      <ColorSection />
      <TypeSection />
      <ButtonSection />
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const COLOR_FAMILIES = [
  { name: 'Primary', base: '#2D5A27', ramp: Palette.green, role: 'Forest green · brand accent' },
  { name: 'Secondary', base: '#3B82F6', ramp: Palette.blue, role: 'Blue · AI-reasoning accents' },
  { name: 'Tertiary', base: '#F59E0B', ramp: Palette.amber, role: 'Amber · opportunity scores' },
  { name: 'Neutral', base: '#1A1A1A', ramp: Palette.neutral, role: 'Warm charcoal · type & surfaces' },
] as const;

function ColorSection() {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">Color</ThemedText>
      {COLOR_FAMILIES.map((f) => (
        <Card key={f.name}>
          <View style={styles.rowBetween}>
            <ThemedText type="bodyBold">{f.name}</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">
              {f.base}
            </ThemedText>
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {f.role}
          </ThemedText>
          <View style={styles.ramp}>
            {RAMP_STEPS.map((step) => (
              <View
                key={step}
                style={[styles.rampSwatch, { backgroundColor: (f.ramp as Record<number, string>)[step] }]}
              />
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

const TYPE_SAMPLES: { variant: TypographyVariant; sample: string }[] = [
  { variant: 'display', sample: 'Display' },
  { variant: 'title', sample: 'Title' },
  { variant: 'subtitle', sample: 'Subtitle' },
  { variant: 'body', sample: 'Body — the quick brown fox.' },
  { variant: 'bodyBold', sample: 'Body bold — the quick brown fox.' },
  { variant: 'small', sample: 'Small — supporting copy.' },
  { variant: 'smallBold', sample: 'Small bold — supporting copy.' },
  { variant: 'label', sample: 'LABEL / UI CHROME' },
  { variant: 'caption', sample: 'Caption metadata' },
];

const FAMILY_LABEL: Partial<Record<TypographyVariant, string>> = {
  display: 'Hanken Grotesk',
  body: 'Inter',
  label: 'Geist',
};

function TypeSection() {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">Typography</ThemedText>
      <Card>
        {TYPE_SAMPLES.map((s) => (
          <View key={s.variant} style={styles.typeRow}>
            <ThemedText type={s.variant}>{s.sample}</ThemedText>
            {FAMILY_LABEL[s.variant] && (
              <ThemedText type="caption" themeColor="textSecondary">
                {FAMILY_LABEL[s.variant]}
              </ThemedText>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function ButtonSection() {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">Buttons</ThemedText>
      <Card>
        <View style={styles.buttonGrid}>
          <PrimaryButton label="Primary" variant="primary" onPress={() => {}} style={styles.gridButton} />
          <PrimaryButton label="Secondary" variant="secondary" onPress={() => {}} style={styles.gridButton} />
          <PrimaryButton label="Inverted" variant="inverted" onPress={() => {}} style={styles.gridButton} />
          <PrimaryButton label="Outlined" variant="outlined" onPress={() => {}} style={styles.gridButton} />
        </View>
      </Card>

      <ThemedText type="subtitle">Status</ThemedText>
      <Card>
        <View style={styles.chipRow}>
          {(['success', 'warning', 'danger', 'info', 'score'] as const).map((token) => (
            <View key={token} style={[styles.chip, { backgroundColor: theme[token] }]}>
              <ThemedText type="caption" style={{ color: theme.onAccent }}>
                {token}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ramp: {
    flexDirection: 'row',
    marginTop: Spacing.two,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  rampSwatch: { flex: 1, height: 40 },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  buttonGrid: { gap: Spacing.two },
  gridButton: { width: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
