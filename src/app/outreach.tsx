import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  generateOutreach,
  type InferenceMeta,
  type OpportunityCategory,
  type OutreachChannel,
  type OutreachTone,
} from '@/services/gemma';
import { useBusiness } from '@/state/business-context';
import { useOpportunities } from '@/state/opportunities-context';
import { usePlan } from '@/state/plan-context';

/**
 * Outreach generator (T10). Gemma drafts privately on-device (template fallback
 * otherwise); the owner edits, copies, and sends from their own apps. Scout
 * NEVER auto-sends — generate → edit → copy is the whole contract, and drafts
 * use only facts from the selected opportunity (grounding enforced in the
 * service layer).
 */

const CHANNELS: OutreachChannel[] = ['email', 'phone', 'walk-in'];
const TONES: OutreachTone[] = ['friendly', 'professional', 'direct'];

/** Sensible starting channel per category — the owner can switch freely. */
const DEFAULT_CHANNEL: Record<OpportunityCategory, OutreachChannel> = {
  recurring: 'phone',
  partnership: 'walk-in',
  event: 'email',
  direct: 'walk-in',
};

const CHANNEL_HINT: Record<OutreachChannel, string> = {
  email: 'Copy into your mail app when it reads right.',
  phone: 'A script for when you call — keep it near you.',
  'walk-in': 'Your opener for when you show up in person.',
};

export default function OutreachScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ranked } = useOpportunities();
  const { business } = useBusiness();
  const plan = usePlan();

  const opportunity = ranked.find((o) => o.id === id) ?? ranked[0];

  const [channel, setChannel] = useState<OutreachChannel>(
    opportunity ? DEFAULT_CHANNEL[opportunity.category] : 'email',
  );
  const [tone, setTone] = useState<OutreachTone>('friendly');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [meta, setMeta] = useState<InferenceMeta | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  const generate = useCallback(
    async (nextChannel: OutreachChannel, nextTone: OutreachTone) => {
      if (!business || !opportunity) return;
      const run = ++runId.current;
      setGenerating(true);
      const { data, meta: m } = await generateOutreach(
        business.profile,
        opportunity,
        nextChannel,
        nextTone,
      );
      if (run !== runId.current) return; // a newer request superseded this one
      setSubject(data.subject ?? '');
      setBody(data.body);
      setMeta(m);
      setGenerating(false);
    },
    [business, opportunity],
  );

  useEffect(() => {
    // Only on mount / opportunity change — chip taps call generate directly.
    // Deferred a tick so the effect itself doesn't set state synchronously.
    const t = setTimeout(() => void generate(channel, tone), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunity?.id]);

  if (!business || !opportunity) {
    return (
      <Screen>
        <ThemedText type="subtitle">Nothing to draft yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Pick an opportunity from today&apos;s growth plan first.
        </ThemedText>
        <PrimaryButton label="Back to growth plan" onPress={() => router.replace('/opportunities')} />
      </Screen>
    );
  }

  const pick = (c: OutreachChannel, t: OutreachTone) => {
    setChannel(c);
    setTone(t);
    setCopied(false);
    void generate(c, t);
  };

  async function copyDraft() {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Share.share({ message: text });
      }
      setCopied(true);
    } catch {
      // Owner cancelled the share sheet — nothing to do.
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Reach out to {opportunity.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {CHANNEL_HINT[channel]} Scout never sends anything for you.
        </ThemedText>
      </View>

      <View style={styles.chipGroup}>
        <ChipRow options={CHANNELS} active={channel} onPick={(c) => pick(c, tone)} />
        <ChipRow options={TONES} active={tone} onPick={(t) => pick(channel, t)} />
      </View>

      {generating ? (
        <Card>
          <View style={styles.generating}>
            <ActivityIndicator color={theme.info} />
            <ThemedText type="small" style={{ color: theme.info }}>
              Drafting privately on your device…
            </ThemedText>
          </View>
        </Card>
      ) : (
        <>
          {channel === 'email' && (
            <Card>
              <ThemedText type="label" themeColor="textMuted">
                SUBJECT
              </ThemedText>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                accessibilityLabel="Email subject"
                style={[styles.subject, { color: theme.text }]}
              />
            </Card>
          )}

          <Card>
            <ThemedText type="label" themeColor="textMuted">
              {channel === 'phone' ? 'CALL SCRIPT' : channel === 'walk-in' ? 'OPENER' : 'MESSAGE'}
            </ThemedText>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              accessibilityLabel="Outreach message"
              style={[styles.body, { color: theme.text }]}
            />
          </Card>

          <ThemedText type="caption" themeColor="textMuted">
            {meta?.source === 'gemma'
              ? `Generated privately using Gemma · ${(meta.latencyMs / 1000).toFixed(1)}s on-device`
              : 'Drafted on-device from your business profile'}
          </ThemedText>
        </>
      )}

      <PrimaryButton
        label={copied ? '✓ Copied' : Platform.OS === 'web' ? 'Copy draft' : 'Copy / share draft'}
        onPress={copyDraft}
        disabled={generating || !body}
      />
      <PrimaryButton
        label="Regenerate"
        variant="secondary"
        onPress={() => pick(channel, tone)}
        disabled={generating}
      />
      <PrimaryButton
        label={plan.has(opportunity.id) ? "View today's plan" : "Add to today's plan"}
        variant="outlined"
        onPress={() => {
          plan.add(opportunity);
          router.push('/plan');
        }}
      />
    </Screen>
  );
}

function ChipRow<T extends string>({
  options,
  active,
  onPick,
}: {
  options: T[];
  active: T;
  onPick: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option === active;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onPick(option)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.accent : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.border,
              },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.text }}>
              {label(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function label(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  chipGroup: { gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    justifyContent: 'center',
  },
  generating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  subject: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  body: { minHeight: 200, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
});
