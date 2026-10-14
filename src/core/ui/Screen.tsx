import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useTheme } from '@/core/theme';

/** Full-screen themed background with a centered, scrollable column (max 520dp wide). */
export function Screen({
  children,
  scroll = true,
  scrollRef,
  center = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  /** Vertically center short content (pass and card screens). */
  center?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.column, center && styles.center]} collapsable={false}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    gap: space.lg,
  },
  center: { justifyContent: 'center' },
});
