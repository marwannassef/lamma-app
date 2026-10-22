// A guest phone in a network game (werewolf-network.md §2): join a room, wait in the lobby, then
// play: your card, your night action, your Hunter or Mayor choice, and the public outcome.
// The host's phone narrates; this phone stays quiet.
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, TextInput, View } from 'react-native';

import { parseRoomCode } from '@/core/net/roomCode';
import { MAX_NAME_LENGTH, PlayerNamesContext, usePlayerName } from '@/core/players';
import { useSettings } from '@/core/settings/store';
import { fontFamilyFor, radius, space, STEALTH, ThemeProvider, useTheme } from '@/core/theme';
import {
  Avatar,
  BackHeader,
  Button,
  ConfirmInline,
  Hint,
  Panel,
  PlayerPicker,
  Pressable,
  Screen,
  ScreenBackground,
  SecretGuard,
  Text,
  useStayAwake,
} from '@/core/ui';

import { werewolf as module } from '..';
import { GameLookContext, useWerewolfT } from '../components/i18n';
import { MoonlitBackground } from '../components/MoonlitBackground';
import { RoleCard } from '../components/RoleCard';
import { RoleIcon } from '../components/RoleIcon';
import type { PlayerId, SeatView } from '../engine';
import { joinRoom, leaveRoom, useGuest, useNearbyRooms } from '../net/room';
import type { GuestSnapshot } from '../net';
import type { Room } from '@/core/net/native';
import { ActionTurn, RevealTurn, useViewExtras } from './NetTurn';

const OUTCOME_EMOJI = {
  village: '🏡',
  wolves: '🐺',
  tanner: '🪢',
  serialKiller: '🔪',
  lovers: '❤️',
  draw: '🕯️',
} as const;

/** Name, games nearby, or a typed room code. */
function JoinForm({ rooms }: { rooms: readonly Room[] }) {
  const { t } = useWerewolfT(['common']);
  const { colors } = useTheme();
  const myName = useSettings((s) => s.myName);
  const setMyName = useSettings((s) => s.setMyName);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<'name' | 'code' | null>(null);
  const name = myName.trim();

  const join = (address: string | null) => {
    if (!name) return setProblem('name');
    if (!address) return setProblem('code');
    setProblem(null);
    joinRoom(address, name);
  };
  const input = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  ];

  return (
    <Screen>
      <BackHeader title={t('net.joinTitle')} image={module.icon} />
      <Panel title={t('net.yourName')} icon="🙋">
        <TextInput
          testID="my-name"
          value={myName}
          onChangeText={(v) => setMyName(v.slice(0, MAX_NAME_LENGTH))}
          placeholder={t('net.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('net.yourName')}
          autoCorrect={false}
          maxFontSizeMultiplier={2}
          style={[...input, { fontFamily: fontFamilyFor(myName || 'a', 'body', 'bold') }]}
        />
        <Text variant="caption" tone="muted">
          {t('net.nameHint')}
        </Text>
        {problem === 'name' ? <Hint>{t('net.needName')}</Hint> : null}
      </Panel>

      <Panel title={t('net.nearby')} icon="📶">
        {rooms.length === 0 ? (
          <Text variant="body" tone="muted" accessibilityLiveRegion="polite">
            {t('net.searching')}
          </Text>
        ) : (
          rooms.map((r) => (
            <Button
              key={r.id}
              testID={`room-${r.name}`}
              variant="secondary"
              size="md"
              icon="🎲"
              label={r.name}
              onPress={() => join(r.address)}
            />
          ))
        )}
      </Panel>

      <Panel title={t('net.code')} icon="🔢">
        <TextInput
          testID="room-code"
          value={code}
          onChangeText={setCode}
          placeholder={t('net.codePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('net.code')}
          autoCapitalize="characters"
          autoCorrect={false}
          maxFontSizeMultiplier={2}
          style={[...input, styles.code]}
        />
        {problem === 'code' ? <Hint>{t('net.codeInvalid')}</Hint> : null}
        <Button
          testID="join-code"
          size="md"
          label={t('net.joinCode')}
          onPress={() => join(parseRoomCode(code))}
        />
      </Panel>

      <Text variant="caption" tone="muted" align="center">
        {t('net.help')}
      </Text>
    </Screen>
  );
}

/** Connecting, rejected, or waiting for the host to start. */
function Waiting({ snapshot }: { snapshot: GuestSnapshot }) {
  const { t } = useWerewolfT(['common']);
  const { colors } = useTheme();
  const { status, lobby, seat, reason } = snapshot;
  const back = () => leaveRoom();
  return (
    <Screen
      footer={
        <Button
          testID="leave-room"
          variant="ghost"
          size="md"
          label={t('net.leave')}
          onPress={back}
        />
      }
    >
      <BackHeader title={t('net.joinTitle')} image={module.icon} />
      {status === 'rejected' && reason ? (
        <Hint>{t(`net.rejected.${reason}`)}</Hint>
      ) : status === 'lobby' && lobby ? (
        <>
          <Text variant="heading" align="center" testID="waiting-host">
            {t('net.waitingHost', { host: lobby.names[lobby.host] ?? '' })}
          </Text>
          <Panel title={t('net.players', { n: lobby.names.length })} icon="👥">
            {lobby.names.map((n, i) => (
              <View key={i} style={styles.row}>
                <Avatar player={i} size={36} />
                <Text variant="label" style={styles.flex} numberOfLines={1}>
                  {n}
                </Text>
                <Text
                  variant="caption"
                  style={{ color: i === seat ? colors.secondary : colors.textMuted }}
                >
                  {i === seat
                    ? t('net.you')
                    : lobby.online[i]
                      ? t('net.seat', { n: i + 1 })
                      : t('net.offline')}
                </Text>
              </View>
            ))}
          </Panel>
        </>
      ) : (
        <Text variant="heading" align="center" accessibilityLiveRegion="polite">
          {status === 'reconnecting' ? t('net.reconnecting') : t('net.connecting')}
        </Text>
      )}
    </Screen>
  );
}

/** Quiet dark screen while the host narrates the night. */
function EyesClosed({ text }: { text: string }) {
  return (
    <Screen stealthColor={STEALTH.bg} center>
      <Text variant="heading" align="center" style={styles.stealth} testID="eyes-closed">
        {text}
      </Text>
    </Screen>
  );
}

/** Press and hold to see your own card again during the day. */
function PeekRole({ view }: { view: SeatView }) {
  const { t } = useWerewolfT();
  const [open, setOpen] = useState(false);
  const extras = useViewExtras(view);
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <Pressable
        testID="peek-role"
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
        <RoleCard role={view.me.role}>
          {extras.map((line) => (
            <Text key={line} variant="label" align="center" style={styles.white}>
              {line}
            </Text>
          ))}
        </RoleCard>
      ) : null}
    </View>
  );
}

/** The table's alive/dead list, with roles the rules have made public. */
function Table({ view }: { view: SeatView }) {
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  return (
    <Panel>
      {view.public.players.map((p) => (
        <View key={p.id} style={styles.row}>
          <Avatar player={p.id} size={32} />
          <Text variant="label" style={styles.flex} numberOfLines={1}>
            {`${p.alive ? '' : '💀 '}${nameOf(p.id)}${p.mayor ? ' 🎖️' : ''}`}
          </Text>
          {p.role ? (
            <>
              <Text variant="caption" tone="muted">
                {t(`roles.${p.role}.name`)}
              </Text>
              <RoleIcon role={p.role} size={28} />
            </>
          ) : null}
        </View>
      ))}
    </Panel>
  );
}

/** Hunter's shot, Mayor's badge or tie-break, picked on this player's own phone. */
function OwnChoice({ view, send }: { view: SeatView; send: ReturnType<typeof useSend> }) {
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  const { colors } = useTheme();
  const [picked, setPicked] = useState<PlayerId | null>(null);
  const task = view.task;
  if (!task || (task.t !== 'hunterShot' && task.t !== 'mayorHandoff' && task.t !== 'mayorTieBreak'))
    return null;
  const options = task.t === 'mayorTieBreak' ? task.tied : task.targets;
  const confirm = () => {
    if (picked == null) return;
    if (task.t === 'hunterShot') send({ t: 'hunterShoot', target: picked });
    else if (task.t === 'mayorHandoff') send({ t: 'passBadge', to: picked });
    else send({ t: 'mayorDecide', pick: picked });
  };
  const title =
    task.t === 'hunterShot'
      ? t('effects.hunter', { name: nameOf(view.seat) })
      : task.t === 'mayorHandoff'
        ? t('effects.mayor', { name: nameOf(view.seat) })
        : t('day.mayorBreak', { name: nameOf(view.seat) });
  return (
    <Screen
      footer={
        <View style={styles.stack}>
          <Button
            testID="own-choice"
            icon={task.t === 'hunterShot' ? '🏹' : '🎖️'}
            label={picked != null ? nameOf(picked) : '…'}
            onPress={confirm}
          />
          {task.t !== 'hunterShot' ? (
            <Button
              variant="ghost"
              size="md"
              testID="own-choice-none"
              label={task.t === 'mayorHandoff' ? t('effects.nobody') : t('day.spare')}
              onPress={() =>
                send(
                  task.t === 'mayorHandoff'
                    ? { t: 'passBadge', to: null }
                    : { t: 'mayorDecide', pick: null },
                )
              }
            />
          ) : null}
        </View>
      }
    >
      <Text variant="heading" align="center" testID="narration">
        {title}
      </Text>
      <PlayerPicker
        players={view.public.players}
        selected={picked != null ? [picked] : []}
        include={(p) => options.includes(p.id)}
        onToggle={setPicked}
        fg={colors.text}
        muted={colors.textMuted}
        bg={colors.surfaceRaised}
        accent={colors.secondary}
      />
    </Screen>
  );
}

const useSend = () => {
  const { session } = useGuest();
  return (intent: Parameters<NonNullable<typeof session>['send']>[0]) => session?.send(intent);
};

/** The public part of the day on this phone: what happened, and your own card on a long press. */
function DayInfo({ view, children }: { view: SeatView; children?: ReactNode }) {
  const { t } = useWerewolfT();
  return (
    <Screen>
      <Text variant="title" align="center">
        {t('day.title', { n: Math.max(view.public.day, 1) })}
      </Text>
      {children}
      <Text variant="body" align="center" tone="muted">
        {view.me.alive ? t('net.lookUp') : t('net.out')}
      </Text>
      <PeekRole view={view} />
      <Table view={view} />
    </Screen>
  );
}

function GuestPhase({ view }: { view: SeatView }) {
  const { t } = useWerewolfT(['common']);
  const nameOf = usePlayerName();
  const send = useSend();
  const ph = view.public.phase;
  switch (ph.t) {
    case 'reveal':
      return view.task?.t === 'reveal' && view.task.seen ? (
        <EyesClosed text={t('net.waitOthers', { done: ph.seen, total: ph.total })} />
      ) : (
        <RevealTurn
          view={view}
          onSeen={() => send({ t: 'seen' })}
          onLink={(lovers) => send({ t: 'cupidLink', lovers })}
        />
      );
    case 'nightIntro':
    case 'glance':
    case 'pass':
      return <EyesClosed text={t('net.eyesClosed')} />;
    case 'actions':
      return (
        <ActionTurn
          key={`night-${view.public.night}`}
          view={view}
          onConfirm={(action) => send({ t: 'seatAction', action })}
        />
      );
    case 'morning':
      return (
        <DayInfo view={view}>
          <Text variant="heading" align="center">
            {`🌅 ${t('morning.title')}`}
          </Text>
          {ph.deaths.map((id) => (
            <Text key={id} variant="label" align="center">
              {`💀 ${nameOf(id)}`}
            </Text>
          ))}
        </DayInfo>
      );
    case 'deathEffects':
    case 'mayorTieBreak': {
      if (view.task) return <OwnChoice view={view} send={send} />;
      const by =
        ph.t === 'deathEffects' ? ph.effect?.by : view.public.players.find((p) => p.mayor)?.id;
      return (
        <DayInfo view={view}>
          {by != null ? (
            <Text variant="heading" align="center" testID="wait-for">
              {t('net.waitFor', { name: nameOf(by) })}
            </Text>
          ) : null}
        </DayInfo>
      );
    }
    case 'mayorElection':
      return (
        <DayInfo view={view}>
          <Text variant="heading" align="center">
            {t('day.electMayor')}
          </Text>
        </DayInfo>
      );
    case 'discussion':
      return (
        <DayInfo view={view}>
          <Text variant="heading" align="center">
            {t('day.discussion')}
          </Text>
        </DayInfo>
      );
    case 'vote':
      return (
        <DayInfo view={view}>
          <Text variant="heading" align="center">
            {`☝️ ${t('day.voteTitle')}`}
          </Text>
        </DayInfo>
      );
    case 'execution': {
      const out = ph.playerId == null ? null : view.public.players[ph.playerId];
      return (
        <DayInfo view={view}>
          <Text variant="heading" align="center">
            {out ? t('day.banished', { name: nameOf(out.id) }) : t('day.nobody')}
          </Text>
          {out?.role ? (
            <Text variant="label" align="center">
              {t('day.theyWere', { role: t(`roles.${out.role}.name`) })}
            </Text>
          ) : null}
        </DayInfo>
      );
    }
    case 'gameOver':
      return (
        <Screen
          footer={
            <Button
              testID="guest-home"
              variant="ghost"
              size="md"
              label={t('over.home')}
              onPress={() => {
                leaveRoom();
                router.replace('/');
              }}
            />
          }
        >
          <Text style={styles.big} align="center" accessible={false}>
            {OUTCOME_EMOJI[ph.result.outcome]}
          </Text>
          <Text variant="title" tone="secondary" align="center" testID="outcome">
            {t(`over.outcome.${ph.result.outcome}`)}
          </Text>
          <Text variant="heading" align="center">
            {t('net.youWere', { role: t(`roles.${view.me.dealtRole}.name`) })}
          </Text>
          <Table view={view} />
        </Screen>
      );
  }
}

const SECRET = new Set(['reveal', 'nightIntro', 'glance', 'actions', 'pass']);

/**
 * A short buzz when this phone has something new to do (its card, its night turn, its Hunter or
 * Mayor choice). Every phone gets the same buzz for the shared steps, so it gives nothing away.
 */
function useTaskBuzz(view: SeatView | null) {
  const haptics = useSettings((s) => s.haptics);
  const task = view?.task;
  const key =
    task && !('done' in task && task.done) && !(task.t === 'reveal' && task.seen)
      ? `${task.t}-${view.public.night}-${view.public.day}`
      : null;
  useEffect(() => {
    if (key && haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [haptics, key]);
}

/** The game on a guest phone, in the host's theme, names and Kids mode. */
function GuestGame({ snapshot }: { snapshot: GuestSnapshot }) {
  const { t } = useWerewolfT(['common']);
  const [askLeave, setAskLeave] = useState(false);
  const view = snapshot.view;
  useTaskBuzz(view);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);
  if (!view) return null;
  const secret = SECRET.has(view.public.phase.t);
  const body = <GuestPhase view={view} />;
  return (
    <PlayerNamesContext.Provider value={snapshot.names}>
      <GameLookContext.Provider value={{ theme: view.public.theme, kids: view.public.kids }}>
        <ThemeProvider scheme="dark">
          <ScreenBackground.Provider value={<MoonlitBackground theme={view.public.theme} />}>
            <Stack.Screen options={{ gestureEnabled: false }} />
            <StatusBar style="light" hidden={secret} />
            {snapshot.status === 'reconnecting' ? (
              <View style={styles.banner}>
                <Text variant="caption" align="center" accessibilityLiveRegion="polite">
                  {t('net.reconnecting')}
                </Text>
              </View>
            ) : null}
            {secret ? <SecretGuard>{body}</SecretGuard> : body}
            {!secret && view.public.phase.t !== 'gameOver' ? (
              <View style={styles.leave}>
                {askLeave ? (
                  <ConfirmInline
                    testID="leave-confirm"
                    question={t('host.quitConfirm')}
                    confirmLabel={t('net.leave')}
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
                    label={t('net.leave')}
                    onPress={() => setAskLeave(true)}
                  />
                )}
              </View>
            ) : null}
          </ScreenBackground.Provider>
        </ThemeProvider>
      </GameLookContext.Provider>
    </PlayerNamesContext.Provider>
  );
}

/** Route: Werewolf/Mafia → "Join someone's game". */
export default function Join() {
  useStayAwake();
  const { snapshot } = useGuest();
  const joining = !snapshot || snapshot.status === 'closed' || snapshot.status === 'connecting';
  const rooms = useNearbyRooms(joining);
  if (!snapshot || snapshot.status === 'closed') return <JoinForm rooms={rooms} />;
  if (snapshot.status === 'playing' || (snapshot.view && snapshot.status === 'reconnecting')) {
    return <GuestGame snapshot={snapshot} />;
  }
  return <Waiting snapshot={snapshot} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 18,
  },
  code: { fontSize: 24, letterSpacing: 2, textAlign: 'center' },
  stealth: { color: STEALTH.text },
  white: { color: '#FFFFFF' },
  big: { fontSize: 72, lineHeight: 90 },
  peek: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  banner: { paddingTop: space.xl, paddingHorizontal: space.lg },
  leave: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
