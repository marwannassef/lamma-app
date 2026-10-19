import type * as BrightnessApi from 'expo-brightness';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';

import { STEALTH } from '@/core/theme';

import { useNoScreenCapture } from './platformGuards';

const DIM = 0.25;

type BrightnessModule = typeof BrightnessApi;

/**
 * Loaded lazily: a build without the native module (an old dev client) must still run the
 * game, just without dimming, instead of crashing every screen that imports the UI kit.
 */
function brightness(): BrightnessModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-brightness') as BrightnessModule;
  } catch {
    return null;
  }
}

/**
 * Wraps secret pass-the-phone screens (§4): blocks screenshots and recording, dims the screen,
 * blocks the hardware back button and covers the content whenever the app leaves the foreground
 * (so the app-switcher snapshot shows nothing).
 */
export function SecretGuard({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(AppState.currentState !== 'active');
  useNoScreenCapture('secret-screen');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setHidden(s !== 'active'));
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    let previous: number | null = null;
    const Brightness = brightness();
    void (async () => {
      try {
        if (!Brightness) return;
        previous = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(Math.min(previous, DIM));
      } catch {
        // Brightness is a nicety; the game works without it.
      }
    })();
    return () => {
      sub.remove();
      back.remove();
      void (async () => {
        try {
          if (!Brightness) return;
          if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
          else if (previous != null) await Brightness.setBrightnessAsync(previous);
        } catch {
          // ignore
        }
      })();
    };
  }, []);

  return (
    <View style={styles.fill}>
      {children}
      {hidden ? <View style={[StyleSheet.absoluteFill, { backgroundColor: STEALTH.bg }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
