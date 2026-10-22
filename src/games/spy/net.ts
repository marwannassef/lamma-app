// Spy on everyone's phone (docs/games/werewolf-network.md §4.1): each phone shows its own card;
// the host's phone runs the round, the reveal and the scores. Phones get ids, never text, so each
// shows the word in its own language from its own packs.
import { getRoom, isObj, openRoom, useHostRoom, type RoomGame } from '@/core/room';
import { fitScores, useSession } from '@/core/session';

import type { ActiveRound } from './store';
import { useSpy } from './store';

export const SPY_ROOM = 'spy';

/** What one phone may know about the round. */
export interface SpyView {
  round: number;
  players: number;
  /** Who asks the first question. */
  firstAsker: number;
  /** This phone's card: the word for players; for a spy, the category only if the rule allows. */
  card: { spy: true; packId: string | null } | { spy: false; packId: string; wordId: string };
  /** Whether this phone has looked at its card, and how many have. */
  seen: boolean;
  seenCount: number;
  /** Once the host reveals: the word and who the spies were. */
  answer: { packId: string; wordId: string; spies: number[] } | null;
  /** Once scored: this round's points and everyone's totals. */
  gain: number[] | null;
  totals: number[];
}

/** Everything one seat's phone may know (and nothing it may not). Pure. */
export function spyViewFor(
  round: ActiveRound,
  seat: number,
  opts: { spySeesCategory: boolean; totals: readonly number[] },
): SpyView {
  const spy = round.spies.includes(seat);
  return {
    round: round.no,
    players: round.players,
    firstAsker: round.firstAsker,
    card: spy
      ? { spy: true, packId: opts.spySeesCategory ? round.packId : null }
      : { spy: false, packId: round.packId, wordId: round.wordId },
    seen: round.seen.includes(seat),
    seenCount: round.seen.length,
    answer: round.revealed
      ? { packId: round.packId, wordId: round.wordId, spies: round.spies }
      : null,
    gain: round.gain,
    totals: fitScores(opts.totals, round.players),
  };
}

const networkRound = () => {
  const r = useSpy.getState().round;
  return r?.network ? r : null;
};

/** The room's view of Spy, reading and updating the Spy store. A guest may only say "seen". */
export function spyRoomGame(kids: boolean): RoomGame {
  return {
    id: SPY_ROOM,
    theme: null,
    kids,
    players: () => networkRound()?.players ?? null,
    viewFor: (seat) => {
      const r = networkRound();
      if (!r) return null;
      return spyViewFor(r, seat, {
        spySeesCategory: useSpy.getState().spySeesCategory,
        totals: useSession.getState().scores,
      });
    },
    act: (seat, intent) => {
      if (isObj(intent) && intent.t === 'seen' && networkRound()) useSpy.getState().markSeen(seat);
    },
  };
}

const watch = (onChange: () => void) => {
  const a = useSpy.subscribe((s, prev) => s.round !== prev.round && onChange());
  const b = useSession.subscribe((s, prev) => s.scores !== prev.scores && onChange());
  return () => {
    a();
    b();
  };
};

export const openSpyRoom = (name: string, kids: boolean) =>
  openRoom({ name, game: spyRoomGame(kids), watch });

/**
 * The shared scoreboard follows this phone's roster; a room's seats are different people. The
 * first round played in a room starts the scoreboard afresh.
 */
let scoredRoom: object | null = null;
export function isNewRoomSession(room: object) {
  if (scoredRoom === room) return false;
  scoredRoom = room;
  return true;
}

export const useSpyRoom = () => useHostRoom(SPY_ROOM);
export const getSpyRoom = () => getRoom(SPY_ROOM);
