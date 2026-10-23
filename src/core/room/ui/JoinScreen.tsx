// "Join a game" (werewolf-network.md §5), for any game: your name, games found nearby or a
// typed room code, then the host's lobby. Once the game starts, the game's own screens take over.
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import type { Room } from '@/core/net/native';
import { parseRoomCode } from '@/core/net/roomCode';
import { MAX_NAME_LENGTH } from '@/core/players';
import { useSettings } from '@/core/settings/store';
import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import { Avatar, BackHeader, Button, Hint, Panel, Screen, Text, useStayAwake } from '@/core/ui';

import type { GuestSnapshot } from '../guest';
import { joinRoom, leaveRoom, useGuest, useNearbyRooms } from '../manager';
import type { Lobby } from '../protocol';

/** Name, games nearby, or a typed room code. */
function JoinForm({ rooms }: { rooms: readonly Room[] }) {
  const { t } = useTranslation('common');
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
      <BackHeader title={t('net.joinTitle')} icon="📶" />
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
function Waiting({
  snapshot,
  gameTitle,
}: {
  snapshot: GuestSnapshot;
  gameTitle(lobby: Lobby): string | null;
}) {
  const { t } = useTranslation('common');
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
      <BackHeader title={t('net.joinTitle')} icon="📶" />
      {status === 'rejected' && reason ? (
        <Hint>{t(`net.rejected.${reason}`)}</Hint>
      ) : status === 'lobby' && lobby ? (
        <>
          <Text variant="heading" align="center" testID="waiting-host">
            {t('net.waitingHost', { host: lobby.names[lobby.host] ?? '' })}
          </Text>
          {gameTitle(lobby) ? (
            <Text variant="label" align="center" tone="muted" testID="room-game">
              {t('net.playing', { game: gameTitle(lobby) })}
            </Text>
          ) : (
            <Hint>{t('net.unknownGame')}</Hint>
          )}
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
        <>
          <Text variant="heading" align="center" accessibilityLiveRegion="polite">
            {status === 'reconnecting' ? t('net.reconnecting') : t('net.connecting')}
          </Text>
          {/* Still trying: say what usually fixes it, and the technical reason for us. */}
          {snapshot.failures >= 2 ? (
            <Hint testID="cant-reach">
              {snapshot.error
                ? `${t('net.cantReach')}\n${t('net.details', { detail: snapshot.error })}`
                : t('net.cantReach')}
            </Hint>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/**
 * The Join route. `renderGame` shows the running game for a game id (null when this app doesn't
 * know that game); `gameTitle` names the lobby's game.
 */
export function JoinScreen({
  renderGame,
  gameTitle,
}: {
  renderGame(snapshot: GuestSnapshot): ReactNode | null;
  gameTitle(lobby: Lobby): string | null;
}) {
  useStayAwake();
  const { snapshot } = useGuest();
  const joining = !snapshot || snapshot.status === 'closed' || snapshot.status === 'connecting';
  const rooms = useNearbyRooms(joining);
  if (!snapshot || snapshot.status === 'closed') return <JoinForm rooms={rooms} />;
  const inGame =
    snapshot.status === 'playing' || (snapshot.view != null && snapshot.status === 'reconnecting');
  const game = inGame ? renderGame(snapshot) : null;
  if (game) return game;
  return <Waiting snapshot={snapshot} gameTitle={gameTitle} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 18,
  },
  code: { fontSize: 24, letterSpacing: 2, textAlign: 'center' },
});
