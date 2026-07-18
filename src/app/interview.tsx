import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  interviewStep,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  summarizeInterview,
  type InterviewTurn,
} from '@/services/gemma';
import { useBusiness } from '@/state/business-context';

type Phase = 'asking' | 'thinking' | 'finishing';
type Prompt = { question: string; placeholder: string };

/**
 * The opening question — shown immediately (no cold-start wait) before Gemma
 * takes over and adaptively decides what, if anything, to ask next.
 */
const SEED_QUESTION: Prompt = {
  question: 'What product or service do you most want to grow right now?',
  placeholder: 'e.g. recurring commercial accounts, weekend bookings',
};

/** Shown if Gemma wants to stop before the minimum — keeps the interview useful. */
const EARLY_GAP: Prompt = {
  question: 'Where do those customers usually spend their time — the places or events where you could reach them?',
  placeholder: 'e.g. office parks, gyms, breweries, weekend tournaments',
};

export default function InterviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { business, hydrated, completeInterview } = useBusiness();

  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [current, setCurrent] = useState<Prompt>({ ...SEED_QUESTION });
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<Phase>('asking');

  // The interview refines the owner's stored business — it needs one to exist.
  if (hydrated && !business) return <Redirect href="/profile" />;

  /** Wrap up: distill the transcript into the profile and move to analysis. */
  async function finish(finalHistory: InterviewTurn[]) {
    if (!business) return;
    setPhase('finishing');
    const { data: profile } = await summarizeInterview(finalHistory, business.profile);
    completeInterview(profile);
    router.push('/analysis');
  }

  async function handleNext() {
    const answer = draft.trim();
    if (!answer || phase !== 'asking' || !business) return;

    const nextHistory = [...history, { question: current.question, answer }];
    setHistory(nextHistory);
    setDraft('');
    setPhase('thinking');

    // Gemma reasons about whether it has enough to search — else asks one more.
    const { data: decision } = await interviewStep(nextHistory);

    const atMax = nextHistory.length >= MAX_QUESTIONS;
    const belowMin = nextHistory.length < MIN_QUESTIONS;
    const shouldStop = atMax || (decision.done && !belowMin);

    if (shouldStop) {
      await finish(nextHistory);
      return;
    }

    // Ask again: use Gemma's question, or a gap question if it stopped early.
    setCurrent(
      !decision.done && decision.question
        ? { question: decision.question, placeholder: decision.placeholder ?? '' }
        : EARLY_GAP,
    );
    setPhase('asking');
  }

  if (phase !== 'asking') {
    const heading = phase === 'finishing' ? 'Assembling your growth plan…' : 'Understanding your business…';
    return (
      <Screen>
        <View style={[styles.thinking, { backgroundColor: theme.infoSubtle }]}>
          <ActivityIndicator color={theme.info} />
          <ThemedText type="subtitle" style={{ color: theme.info }}>
            {heading}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.thinkingCopy}>
            Gemma 4 is reasoning privately on your device.
          </ThemedText>
        </View>
      </Screen>
    );
  }

  const canSubmit = draft.trim().length > 0;
  const isFinalAllowed = history.length + 1 >= MAX_QUESTIONS;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          QUESTION {history.length + 1}
        </ThemedText>
        <ThemedText type="subtitle">{current.question}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          Gemma asks only what it needs to find where you should grow.
        </ThemedText>
      </View>

      <Card>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={current.placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { color: theme.text }]}
        />
      </Card>

      <PrimaryButton
        label={isFinalAllowed ? 'Analyze on device' : 'Next'}
        onPress={handleNext}
        disabled={!canSubmit}
      />

      {history.length >= MIN_QUESTIONS && (
        <PrimaryButton
          label="That's enough — build my plan"
          variant="secondary"
          onPress={() => void finish(history)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  input: { minHeight: 96, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
  thinking: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
  },
  thinkingCopy: { textAlign: 'center' },
});
