import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Content a screen reader must never read aloud, such as a secret role on a pass-the-phone screen
 * where everyone at the table would hear it (werewolf.md W6). Buttons stay outside this wrapper.
 */
export function HiddenFromScreenReader({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {children}
    </View>
  );
}
