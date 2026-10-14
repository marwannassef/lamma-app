import * as Haptics from 'expo-haptics';
import { Pressable as RNPressable, type PressableProps } from 'react-native';

import { useSettings } from '@/core/settings/store';
import { minTouch } from '@/core/theme';

/** Pressable with a 48dp minimum target and an optional light haptic (respects Settings). */
export function Pressable({
  haptic = true,
  onPress,
  style,
  ...rest
}: PressableProps & { haptic?: boolean }) {
  const hapticsOn = useSettings((s) => s.haptics);
  return (
    <RNPressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={(e) => {
        if (haptic && hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={(state) => [
        { minHeight: minTouch },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    />
  );
}
