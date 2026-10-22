// What each phone may see in network mode (docs/games/werewolf-network.md §3.2). The host keeps
// the full GameState; guests only ever receive the view for their own seat.
import { expectedAction, validAction } from './reducer';
import { isPackWolf, packOf } from './roles';
import { wolfTargetable } from './night';
import type {
  GameState,
  HouseRules,
  Player,
  PlayerId,
  RoleId,
  SeatAction,
  SeatResult,
  StoryLine,
  Theme,
  WinResult,
} from './types';

export interface PublicPlayer {
  id: PlayerId;
  alive: boolean;
  /** Known to everyone: a dead player's role when roles are revealed on death, or any at game over. */
  role: RoleId | null;
  mayor: boolean;
}

/** The phase as the whole table may see it: counts, never who has finished a secret step. */
export type PublicPhase =
  | { t: 'pass' }
  | { t: 'reveal'; seen: number; total: number }
  | { t: 'nightIntro'; night: number }
  | { t: 'glance'; endsAt: number }
  | { t: 'actions'; done: number; total: number; startedAt: number }
  | { t: 'morning'; story: StoryLine[]; deaths: PlayerId[] }
  | { t: 'deathEffects'; effect: { t: 'hunterShot' | 'mayorHandoff'; by: PlayerId } | null }
  | { t: 'mayorElection' }
  | { t: 'discussion'; endsAt: number | null; pausedLeft: number | null }
  | { t: 'vote' }
  | { t: 'mayorTieBreak'; tied: PlayerId[] }
  | { t: 'execution'; playerId: PlayerId | null }
  | { t: 'gameOver'; result: WinResult };

export interface PublicView {
  theme: Theme;
  kids: boolean;
  rules: HouseRules;
  night: number;
  day: number;
  players: PublicPlayer[];
  phase: PublicPhase;
}

/** What a seat has to do right now on its own phone. */
export type SeatTask =
  | { t: 'reveal'; cupid: boolean; seen: boolean }
  | {
      t: 'action';
      kind: SeatAction['kind'];
      /** Seats this action may pick (for the Witch: the poison targets). */
      targets: PlayerId[];
      wolfKills: 1 | 2;
      doctorLast: PlayerId | null;
      witch: { healUsed: boolean; poisonUsed: boolean };
      startedAt: number;
      done: boolean;
    }
  | { t: 'hunterShot'; targets: PlayerId[] }
  | { t: 'mayorHandoff'; targets: PlayerId[] }
  | { t: 'mayorTieBreak'; tied: PlayerId[] };

export interface SeatView {
  seat: PlayerId;
  public: PublicView;
  me: {
    role: RoleId;
    dealtRole: RoleId;
    alive: boolean;
    /** Pack wolves see their pack; the Sorcerer sees the pack too (werewolf.md §3). */
    pack: PlayerId[];
    /** The living Alpha, for the pack's crown label; only pack wolves get it. */
    alpha: PlayerId | null;
    lover: PlayerId | null;
    /** A Cupid's own link, so they can see who they paired. */
    linked: [PlayerId, PlayerId] | null;
  };
  task: SeatTask | null;
  /** Tonight's Seer or Sorcerer answer, once this seat has acted. */
  result: SeatResult | null;
}

function publicPhase(s: GameState): PublicPhase {
  const ph = s.phase;
  const total = s.players.length;
  switch (ph.t) {
    case 'setup':
    case 'discovery':
    case 'pass':
      return { t: 'pass' };
    case 'reveal':
      return { t: 'reveal', seen: ph.seen.length, total };
    case 'actions':
      return { t: 'actions', done: ph.acted.length, total, startedAt: ph.startedAt };
    case 'morning':
      return { t: 'morning', story: ph.story, deaths: ph.report.deaths.map((d) => d.playerId) };
    case 'deathEffects': {
      const head = ph.queue[0];
      if (!head) return { t: 'deathEffects', effect: null };
      return {
        t: 'deathEffects',
        effect: { t: head.t, by: head.t === 'hunterShot' ? head.hunter : head.mayor },
      };
    }
    case 'execution':
      return { t: 'execution', playerId: ph.playerId };
    case 'nightIntro':
    case 'glance':
    case 'mayorElection':
    case 'discussion':
    case 'vote':
    case 'mayorTieBreak':
    case 'gameOver':
      return ph;
  }
}

/** The host screen: what everyone at the table may know. */
export function publicView(s: GameState): PublicView {
  const over = s.phase.t === 'gameOver';
  return {
    theme: s.theme,
    kids: s.kids,
    rules: s.rules,
    night: s.night,
    day: s.day,
    players: s.players.map((p) => ({
      id: p.id,
      alive: p.alive,
      role: over || (!p.alive && s.rules.revealRoleOnDeath) ? p.role : null,
      mayor: s.mayor === p.id,
    })),
    phase: publicPhase(s),
  };
}

/** The seat that must act on its own phone in a public step (Hunter, Mayor), if any. */
export function actingSeat(s: GameState): PlayerId | null {
  const ph = s.phase;
  if (ph.t === 'mayorTieBreak') return s.mayor;
  const head = ph.t === 'deathEffects' ? ph.queue[0] : undefined;
  if (!head) return null;
  return head.t === 'hunterShot' ? head.hunter : head.mayor;
}

const ids = (s: GameState, keep: (id: PlayerId) => boolean) =>
  s.players.map((p) => p.id).filter(keep);

function taskFor(s: GameState, me: Player): SeatTask | null {
  const ph = s.phase;
  const seat = me.id;
  if (ph.t === 'reveal') {
    return { t: 'reveal', cupid: me.role === 'cupid', seen: ph.seen.includes(seat) };
  }
  if (ph.t === 'actions') {
    const kind = expectedAction(s, seat);
    const allowed = (a: (id: PlayerId) => SeatAction) =>
      ids(s, (id) => validAction(s, seat, a(id)));
    const targets =
      kind === 'dummy'
        ? ids(s, () => true)
        : kind === 'wolf'
          ? ids(s, (id) => wolfTargetable(s, id))
          : kind === 'witch'
            ? allowed((id) => ({ kind, heal: false, poison: id }))
            : allowed((id) => ({ kind, target: id }));
    return {
      t: 'action',
      kind,
      targets,
      wolfKills: s.wolfKills,
      doctorLast: kind === 'doctor' ? s.doctorLastTarget : null,
      witch: kind === 'witch' ? s.witch : { healUsed: false, poisonUsed: false },
      startedAt: ph.startedAt,
      done: ph.acted.includes(seat),
    };
  }
  if (actingSeat(s) !== seat) return null;
  if (ph.t === 'mayorTieBreak') return { t: 'mayorTieBreak', tied: ph.tied };
  // Otherwise this seat heads the death-effects queue (Hunter's shot or Mayor's badge).
  const effect =
    ph.t === 'deathEffects' && ph.queue[0]?.t === 'hunterShot' ? 'hunterShot' : 'mayorHandoff';
  return { t: effect, targets: ids(s, (id) => !!s.players[id]?.alive && id !== seat) };
}

/** Everything one seat's phone may know (and nothing it may not). */
export function viewFor(s: GameState, seat: PlayerId): SeatView {
  const me = s.players[seat];
  if (!me) throw new Error(`No seat ${seat}`);
  const wolf = isPackWolf(me.role);
  const pack =
    wolf || me.role === 'sorcerer'
      ? packOf(s)
          .filter((p) => p.id !== seat)
          .map((p) => p.id)
      : [];
  const [a, b] = s.lovers ?? [null, null];
  const lover = seat === a ? b : seat === b ? a : null;
  return {
    seat,
    public: publicView(s),
    me: {
      role: me.role,
      dealtRole: me.dealtRole,
      alive: me.alive,
      pack,
      alpha: wolf ? (s.players.find((p) => p.role === 'alpha' && p.alive)?.id ?? null) : null,
      lover,
      linked: me.role === 'cupid' ? s.lovers : null,
    },
    task: taskFor(s, me),
    result: s.nightResults?.[seat] ?? null,
  };
}
