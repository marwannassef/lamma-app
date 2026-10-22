// A guest phone in a Blend In network game: your own card (hold to see, release to hide), a buzz
// on your clue turn, the Chameleon's escape guess on their own phone, and the result. Joining and
// the lobby are shared by every game; the host's phone runs the circle and the vote.
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { allPacks, localized, wordLines, type Pack } from '@/core/content';
import { PlayerNamesContext, usePlayerName } from '@/core/players';
import { leaveRoom, useGuest, type GuestSnapshot } from '@/core/room';
import { useSettings } from '@/core/settings/store';
import { radius, space, STEALTH, useTheme } from '@/core/theme';
import {
  Avatar,
  Button,
  ConfirmInline,
  Panel,
  Pressable,
  Scoreboard,
  Screen,
  Text,
  useNoScreenCapture,
} from '@/core/ui';

import { WordGrid } from '../components/WordGrid';
import { CHAMELEON } from './Phases';
import type { BlendInView } from '../net';

/** This phone's card, from ids: each phone shows the words in its own language. */
function Card({ view, pack }: { view: BlendInView; pack: Pack }) {
  const { t, i18n } = useTranslation('blendIn');
  const { card } = view;
  const wordId = card.kind === 'word' ? card.wordId : card.secret;
  const word = wordId ? pack.words.find((w) => w.id === wordId) : undefined;
  const lines = word ? wordLines(pack, word, i18n.language) : [];
  const chameleon = card.kind === 'grid' && card.secret == null;
  return (
    <LinearGradient
      colors={chameleon ? CHAMELEON : ['#1B1530', '#241B3F']}
      style={styles.card}
      testID={chameleon ? 'card-chameleon' : 'card-word'}
    >
      <Text variant="label" align="center" style={styles.white}>
        {t('peek.topic', { emoji: pack.emoji, name: localized(pack.name, i18n.language) })}
      </Text>
      <Text
        variant="hero"
        align="center"
        style={styles.white}
        adjustsFontSizeToFit
        numberOfLines={2}
      >
        {chameleon ? `🦎 ${t('peek.chameleonTitle')}` : lines[0]}
      </Text>
      {!chameleon && lines[1] ? (
        <Text variant="label" align="center" style={styles.white}>
          {lines.slice(1).join(' · ')}
        </Text>
      ) : null}
      <Text variant="caption" align="center" style={styles.white}>
        {chameleon
          ? t('peek.chameleonHint')
          : card.kind === 'word'
            ? t('peek.undercoverHint')
            : t('peek.innocentHint')}
      </Text>
      {card.kind === 'grid' ? (
        <WordGrid
          pack={pack}
          words={card.grid}
          highlight={card.secret ?? undefined}
          compact
          colors={{ bg: 'rgba(0,0,0,0.25)', fg: '#FFFFFF' }}
        />
      ) : null}
    </LinearGradient>
  );
}

/** Press and hold to see your card; it hides as soon as you let go. */
function HoldCard({
  view,
  pack,
  label,
  onHidden,
}: {
  view: BlendInView;
  pack: Pack;
  label: string;
  onHidden?(): void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  useNoScreenCapture('blend-in-card');
  return (
    <View style={styles.stack}>
      {open ? <Card view={view} pack={pack} /> : null}
      <Pressable
        testID="hold-card"
        haptic={false}
        accessibilityLabel={label}
        onPressIn={() => setOpen(true)}
        onPressOut={() => {
          setOpen(false);
          onHidden?.();
        }}
        style={[styles.hold, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text variant="label" align="center" accessible={false}>
          {`🔒 ${label}`}
        </Text>
      </Pressable>
    </View>
  );
}

/** The caught Chameleon's escape: tap the secret word, on their own phone. */
function Escape({
  view,
  pack,
  onGuess,
}: {
  view: BlendInView;
  pack: Pack;
  onGuess(id: string): void;
}) {
  const { t } = useTranslation('blendIn');
  const [sent, setSent] = useState(false);
  return (
    <Screen stealthColor={STEALTH.bg} center>
      {sent ? (
        <Text variant="title" align="center" style={styles.secret}>
          {t('escape.suspense')}
        </Text>
      ) : (
        <>
          <Text variant="title" align="center" style={styles.secret}>
            {`🦎 ${t('escape.pick')}`}
          </Text>
          <WordGrid
            pack={pack}
            words={view.escapeChoices ?? []}
            colors={{ bg: '#1B1530', fg: '#C9C2DA' }}
            onPick={(wordId) => {
              setSent(true);
              onGuess(wordId);
            }}
          />
        </>
      )}
    </Screen>
  );
}

/** A buzz when it's this phone's turn to give a clue. */
function useTurnBuzz(view: BlendInView | null, seat: number | null) {
  const haptics = useSettings((s) => s.haptics);
  const ph = view?.phase;
  const key =
    view && ph?.t === 'circle' && ph.speaker === seat ? `${view.round}-${ph.clueRound}` : null;
  useEffect(() => {
    if (key && haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [haptics, key]);
}

function Phase({ view, seat, pack }: { view: BlendInView; seat: number | null; pack: Pack }) {
  const { t, i18n } = useTranslation(['blendIn', 'common']);
  const nameOf = usePlayerName();
  const { session } = useGuest();
  const ph = view.phase;
  const word = (id: string | null) => {
    const w = id ? pack.words.find((x) => x.id === id) : undefined;
    return w ? (wordLines(pack, w, i18n.language)[0] ?? '') : '';
  };

  if (ph.t === 'look') {
    return view.seen ? (
      <Screen stealthColor={STEALTH.bg} center>
        <Text variant="heading" align="center" style={styles.secret} testID="wait-others">
          {t('net.waitOthers', { n: ph.seen, total: ph.total })}
        </Text>
      </Screen>
    ) : (
      <Screen stealthColor={STEALTH.bg} center>
        <Text variant="heading" align="center" style={styles.secret}>
          {t('peek.hold')}
        </Text>
        <HoldCard
          view={view}
          pack={pack}
          label={t('peek.hold')}
          onHidden={() => session?.send({ t: 'seen' })}
        />
      </Screen>
    );
  }
  if (ph.t === 'escape' && view.escapeChoices) {
    return (
      <Escape view={view} pack={pack} onGuess={(wordId) => session?.send({ t: 'guess', wordId })} />
    );
  }

  let headline: string;
  switch (ph.t) {
    case 'circle':
      headline =
        ph.speaker === seat ? t('net.yourTurn') : t('circle.turn', { name: nameOf(ph.speaker) });
      break;
    case 'discuss':
      headline = t('discuss.title');
      break;
    case 'vote':
      headline = ph.among ? t('vote.revote') : t('vote.countdown');
      break;
    case 'escape':
      headline = t('net.guessing', { name: nameOf(ph.chameleon) });
      break;
    case 'result':
      headline =
        ph.outcome === 'notCaught'
          ? t('result.wrongPerson', { name: nameOf(ph.chameleon) })
          : ph.outcome === 'escaped'
            ? t('result.escaped', { name: nameOf(ph.chameleon) })
            : ph.outcome === 'caught'
              ? t('result.town')
              : t('result.ruleBroken');
      break;
    case 'over': {
      const names = ph.winners.map(nameOf).join(' & ');
      headline = ph.winners.length > 1 ? t('over.winners', { names }) : t('over.winner', { names });
      break;
    }
  }

  return (
    <Screen>
      {ph.t === 'circle' ? (
        <Text variant="label" align="center" tone="muted">
          {t('circle.round', { n: ph.clueRound, total: ph.clueRounds })}
        </Text>
      ) : null}
      {ph.t === 'circle' ? (
        <View style={styles.center}>
          <Avatar player={ph.speaker} size={72} />
        </View>
      ) : null}
      <Text variant="title" align="center" testID="headline" accessibilityLiveRegion="polite">
        {headline}
      </Text>
      {ph.t === 'circle' ? (
        <Text variant="body" align="center" tone="muted">
          {t('circle.reminder')}
        </Text>
      ) : null}
      {ph.t === 'result' ? (
        <Panel>
          <Text variant="caption" tone="muted" align="center">
            {t('result.wordWas')}
          </Text>
          <Text variant="hero" tone="secondary" align="center" testID="secret-word">
            {word(ph.secret)}
          </Text>
          <Scoreboard scores={view.totals} gains={ph.gain} testID="guest-scores" />
          <Text variant="caption" tone="muted" align="center">
            {t('net.waitNext')}
          </Text>
        </Panel>
      ) : ph.t === 'over' ? (
        <Panel>
          <Scoreboard scores={view.totals} testID="guest-scores" />
        </Panel>
      ) : (
        <>
          <Text variant="body" align="center" tone="muted">
            {t('net.lookUp')}
          </Text>
          <HoldCard view={view} pack={pack} label={t('net.peek')} />
        </>
      )}
    </Screen>
  );
}

/** The game on a guest phone, with the room's names. */
export function BlendInGuest({ snapshot }: { snapshot: GuestSnapshot }) {
  const { t } = useTranslation(['blendIn', 'common']);
  const [askLeave, setAskLeave] = useState(false);
  const view = snapshot.view as BlendInView | null;
  const pack = view ? allPacks.find((p) => p.id === view.packId) : undefined;
  useTurnBuzz(view, snapshot.seat);
  if (!view || !pack) return null;
  return (
    <PlayerNamesContext.Provider value={snapshot.names}>
      <View style={styles.fill}>
        <Phase view={view} seat={snapshot.seat} pack={pack} />
        <View style={styles.leave}>
          {snapshot.status === 'reconnecting' ? (
            <Text variant="caption" align="center" tone="muted" accessibilityLiveRegion="polite">
              {t('common:net.reconnecting')}
            </Text>
          ) : null}
          {askLeave ? (
            <ConfirmInline
              testID="leave-confirm"
              question={t('common:net.leave')}
              confirmLabel={t('common:net.leave')}
              cancelLabel={t('common:actions.cancel')}
              onConfirm={() => {
                leaveRoom();
                router.replace('/');
              }}
              onCancel={() => setAskLeave(false)}
            />
          ) : (
            <Button
              testID="guest-leave"
              variant="ghost"
              size="md"
              label={t('common:net.leave')}
              onPress={() => setAskLeave(true)}
            />
          )}
        </View>
      </View>
    </PlayerNamesContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stack: { gap: space.sm },
  center: { alignItems: 'center' },
  card: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  white: { color: '#FFFFFF' },
  secret: { color: '#C9C2DA' },
  hold: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  leave: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs },
});
