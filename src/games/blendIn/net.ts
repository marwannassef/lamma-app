// Blend In on everyone's phone (docs/games/werewolf-network.md §4.1): each phone shows its own
// card and buzzes on its clue turn; a caught Chameleon guesses on their own phone. The host's
// phone runs the circle, the vote and the scores. Phones get ids, never text.
import { getRoom, isObj, openRoom, useHostRoom, type RoomGame } from '@/core/room';

import type { BlendInState, Mode, Outcome } from './logic';
import { useBlendIn } from './store';

export const BLEND_IN_ROOM = 'blendIn';

/** What the table may see of the phase. The Chameleon and the word only once the round is over. */
export type PublicPhase =
  | { t: 'look'; seen: number; total: number }
  | { t: 'circle'; clueRound: number; clueRounds: number; speaker: number }
  | { t: 'discuss' }
  | { t: 'vote'; among: number[] | null }
  | { t: 'escape'; chameleon: number }
  | {
      t: 'result';
      outcome: Outcome;
      accused: number | null;
      guess: string | null;
      gain: number[];
      chameleon: number;
      secret: string;
    }
  | { t: 'over'; winners: number[] };

export interface BlendInView {
  round: number;
  mode: Mode;
  players: number;
  packId: string;
  /**
   * This phone's card. Classic: the grid, with the secret for everyone but the Chameleon.
   * Undercover: a word (the odd one out gets a different one and isn't told).
   */
  card: { kind: 'grid'; grid: string[]; secret: string | null } | { kind: 'word'; wordId: string };
  /** Whether this phone has looked at its card this round. */
  seen: boolean;
  phase: PublicPhase;
  /** The Chameleon's escape choices, on the Chameleon's phone only. */
  escapeChoices: string[] | null;
  totals: number[];
}

function publicPhase(g: BlendInState): PublicPhase {
  const ph = g.phase;
  switch (ph.t) {
    case 'peek':
    case 'look':
      return {
        t: 'look',
        seen: ph.t === 'look' ? ph.seen.length : ph.seat,
        total: g.players,
      };
    case 'circle':
      return {
        t: 'circle',
        clueRound: ph.clueRound,
        clueRounds: g.settings.clueRounds,
        speaker: g.round.order[ph.turn] ?? 0,
      };
    case 'escape':
      // A caught Chameleon is public: the table just pointed at them.
      return { t: 'escape', chameleon: g.round.chameleon };
    case 'result':
      return { ...ph, chameleon: g.round.chameleon, secret: g.round.secret };
    case 'discuss':
    case 'vote':
    case 'over':
      return ph;
  }
}

/** Everything one seat's phone may know (and nothing it may not). Pure. */
export function blendInViewFor(g: BlendInState, seat: number): BlendInView {
  const odd = seat === g.round.chameleon;
  const undercover = g.settings.mode === 'undercover';
  return {
    round: g.round.no,
    mode: g.settings.mode,
    players: g.players,
    packId: g.round.packId,
    card: undercover
      ? {
          kind: 'word',
          wordId: odd ? (g.round.undercoverWord ?? g.round.secret) : g.round.secret,
        }
      : { kind: 'grid', grid: g.round.grid, secret: odd ? null : g.round.secret },
    seen: g.phase.t === 'look' ? g.phase.seen.includes(seat) : g.phase.t !== 'peek',
    phase: publicPhase(g),
    escapeChoices: g.phase.t === 'escape' && odd ? g.phase.choices : null,
    totals: g.totals,
  };
}

const networkGame = () => {
  const g = useBlendIn.getState().game;
  return g?.network ? g : null;
};

/**
 * The room's view of Blend In. A phone may say it has seen its card, and the caught Chameleon
 * may make their escape guess; everything else happens on the host's phone.
 */
export function blendInRoomGame(kids: boolean): RoomGame {
  return {
    id: BLEND_IN_ROOM,
    theme: null,
    kids,
    players: () => networkGame()?.players ?? null,
    viewFor: (seat) => {
      const g = networkGame();
      return g ? blendInViewFor(g, seat) : null;
    },
    act: (seat, intent) => {
      const g = networkGame();
      if (!g || !isObj(intent)) return;
      const { dispatch } = useBlendIn.getState();
      if (intent.t === 'seen') dispatch({ t: 'seen', seat });
      if (intent.t === 'guess' && typeof intent.wordId === 'string' && seat === g.round.chameleon) {
        dispatch({ t: 'guess', wordId: intent.wordId });
      }
    },
  };
}

const watch = (onChange: () => void) =>
  useBlendIn.subscribe((s, prev) => {
    if (s.game !== prev.game) onChange();
  });

export const openBlendInRoom = (name: string, kids: boolean) =>
  openRoom({
    name,
    game: blendInRoomGame(kids),
    watch,
    // After a relaunch mid-game, the same players get their seats back.
    members: networkGame() ? (useBlendIn.getState().netMembers ?? undefined) : undefined,
  });

/** At app start: a network game saved mid-way gets its room back. */
export function resumeBlendInRoom(fallbackName: string, kids: boolean) {
  const game = networkGame();
  if (!game || game.phase.t === 'over') return;
  const name = useBlendIn.getState().netMembers?.find((m) => m.isHost)?.name ?? fallbackName;
  void openBlendInRoom(name, kids).catch(() => undefined);
}

/**
 * The shared scoreboard follows this phone's roster; a room's seats are different people. The
 * first game played in a room starts the scoreboard afresh.
 */
let scoredRoom: object | null = null;
export function isNewRoomSession(room: object) {
  if (scoredRoom === room) return false;
  scoredRoom = room;
  return true;
}

export const useBlendInRoom = () => useHostRoom(BLEND_IN_ROOM);
export const getBlendInRoom = () => getRoom(BLEND_IN_ROOM);
