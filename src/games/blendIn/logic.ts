// Pure Blend In rules (docs/games/blend-in.md). No React, no storage; randomness is injected.
import { chooseCategory, chooseWord, RANDOM, type CategoryChoice, type Pack } from '@/core/content';
import { pick, shuffle, type Rng } from '@/core/rng';

export { RANDOM, type CategoryChoice };

export const GRID_SIZE = 16;
export const MIN_PAIRS = 8;
export const TARGET_POINTS = 10;

export type Mode = 'classic' | 'undercover';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameLength = { t: 'rounds'; n: 3 | 5 | 8 } | { t: 'target' };

export interface Settings {
  mode: Mode;
  choice: CategoryChoice;
  length: GameLength;
  clueRounds: 1 | 2;
  /** Seconds per clue; 0 = off. */
  clueTimer: 0 | 10 | 15 | 20;
  escape: Difficulty;
  chameleonNeverFirst: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  choice: RANDOM,
  length: { t: 'rounds', n: 5 },
  clueRounds: 1,
  clueTimer: 15,
  escape: 'normal',
  chameleonNeverFirst: true,
};

/** Packs playable in a mode: 16+ words for the grid, and 8+ pairs for Undercover (§9). */
export const playable = (packs: readonly Pack[], mode: Mode) =>
  packs.filter(
    (p) =>
      p.words.length >= GRID_SIZE && (mode === 'classic' || (p.pairs?.length ?? 0) >= MIN_PAIRS),
  );

export interface Round {
  no: number;
  packId: string;
  /** 16 word ids shown to everyone (Classic). Empty in Undercover, where no grid is shown. */
  grid: string[];
  /** The word everyone else knows. */
  secret: string;
  /** Undercover mode: the odd one out's close-but-different word. */
  undercoverWord?: string;
  /** The Chameleon (or Undercover). */
  chameleon: number;
  /** Clue order, clockwise from the starter. */
  order: number[];
}

/** A grid of 16 different words containing the secret, which doesn't repeat in a topic until all were used (§5). */
export function pickGrid(pack: Pack, used: readonly string[], rng: Rng) {
  const { word, used: nextUsed } = chooseWord(pack, used, rng);
  const others = shuffle(
    rng,
    pack.words.filter((w) => w.id !== word.id).map((w) => w.id),
  ).slice(0, GRID_SIZE - 1);
  return { grid: shuffle(rng, [word.id, ...others]), secret: word.id, used: nextUsed };
}

/** Undercover: a random pair, in random order (who gets which word). */
export function pickPair(pack: Pack, rng: Rng): { secret: string; undercover: string } {
  const [a, b] = pick(rng, pack.pairs ?? []);
  return rng.next() < 0.5 ? { secret: a, undercover: b } : { secret: b, undercover: a };
}

/** Never the same player twice in a row once there are 4+ players (§12). */
export function pickChameleon(players: number, last: number | null, rng: Rng): number {
  const seats = Array.from({ length: players }, (_, i) => i);
  const pool = players >= 4 && last != null ? seats.filter((s) => s !== last) : seats;
  return pick(rng, pool);
}

/** The starter rotates each round; with "never first" on, the Chameleon passes to the next seat. */
export function starterFor(
  roundNo: number,
  players: number,
  chameleon: number,
  neverFirst: boolean,
) {
  const s = (roundNo - 1) % players;
  return neverFirst && s === chameleon ? (s + 1) % players : s;
}

export const clueOrder = (starter: number, players: number) =>
  Array.from({ length: players }, (_, i) => (starter + i) % players);

const CHOICES: Record<Difficulty, number> = { easy: 4, normal: 8, hard: GRID_SIZE };

/** Escape options: always include the secret, in random positions (§6). */
export function escapeChoices(grid: readonly string[], secret: string, d: Difficulty, rng: Rng) {
  const n = Math.min(CHOICES[d], grid.length);
  const others = shuffle(
    rng,
    grid.filter((w) => w !== secret),
  ).slice(0, n - 1);
  return shuffle(rng, [secret, ...others]);
}

export type Outcome = 'notCaught' | 'escaped' | 'caught' | 'ruleBroken';

/**
 * Points (§7, §8): not caught → Chameleon +2; caught but escaped → +1; caught and wrong →
 * everyone else +1; a broken rule → Chameleon +1. Undercover has no escape.
 */
export function scoreRound(players: number, chameleon: number, outcome: Outcome): number[] {
  return Array.from({ length: players }, (_, p) => {
    if (outcome === 'caught') return p === chameleon ? 0 : 1;
    if (p !== chameleon) return 0;
    return outcome === 'notCaught' ? 2 : 1;
  });
}

/** The game ends after N rounds, or when someone reaches 10 points. */
export function isOver(totals: readonly number[], roundsPlayed: number, length: GameLength) {
  return length.t === 'rounds' ? roundsPlayed >= length.n : Math.max(0, ...totals) >= TARGET_POINTS;
}

/** Everyone tied for the most points shares the win. */
export const winnersOf = (totals: readonly number[]) => {
  const top = Math.max(...totals);
  return totals.flatMap((t, i) => (t === top ? [i] : []));
};

export type Phase =
  | { t: 'peek'; seat: number }
  /** Everyone's phone (network mode): every seat looks at its own card at once. */
  | { t: 'look'; seen: number[] }
  | { t: 'circle'; clueRound: number; turn: number }
  | { t: 'discuss' }
  /** `among`: null = everyone may be accused; a list = revote among the tied players. */
  | { t: 'vote'; among: number[] | null }
  | { t: 'escape'; choices: string[] }
  | { t: 'result'; outcome: Outcome; accused: number | null; guess: string | null; gain: number[] }
  | { t: 'over'; winners: number[] };

export interface Memory {
  usedByPack: Record<string, string[]>;
  lastPackId: string | null;
  lastChameleon: number | null;
}

export interface BlendInState extends Memory {
  /** Played on everyone's phone; missing in games saved before network mode. */
  network?: boolean;
  settings: Settings;
  players: number;
  round: Round;
  phase: Phase;
  /** Points this game (the shared scoreboard gets the same gains). */
  totals: number[];
  roundsPlayed: number;
}

function dealRound(
  no: number,
  players: number,
  settings: Settings,
  packs: readonly Pack[],
  memory: Memory,
  rng: Rng,
): { round: Round; memory: Memory } {
  const pool = playable(packs, settings.mode);
  const pack = chooseCategory(pool, settings.choice, memory.lastPackId, rng);
  const chameleon = pickChameleon(players, memory.lastChameleon, rng);
  const order = clueOrder(
    starterFor(no, players, chameleon, settings.chameleonNeverFirst),
    players,
  );
  if (settings.mode === 'undercover') {
    const { secret, undercover } = pickPair(pack, rng);
    return {
      round: {
        no,
        packId: pack.id,
        grid: [],
        secret,
        undercoverWord: undercover,
        chameleon,
        order,
      },
      memory: { ...memory, lastPackId: pack.id, lastChameleon: chameleon },
    };
  }
  const g = pickGrid(pack, memory.usedByPack[pack.id] ?? [], rng);
  return {
    round: { no, packId: pack.id, grid: g.grid, secret: g.secret, chameleon, order },
    memory: {
      usedByPack: { ...memory.usedByPack, [pack.id]: g.used },
      lastPackId: pack.id,
      lastChameleon: chameleon,
    },
  };
}

/** How a round opens: the pass-the-phone peek, or everyone looking at their own phone. */
const firstPhase = (network: boolean | undefined): Phase =>
  network ? { t: 'look', seen: [] } : { t: 'peek', seat: 0 };

/** A new game, starting with the first secret peek. Throws if no pack is playable. */
export function newGame(
  players: number,
  settings: Settings,
  packs: readonly Pack[],
  memory: Memory,
  rng: Rng,
  network = false,
): BlendInState {
  const { round, memory: m } = dealRound(1, players, settings, packs, memory, rng);
  return {
    ...m,
    ...(network && { network }),
    settings,
    players,
    round,
    phase: firstPhase(network),
    totals: Array<number>(players).fill(0),
    roundsPlayed: 0,
  };
}

export type BlendInEvent =
  | { t: 'peeked' }
  /** Network mode: a seat has looked at its own card. */
  | { t: 'seen'; seat: number }
  | { t: 'nextClue' }
  | { t: 'ruleBroken' }
  | { t: 'startVote' }
  | { t: 'accuse'; id: number }
  | { t: 'tie'; tied: number[] }
  | { t: 'guess'; wordId: string }
  | { t: 'nextRound'; packs: readonly Pack[] };

function finish(s: BlendInState, outcome: Outcome, accused: number | null, guess: string | null) {
  const gain = scoreRound(s.players, s.round.chameleon, outcome);
  return {
    ...s,
    totals: s.totals.map((t, i) => t + (gain[i] ?? 0)),
    roundsPlayed: s.roundsPlayed + 1,
    phase: { t: 'result' as const, outcome, accused, guess, gain },
  };
}

/** The only way a Blend In game changes. Events that don't fit the phase are ignored. */
export function blendInReducer(s: BlendInState, e: BlendInEvent, rng: Rng): BlendInState {
  const ph = s.phase;
  switch (ph.t) {
    case 'peek':
      if (e.t !== 'peeked') return s;
      return {
        ...s,
        phase:
          ph.seat + 1 < s.players
            ? { t: 'peek', seat: ph.seat + 1 }
            : { t: 'circle', clueRound: 1, turn: 0 },
      };
    case 'look': {
      if (e.t !== 'seen' || e.seat < 0 || e.seat >= s.players || ph.seen.includes(e.seat)) {
        return s;
      }
      const seen = [...ph.seen, e.seat];
      return {
        ...s,
        phase:
          seen.length < s.players ? { t: 'look', seen } : { t: 'circle', clueRound: 1, turn: 0 },
      };
    }
    case 'circle':
      if (e.t === 'ruleBroken') return finish(s, 'ruleBroken', null, null);
      if (e.t !== 'nextClue') return s;
      if (ph.turn + 1 < s.players) return { ...s, phase: { ...ph, turn: ph.turn + 1 } };
      if (ph.clueRound < s.settings.clueRounds) {
        return { ...s, phase: { t: 'circle', clueRound: ph.clueRound + 1, turn: 0 } };
      }
      return { ...s, phase: { t: 'discuss' } };
    case 'discuss':
      if (e.t === 'ruleBroken') return finish(s, 'ruleBroken', null, null);
      return e.t === 'startVote' ? { ...s, phase: { t: 'vote', among: null } } : s;
    case 'vote': {
      if (e.t === 'tie') {
        const tied = [...new Set(e.tied)].filter(
          (id) => id >= 0 && id < s.players && (!ph.among || ph.among.includes(id)),
        );
        if (tied.length < 2) return s;
        // First tie: revote among the tied. Second tie: the Chameleon slips away.
        return ph.among
          ? finish(s, 'notCaught', null, null)
          : { ...s, phase: { t: 'vote', among: tied } };
      }
      if (e.t !== 'accuse') return s;
      if (e.id < 0 || e.id >= s.players || (ph.among && !ph.among.includes(e.id))) return s;
      if (e.id !== s.round.chameleon) return finish(s, 'notCaught', e.id, null);
      if (s.settings.mode === 'undercover') return finish(s, 'caught', e.id, null);
      return {
        ...s,
        phase: {
          t: 'escape',
          choices: escapeChoices(s.round.grid, s.round.secret, s.settings.escape, rng),
        },
      };
    }
    case 'escape':
      if (e.t !== 'guess' || !ph.choices.includes(e.wordId)) return s;
      return finish(
        s,
        e.wordId === s.round.secret ? 'escaped' : 'caught',
        s.round.chameleon,
        e.wordId,
      );
    case 'result': {
      if (e.t !== 'nextRound') return s;
      if (isOver(s.totals, s.roundsPlayed, s.settings.length)) {
        return { ...s, phase: { t: 'over', winners: winnersOf(s.totals) } };
      }
      const { round, memory } = dealRound(s.round.no + 1, s.players, s.settings, e.packs, s, rng);
      return { ...s, ...memory, round, phase: firstPhase(s.network) };
    }
    default:
      return s;
  }
}

/**
 * A relaunch never resumes on a secret screen (§12). Peeks always reopen at their handoff (the
 * card only shows while held); an interrupted escape guess goes back to the vote.
 */
export function resumeState(s: BlendInState): BlendInState {
  if (s.phase.t === 'escape') return { ...s, phase: { t: 'vote', among: null } };
  return s;
}
