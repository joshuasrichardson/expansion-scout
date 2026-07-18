import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BusinessProvider } from '@/state/business-context';
import { OpportunitiesProvider } from '@/state/opportunities-context';
import { PlanProvider } from '@/state/plan-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <BusinessProvider>
        <OpportunitiesProvider>
          <PlanProvider>
            <AnimatedSplashOverlay />
            <StatusBar style="auto" />
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="daily-mission" options={{ title: 'Daily Mission' }} />
              <Stack.Screen name="interview" options={{ title: 'AI Conversation' }} />
              <Stack.Screen name="analysis" options={{ title: 'Analysis' }} />
              <Stack.Screen name="opportunities" options={{ title: "Today's Growth Plan" }} />
              <Stack.Screen name="opportunity/[id]" options={{ title: 'Opportunity' }} />
              <Stack.Screen name="outreach" options={{ title: 'Outreach' }} />
              <Stack.Screen name="plan" options={{ title: "Today's Plan" }} />
              <Stack.Screen name="profile" options={{ title: 'Your Business' }} />
              <Stack.Screen name="privacy" options={{ title: 'Your Data' }} />
              <Stack.Screen name="design-system" options={{ title: 'Design System' }} />
            </Stack>
          </PlanProvider>
        </OpportunitiesProvider>
      </BusinessProvider>
    </ThemeProvider>
  );
}
