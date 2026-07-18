/**
 * Locality proof for the on-device reasoning layer (rubric §4).
 *
 * Shows — live — whether Gemma is answering on this device, which model, and how
 * fast. The "Run sample reasoning" button executes the real analyze → rank flow
 * against the demo taco truck and reports the `InferenceMeta` (source, latency,
 * validated, coverage note) so a judge can *see* that reasoning ran locally.
 *
 * Brand (CLAUDE.md): blue = AI-reasoning accent; forest green = primary; the
 * privacy line is stated exactly. Colors come from theme tokens, never hardcoded.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { demoBusiness, demoCandidates } from '@/data/demo';
import { useTheme } from '@/hooks/use-theme';
import {
  analyzeBusiness,
  getGemmaStatus,
  rankOpportunities,
  warmUpGemma,
  type GemmaStatus,
  type InferenceMeta,
  type RankedOpportunity,
} from '@/services/gemma';

type SampleRun = {
  meta: InferenceMeta;
  focus: string;
  top: RankedOpportunity;
};

export function LocalAiStatus() {
  const theme = useTheme();
  const [status, setStatus] = useState<GemmaStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [sample, setSample] = useState<SampleRun | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getGemmaStatus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getGemmaStatus();
      if (!cancelled) setStatus(s);
      warmUpGemma(); // preload so the first real call isn't a cold start
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSample = useCallback(async () => {
    setRunning(true);
    setSample(null);
    try {
      const analysis = await analyzeBusiness(demoBusiness);
      const ranked = await rankOpportunities(demoBusiness, analysis.data, demoCandidates);
      const top = ranked.data[0];
      if (top) setSample({ meta: ranked.meta, focus: analysis.data.focus, top });
      await refresh();
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  const onDevice = status?.onDevice ?? false;
  const dotColor = onDevice ? theme.success : theme.warning;

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">On-device reasoning</ThemedText>

      <Card>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <ThemedText type="bodyBold" style={{ color: theme.info }}>
            {onDevice ? 'Gemma 4 · running on this device' : 'Deterministic fallback'}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {status?.detail ?? 'Checking the local runtime…'}
        </ThemedText>

        {status && (
          <View style={styles.metaGrid}>
            <MetaPill label="Model" value={shortModel(status.model)} />
            <MetaPill label="Endpoint" value={hostOf(status.baseUrl)} />
            <MetaPill label="Probe" value={`${status.latencyMs}ms`} />
          </View>
        )}

        <ThemedText type="caption" themeColor="textMuted">
          Powered locally by Gemma 4 · Your business strategy stays on your device.
        </ThemedText>
      </Card>

      <PrimaryButton
        label={running ? 'Reasoning on-device…' : 'Run sample reasoning'}
        variant="primary"
        disabled={running}
        onPress={runSample}
        icon={running ? <ActivityIndicator color={theme.onAccent} /> : undefined}
      />

      {sample && (
        <Card>
          <View style={styles.row}>
            <SourceBadge source={sample.meta.source} />
            <ThemedText type="caption" themeColor="textSecondary">
              {sample.meta.latencyMs}ms · {sample.meta.validated ? 'schema-validated' : 'repaired'}
            </ThemedText>
          </View>

          <ThemedText type="smallBold">Today&apos;s focus</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {sample.focus}
          </ThemedText>

          <View style={styles.topRow}>
            <ThemedText type="bodyBold" style={styles.flex}>
              {sample.top.name}
            </ThemedText>
            <View style={[styles.score, { backgroundColor: theme.scoreSubtle }]}>
              <ThemedText type="smallBold" style={{ color: theme.warning }}>
                {sample.top.score}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {sample.top.reasons[0]}
          </ThemedText>

          {sample.meta.note && (
            <ThemedText type="caption" themeColor="textMuted">
              {sample.meta.note}
            </ThemedText>
          )}
        </Card>
      )}
    </View>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.infoSubtle }]}>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.info }}>
        {value}
      </ThemedText>
    </View>
  );
}

function SourceBadge({ source }: { source: InferenceMeta['source'] }) {
  const theme = useTheme();
  const isGemma = source === 'gemma';
  const bg = isGemma ? theme.infoSubtle : theme.backgroundSelected;
  const fg = isGemma ? theme.info : theme.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <ThemedText type="caption" style={{ color: fg }}>
        {isGemma ? '⬤ on-device Gemma' : '○ deterministic fallback'}
      </ThemedText>
    </View>
  );
}

function shortModel(model: string): string {
  return model.replace(/^.*\//, '');
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: Radius.pill },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  score: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
    minWidth: 34,
    alignItems: 'center',
  },
});
