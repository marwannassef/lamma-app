import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent, type ScrollView } from 'react-native';

import { localized, wordLines, type Pack, type Word } from '@/core/content';
import { usePlayerName, usePlayers } from '@/core/players';
import { losersOf, punishmentText, usePunishments, type PunishmentCard } from '@/core/punishments';
import { fitScores, useSession } from '@/core/session';
import { radius, space, useTheme } from '@/core/theme';
import { Button, Hint, Panel, Pressable, Scoreboard, Screen, Text } from '@/core/ui';

import { RANDOM, roundResult, scoreRound, verdictsComplete } from '../logic';
import { useSpy, type ActiveRound } from '../store';

type Anchor = 'answer' | 'result';

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
        style={[
          styles.yn,
          {
            borderColor: selected ? colors.secondary : colors.border,
            backgroundColor: selected ? colors.secondary : colors.surfaceRaised,
          },
        ]}
      >
        <Text
          variant="label"
          align="center"
          style={{ color: selected ? colors.onSecondary : colors.text }}
        >
          {label}
        </Text>
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
  const count = usePlayers((s) => s.count);
  const spySeesCategory = useSpy((s) => s.spySeesCategory);
  const setVerdict = useSpy((s) => s.setVerdict);
  const setGain = useSpy((s) => s.setGain);
  const session = useSession();
  const punishments = usePunishments();

  const scrollRef = useRef<ScrollView>(null);
  const reveal = useReveal(scrollRef);
  const [revealed, setRevealed] = useState(round.gain != null);
  const [showHint, setShowHint] = useState(false);
  const [cards, setCards] = useState<PunishmentCard[] | null>(null);

  const join = (ids: readonly number[]) => ids.map(nameOf).join(t('common:list.and'));
  const twoSpies = round.spies.length > 1;

  const addPoints = () => {
    if (!verdictsComplete(round.verdicts)) return setShowHint(true);
    setShowHint(false);
    const gain = scoreRound(count, round.spies, round.verdicts);
    session.addPoints(gain);
    setGain(gain);
    reveal.request('result');
  };

  const losers = round.gain ? losersOf(round.gain) : [];
  const result = roundResult(round.verdicts);

  return (
    <Screen scrollRef={scrollRef}>
      <Text style={styles.hero} align="center" accessible={false}>
        🎬
      </Text>
      <Text variant="title" tone="secondary" align="center" testID="round-title">
        {t('round.started', { n: round.no })}
      </Text>
      {round.choice === RANDOM && spySeesCategory ? (
        <View style={[styles.pill, { backgroundColor: colors.surface }]}>
          <Text variant="label" align="center">
            {`🎲 ${pack.emoji} ${localized(pack.name, lang)}`}
          </Text>
        </View>
      ) : null}
      <Text variant="body" align="center">
        {t('round.firstAsk', { name: nameOf(round.firstAsker) })}
      </Text>
      <Text variant="body" tone="muted" align="center">
        {t('round.rules')}
      </Text>

      {revealed ? (
        <View onLayout={reveal.onLayout('answer')} style={styles.stack}>
          <Panel testID="answer">
            <Text variant="caption" tone="muted" align="center">
              {t('round.wordWas')}
            </Text>
            {wordLines(pack, word, lang).map((line, i) => (
              <Text
                key={i}
                variant={i === 0 ? 'title' : 'label'}
                tone={i === 0 ? 'secondary' : 'default'}
                align="center"
                testID={i === 0 ? 'answer-word' : undefined}
              >
                {line}
              </Text>
            ))}
            <Text variant="label" align="center" testID="answer-spies">
              {twoSpies
                ? t('round.spiesAre', { names: join(round.spies) })
                : t('round.spyIs', { names: join(round.spies) })}
            </Text>
          </Panel>

          {round.gain == null ? (
            <Panel title={t('round.whoWon')} testID="who-won">
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
                    <Text variant="label">
                      {twoSpies ? t('round.caughtQ', { name }) : t('round.caughtQSingle', { name })}
                    </Text>
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
              <Button testID="add-points" label={t('round.addPoints')} onPress={addPoints} />
            </Panel>
          ) : (
            <View onLayout={reveal.onLayout('result')} style={styles.stack}>
              <Panel testID="result">
                <Text variant="title" tone="secondary" align="center" testID="result-title">
                  {t(`round.result.${result}`)}
                </Text>
                <Scoreboard
                  scores={fitScores(session.scores, count)}
                  gains={round.gain}
                  testID="round-scores"
                />
              </Panel>

              {punishments.level !== 'off' && losers.length > 0 ? (
                <Panel title={t('common:punishments.panelTitle')} testID="punishments">
                  <Text variant="body" align="center">
                    {t('common:punishments.losers', { names: join(losers) })}
                  </Text>
                  {cards == null ? (
                    <Button
                      testID="draw-punishment"
                      tone="danger"
                      label={t('common:punishments.draw')}
                      onPress={() => setCards(punishments.deal(losers))}
                    />
                  ) : (
                    cards.map((card) => (
                      <View
                        key={card.id}
                        style={[styles.pun, { backgroundColor: colors.danger }]}
                        accessibilityLiveRegion="polite"
                      >
                        <Text variant="label" align="center" style={{ color: colors.onSecondary }}>
                          {card.players.length > 1
                            ? t('common:punishments.group', { names: join(card.players) })
                            : nameOf(card.players[0] ?? 0)}
                        </Text>
                        <Text
                          variant="heading"
                          align="center"
                          style={{ color: colors.onSecondary }}
                          testID="punishment-text"
                        >
                          {punishmentText(lang, card.draw.level, card.draw.index)}
                        </Text>
                        <Text
                          variant="caption"
                          align="center"
                          style={{ color: colors.onSecondary }}
                        >
                          {t(`common:punishments.levels.${card.draw.level}`)}
                        </Text>
                        {!card.swapped ? (
                          <Pressable
                            testID={`swap-${card.id}`}
                            accessibilityLabel={t('common:punishments.swap')}
                            onPress={() =>
                              setCards((cs) =>
                                (cs ?? []).map((c) => (c.id === card.id ? punishments.swap(c) : c)),
                              )
                            }
                            style={styles.swap}
                          >
                            <Text
                              variant="label"
                              align="center"
                              style={{ color: colors.onSecondary, textDecorationLine: 'underline' }}
                            >
                              {t('common:punishments.swap')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))
                  )}
                </Panel>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.stack}>
        {!revealed ? (
          <Button
            variant="ghost"
            testID="reveal"
            label={t('round.reveal')}
            onPress={() => {
              setRevealed(true);
              reveal.request('answer');
            }}
          />
        ) : null}
        <Button testID="next-round" label={t('round.next')} onPress={onNext} />
        <Button
          variant="ghost"
          testID="change-settings"
          label={t('round.settings')}
          onPress={onSettings}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 56, lineHeight: 68 },
  pill: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  stack: { gap: space.md },
  spyQ: { gap: space.sm, paddingTop: space.sm },
  ynRow: { flexDirection: 'row', gap: space.sm },
  yn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    justifyContent: 'center',
  },
  pun: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  swap: { alignSelf: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
