import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDraftForOpportunity, outreachDrafts } from '@/mockData';

export default function OutreachScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const draft = (id ? getDraftForOpportunity(id) : undefined) ?? outreachDrafts[0];
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState(draft.body);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Outreach draft</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {draft.channel.toUpperCase()} · to {draft.recipientHint}
        </ThemedText>
      </View>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          SUBJECT
        </ThemedText>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          style={[styles.subject, { color: theme.text }]}
        />
      </Card>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          MESSAGE
        </ThemedText>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          style={[styles.body, { color: theme.text }]}
        />
      </Card>

      <PrimaryButton label="Add to today's plan" onPress={() => router.push('/plan')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  subject: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  body: { minHeight: 220, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
});
