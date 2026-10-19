import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '@/core/settings/store';
import { space, useTheme } from '@/core/theme';
import { Pressable, Text } from '@/core/ui';

import { nextVolume, useAudioControls } from './controls';
import { narrator } from './narrator';

const VOLUME_ICON = (v: number) => (v >= 0.99 ? '🔊' : v >= 0.5 ? '🔉' : '🔈');

/** Pause, replay the last line, skip it, and volume (§10). Shown on public screens only. */
export function HostAudioControls() {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const sound = useSettings((s) => s.sound);
  const volume = useSettings((s) => s.volume);
  const setVolume = useSettings((s) => s.setVolume);
  const { paused, togglePause } = useAudioControls();
  if (!sound) return null;

  const button = (testID: string, label: string, icon: string, onPress: () => void) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text variant="label" accessible={false}>
        {icon}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {button(
        'audio-pause',
        paused ? t('audio.resume') : t('audio.pause'),
        paused ? '▶' : '⏸',
        togglePause,
      )}
      {button('audio-replay', t('audio.replay'), '↺', () => narrator.replay())}
      {button('audio-skip', t('audio.skip'), '⏭', () => narrator.skip())}
      {button(
        'audio-volume',
        t('audio.volume', { n: Math.round(volume * 100) }),
        VOLUME_ICON(volume),
        () => setVolume(nextVolume(volume)),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  button: {
    width: 40,
    height: 40,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
