// The host's room in a game's setup (werewolf-network.md §5), for any game: open it, show the
// room code, and seat the players who joined.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { roomCode } from '@/core/net/roomCode';
import { MAX_NAME_LENGTH } from '@/core/players';
import { useSettings } from '@/core/settings/store';
import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import { Avatar, Button, Hint, Panel, Pressable, ReorderList, Text, useStayAwake } from '@/core/ui';

import { useHostRoom } from '../manager';

/** A sleeping host phone drops every connection, so it stays awake while the room is open. */
function StayAwake() {
  useStayAwake();
  return null;
}

/** "192.168.1.5:47777" → its room code, or null when the phone has no local address. */
function codeOf(address: string) {
  const colon = address.lastIndexOf(':');
  if (colon <= 0) return null;
  return roomCode(address.slice(0, colon), Number(address.slice(colon + 1)));
}

export function HostLobby({
  game,
  open: openFor,
  freeCap,
}: {
  /** The room's game id: the lobby shows this game's room only. */
  game: string;
  /** Opens this game's room as `name` (the host player). */
  open(name: string): Promise<unknown>;
  /** The free tier's player limit, shown when the host doesn't have Premium. */
  freeCap: number | null;
}) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const myName = useSettings((s) => s.myName);
  const setMyName = useSettings((s) => s.setMyName);
  const { room, snapshot } = useHostRoom(game);
  const [state, setState] = useState<'idle' | 'opening' | 'failed' | 'needName'>('idle');

  if (!room || !snapshot) {
    const open = () => {
      const name = myName.trim();
      if (!name) return setState('needName');
      setState('opening');
      openFor(name).then(
        () => setState('idle'),
        () => setState('failed'),
      );
    };
    return (
      <Panel title={t('net.yourName')} icon="🙋" testID="lobby">
        <TextInput
          testID="host-name"
          value={myName}
          onChangeText={(v) => setMyName(v.slice(0, MAX_NAME_LENGTH))}
          placeholder={t('net.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('net.yourName')}
          autoCorrect={false}
          maxFontSizeMultiplier={2}
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surfaceRaised,
              fontFamily: fontFamilyFor(myName || 'a', 'body', 'bold'),
            },
          ]}
        />
        {state === 'needName' ? <Hint>{t('net.needName')}</Hint> : null}
        {state === 'failed' ? <Hint>{t('net.openFailed')}</Hint> : null}
        <Button
          testID="open-room"
          size="md"
          icon="📶"
          label={state === 'opening' ? t('net.opening') : t('net.openRoom')}
          onPress={() => state !== 'opening' && open()}
        />
      </Panel>
    );
  }

  const code = codeOf(snapshot.address);
  const members = snapshot.members;
  return (
    <Panel title={t('net.roomCode')} icon="📶" testID="lobby">
      <StayAwake />
      {code ? (
        <Text
          variant="hero"
          align="center"
          testID="room-code-shown"
          accessibilityLabel={`${t('net.roomCode')}: ${code.split('').join(' ')}`}
        >
          {code}
        </Text>
      ) : (
        <Hint>{t('net.noAddress')}</Hint>
      )}
      <Text variant="caption" tone="muted" align="center">
        {t('net.howToJoin')}
      </Text>
      <Text variant="label">{t('net.players', { n: members.length })}</Text>
      {freeCap != null ? (
        <Text variant="caption" tone="muted" testID="free-cap">
          {t('premium.freeCap', { n: freeCap })}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        {t('net.seatHint')}
      </Text>
      <ReorderList
        count={members.length}
        onMove={(from, to) => room.move(from, to)}
        handleLabel={(i) => t('net.dragSeat', { name: members[i]?.name ?? '' })}
        moveUpLabel={(i) => t('net.moveUp', { name: members[i]?.name ?? '' })}
        moveDownLabel={(i) => t('net.moveDown', { name: members[i]?.name ?? '' })}
        renderRow={(i) => {
          const m = members[i];
          if (!m) return null;
          return (
            <View
              style={[
                styles.seat,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <Text variant="label" tone="muted" style={styles.seatNo}>
                {String(i + 1)}
              </Text>
              <Avatar player={i} size={32} />
              <Text variant="label" style={styles.flex} numberOfLines={1} testID={`member-${i}`}>
                {m.isHost ? `${m.name} (${t('net.you')})` : m.name}
              </Text>
              {!m.online ? (
                <Text variant="caption" tone="muted">
                  {t('net.offline')}
                </Text>
              ) : null}
              {!m.isHost ? (
                <Pressable
                  testID={`remove-${i}`}
                  accessibilityLabel={t('net.remove', { name: m.name })}
                  onPress={() => room.remove(m.deviceId)}
                  style={styles.remove}
                >
                  <Text variant="label" tone="muted" accessible={false}>
                    ✕
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 18,
  },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    minHeight: 52,
  },
  seatNo: { width: 22, textAlign: 'center' },
  remove: { minWidth: 48, alignItems: 'center', justifyContent: 'center' },
});
