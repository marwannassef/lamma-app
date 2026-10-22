// TEMPORARY (network mode N3 smoke test, removed in N4): host or join a room on real phones.
// Development builds only; open lamma://dev-network. Not translated on purpose.
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TextInput, View } from 'react-native';

import { browseRooms, nativeTransport, type Room } from '@/core/net/native';
import { parseRoomCode, roomCode } from '@/core/net/roomCode';
import { mathRng } from '@/core/rng';
import { useTheme } from '@/core/theme';
import { Button, Screen, Text } from '@/core/ui';
import { gameReducer, newGame, type GameState, type RoleId } from '@/games/werewolf/engine';
import { GuestSession, HostSession } from '@/games/werewolf/net';

const deviceId = `dev-${Math.random().toString(36).slice(2, 10)}`;
const noop = () => () => undefined;

function HostPanel() {
  const [session, setSession] = useState<HostSession | null>(null);
  const [error, setError] = useState('');
  // The session reads the ref; the screen renders the state.
  const game = useRef<GameState | null>(null);
  const [shown, setShown] = useState<GameState | null>(null);
  const setGame = (g: GameState | null) => {
    game.current = g;
    setShown(g);
  };
  useEffect(() => {
    let s: HostSession | null = null;
    HostSession.open({
      transport: nativeTransport('Dev room'),
      host: { deviceId, name: 'Host' },
      theme: 'werewolf',
      kids: false,
      getGame: () => game.current,
      dispatch: (e) => {
        if (game.current) setGame(gameReducer(game.current, e, { now: Date.now(), rng: mathRng }));
      },
      now: Date.now,
    })
      .then((x) => {
        s = x;
        setSession(x);
      })
      .catch((e: Error) => setError(e.message));
    const tick = setInterval(() => s?.tick(), 1000);
    return () => {
      clearInterval(tick);
      s?.close();
    };
  }, []);
  const snap = useSyncExternalStore(session?.subscribe ?? noop, () => session?.getSnapshot());
  if (error) return <Text testID="dev-error">{`Error: ${error}`}</Text>;
  if (!session || !snap) return <Text>Opening room…</Text>;
  const ip = snap.address.split(':')[0] ?? '';
  return (
    <View style={{ gap: 8 }}>
      <Text testID="dev-address">{`Address: ${snap.address || '(no Wi-Fi/hotspot)'}`}</Text>
      <Text variant="hero" testID="dev-code">
        {roomCode(ip) ?? '—'}
      </Text>
      {snap.members.map((m) => (
        <Text
          key={m.deviceId}
        >{`${m.online ? '🟢' : '⚪️'} ${m.name}${m.isHost ? ' (host)' : ''}`}</Text>
      ))}
      <Button
        testID="dev-start"
        label={`Start (${snap.members.length} players)`}
        onPress={() => {
          const n = snap.members.length;
          const roles: RoleId[] = Array.from({ length: n }, (_, i) =>
            i === 0 ? 'werewolf' : 'villager',
          );
          setGame(newGame(roles, {}, { mode: 'network' }));
          session.sync();
        }}
      />
      <Text testID="dev-phase">{`Phase: ${shown ? JSON.stringify(shown.phase) : 'lobby'}`}</Text>
      {shown ? (
        <Button
          testID="dev-host-seen"
          label="I've seen my card (host)"
          onPress={() => session.actFor(session.hostSeat, { t: 'seen' })}
        />
      ) : null}
    </View>
  );
}

function GuestPanel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [code, setCode] = useState('');
  const [session, setSession] = useState<GuestSession | null>(null);
  const { colors } = useTheme();
  useEffect(() => browseRooms(setRooms), []);
  useEffect(() => () => session?.leave(), [session]);
  const snap = useSyncExternalStore(session?.subscribe ?? noop, () => session?.getSnapshot());
  const join = (address: string) =>
    setSession(
      new GuestSession({
        transport: nativeTransport('guest'),
        address,
        deviceId,
        name: 'Guest',
        now: Date.now,
        schedule: (fn, ms) => {
          const t = setTimeout(fn, ms);
          return () => clearTimeout(t);
        },
      }),
    );
  if (session && snap) {
    return (
      <View style={{ gap: 8 }}>
        <Text testID="dev-status">{`Status: ${snap.status}${snap.reason ? ` (${snap.reason})` : ''}`}</Text>
        <Text testID="dev-seat">{`Seat: ${snap.seat ?? '—'}  Names: ${(snap.lobby?.names ?? snap.names).join(', ')}`}</Text>
        {snap.view ? (
          <>
            <Text testID="dev-role">{`My role: ${snap.view.me.role}`}</Text>
            <Text>{`Public phase: ${JSON.stringify(snap.view.public.phase)}`}</Text>
            <Button
              testID="dev-seen"
              label="I've seen my card"
              onPress={() => session.send({ t: 'seen' })}
            />
          </>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Text variant="heading">Nearby rooms</Text>
      {rooms.length === 0 ? <Text tone="muted">Searching…</Text> : null}
      {rooms.map((r) => (
        <Button
          key={r.id}
          testID={`dev-room-${r.name}`}
          label={`${r.name} · ${r.address}`}
          onPress={() => join(r.address)}
        />
      ))}
      <TextInput
        testID="dev-code-input"
        value={code}
        onChangeText={setCode}
        placeholder="Room code"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        style={{
          color: colors.text,
          borderColor: colors.border,
          borderWidth: 1,
          padding: 12,
          minHeight: 48,
        }}
      />
      <Button
        testID="dev-join-code"
        label={`Join ${parseRoomCode(code) ?? ''}`}
        onPress={() => {
          const address = parseRoomCode(code);
          if (address) join(address);
        }}
      />
    </View>
  );
}

export default function DevNetwork() {
  const [mode, setMode] = useState<'host' | 'guest' | null>(null);
  const panel = useMemo(
    () => (mode === 'host' ? <HostPanel /> : mode === 'guest' ? <GuestPanel /> : null),
    [mode],
  );
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <Text variant="heading">Network smoke test</Text>
      {mode ? (
        panel
      ) : (
        <>
          <Button testID="dev-host" label="Host a room" onPress={() => setMode('host')} />
          <Button
            testID="dev-join"
            variant="secondary"
            label="Join a room"
            onPress={() => setMode('guest')}
          />
        </>
      )}
    </Screen>
  );
}
