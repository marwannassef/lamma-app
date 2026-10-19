import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useTheme } from '@/core/theme';

import { GameBackground } from './GameBackground';

/** Lets a game swap the decorated background behind every Screen it renders (e.g. Werewolf's moonlit village). */
export const ScreenBackground = createContext<ReactNode>(null);

/** Extra space above a Screen's content, for a game's overlaid host bar. */
export const ScreenTopInset = createContext(0);

/**
 * Full-screen game background with a centered, scrollable column (max 520dp wide).
 * `footer` stays pinned to the bottom (e.g. the main call to action).
 */
export function Screen({
  children,
  scroll = true,
  scrollRef,
  center = false,
  footer,
  stealthColor,
}: {
  children: ReactNode;
  scroll?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  /** Vertically center short content (pass and card screens). */
  center?: boolean;
  footer?: ReactNode;
  /** Plain dark background with no decoration, for secret pass-the-phone screens. */
  stealthColor?: string;
}) {
  const { colors } = useTheme();
  const background = useContext(ScreenBackground);
  const topInset = useContext(ScreenTopInset);
  const body = (
    <View
      style={[
        styles.column,
        center && styles.center,
        topInset > 0 && { paddingTop: space.xl + topInset },
      ]}
      collapsable={false}
    >
      {children}
    </View>
  );
  return (
    <View style={[styles.fill, { backgroundColor: stealthColor ?? colors.bg }]}>
      {stealthColor ? null : (background ?? <GameBackground />)}
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
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
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
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
  footer: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
});
