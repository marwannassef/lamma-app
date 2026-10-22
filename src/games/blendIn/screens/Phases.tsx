import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { mixer } from '@/core/audio';
import { localized, wordLines, type Pack } from '@/core/content';
import { usePlayerName } from '@/core/players';
import { closeRoom } from '@/core/room';
import { usePacks } from '@/core/settings/content';
import { radius, space, STEALTH, useTheme } from '@/core/theme';
import {
  Avatar,
  Button,
  Confetti,
  Panel,
  PlayerPicker,
  Pressable,
  PunishmentPanel,
  Scoreboard,
  Screen,
  SecretGuard,
  SoftUpsell,
  Text,
  useCountdown,
} from '@/core/ui';

import { blendIn } from '..';
import { WordGrid } from '../components/WordGrid';
import { isOver, playable, type BlendInState, type Outcome } from '../logic';
import { useBlendIn } from '../store';

const LEAF = '#6DBE45';
export const CHAMELEON = ['#6DBE45', '#3E8E5A', '#6B3FC6'] as const;
const PEEK_HOLD_MS = 500;
const SECRET_TEXT = '#C9C2DA';

function useWord(pack: Pack, id: string | undefined) {
  const { i18n } = useTranslation();
  const word = pack.words.find((w) => w.id === id);
  return word ? wordLines(pack, word, i18n.language) : [];
}

/** "Pass the phone to …", then hold to see your card; releasing hides it (§4 step 1). */
export function Peek({
  game,
  pack,
  seat,
  onDone,
}: {
  game: BlendInState;
  pack: Pack;
  seat: number;
  /** After the card is hidden (default: the next seat's peek). Network mode marks the seat. */
  onDone?(): void;
}) {
  const { t, i18n } = useTranslation('blendIn');
  const nameOf = usePlayerName();
  const dispatch = useBlendIn((s) => s.dispatch);
  const [step, setStep] = useState<'handoff' | 'hold'>('handoff');
  const [showing, setShowing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOdd = seat === game.round.chameleon;
  const undercover = game.settings.mode === 'undercover';
  // Undercover: the odd one out gets their own word and an identical-looking card.
  const myWordId = undercover && isOdd ? game.round.undercoverWord : game.round.secret;
  const lines = useWord(pack, myWordId);
  const topic = `${pack.emoji} ${localized(pack.name, i18n.language)}`;
  const chameleonCard = isOdd && !undercover;

  return (
    <SecretGuard>
      <Screen stealthColor={STEALTH.bg} center scroll={false}>
        {step === 'handoff' ? (
          <>
            <View style={styles.center}>
              <Text variant="label" align="center" style={styles.muted}>
                {t('peek.passTo')}
              </Text>
              <Avatar player={seat} size={96} />
              <Text variant="hero" align="center" style={styles.secret} testID="peek-name">
                {nameOf(seat)}
              </Text>
            </View>
            <Button
              testID="im-player"
              variant="secondary"
              label={t('peek.imPlayer', { name: nameOf(seat) })}
              onPress={() => setStep('hold')}
            />
          </>
        ) : (
          <>
            {showing ? (
              <LinearGradient
                colors={chameleonCard ? CHAMELEON : ['#1B1530', '#241B3F']}
                style={styles.card}
                testID={chameleonCard ? 'card-chameleon' : 'card-word'}
              >
                <Text variant="label" align="center" style={styles.white}>
                  {t('peek.topic', {
                    emoji: pack.emoji,
                    name: localized(pack.name, i18n.language),
                  })}
                </Text>
                <Text
                  variant="hero"
                  align="center"
                  style={styles.white}
                  adjustsFontSizeToFit
                  numberOfLines={2}
                >
                  {chameleonCard ? `🦎 ${t('peek.chameleonTitle')}` : lines[0]}
                </Text>
                {!chameleonCard && lines[1] ? (
                  <Text variant="label" align="center" style={styles.white}>
                    {lines.slice(1).join(' · ')}
                  </Text>
                ) : null}
                <Text variant="caption" align="center" style={styles.white}>
                  {chameleonCard
                    ? t('peek.chameleonHint')
                    : undercover
                      ? t('peek.undercoverHint')
                      : t('peek.innocentHint')}
                </Text>
                {!undercover ? (
                  <WordGrid
                    pack={pack}
                    words={game.round.grid}
                    highlight={chameleonCard ? undefined : game.round.secret}
                    compact
                    colors={{ bg: 'rgba(0,0,0,0.25)', fg: '#FFFFFF' }}
                  />
                ) : null}
              </LinearGradient>
            ) : (
              <Text variant="heading" align="center" style={styles.muted}>
                {`${topic}\n${t('peek.hold')}`}
              </Text>
            )}
            <Pressable
              testID="peek-hold"
              haptic={false}
              accessibilityLabel={t('peek.hold')}
              onPressIn={() => {
                timer.current = setTimeout(() => setShowing(true), PEEK_HOLD_MS);
              }}
              onPressOut={() => {
                if (timer.current) clearTimeout(timer.current);
                if (!showing) return;
                setShowing(false);
                if (onDone) onDone();
                else dispatch({ t: 'peeked' });
              }}
              style={({ pressed }) => [styles.seal, pressed && styles.sealPressed]}
            >
              <Image source={blendIn.icon} style={styles.sealLogo} accessible={false} />
            </Pressable>
            {showing ? (
              <Text variant="caption" align="center" style={styles.muted}>
                {t('peek.release')}
              </Text>
            ) : null}
          </>
        )}
      </Screen>
    </SecretGuard>
  );
}

/** Phone in the middle: the grid on top, the current speaker big at the bottom (§4 step 2). */
export function Circle({
  game,
  pack,
  clueRound,
  turn,
}: {
  game: BlendInState;
  pack: Pack;
  clueRound: number;
  turn: number;
}) {
  const { t, i18n } = useTranslation(['blendIn', 'common']);
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const dispatch = useBlendIn((s) => s.dispatch);
  const speaker = game.round.order[turn] ?? 0;
  const timed = game.settings.clueTimer > 0;
  const [endsAt] = useState(() => Date.now() + game.settings.clueTimer * 1000);
  const left = useCountdown(timed ? endsAt : 0);
  const fired = useRef(false);
  useEffect(() => {
    if (timed && left === 0 && !fired.current) {
      fired.current = true;
      dispatch({ t: 'nextClue' });
    }
  }, [dispatch, left, timed]);
  const upNext = game.round.order
    .slice(turn + 1)
    .map(nameOf)
    .join(' · ');
  const first = clueRound === 1 && turn === 0;

  return (
    <Screen
      footer={
        <View style={styles.stack}>
          <Button
            testID="next-clue"
            icon="➡️"
            label={t('circle.next')}
            onPress={() => dispatch({ t: 'nextClue' })}
          />
          <Button
            size="md"
            variant="ghost"
            testID="rule-broken"
            icon="🚩"
            label={t('circle.ruleBroken')}
            onPress={() => dispatch({ t: 'ruleBroken' })}
          />
        </View>
      }
    >
      <Text variant="heading" align="center">
        {`${pack.emoji} ${localized(pack.name, i18n.language)}`}
      </Text>
      {game.settings.clueRounds > 1 ? (
        <Text variant="caption" tone="muted" align="center">
          {t('circle.round', { n: clueRound, total: game.settings.clueRounds })}
        </Text>
      ) : null}
      {game.settings.mode === 'classic' ? <WordGrid pack={pack} words={game.round.grid} /> : null}
      <View style={styles.speaker} accessibilityLiveRegion="polite">
        <View style={[styles.ring, { borderColor: timed && left <= 5000 ? colors.primary : LEAF }]}>
          <Avatar player={speaker} size={72} />
        </View>
        <Text variant="title" align="center" testID="speaker">
          {first
            ? t('circle.starts', { name: nameOf(speaker) })
            : t('circle.turn', { name: nameOf(speaker) })}
        </Text>
        {timed ? (
          <Text
            variant="hero"
            align="center"
            style={{ color: left <= 5000 ? colors.primary : LEAF }}
          >
            {String(Math.ceil(left / 1000))}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" align="center">
          {t('circle.reminder')}
        </Text>
        {upNext ? (
          <Text variant="caption" tone="muted" align="center" numberOfLines={2}>
            {t('circle.upNext', { names: upNext })}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const DISCUSS_SECONDS = 45;

export function Discuss() {
  const { t } = useTranslation('blendIn');
  const dispatch = useBlendIn((s) => s.dispatch);
  const [endsAt] = useState(() => Date.now() + DISCUSS_SECONDS * 1000);
  const left = useCountdown(endsAt);
  const fired = useRef(false);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      dispatch({ t: 'startVote' });
    }
  }, [dispatch, left]);
  // A ticking clock in the last 10 seconds that doubles its pace for the last 5 (§10).
  const secs = Math.ceil(left / 1000);
  useEffect(() => {
    if (secs <= 0 || secs > 10) return;
    mixer.sfx('tick');
    if (secs > 5) return;
    const id = setTimeout(() => mixer.sfx('tick'), 500);
    return () => clearTimeout(id);
  }, [secs]);
  return (
    <Screen
      center
      footer={
        <Button
          testID="point-now"
          icon="☝️"
          label={t('discuss.point')}
          onPress={() => dispatch({ t: 'startVote' })}
        />
      }
    >
      <Text style={styles.big} align="center" accessible={false}>
        🤔
      </Text>
      <Text variant="title" align="center">
        {t('discuss.title')}
      </Text>
      <Text variant="body" tone="muted" align="center">
        {t('discuss.sub')}
      </Text>
      <Text variant="hero" align="center" tone="secondary">
        {String(secs)}
      </Text>
    </Screen>
  );
}

const UNDO_SECONDS = 3;

/** 3-2-1 Point!, then the host taps the most-pointed player (with a 3 s Undo) or a tie. */
export function Vote({ game, among }: { game: BlendInState; among: number[] | null }) {
  const { t } = useTranslation('blendIn');
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const dispatch = useBlendIn((s) => s.dispatch);
  const [count, setCount] = useState(3);
  const [tie, setTie] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [pending, setPending] = useState<{ id: number; at: number } | null>(null);
  const undoLeft = useCountdown(pending ? pending.at + UNDO_SECONDS * 1000 : 0);

  useEffect(() => {
    if (count <= 0) return;
    mixer.sfx('tick');
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count]);
  useEffect(() => {
    if (pending && undoLeft === 0) dispatch({ t: 'accuse', id: pending.id });
  }, [dispatch, pending, undoLeft]);

  if (count > 0) {
    return (
      <Screen center>
        {among ? (
          <Text variant="heading" align="center">
            {t('vote.revote')}
          </Text>
        ) : null}
        <Text variant="heading" align="center" tone="muted">
          {t('vote.countdown')}
        </Text>
        <Text variant="hero" align="center" style={styles.countdown}>
          {String(count)}
        </Text>
      </Screen>
    );
  }
  const players = Array.from({ length: game.players }, (_, id) => ({ id, alive: true }));
  return (
    <Screen
      footer={
        pending ? (
          <Button
            testID="undo"
            variant="secondary"
            icon="↩️"
            label={t('vote.undo', { n: Math.ceil(undoLeft / 1000) })}
            onPress={() => setPending(null)}
          />
        ) : (
          <View style={styles.stack}>
            {tie ? (
              <Button
                testID="confirm-tie"
                icon="⚖️"
                label={t('vote.confirmTie')}
                onPress={() => picked.length > 1 && dispatch({ t: 'tie', tied: picked })}
              />
            ) : (
              <Button
                testID="accuse"
                icon="☝️"
                label={
                  picked[0] != null
                    ? t('vote.accuse', { name: nameOf(picked[0]) })
                    : t('vote.title')
                }
                onPress={() => picked[0] != null && setPending({ id: picked[0], at: Date.now() })}
              />
            )}
            <Button
              size="md"
              variant="ghost"
              testID="tie-mode"
              label={tie ? '↩︎' : t('vote.tie')}
              onPress={() => {
                setTie((v) => !v);
                setPicked([]);
              }}
            />
          </View>
        )
      }
    >
      <Text variant="hero" align="center">
        {t('vote.point')}
      </Text>
      <Text variant="heading" align="center" tone="muted">
        {tie ? t('vote.tieHint') : t('vote.title')}
      </Text>
      <PlayerPicker
        players={players}
        include={(p) => !among || among.includes(p.id)}
        selected={pending ? [pending.id] : picked}
        onToggle={(id) =>
          !pending &&
          setPicked((cur) =>
            tie ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id],
          )
        }
        fg={colors.text}
        muted={colors.textMuted}
        bg={colors.surfaceRaised}
        accent={LEAF}
      />
    </Screen>
  );
}

/** Caught! The phone goes to the Chameleon, who taps one word (§6). */
export function Escape({
  game,
  pack,
  choices,
}: {
  game: BlendInState;
  pack: Pack;
  choices: string[];
}) {
  const { t } = useTranslation('blendIn');
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const dispatch = useBlendIn((s) => s.dispatch);
  const [step, setStep] = useState<'caught' | 'pick' | 'suspense'>('caught');
  const cham = game.round.chameleon;

  if (step === 'caught') {
    return (
      <View style={[styles.fill, { backgroundColor: colors.danger }]}>
        <Screen center stealthColor={colors.danger}>
          <Animated.View entering={ZoomIn} style={styles.center}>
            <Text style={styles.big} accessible={false}>
              🚨
            </Text>
            <Text variant="title" align="center" style={styles.white}>
              {t('escape.caught')}
            </Text>
            <Avatar player={cham} size={96} />
            <Text variant="heading" align="center" style={styles.white}>
              {t('escape.passTo', { name: nameOf(cham) })}
            </Text>
          </Animated.View>
          <Button
            testID="escape-open"
            variant="secondary"
            label={t('escape.imPlayer', { name: nameOf(cham) })}
            onPress={() => setStep('pick')}
          />
        </Screen>
      </View>
    );
  }
  return (
    <SecretGuard>
      <Screen stealthColor={STEALTH.bg} center>
        {step === 'suspense' ? (
          <Text variant="title" align="center" style={styles.secret}>
            {t('escape.suspense')}
          </Text>
        ) : (
          <>
            <Text
              variant="title"
              align="center"
              style={styles.secret}
              accessibilityLabel={t('escape.pick')}
            >
              {`🦎 ${t('escape.pick')}`}
            </Text>
            <WordGrid
              pack={pack}
              words={choices}
              colors={{ bg: '#1B1530', fg: SECRET_TEXT }}
              onPick={(wordId) => {
                setStep('suspense');
                setTimeout(() => dispatch({ t: 'guess', wordId }), 1500);
              }}
            />
          </>
        )}
      </Screen>
    </SecretGuard>
  );
}

const OUTCOME_EMOJI: Record<Outcome, string> = {
  notCaught: '🦎',
  escaped: '🦎💨',
  caught: '🎉',
  ruleBroken: '🚩',
};

export function Result({
  game,
  pack,
  outcome,
  accused,
  guess,
  gain,
}: {
  game: BlendInState;
  pack: Pack;
  outcome: Outcome;
  accused: number | null;
  guess: string | null;
  gain: number[];
}) {
  const { t } = useTranslation('blendIn');
  const nameOf = usePlayerName();
  const dispatch = useBlendIn((s) => s.dispatch);
  const cham = game.round.chameleon;
  const secret = useWord(pack, game.round.secret);
  const odd = useWord(pack, game.round.undercoverWord);
  const guessed = useWord(pack, guess ?? undefined);
  const done = isOver(game.totals, game.roundsPlayed, game.settings.length);
  const packs = playable(usePacks('spy'), game.settings.mode);
  const title =
    outcome === 'caught'
      ? t('result.town')
      : outcome === 'escaped'
        ? t('result.escaped', { name: nameOf(cham) })
        : outcome === 'ruleBroken'
          ? t('result.ruleBroken')
          : t('result.wrongPerson', { name: nameOf(cham) });
  return (
    <View style={styles.fill}>
      <Screen
        footer={
          <Button
            testID="next-round"
            icon={done ? '🏆' : '🔁'}
            label={done ? t('result.finish') : t('result.next')}
            onPress={() => dispatch({ t: 'nextRound', packs })}
          />
        }
      >
        <Animated.View entering={ZoomIn.springify()} style={styles.center}>
          <Text style={styles.big} accessible={false}>
            {OUTCOME_EMOJI[outcome]}
          </Text>
          <Text variant="title" align="center" tone="secondary" testID="result-title">
            {title}
          </Text>
          <Avatar player={cham} size={72} ring={LEAF} />
        </Animated.View>
        <Panel>
          <Text variant="caption" tone="muted" align="center">
            {t('result.wordWas')}
          </Text>
          <Text variant="hero" align="center" style={{ color: LEAF }} testID="secret-word">
            {secret[0]}
          </Text>
          {game.settings.mode === 'undercover' ? (
            <Text variant="label" align="center">
              {`${t('result.undercoverHad', { name: nameOf(cham) })}: ${odd[0] ?? ''}`}
            </Text>
          ) : null}
          {guess ? (
            <Text variant="label" align="center">
              {`${t('result.guessed')}: ${guessed[0] ?? ''}`}
            </Text>
          ) : null}
          {accused != null && accused !== cham ? (
            <View style={styles.rowCenter}>
              <Avatar player={accused} size={32} />
              <Text variant="caption" tone="muted">
                ☝️
              </Text>
            </View>
          ) : null}
        </Panel>
        <Panel>
          <Scoreboard scores={game.totals} gains={gain} testID="round-scores" />
        </Panel>
        <PunishmentPanel losers={gain.flatMap((g, i) => (g === 0 ? [i] : []))} />
      </Screen>
      {outcome === 'caught' ? <Confetti /> : null}
    </View>
  );
}

export function Over({ game, winners }: { game: BlendInState; winners: number[] }) {
  const { t } = useTranslation('blendIn');
  const nameOf = usePlayerName();
  const quit = useBlendIn((s) => s.quit);
  const names = winners.map(nameOf).join(' & ');
  // Play again keeps a network room open, so everyone stays connected for the next game.
  const leave = (to: '/' | '/games/blend-in') => {
    quit();
    if (to === '/') closeRoom();
    router.replace(to);
  };
  return (
    <View style={styles.fill}>
      <Screen
        footer={
          <View style={styles.stack}>
            <Button
              testID="play-again"
              icon="🔁"
              label={t('over.playAgain')}
              onPress={() => leave('/games/blend-in')}
            />
            <Button
              size="md"
              variant="ghost"
              testID="go-home"
              label={t('over.home')}
              onPress={() => leave('/')}
            />
          </View>
        }
      >
        <Text style={styles.big} align="center" accessible={false}>
          🏆
        </Text>
        <Text variant="title" align="center">
          {t('over.title')}
        </Text>
        <View style={styles.rowCenter}>
          {winners.map((w) => (
            <Avatar key={w} player={w} size={64} ring={LEAF} />
          ))}
        </View>
        <Text variant="heading" align="center" tone="secondary" testID="winners">
          {winners.length > 1 ? t('over.winners', { names }) : t('over.winner', { names })}
        </Text>
        <Panel>
          <Scoreboard scores={game.totals} />
        </Panel>
        <SoftUpsell />
      </Screen>
      <Confetti />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', gap: space.md },
  stack: { gap: space.sm },
  rowCenter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: { color: STEALTH.text },
  secret: { color: SECRET_TEXT },
  white: { color: '#FFFFFF' },
  big: { fontSize: 64, lineHeight: 80 },
  countdown: { fontSize: 120, lineHeight: 140 },
  card: {
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
    minHeight: 380,
    justifyContent: 'center',
  },
  seal: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#163320',
    borderWidth: 4,
    borderColor: '#2E6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealPressed: { transform: [{ scale: 0.94 }], borderColor: LEAF },
  sealLogo: { width: 84, height: 84, borderRadius: 42 },
  speaker: { alignItems: 'center', gap: space.xs, paddingTop: space.md },
  ring: { borderWidth: 6, borderRadius: 50, padding: 4 },
});
