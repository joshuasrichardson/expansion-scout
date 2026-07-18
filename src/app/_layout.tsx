import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { InterviewProvider } from '@/state/interview-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <InterviewProvider>
        <AnimatedSplashOverlay />
        <StatusBar style="auto" />
        <Stack>
        <Stack.Screen name="index" options={{ title: 'Expansion Scout' }} />
        <Stack.Screen name="daily-mission" options={{ title: 'Daily Mission' }} />
        <Stack.Screen name="interview" options={{ title: 'AI Interview' }} />
        <Stack.Screen name="analysis" options={{ title: 'Analysis' }} />
        <Stack.Screen name="opportunities" options={{ title: 'Opportunities' }} />
        <Stack.Screen name="opportunity/[id]" options={{ title: 'Opportunity' }} />
        <Stack.Screen name="outreach" options={{ title: 'Outreach' }} />
        <Stack.Screen name="plan" options={{ title: "Today's Plan" }} />
          <Stack.Screen name="design-system" options={{ title: 'Design System' }} />
        </Stack>
      </InterviewProvider>
    </ThemeProvider>
  );
}
