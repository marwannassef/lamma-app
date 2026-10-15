import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Text } from './Text';

/** Game card that groups related content, with an optional emoji + title header. */
export function Panel({
  title,
  icon,
  children,
  style,
  ...rest
}: ViewProps & { title?: string; icon?: string; children: ReactNode }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.glow,
          shadowOpacity: scheme === 'dark' ? 0.35 : 0.18,
        },
        style,
      ]}
      {...rest}
    >
      {title ? (
        <View style={styles.header}>
          {icon ? (
            <View style={[styles.icon, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={styles.iconText} accessible={false}>
                {icon}
              </Text>
            </View>
          ) : null}
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.card - 4,
    borderWidth: 1.5,
    padding: space.lg,
    gap: space.md,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 28 },
  title: { flex: 1 },
});
