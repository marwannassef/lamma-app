// A guest phone in a Spy network game: your own card (flip, hide, hold to peek again), then the
// answer and the scores when the host reveals them. Joining and the lobby are shared by every
// game (src/core/room/ui/JoinScreen); the host's phone runs the round.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { allPacks, wordLines } from '@/core/content';
import { PlayerNamesContext, usePlayerName } from '@/core/players';
import { leaveRoom, useGuest, type GuestSnapshot } from '@/core/room';
import { useSettings } from '@/core/settings/store';
import { radius, space, useTheme } from '@/core/theme';
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

import { CardBack } from '../components/CardBack';
import { RoleCard } from '../components/RoleCard';
import type { SpyView } from '../net';

const CARD_HEIGHT = 380;

/** This phone's card, from ids: each phone shows the word in its own language. */
function useCard(view: SpyView) {
  const { card } = view;
  const pack = allPacks.find((p) => p.id === card.packId) ?? null;
  const word = card.spy ? null : (pack?.words.find((w) => w.id === card.wordId) ?? null);
  return { pack, word, spy: card.spy };
}

/** Covers the card while the app is in the background (the app-switcher snapshot). */
function useBackgrounded() {
  const isAway = (s: string | null) => s === 'background' || s === 'inactive';
  const [away, setAway] = useState(isAway(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAway(isAway(s)));
    return () => sub.remove();
  }, []);
  return away;
}

/** Tap to flip your card, then hide it: the host sees one more "seen". */
function FlipCard({ view, onSeen }: { view: SpyView; onSeen(): void }) {
  const { t } = useTranslation('spy');
  const haptics = useSettings((s) => s.haptics);
  const { pack, word, spy } = useCard(view);
  const [open, setOpen] = useState(false);
  useNoScreenCapture('spy-card');
  const away = useBackgrounded();
  return (
    <Screen
      footer={
        open ? (
          <Button testID="hide-card" icon="🙈" label={t('card.hide')} onPress={onSeen} />
        ) : (
          <Text variant="body" tone="muted" align="center">
            {t('pass.hint')}
          </Text>
        )
      }
    >
      <Text variant="title" align="center" testID="round-title">
        {t('round.started', { n: view.round })}
      </Text>
      <Pressable
        testID="show-card"
        haptic={false}
        accessible={!open}
        accessibilityLabel={open ? undefined : t('pass.show')}
        onPress={() => {
          if (open) return;
          setOpen(true);
          if (haptics) {
            void Haptics.impactAsync(
              spy ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
            );
          }
        }}
        style={styles.card}
      >
        {open && !away ? (
          <RoleCard pack={pack} word={word} isSpy={spy} spySeesCategory={pack != null} />
        ) : (
          <CardBack hint={`👆 ${t('pass.show')}`} />
        )}
      </Pressable>
    </Screen>
  );
}

/** Press and hold to see your card again during the round. */
function Peek({ view }: { view: SpyView }) {
  const { t } = useTranslation('spy');
  const { colors } = useTheme();
  const { pack, word, spy } = useCard(view);
  const [open, setOpen] = useState(false);
  useNoScreenCapture('spy-peek');
  return (
    <View style={styles.stack}>
      <Pressable
        testID="peek-card"
        haptic={false}
        accessibilityLabel={t('net.peek')}
        onPressIn={() => setOpen(true)}
        onPressOut={() => setOpen(false)}
        style={[styles.peek, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text variant="label" align="center" accessible={false}>
          {`🔒 ${t('net.peek')}`}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.card}>
          <RoleCard pack={pack} word={word} isSpy={spy} spySeesCategory={pack != null} />
        </View>
      ) : null}
    </View>
  );
}

function Round({ view }: { view: SpyView }) {
  const { t, i18n } = useTranslation(['spy', 'common']);
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const answer = view.answer;
  const pack = answer ? allPacks.find((p) => p.id === answer.packId) : undefined;
  const word = pack?.words.find((w) => w.id === answer?.wordId);
  const names = (ids: readonly number[]) => ids.map(nameOf).join(t('common:list.and'));
  return (
    <Screen>
      <Text variant="title" align="center" testID="round-title">
        {t('round.started', { n: view.round })}
      </Text>
      <Panel>
        <View style={styles.row}>
          <Avatar player={view.firstAsker} size={48} ring={colors.gold} />
          <Text variant="heading" style={styles.flex}>
            {t('round.firstAsk', { name: nameOf(view.firstAsker) })}
          </Text>
        </View>
        <Text variant="body" tone="muted">
          {answer ? t('round.rules') : t('net.talk')}
        </Text>
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {t('net.seenCount', { n: view.seenCount, total: view.players })}
        </Text>
      </Panel>
      {answer && pack && word ? (
        <Panel testID="answer">
          <Text variant="caption" tone="muted" align="center">
            {t('round.wordWas')}
          </Text>
          {wordLines(pack, word, i18n.language).map((line, i) => (
            <Text
              key={i}
              variant={i === 0 ? 'hero' : 'label'}
              tone={i === 0 ? 'secondary' : 'default'}
              align="center"
              testID={i === 0 ? 'answer-word' : undefined}
            >
              {line}
            </Text>
          ))}
          <Text variant="label" align="center" testID="answer-spies">
            {answer.spies.length > 1
              ? t('round.spiesAre', { names: names(answer.spies) })
              : t('round.spyIs', { names: names(answer.spies) })}
          </Text>
        </Panel>
      ) : (
        <Text variant="body" align="center" tone="muted">
          {t('net.hidden')}
        </Text>
      )}
      {view.gain ? (
        <Panel title={t('common:scores.title')}>
          <Scoreboard scores={view.totals} gains={view.gain} testID="guest-scores" />
          <Text variant="caption" tone="muted" align="center">
            {t('net.waitNext')}
          </Text>
        </Panel>
      ) : (
        <Peek view={view} />
      )}
    </Screen>
  );
}

/** The game on a guest phone, with the room's names. */
export function SpyGuest({ snapshot }: { snapshot: GuestSnapshot }) {
  const { t } = useTranslation(['spy', 'common']);
  const [askLeave, setAskLeave] = useState(false);
  const { session } = useGuest();
  const view = snapshot.view as SpyView | null;
  if (!view) return null;
  return (
    <PlayerNamesContext.Provider value={snapshot.names}>
      <View style={styles.fill}>
        {view.seen ? (
          <Round view={view} />
        ) : (
          <FlipCard key={view.round} view={view} onSeen={() => session?.send({ t: 'seen' })} />
        )}
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
  flex: { flex: 1 },
  stack: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { height: CARD_HEIGHT },
  peek: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  leave: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs },
});
