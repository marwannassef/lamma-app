import { activateKeepAwakeAsync, deactivateKeepAwake, useKeepAwake } from 'expo-keep-awake';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';

/**
 * Blocks screenshots and recording on secret screens. Browsers have no way to do this, so it's a
 * no-op on web (the native module throws there).
 */
export const useNoScreenCapture: (key: string) => void = web
  ? () => undefined
  : (key) => usePreventScreenCapture(key);

/** Keeps the screen on during a game. On web the Wake Lock API may refuse; that's fine. */
function useWebKeepAwake(tag = 'lamma-game') {
  useEffect(() => {
    activateKeepAwakeAsync(tag).catch(() => undefined);
    return () => {
      void Promise.resolve()
        .then(() => deactivateKeepAwake(tag))
        .catch(() => undefined);
    };
  }, [tag]);
}

export const useStayAwake: () => void = web ? () => useWebKeepAwake() : () => useKeepAwake();
