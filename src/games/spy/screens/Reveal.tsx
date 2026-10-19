import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Pack, Word } from '@/core/content';
import { customName, usePlayers } from '@/core/players';
import { useSettings } from '@/core/settings/store';
import { radius, space, useTheme } from '@/core/theme';
import { Avatar, Button, Pressable, Screen, seatOf, Text, useNoScreenCapture } from '@/core/ui';

import { CardBack } from '../components/CardBack';
import { RoleCard } from '../components/RoleCard';

const CARD_HEIGHT = 420;

/**
 * One player's turn: "pass the phone to …" over a face-down card. Tapping the card flips it
 * (instantly with reduced motion). Hidden from screenshots and the app switcher.
 */
export default function Reveal({
  player,
  pack,
  word,
  isSpy,
  spySeesCategory,
  onDone,
}: {
  player: number;
  pack: Pack;
  word: Word;
  isSpy: boolean;
  spySeesCategory: boolean;
  onDone(): void;
}) {
  const { t } = useTranslation(['spy', 'common']);
  const { colors } = useTheme();
  const { count, names } = usePlayers();
  const haptics = useSettings((s) => s.haptics);
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [backgrounded, setBackgrounded] = useState(AppState.currentState !== 'active');
  const rotation = useSharedValue(0);
  const name = customName(names, player) || t('common:players.defaultName', { n: player + 1 });

  // Android: FLAG_SECURE blanks the recents thumbnail and screenshots. iOS: blocks recording.
  useNoScreenCapture('spy-card');
  // iOS snapshots the app on "inactive", so cover the card as soon as we leave "active".
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setBackgrounded(s !== 'active'));
    return () => sub.remove();
  }, []);

  const flip = () => {
    if (flipped) return;
    setFlipped(true);
    rotation.value = reduce
      ? 180
      : withTiming(180, { duration: 650, easing: Easing.out(Easing.back(1.2)) });
    if (haptics) {
      void Haptics.impactAsync(
        isSpy ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
      );
    }
  };

  const backStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: rotation.value >= 90 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value - 180}deg` }],
  }));

  return (
    <View style={styles.fill}>
      <Screen
        footer={
          flipped ? (
            <Button testID="hide-card" icon="🙈" label={t('card.hide')} onPress={onDone} />
          ) : (
            <Text variant="body" tone="muted" align="center">
              {t('pass.hint')}
            </Text>
          )
        }
      >
        <View
          style={styles.progress}
          accessible
          accessibilityLabel={t('pass.progress', { n: player + 1, total: count })}
        >
          {Array.from({ length: count }, (_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    i < player
                      ? colors.primary
                      : i === player
                        ? seatOf(i).color
                        : colors.surfaceRaised,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.who} accessible accessibilityLiveRegion="polite">
          <Avatar player={player} size={72} ring={colors.text} />
          <View style={styles.whoText}>
            <Text variant="label" tone="muted">
              {t('pass.label')}
            </Text>
            <Text variant="title" testID="pass-name" numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>

        <Pressable
          testID="show-card"
          haptic={false}
          // Once flipped, let screen readers reach the card's text instead of the button.
          accessible={!flipped}
          accessibilityLabel={flipped ? undefined : t('pass.show')}
          accessibilityHint={flipped ? undefined : t('pass.hint')}
          onPress={flip}
          style={styles.cardArea}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, backStyle]}
            pointerEvents="none"
            importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
          >
            <CardBack hint={`👆 ${t('pass.show')}`} />
          </Animated.View>
          {flipped ? (
            <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
              <RoleCard pack={pack} word={word} isSpy={isSpy} spySeesCategory={spySeesCategory} />
            </Animated.View>
          ) : null}
        </Pressable>
      </Screen>
      {backgrounded && flipped ? (
        <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.bg }]}>
          <Text variant="title" tone="muted" align="center">
            {t('card.cover')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  progress: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: radius.pill },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoText: { flex: 1 },
  cardArea: { height: CARD_HEIGHT },
  cover: { alignItems: 'center', justifyContent: 'center' },
});
