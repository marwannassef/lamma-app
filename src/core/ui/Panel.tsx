import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Text } from './Text';

/** Rounded surface that groups related content, with an optional heading. */
export function Panel({
  title,
  children,
  style,
  ...rest
}: ViewProps & { title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }, style]} {...rest}>
      {title ? (
        <Text variant="heading" align="center">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
});
