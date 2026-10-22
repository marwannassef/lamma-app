import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  I18nManager,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useSettings } from '@/core/settings/store';
import { gradients, radius, space, useTheme } from '@/core/theme';
import { Badge, Button, Pressable, Steps, Text } from '@/core/ui';
import type { GameModule } from '@/games/registry';

import { flavorOf } from './flavor';
import { Surprise } from './Surprise';

/** Shortest signed distance from the wheel position to card `i`, so the wheel loops around. */
export function wheelOffset(i: number, pos: number, n: number): number {
  'worklet';
  const d = i - pos;
  return d - n * Math.round(d / n);
}

/** Which card sits in front for a wheel position. */
export const frontIndex = (pos: number, n: number) => (((Math.round(pos) % n) + n) % n) as number;

const SPRING = { damping: 18, stiffness: 150 };

/** The logo shrinks on short cards so the story and Play button always fit. */
const artSize = (cardHeight: number) => Math.round(Math.min(132, Math.max(84, cardHeight * 0.26)));

function CardFace({
  game,
  side,
  flip,
  onPlay,
  onFlip,
  front,
  height,
}: {
  game: GameModule;
  side: 'front' | 'back';
  flip: SharedValue<number>;
  onPlay(): void;
  onFlip(): void;
  front: boolean;
  height: number;
}) {
  const { t } = useTranslation(['common', 'spy', 'werewolf', 'blendIn']);
  const { t: th } = useTranslation(['mafia', 'werewolf', 'spy', 'blendIn']);
  const { colors } = useTheme();
  const f = flavorOf(game.id);
  const style = useAnimatedStyle(() => {
    const deg = interpolate(flip.value, [0, 1], side === 'front' ? [0, 180] : [-180, 0]);
    return { transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }] };
  });
  const title = t(game.titleKey);
  const players = game.mystery
    ? t('games.mystery.teaser')
    : t('home.playersRange', { min: game.minPlayers, max: game.maxPlayers });
  const steps = (key: 'setup' | 'play'): string[] => {
    if (!f.howTo) return [];
    const ns = f.howTo === 'mafia' ? ['mafia', 'werewolf'] : [f.howTo];
    const v = th(`howTo.${key}` as never, { ns, returnObjects: true } as never) as unknown;
    return Array.isArray(v) ? (v as string[]) : [];
  };
  return (
    <Animated.View
      style={[styles.face, { height }, style]}
      pointerEvents={front ? 'auto' : 'none'}
      accessibilityElementsHidden={!front}
      importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
    >
      <LinearGradient
        colors={game.ready ? gradients.brand : [colors.border, colors.border]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.frame}
      >
        <View style={[styles.inner, { backgroundColor: colors.surface }]}>
          {side === 'front' ? (
            <>
              <View style={styles.topRow}>
                <Badge
                  icon={game.mystery ? '🤫' : '👥'}
                  tone={game.mystery ? 'secondary' : 'neutral'}
                  label={players}
                />
                <Pressable
                  testID={`info-${game.id}`}
                  accessibilityLabel={t('home.info', { game: title })}
                  onPress={onFlip}
                  style={[styles.iconBtn, { borderColor: colors.border }]}
                >
                  <Text variant="label" tone="secondary" accessible={false}>
                    ⓘ
                  </Text>
                </Pressable>
              </View>
              <Image
                source={game.icon}
                style={[
                  styles.art,
                  { width: artSize(height), height: artSize(height) },
                  !game.ready && styles.dim,
                ]}
                accessibilityIgnoresInvertColors
              />
              <Text variant="title" align="center" numberOfLines={1} adjustsFontSizeToFit>
                {title}
              </Text>
              <Text
                variant="body"
                tone="muted"
                align="center"
                numberOfLines={4}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={styles.story}
              >
                {t(`home.stories.${game.id}` as 'home.stories.spy')}
              </Text>
              {game.ready ? (
                <Button
                  testID={`wheel-play-${game.id}`}
                  size="md"
                  icon={I18nManager.isRTL ? '◀' : '▶'}
                  label={t('home.play')}
                  onPress={onPlay}
                />
              ) : (
                <Badge tone="primary" align="center" label={t('home.comingSoon')} />
              )}
            </>
          ) : (
            <>
              <View style={styles.topRow}>
                <Text variant="heading" style={styles.flex}>
                  {`📖 ${t('howTo.title')}`}
                </Text>
                <Pressable
                  testID={`flip-back-${game.id}`}
                  accessibilityLabel={t('home.flipBack')}
                  onPress={onFlip}
                  style={[styles.iconBtn, { borderColor: colors.border }]}
                >
                  <Text variant="label" tone="secondary" accessible={false}>
                    ↺
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.backBody}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {f.howTo ? (
                  <>
                    <Steps title={t('howTo.setup')} icon="🛠️" steps={steps('setup')} />
                    <Steps title={t('howTo.play')} icon="🎮" steps={steps('play')} />
                  </>
                ) : (
                  <Text variant="body" tone="muted" align="center">
                    {t('games.mystery.reveal')}
                  </Text>
                )}
              </ScrollView>
              {game.ready ? (
                <Button
                  size="md"
                  icon={I18nManager.isRTL ? '◀' : '▶'}
                  label={t('home.play')}
                  onPress={onPlay}
                />
              ) : null}
            </>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function WheelCard({
  game,
  i,
  n,
  pos,
  width,
  height,
  front,
  onSelect,
}: {
  game: GameModule;
  i: number;
  n: number;
  pos: SharedValue<number>;
  width: number;
  height: number;
  front: boolean;
  onSelect(i: number): void;
}) {
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const reduce = useReducedMotion();
  const dir = I18nManager.isRTL ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const d = wheelOffset(i, pos.value, n);
    const a = Math.abs(d);
    return {
      zIndex: Math.round(100 - a * 10),
      opacity: Math.max(0, 1 - a * 0.38),
      transform: [
        { perspective: 1100 },
        { translateX: d * width * 0.56 * dir },
        { rotateY: `${-d * 40 * dir}deg` },
        { scale: 1 - Math.min(a, 2) * 0.16 },
      ],
    };
  });
  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    flip.value = reduce ? (next ? 1 : 0) : withTiming(next ? 1 : 0, { duration: 450 });
  };
  const open = () => router.push(game.entryRoute);
  return (
    <Animated.View style={[styles.slot, { width, height }, style]}>
      <CardFace
        game={game}
        side="front"
        flip={flip}
        onPlay={open}
        onFlip={toggle}
        front={front && !flipped}
        height={height}
      />
      <CardFace
        game={game}
        side="back"
        flip={flip}
        onPlay={open}
        onFlip={toggle}
        front={front && flipped}
        height={height}
      />

      {front ? null : (
        // Side cards: a tap brings them to the front. The front card has no wrapper, so its
        // buttons and the How to play list (which scrolls) get the touches.
        <Pressable
          testID={`wheel-${game.id}`}
          haptic={false}
          accessibilityLabel={game.id}
          onPress={() => onSelect(i)}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
}

/**
 * The games as 3D cards on a wheel: swipe sideways (it loops), tap a side card to bring it
 * forward, ⓘ flips a card to its How to play. The front card gets a themed surprise burst.
 */
export function GameWheel({ games }: { games: readonly GameModule[] }) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const hapticsOn = useSettings((s) => s.haptics);
  const { width: screen, height: screenH } = useWindowDimensions();
  const width = Math.min(screen * 0.7, 320);
  // The whole front card fits on screen under the logo, with room for the controls.
  const height = Math.round(Math.max(360, Math.min(width * 1.4, screenH - 480)));
  const n = games.length;
  const pos = useSharedValue(0);
  const [front, setFront] = useState(0);
  const [burst, setBurst] = useState(0);
  const dir = I18nManager.isRTL ? -1 : 1;
  const step = width * 0.56;

  const settle = (index: number) => {
    setFront(index);
    setBurst((b) => b + 1);
    if (hapticsOn) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  const goTo = (target: number) => {
    const index = frontIndex(target, n);
    pos.value = withSpring(target, SPRING, (done) => {
      if (done) scheduleOnRN(settle, index);
    });
  };
  const select = (i: number) => goTo(pos.value + wheelOffset(i, pos.value, n));

  const start = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart(() => {
      start.value = pos.value;
    })
    .onUpdate((e) => {
      pos.value = start.value - (e.translationX * dir) / step;
    })
    .onEnd((e) => {
      // One card per swipe (a fast flick also moves one), so the wheel stays predictable.
      const fling = Math.abs(e.velocityX) > 500 ? -Math.sign(e.velocityX) * dir * 0.5 : 0;
      const raw = Math.round(pos.value + fling);
      const base = Math.round(start.value);
      const target = Math.max(base - 1, Math.min(base + 1, raw));
      const index = (((target % n) + n) % n) as number;
      pos.value = withSpring(target, SPRING, (done) => {
        if (done) scheduleOnRN(settle, index);
      });
    });

  const game = games[front];
  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={pan}>
        <View style={[styles.stage, { height: height + space.lg }]} testID="game-wheel">
          {games.map((g, i) => (
            <WheelCard
              key={g.id}
              game={g}
              i={i}
              n={n}
              pos={pos}
              width={width}
              height={height}
              front={i === front}
              onSelect={select}
            />
          ))}
          {game ? <Surprise key={`${game.id}-${burst}`} gameId={game.id} /> : null}
        </View>
      </GestureDetector>
      {game ? (
        <Text
          key={`cheer-${burst}`}
          variant="label"
          tone="secondary"
          align="center"
          testID="wheel-cheer"
        >
          {t(`home.cheers.${game.id}` as 'home.cheers.spy')}
        </Text>
      ) : null}
      <View style={styles.controls}>
        <Pressable
          testID="wheel-prev"
          accessibilityLabel={t('home.previous')}
          onPress={() => goTo(Math.round(pos.value) - 1)}
          style={[styles.arrow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="heading" tone="secondary" accessible={false}>
            {I18nManager.isRTL ? '›' : '‹'}
          </Text>
        </Pressable>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('home.position', { n: front + 1, total: n })}
        >
          {games.map((g, i) => (
            <View
              key={g.id}
              style={[
                styles.dot,
                { backgroundColor: i === front ? colors.secondary : colors.border },
                i === front && styles.dotOn,
              ]}
            />
          ))}
        </View>
        <Pressable
          testID="wheel-next"
          accessibilityLabel={t('home.next')}
          onPress={() => goTo(Math.round(pos.value) + 1)}
          style={[styles.arrow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="heading" tone="secondary" accessible={false}>
            {I18nManager.isRTL ? '‹' : '›'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.md },
  stage: { alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute' },
  face: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backfaceVisibility: 'hidden' },
  frame: { flex: 1, borderRadius: radius.card, padding: 3 },
  inner: {
    flex: 1,
    borderRadius: radius.card - 3,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { borderRadius: 28, alignSelf: 'center' },
  dim: { opacity: 0.55 },
  story: { flexShrink: 1 },
  backBody: { gap: space.xs, paddingBottom: space.sm },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
});
