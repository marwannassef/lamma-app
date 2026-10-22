// Werewolf/Mafia in the shared room (src/core/room): which views the phones get and what they
// may do, from this game's engine and store.
import { openRoom, useHostRoom, getRoom, type RoomGame } from '@/core/room';
import { useSettings } from '@/core/settings/store';

import {
  actingSeat,
  viewFor,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Theme,
} from '../engine';
import { useWerewolf } from '../store';
import { parseIntent, type Intent } from './intents';

/** The room's game id: Werewolf and Mafia share one engine, told apart by the theme. */
export const ROOM_GAME = 'werewolf';

/** Turns a guest's intent into an event for their own seat, or null if it isn't theirs to send. */
export function eventFor(game: GameState, seat: PlayerId, intent: Intent): GameEvent | null {
  switch (intent.t) {
    case 'seen':
      return { t: 'seatSeen', seat };
    case 'cupidLink':
      return { t: 'cupidLink', lovers: intent.lovers, seat };
    case 'seatAction':
      return { t: 'seatAction', seat, action: intent.action };
    case 'hunterShoot':
    case 'passBadge':
    case 'mayorDecide':
      return actingSeat(game) === seat ? intent : null;
  }
}

const networkGame = () => {
  const g = useWerewolf.getState().game;
  return g?.mode === 'network' ? g : null;
};

/** The room's view of this game, reading and updating the Werewolf store. */
export function werewolfRoomGame(theme: Theme, kids: boolean): RoomGame {
  return {
    id: ROOM_GAME,
    theme,
    kids,
    players: () => networkGame()?.players.length ?? null,
    viewFor: (seat) => {
      const g = networkGame();
      return g ? viewFor(g, seat) : null;
    },
    act: (seat, raw) => {
      const g = networkGame();
      const intent = parseIntent(raw);
      const e = g && intent ? eventFor(g, seat, intent) : null;
      if (e) useWerewolf.getState().dispatch(e);
    },
  };
}

const watchStore = (onChange: () => void) =>
  useWerewolf.subscribe((s, prev) => {
    if (s.game !== prev.game) onChange();
  });

/** Opens (or returns) this phone's Werewolf/Mafia room. `name` is the host player's name. */
export function openWerewolfRoom(opts: { name: string; theme: Theme; kids: boolean }) {
  return openRoom({
    name: opts.name,
    game: werewolfRoomGame(opts.theme, opts.kids),
    watch: watchStore,
    // After a relaunch mid-game, the same players get their seats back.
    members: networkGame() ? (useWerewolf.getState().netMembers ?? undefined) : undefined,
  });
}

/**
 * At app start: a network game saved mid-way gets its room back, so the phones find their
 * seats again without the host first opening the game.
 */
export function resumeWerewolfRoom() {
  const game = networkGame();
  if (!game || game.phase.t === 'gameOver') return;
  const { netMembers } = useWerewolf.getState();
  const name = netMembers?.find((m) => m.isHost)?.name ?? useSettings.getState().myName;
  void openWerewolfRoom({ name, theme: game.theme, kids: game.kids }).catch(() => undefined);
}

/** This phone's Werewolf room (not another game's). */
export const useWerewolfRoom = () => useHostRoom(ROOM_GAME);
export const getWerewolfRoom = () => getRoom(ROOM_GAME);
