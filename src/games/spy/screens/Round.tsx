import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent, type ScrollView } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { localized, wordLines, type Pack, type Word } from '@/core/content';
import { usePlayerName } from '@/core/players';
import { losersOf } from '@/core/punishments';
import { fitScores, useSession } from '@/core/session';
import { gradients, radius, space, useTheme } from '@/core/theme';
import {
  Avatar,
  Button,
  Confetti,
  Hint,
  Panel,
  Pressable,
  PunishmentPanel,
  Scoreboard,
  Screen,
  SoftUpsell,
  Text,
} from '@/core/ui';

import { RANDOM, roundResult, scoreRound, verdictsComplete, type RoundResult } from '../logic';
import { useSpy, type ActiveRound } from '../store';

type Anchor = 'answer' | 'result';

const RESULT_EMOJI: Record<RoundResult, string> = {
  players: '🏆',
  spy: '🕵️',
  spies: '🕵️',
  split: '🤝',
};

/** Scrolls newly revealed content into view once it has laid out. */
function useReveal(ref: React.RefObject<ScrollView | null>) {
  const ys = useRef<Partial<Record<Anchor, number>>>({});
  const pending = useRef<Anchor | null>(null);
  const scroll = (a: Anchor) => {
    const y = ys.current[a];
    if (y == null) return;
    ref.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: true });
    pending.current = null;
  };
  return {
    onLayout: (a: Anchor) => (e: LayoutChangeEvent) => {
      ys.current[a] = e.nativeEvent.layout.y;
      if (pending.current === a) scroll(a);
    },
    request: (a: Anchor) => {
      pending.current = a;
      scroll(a);
    },
  };
}

function YesNo({
  yesLabel,
  noLabel,
  value,
  onChange,
  testID,
}: {
  yesLabel: string;
  noLabel: string;
  value: boolean | null;
  onChange(v: boolean): void;
  testID: string;
}) {
  const { colors } = useTheme();
  const option = (v: boolean, label: string) => {
    const selected = value === v;
    return (
      <Pressable
        testID={`${testID}-${v ? 'yes' : 'no'}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
        onPress={() => onChange(v)}
        style={({ pressed }) => [styles.ynCell, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <LinearGradient
          colors={
            selected
              ? v
                ? colors.secondaryGradient
                : colors.dangerGradient
              : [colors.surfaceRaised, colors.surfaceRaised]
          }
          style={[styles.yn, { borderColor: selected ? 'transparent' : colors.border }]}
        >
          <Text
            variant="label"
            align="center"
            style={{ color: selected ? colors.onSecondary : colors.text }}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  };
  return (
    <View style={styles.ynRow} accessibilityRole="radiogroup">
      {option(true, yesLabel)}
      {option(false, noLabel)}
    </View>
  );
}

export default function Round({
  round,
  pack,
  word,
  onNext,
  onSettings,
}: {
  round: ActiveRound;
  pack: Pack;
  word: Word;
  onNext(): void;
  onSettings(): void;
}) {
  const { t, i18n } = useTranslation(['spy', 'common']);
  const lang = i18n.language;
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const spySeesCategory = useSpy((s) => s.spySeesCategory);
  const setVerdict = useSpy((s) => s.setVerdict);
  const setGain = useSpy((s) => s.setGain);
  const setRevealedInStore = useSpy((s) => s.setRevealed);
  const session = useSession();

  const scrollRef = useRef<ScrollView>(null);
  const reveal = useReveal(scrollRef);
  // Kept in the store, so on everyone's phone the reveal reaches every phone too.
  const revealed = round.revealed || round.gain != null;
  const [showHint, setShowHint] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const join = (ids: readonly number[]) => ids.map(nameOf).join(t('common:list.and'));
  const twoSpies = round.spies.length > 1;

  const addPoints = () => {
    if (!verdictsComplete(round.verdicts)) return setShowHint(true);
    setShowHint(false);
    const gain = scoreRound(round.players, round.spies, round.verdicts);
    session.addPoints(gain);
    setGain(gain);
    setCelebrate(true);
    reveal.request('result');
  };

  const losers = round.gain ? losersOf(round.gain) : [];
  const result = roundResult(round.verdicts);

  return (
    <View style={styles.fill}>
      <Screen
        scrollRef={scrollRef}
        footer={
          !revealed ? (
            <Button
              testID="reveal"
              variant="secondary"
              icon="🔍"
              label={t('round.reveal')}
              onPress={() => {
                setRevealedInStore();
                reveal.request('answer');
              }}
            />
          ) : (
            // Until points are added, "Next round" stays secondary so it doesn't compete.
            <Button
              testID="next-round"
              variant={round.gain ? 'primary' : 'ghost'}
              size={round.gain ? 'lg' : 'md'}
              icon="🔁"
              label={t('round.next')}
              onPress={onNext}
            />
          )
        }
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <Text style={styles.bannerEmoji} accessible={false}>
            🎬
          </Text>
          <Text variant="title" align="center" style={styles.bannerText} testID="round-title">
            {t('round.started', { n: round.no })}
          </Text>
          {round.choice === RANDOM && spySeesCategory ? (
            <View style={styles.bannerPill}>
              <Text variant="label" align="center" style={styles.bannerText}>
                {`🎲 ${pack.emoji} ${localized(pack.name, lang)}`}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        <Panel>
          <View style={styles.spotlight}>
            <Avatar player={round.firstAsker} size={56} ring={colors.gold} />
            <Text variant="heading" style={styles.flex}>
              {t('round.firstAsk', { name: nameOf(round.firstAsker) })}
            </Text>
          </View>
          <Text variant="body" tone="muted">
            {t('round.rules')}
          </Text>
          {round.network ? (
            <Text variant="label" testID="seen-count" accessibilityLiveRegion="polite">
              {t('net.seenCount', { n: round.seen.length, total: round.players })}
            </Text>
          ) : null}
        </Panel>

        {revealed ? (
          <View onLayout={reveal.onLayout('answer')} style={styles.stack}>
            <Animated.View entering={ZoomIn.duration(350)}>
              <Panel testID="answer">
                <Text variant="caption" tone="muted" align="center">
                  {t('round.wordWas')}
                </Text>
                {wordLines(pack, word, lang).map((line, i) => (
                  <Text
                    key={i}
                    variant={i === 0 ? 'hero' : 'label'}
                    tone={i === 0 ? 'secondary' : 'default'}
                    align="center"
                    testID={i === 0 ? 'answer-word' : undefined}
                    style={i === 0 && styles.answerWord}
                  >
                    {line}
                  </Text>
                ))}
                <View style={styles.spies}>
                  {round.spies.map((p) => (
                    <Avatar key={p} player={p} size={40} />
                  ))}
                  <Text variant="label" testID="answer-spies">
                    {twoSpies
                      ? t('round.spiesAre', { names: join(round.spies) })
                      : t('round.spyIs', { names: join(round.spies) })}
                  </Text>
                </View>
              </Panel>
            </Animated.View>

            {round.gain == null ? (
              <Panel title={t('round.whoWon')} icon="⚖️" testID="who-won">
                {round.spies.map((spy, k) => {
                  const v = round.verdicts[k] ?? { caught: null, guessed: null };
                  const name = nameOf(spy);
                  return (
                    <View
                      key={spy}
                      style={[
                        styles.spyQ,
                        k > 0 && { borderTopWidth: 2, borderTopColor: colors.border },
                      ]}
                    >
                      <View style={styles.spotlight}>
                        <Avatar player={spy} size={36} />
                        <Text variant="label" style={styles.flex}>
                          {twoSpies
                            ? t('round.caughtQ', { name })
                            : t('round.caughtQSingle', { name })}
                        </Text>
                      </View>
                      <YesNo
                        testID={`caught-${k}`}
                        yesLabel={t('round.caughtYes')}
                        noLabel={t('round.caughtNo')}
                        value={v.caught}
                        onChange={(caught) => {
                          setShowHint(false);
                          setVerdict(k, { caught });
                        }}
                      />
                      {v.caught ? (
                        <>
                          <Text variant="label">{t('round.guessQ', { name })}</Text>
                          <YesNo
                            testID={`guessed-${k}`}
                            yesLabel={t('round.guessYes')}
                            noLabel={t('round.guessNo')}
                            value={v.guessed}
                            onChange={(guessed) => {
                              setShowHint(false);
                              setVerdict(k, { guessed });
                            }}
                          />
                        </>
                      ) : null}
                    </View>
                  );
                })}
                <Text variant="caption" tone="muted">
                  {t('round.scoring')}
                </Text>
                {showHint ? <Hint testID="answer-first">{t('round.answerFirst')}</Hint> : null}
                <Button
                  testID="add-points"
                  icon="🏁"
                  label={t('round.addPoints')}
                  onPress={addPoints}
                />
              </Panel>
            ) : (
              <View onLayout={reveal.onLayout('result')} style={styles.stack}>
                <Animated.View entering={ZoomIn.springify()}>
                  <Panel testID="result">
                    <Text style={styles.trophy} align="center" accessible={false}>
                      {RESULT_EMOJI[result]}
                    </Text>
                    <Text variant="title" tone="secondary" align="center" testID="result-title">
                      {t(`round.result.${result}`)}
                    </Text>
                    <Scoreboard
                      scores={fitScores(session.scores, round.players)}
                      gains={round.gain}
                      testID="round-scores"
                    />
                  </Panel>
                </Animated.View>

                <PunishmentPanel losers={losers} />
                {round.no % 5 === 0 ? <SoftUpsell /> : null}
              </View>
            )}
          </View>
        ) : null}

        <Button
          variant="ghost"
          size="md"
          icon="⚙️"
          testID="change-settings"
          label={t('round.settings')}
          onPress={onSettings}
        />
      </Screen>
      {celebrate && result === 'players' ? <Confetti /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  banner: {
    borderRadius: radius.card,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  bannerEmoji: { fontSize: 44, lineHeight: 54 },
  bannerText: { color: '#FFFFFF' },
  bannerPill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
  spotlight: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stack: { gap: space.lg },
  answerWord: { fontSize: 44, lineHeight: 56 },
  spies: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  spyQ: { gap: space.sm, paddingTop: space.sm },
  ynRow: { flexDirection: 'row', gap: space.sm },
  ynCell: { flex: 1 },
  yn: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  trophy: { fontSize: 64, lineHeight: 80 },
  pun: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  punWho: { flexDirection: 'row', justifyContent: 'center', gap: -8 },
  punLevel: { alignItems: 'center' },
  swap: { alignSelf: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
