import * as Brightness from 'expo-brightness';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';

import { STEALTH } from './meta';

const DIM = 0.25;

/**
 * Wraps secret pass-the-phone screens (§4): blocks screenshots and recording, dims the screen,
 * blocks the hardware back button and covers the content whenever the app leaves the foreground
 * (so the app-switcher snapshot shows nothing).
 */
export function SecretGuard({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(AppState.currentState !== 'active');
  usePreventScreenCapture('werewolf-secret');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setHidden(s !== 'active'));
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    let previous: number | null = null;
    void (async () => {
      try {
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
