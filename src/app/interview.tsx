import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { interviewQuestions } from '@/mockData';
import type { InterviewAnswer } from '@/types';

export default function InterviewScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [draft, setDraft] = useState('');

  const question = interviewQuestions[index];
  const isLast = index === interviewQuestions.length - 1;

  function handleNext() {
    const next = [...answers, { questionId: question.id, text: draft.trim() }];
    setAnswers(next);
    setDraft('');
    if (isLast) {
      // Answers would feed the on-device analysis; for now we just advance.
      router.push('/analysis');
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          QUESTION {index + 1} OF {interviewQuestions.length}
        </ThemedText>
        <ThemedText type="subtitle">{question.prompt}</ThemedText>
      </View>

      <Card>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={question.placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { color: theme.text }]}
        />
      </Card>

      <PrimaryButton label={isLast ? 'Analyze on device' : 'Next'} onPress={handleNext} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  input: { minHeight: 96, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
});
