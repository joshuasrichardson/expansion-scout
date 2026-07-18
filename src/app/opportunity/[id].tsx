import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { CATEGORY_ICON, CATEGORY_LABEL } from '@/components/scout-map';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RankedOpportunity } from '@/services/gemma';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';
import { travelMinutesFor, usePlan } from '@/state/plan-context';

/**
 * Opportunity Details (T9). Everything Gemma concluded about one place — why it
 * fits, the risks, and what to do — plus the three actions: draft outreach,
 * add to today's plan (deduped in plan state), and navigate.
 */
export default function OpportunityDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ranked } = useOpportunities();
  const { business } = useBusiness();
  const plan = usePlan();

  const opportunity = ranked.find((o) => o.id === id);

  if (!opportunity) {
    return (
      <Screen>
        <ThemedText type="subtitle">Opportunity not found</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          This plan may have been rebuilt. Head back to today&apos;s growth plan.
        </ThemedText>
        <PrimaryButton label="Back to growth plan" onPress={() => router.replace('/opportunities')} />
      </Screen>
    );
  }

  const o = opportunity;
  const planned = plan.has(o.id);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{o.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {CATEGORY_ICON[o.category]} {CATEGORY_LABEL[o.category]} · {o.address || `near ${business?.profile.city ?? 'you'}`}
        </ThemedText>
        {o.rating !== undefined && (
          <ThemedText type="small" themeColor="textSecondary">
            ⭐ {o.rating.toFixed(1)}
            {o.reviewCount ? ` (${o.reviewCount} Google reviews)` : ' on Google'}
          </ThemedText>
        )}
      </View>

      <Card>
        <View style={styles.stats}>
          <Stat label="Score" value={String(o.score)} highlight />
          <Stat label="Travel" value={`${travelMinutesFor(o.distanceMiles)} min`} />
          <Stat label="Best time" value={o.bestTime} />
          {o.estimatedValue ? <Stat label="Est. value" value={o.estimatedValue} /> : null}
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText type="label" style={{ color: theme.accent }}>
          WHY EXPANSION SCOUT RECOMMENDS THIS
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {o.summary}
        </ThemedText>
        {o.reasons.map((reason) => (
          <Row key={reason} icon="✓" color={theme.success} text={reason} />
        ))}
      </View>

      {o.evidence.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="label" style={{ color: theme.info }}>
            BACKED BY
          </ThemedText>
          {o.evidence.map((fact) => (
            <Row key={fact} icon="•" color={theme.info} text={fact} />
          ))}
          <View style={styles.confidenceRow}>
            <View style={[styles.confidenceTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.confidenceFill,
                  { backgroundColor: theme.info, width: `${o.confidence}%` },
                ]}
              />
            </View>
            <ThemedText type="caption" themeColor="textMuted">
              {confidenceLabel(o.confidence)} confidence
            </ThemedText>
          </View>
          {o.confidence < 55 && (
            <ThemedText type="caption" themeColor="textMuted">
              Scout is less sure about this one — worth a quick check before you commit time to it.
            </ThemedText>
          )}
        </View>
      )}

      {o.risks.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="label" themeColor="textMuted">
            WORTH KNOWING
          </ThemedText>
          {o.risks.map((risk) => (
            <Row key={risk} icon="!" color={theme.warning} text={risk} />
          ))}
        </View>
      )}

      <Card>
        <ThemedText type="label" themeColor="textMuted">
          RECOMMENDED ACTION
        </ThemedText>
        <ThemedText type="bodyBold">{o.recommendedAction}</ThemedText>
      </Card>

      <PrimaryButton
        label="Generate outreach"
        onPress={() => router.push({ pathname: '/outreach', params: { id: o.id } })}
      />
      {o.phone ? (
        <PrimaryButton
          label={`Call ${o.phone}`}
          variant="secondary"
          onPress={() => Linking.openURL(`tel:${o.phone!.replace(/[^\d+]/g, '')}`).catch(() => {})}
        />
      ) : null}
      <PrimaryButton
        label={planned ? '✓ On today’s plan' : 'Add to today’s plan'}
        variant="secondary"
        disabled={planned}
        onPress={() => plan.add(o)}
      />
      <PrimaryButton label="Navigate" variant="outlined" onPress={() => openMaps(o, business?.profile.city)} />
      {o.website ? (
        <PrimaryButton
          label="Visit website"
          variant="outlined"
          onPress={() => Linking.openURL(o.website!).catch(() => {})}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Open the device's maps. Derived targets (`local-*`) have synthesized
 * coordinates, so those open a real map SEARCH for the kind of place instead of
 * a pin at a made-up point. Failures are swallowed — navigation is a bonus.
 */
function openMaps(o: RankedOpportunity, city?: string) {
  const search = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${o.name} near ${city ?? 'me'}`,
  )}`;
  const pin =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${o.latitude},${o.longitude}`
      : `geo:${o.latitude},${o.longitude}?q=${o.latitude},${o.longitude}(${encodeURIComponent(o.name)})`;
  const url = o.id.startsWith('local-') || Platform.OS === 'web' ? search : pin;
  Linking.openURL(url).catch(() => {
    Linking.openURL(search).catch(() => {});
  });
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <ThemedText type="smallBold" style={highlight ? { color: theme.warning } : undefined}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
    </View>
  );
}

function Row({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" style={{ color }}>
        {icon}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowText}>
        {text}
      </ThemedText>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function confidenceLabel(confidence: number): string {
  return confidence >= 75 ? 'High' : confidence >= 55 ? 'Moderate' : 'Low';
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  stats: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.three },
  stat: { gap: Spacing.half, alignItems: 'flex-start' },
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  rowText: { flex: 1 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  confidenceTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  confidenceFill: { height: 6, borderRadius: 3 },
});
