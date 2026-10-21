import type { Rng } from '@/core/rng';

import { mayorTieBreak, resolveVote, type VoteOutcome } from './day';
import { applyDeaths, effectsFor, hunterShot, mayorHandoff } from './deaths';
import { resolveNight, wolfTargetable } from './night';
import { ROLES, seerSees } from './roles';
import { newStory, pickSetting, tellDawn } from './story';
import {
  DEFAULT_RULES,
  emptyNightActions,
  type Effect,
  type GameState,
  type HouseRules,
  type PlayerId,
  type RoleId,
  type SeatAction,
  type Theme,
  type VoteChoice,
} from './types';
import { checkWin } from './win';

export type GameEvent =
  | { t: 'revealRole' }
  | { t: 'hideRole' }
  | { t: 'cupidLink'; lovers: [PlayerId, PlayerId] }
  | { t: 'nightIntroDone' }
  | { t: 'glanceDone' }
  | { t: 'openTurn' }
  | { t: 'confirmTurn'; action: SeatAction }
  | { t: 'morningDone' }
  | { t: 'hunterShoot'; target: PlayerId }
  | { t: 'passBadge'; to: PlayerId | null }
  | { t: 'electMayor'; id: PlayerId }
  | { t: 'pauseDiscussion' }
  | { t: 'resumeDiscussion' }
  | { t: 'addTime' }
  | { t: 'endDiscussion' }
  | { t: 'vote'; choice: VoteChoice }
  | { t: 'mayorDecide'; pick: PlayerId | null }
  | { t: 'executionDone' };

/** Time and randomness come from outside, so the reducer stays pure and testable. */
export interface Ctx {
  now: number;
  rng: Rng;
}

const SEC = 1000;
export const EXTRA_DISCUSSION_MS = 30 * SEC;

/** A new game with roles dealt per seat; it starts at the first discovery turn. */
export function newGame(
  roles: readonly RoleId[],
  rules: Partial<HouseRules> = {},
  opts: { theme?: Theme; kids?: boolean } = {},
): GameState {
  const players = roles.map((role, id) => ({ id, role, dealtRole: role, alive: true }));
  return {
    players,
    theme: opts.theme ?? 'werewolf',
    kids: opts.kids ?? false,
    story: newStory(),
    rules: { ...DEFAULT_RULES, ...rules },
    phase: { t: 'discovery', seat: 0, revealed: false },
    night: 0,
    day: 0,
    lovers: null,
    mayor: players.find((p) => p.role === 'mayor')?.id ?? null,
    witch: { healUsed: false, poisonUsed: false },
    doctorLastTarget: null,
    wolfKills: 1,
    startSeat: 0,
    actions: emptyNightActions(),
    lastReport: null,
  };
}

/** The screen a seat gets during the night pass (dead players dream too). */
export function expectedAction(state: GameState, seat: PlayerId): SeatAction['kind'] {
  const p = state.players[seat];
  if (!p || !p.alive) return 'dummy';
  switch (ROLES[p.role].nightAction) {
    case 'wolfKill':
      return 'wolf';
    case 'inspectWolf':
      return 'seer';
    case 'inspectSeer':
      return 'sorcerer';
    case 'protect':
      return 'doctor';
    case 'witch':
      return 'witch';
    case 'soloKill':
      return 'serialKiller';
    default:
      return 'dummy';
  }
}

const aliveId = (s: GameState, id: PlayerId | undefined) => id != null && !!s.players[id]?.alive;

/** Whether a seat's night action is allowed by the rules (§2.3 action table, §6). */
export function validAction(state: GameState, seat: PlayerId, a: SeatAction): boolean {
  if (a.kind !== expectedAction(state, seat)) return false;
  switch (a.kind) {
    case 'dummy':
      return true;
    case 'wolf':
      return (
        a.targets.length === state.wolfKills &&
        new Set(a.targets).size === a.targets.length &&
        a.targets.every((t) => wolfTargetable(state, t))
      );
    case 'seer':
    case 'sorcerer':
      return aliveId(state, a.target) && a.target !== seat;
    case 'serialKiller':
      return aliveId(state, a.target) && a.target !== seat;
    case 'doctor': {
      if (!aliveId(state, a.target) || a.target === state.doctorLastTarget) return false;
      if (a.target !== seat) return true;
      const rule = state.rules.doctorSelfProtect;
      return rule === 'always' || (rule === 'night1' && state.night === 1);
    }
    case 'witch':
      return (
        (!a.heal || !state.witch.healUsed) &&
        (a.poison == null ||
          (!state.witch.poisonUsed && aliveId(state, a.poison) && a.poison !== seat))
      );
  }
}

function record(state: GameState, seat: PlayerId, a: SeatAction): GameState {
  const actions = { ...state.actions, wolfVotes: { ...state.actions.wolfVotes } };
  if (a.kind === 'wolf') actions.wolfVotes[seat] = a.targets;
  if (a.kind === 'doctor') actions.doctorTarget = a.target;
  if (a.kind === 'serialKiller') actions.serialKillerTarget = a.target;
  if (a.kind === 'seer') {
    actions.seerCheck = { target: a.target, sawWolf: seerSees(state, a.target) === 'werewolf' };
  }
  if (a.kind === 'witch') {
    actions.witchHeal = a.heal;
    if (a.poison != null) actions.witchPoison = a.poison;
  }
  return { ...state, actions };
}

function startNight(state: GameState, rng: Rng): GameState {
  const night = state.night + 1;
  return {
    ...state,
    night,
    story: { ...state.story, setting: pickSetting(state.theme, state.story.setting, rng) },
    startSeat: (night - 1) % state.players.length,
    actions: emptyNightActions(),
    phase: { t: 'nightIntro', night },
  };
}

function startDiscussion(state: GameState, ctx: Ctx): GameState {
  const s = state.rules.discussionSeconds;
  return {
    ...state,
    phase: { t: 'discussion', endsAt: s == null ? null : ctx.now + s * SEC, pausedLeft: null },
  };
}

/** After a batch of deaths and its effects: win check, then on to the day or the next night. */
function afterDeaths(
  state: GameState,
  then: 'day' | 'night',
  ctx: Ctx,
  executed: PlayerId | null = null,
): GameState {
  const result = checkWin(state, executed);
  if (result) return { ...state, phase: { t: 'gameOver', result } };
  if (then === 'night') return startNight(state, ctx.rng);
  if (state.day === 1 && state.rules.mayor === 'elected' && state.mayor == null) {
    return { ...state, phase: { t: 'mayorElection' } };
  }
  return startDiscussion(state, ctx);
}

function runEffects(state: GameState, queue: Effect[], then: 'day' | 'night', ctx: Ctx) {
  return queue.length > 0
    ? { ...state, phase: { t: 'deathEffects' as const, queue, then } }
    : afterDeaths(state, then, ctx);
}

function execute(state: GameState, outcome: VoteOutcome): GameState {
  if (outcome.t === 'mayorTieBreak') {
    return { ...state, phase: { t: 'mayorTieBreak', tied: outcome.tied } };
  }
  if (outcome.t === 'none') {
    return {
      ...state,
      story: { ...state.story, lastVote: null },
      phase: { t: 'execution', playerId: null, effects: [] },
    };
  }
  const r = applyDeaths(state, [{ playerId: outcome.playerId, cause: 'execution' }]);
  return {
    ...r.state,
    story: { ...r.state.story, lastVote: outcome.playerId },
    phase: { t: 'execution', playerId: outcome.playerId, effects: effectsFor(r.pending) },
  };
}

/**
 * The only way game state changes (§12). Invalid events for the current phase, or a confirm
 * before the minimum turn time, return the state unchanged.
 */
export function gameReducer(state: GameState, e: GameEvent, ctx: Ctx): GameState {
  const ph = state.phase;
  const n = state.players.length;

  switch (ph.t) {
    case 'discovery': {
      const p = state.players[ph.seat];
      if (e.t === 'revealRole' && !ph.revealed)
        return { ...state, phase: { ...ph, revealed: true } };
      if (e.t === 'cupidLink' && ph.revealed && p?.role === 'cupid') {
        const [a, b] = e.lovers;
        if (a === b || !state.players[a] || !state.players[b]) return state;
        return { ...state, lovers: [a, b] };
      }
      if (e.t === 'hideRole' && ph.revealed) {
        // Cupid can't finish their turn without linking the lovers.
        if (p?.role === 'cupid' && !state.lovers) return state;
        return ph.seat + 1 < n
          ? { ...state, phase: { t: 'discovery', seat: ph.seat + 1, revealed: false } }
          : startNight(state, ctx.rng);
      }
      return state;
    }

    case 'nightIntro':
      if (e.t !== 'nightIntroDone') return state;
      return {
        ...state,
        phase: { t: 'glance', endsAt: ctx.now + state.rules.glanceSeconds * SEC },
      };

    case 'glance':
      if (e.t !== 'glanceDone') return state;
      return {
        ...state,
        phase: { t: 'pass', seat: state.startSeat, step: 'handoff', startedAt: 0, turn: 0 },
      };

    case 'pass': {
      if (e.t === 'openTurn' && ph.step === 'handoff') {
        return { ...state, phase: { ...ph, step: 'action', startedAt: ctx.now } };
      }
      if (e.t !== 'confirmTurn' || ph.step !== 'action') return state;
      if (ctx.now - ph.startedAt < state.rules.minTurnSeconds * SEC) return state;
      if (!validAction(state, ph.seat, e.action)) return state;
      const recorded = record(state, ph.seat, e.action);
      const turn = ph.turn + 1;
      if (turn < n) {
        return {
          ...recorded,
          phase: {
            t: 'pass',
            seat: (state.startSeat + turn) % n,
            step: 'handoff',
            startedAt: 0,
            turn,
          },
        };
      }
      const { state: resolved, report } = resolveNight(recorded, recorded.actions, ctx.rng);
      const told = tellDawn(resolved, report, recorded.actions.seerCheck, ctx.rng);
      return {
        ...resolved,
        story: told.story,
        day: resolved.night,
        phase: { t: 'morning', report, story: told.lines },
      };
    }

    case 'morning':
      if (e.t !== 'morningDone') return state;
      return runEffects(state, effectsFor(ph.report.pending), 'day', ctx);

    case 'deathEffects': {
      const [head, ...rest] = ph.queue;
      if (!head) return afterDeaths(state, ph.then, ctx);
      if (e.t === 'hunterShoot' && head.t === 'hunterShot') {
        const target = state.players[e.target];
        if (!target?.alive) return state;
        const r = hunterShot(state, e.target);
        const result = checkWin(r.state);
        if (result) return { ...r.state, phase: { t: 'gameOver', result } };
        return runEffects(r.state, [...rest, ...effectsFor(r.pending)], ph.then, ctx);
      }
      if (e.t === 'passBadge' && head.t === 'mayorHandoff') {
        if (e.to != null && !state.players[e.to]?.alive) return state;
        return runEffects(mayorHandoff(state, e.to), rest, ph.then, ctx);
      }
      return state;
    }

    case 'mayorElection':
      if (e.t !== 'electMayor' || !state.players[e.id]?.alive) return state;
      return startDiscussion({ ...state, mayor: e.id }, ctx);

    case 'discussion':
      if (e.t === 'pauseDiscussion' && ph.endsAt != null) {
        return { ...state, phase: { ...ph, endsAt: null, pausedLeft: ph.endsAt - ctx.now } };
      }
      if (e.t === 'resumeDiscussion' && ph.pausedLeft != null) {
        return { ...state, phase: { ...ph, endsAt: ctx.now + ph.pausedLeft, pausedLeft: null } };
      }
      if (e.t === 'addTime') {
        if (ph.endsAt != null)
          return { ...state, phase: { ...ph, endsAt: ph.endsAt + EXTRA_DISCUSSION_MS } };
        if (ph.pausedLeft != null) {
          return { ...state, phase: { ...ph, pausedLeft: ph.pausedLeft + EXTRA_DISCUSSION_MS } };
        }
        return state;
      }
      if (e.t === 'endDiscussion') return { ...state, phase: { t: 'vote' } };
      return state;

    case 'vote':
      if (e.t !== 'vote') return state;
      return execute(state, resolveVote(state, e.choice));

    case 'mayorTieBreak':
      if (e.t !== 'mayorDecide') return state;
      if (e.pick != null && !ph.tied.includes(e.pick)) return state;
      return execute(state, mayorTieBreak(ph.tied, e.pick));

    case 'execution': {
      if (e.t !== 'executionDone') return state;
      // The Tanner wins the moment the vote executes them, before any death effects.
      const result = checkWin(state, ph.playerId);
      if (result) return { ...state, phase: { t: 'gameOver', result } };
      return runEffects(state, ph.effects, 'night', ctx);
    }

    default:
      return state;
  }
}

/**
 * Where a relaunched game resumes (§4): never on a secret screen. A revealed discovery card is
 * hidden again and an open action turn goes back to its handoff step.
 */
export function resumePhase(state: GameState): GameState {
  const ph = state.phase;
  if (ph.t === 'discovery' && ph.revealed) return { ...state, phase: { ...ph, revealed: false } };
  if (ph.t === 'pass' && ph.step === 'action') {
    return { ...state, phase: { ...ph, step: 'handoff', startedAt: 0 } };
  }
  if (ph.t === 'glance') return { ...state, phase: { t: 'nightIntro', night: state.night } };
  return state;
}
