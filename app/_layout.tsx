import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAge } from '@/core/age';
import { useAudioSettings } from '@/core/audio';
import { configurePurchases } from '@/core/entitlements/purchases';
import { initI18n, syncLayoutDirection } from '@/core/i18n';
import { useSettings } from '@/core/settings/store';
import { fontAssets, ThemeProvider, useTheme } from '@/core/theme';

void SplashScreen.preventAutoHideAsync();

// Settings hydrate synchronously from MMKV, so language and direction are known before first render.
const language = initI18n(useSettings.getState().language);
const reloadingForDirection = syncLayoutDirection(language);

function AppStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="paywall"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = (fontsLoaded || fontError != null) && !reloadingForDirection;
  useAudioSettings();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Platform age signal (monetization §7), refreshed at each launch; and what the store says the
  // user owns (RevenueCat), when purchases are set up in this build.
  useEffect(() => {
    void useAge.getState().refreshSignal();
    configurePurchases();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
