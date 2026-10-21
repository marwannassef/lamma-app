import { seededRng, type Rng } from '@/core/rng';

import {
  EXTRA_DISCUSSION_MS,
  expectedAction,
  gameReducer,
  newGame,
  resumePhase,
  validAction,
  type GameEvent,
} from '../reducer';
import { game } from '../testing';
import type { GameState, PlayerId, RoleId, SeatAction } from '../types';

/** Drives the reducer with a fake clock. */
function driver(state: GameState, rng: Rng = seededRng(1)) {
  let s = state;
  let now = 1_000_000;
  return {
    get state() {
      return s;
    },
    tick(ms: number) {
      now += ms;
    },
    send(e: GameEvent) {
      s = gameReducer(s, e, { now, rng });
      return s;
    },
  };
}

const MIN_TURN = 4500;

/** Plays the discovery pass (Cupid links `lovers` if present). */
function discover(d: ReturnType<typeof driver>, lovers?: [PlayerId, PlayerId]) {
  while (d.state.phase.t === 'discovery') {
    const seat = d.state.phase.seat;
    d.send({ t: 'revealRole' });
    if (d.state.players[seat]?.role === 'cupid' && lovers) d.send({ t: 'cupidLink', lovers });
    d.send({ t: 'hideRole' });
  }
}

/** A valid default for a seat's screen: first eligible target, no potions. */
function defaultAction(s: GameState, seat: PlayerId): SeatAction {
  const others = s.players.filter((p) => p.alive && p.id !== seat).map((p) => p.id);
  const kind = expectedAction(s, seat);
  switch (kind) {
    case 'wolf':
      return {
        kind,
        targets: others
          .filter(
            (id) =>
              !['werewolf', 'alpha', 'wolfCub', 'loneWolf'].includes(s.players[id]?.role ?? ''),
          )
          .slice(0, s.wolfKills),
      };
    case 'seer':
    case 'sorcerer':
    case 'serialKiller':
      return { kind, target: others[0] as PlayerId };
    case 'doctor':
      return { kind, target: others.find((id) => id !== s.doctorLastTarget) as PlayerId };
    case 'witch':
      return { kind, heal: false };
    default:
      return { kind: 'dummy' };
  }
}

/** Plays one night: each seat's action comes from `choose`, else a valid default. */
function night(d: ReturnType<typeof driver>, choose: (seat: PlayerId) => SeatAction | undefined) {
  d.send({ t: 'nightIntroDone' });
  d.send({ t: 'glanceDone' });
  const order: PlayerId[] = [];
  while (d.state.phase.t === 'pass') {
    const seat = d.state.phase.seat;
    order.push(seat);
    d.send({ t: 'openTurn' });
    d.tick(MIN_TURN);
    const before = d.state;
    d.send({ t: 'confirmTurn', action: choose(seat) ?? defaultAction(d.state, seat) });
    if (d.state === before) throw new Error(`seat ${seat}: action rejected`);
  }
  return order;
}

function dayToVote(d: ReturnType<typeof driver>) {
  if (d.state.phase.t === 'morning') d.send({ t: 'morningDone' });
  if (d.state.phase.t === 'discussion') d.send({ t: 'endDiscussion' });
}

describe('discovery pass', () => {
  it('reveals and hides each seat in order, then starts night 1', () => {
    const d = driver(newGame(['werewolf', 'seer', 'villager', 'villager']));
    expect(d.state.phase).toEqual({ t: 'discovery', seat: 0, revealed: false });
    d.send({ t: 'hideRole' }); // can't hide before revealing
    expect(d.state.phase).toEqual({ t: 'discovery', seat: 0, revealed: false });
    discover(d);
    expect(d.state.phase).toEqual({ t: 'nightIntro', night: 1 });
    expect(d.state.night).toBe(1);
  });

  it('Cupid must link two different players during their turn', () => {
    const d = driver(newGame(['cupid', 'werewolf', 'villager', 'villager']));
    d.send({ t: 'revealRole' });
    d.send({ t: 'hideRole' });
    expect(d.state.phase).toMatchObject({ t: 'discovery', seat: 0 }); // blocked until linked
    d.send({ t: 'cupidLink', lovers: [2, 2] });
    expect(d.state.lovers).toBeNull();
    d.send({ t: 'cupidLink', lovers: [0, 3] }); // Cupid may pick themselves
    d.send({ t: 'hideRole' });
    expect(d.state.lovers).toEqual([0, 3]);
    expect(d.state.phase).toMatchObject({ t: 'discovery', seat: 1 });
    d.send({ t: 'revealRole' });
    d.send({ t: 'cupidLink', lovers: [1, 2] }); // only Cupid can link
    expect(d.state.lovers).toEqual([0, 3]);
  });
});

describe('night action pass and anti-cheat (§4)', () => {
  const ready = () => {
    const d = driver(game(['werewolf', 'seer', 'doctor', 'villager', 'villager']));
    d.send({ t: 'nightIntroDone' });
    d.send({ t: 'glanceDone' });
    return d;
  };

  it('Confirm is impossible before the minimum turn time', () => {
    const d = ready();
    d.send({ t: 'openTurn' });
    d.tick(MIN_TURN - 1);
    const before = d.state;
    d.send({ t: 'confirmTurn', action: { kind: 'wolf', targets: [3] } });
    expect(d.state).toBe(before);
    d.tick(1);
    d.send({ t: 'confirmTurn', action: { kind: 'wolf', targets: [3] } });
    expect(d.state.phase).toMatchObject({ t: 'pass', seat: 1, step: 'handoff' });
  });

  it('respects a custom minimum turn time', () => {
    const d = driver(
      game(['werewolf', 'seer', 'villager', 'villager'], { rules: { minTurnSeconds: 8 } }),
    );
    d.send({ t: 'nightIntroDone' });
    d.send({ t: 'glanceDone' });
    d.send({ t: 'openTurn' });
    d.tick(7999);
    d.send({ t: 'confirmTurn', action: { kind: 'wolf', targets: [2] } });
    expect(d.state.phase).toMatchObject({ seat: 0, step: 'action' });
  });

  it('the glance lasts the configured time', () => {
    const d = driver(
      game(['werewolf', 'seer', 'villager', 'villager'], { rules: { glanceSeconds: 12 } }),
    );
    d.send({ t: 'nightIntroDone' });
    expect(d.state.phase).toEqual({ t: 'glance', endsAt: 1_000_000 + 12_000 });
  });

  it('dead seats still get a (dream) turn', () => {
    const d = driver(game(['werewolf', 'seer', 'villager', 'villager', 'villager'], { dead: [3] }));
    expect(expectedAction(d.state, 3)).toBe('dummy');
    expect(night(d, () => undefined)).toEqual([0, 1, 2, 3, 4]);
  });

  it('the start seat rotates one seat each night', () => {
    const d = driver(
      newGame(['villager', 'werewolf', 'villager', 'seer', 'villager', 'villager', 'villager']),
    );
    discover(d);
    expect(night(d, (s) => (s === 1 ? { kind: 'wolf', targets: [0] } : undefined))).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    dayToVote(d);
    d.send({ t: 'vote', choice: { t: 'none' } });
    d.send({ t: 'executionDone' });
    expect(d.state.startSeat).toBe(1);
    expect(night(d, (s) => (s === 1 ? { kind: 'wolf', targets: [2] } : undefined))).toEqual([
      1, 2, 3, 4, 5, 6, 0,
    ]);
  });

  it('rejects actions that break the rules and keeps the turn open', () => {
    const s = game(['werewolf', 'seer', 'doctor', 'witch', 'villager', 'serialKiller'], {
      doctorLastTarget: 4,
    });
    expect(validAction(s, 0, { kind: 'wolf', targets: [0] })).toBe(false); // pack member
    expect(validAction(s, 0, { kind: 'wolf', targets: [4, 5] })).toBe(false); // one kill tonight
    expect(validAction(s, 0, { kind: 'seer', target: 4 })).toBe(false); // wrong screen
    expect(validAction(s, 1, { kind: 'seer', target: 1 })).toBe(false); // not self
    expect(validAction(s, 2, { kind: 'doctor', target: 4 })).toBe(false); // same as last night
    expect(validAction(s, 2, { kind: 'doctor', target: 2 })).toBe(true); // self, night 1
    expect(validAction({ ...s, night: 2 }, 2, { kind: 'doctor', target: 2 })).toBe(false);
    const always = { ...s, night: 3, rules: { ...s.rules, doctorSelfProtect: 'always' as const } };
    expect(validAction(always, 2, { kind: 'doctor', target: 2 })).toBe(true);
    const never = { ...s, rules: { ...s.rules, doctorSelfProtect: 'never' as const } };
    expect(validAction(never, 2, { kind: 'doctor', target: 2 })).toBe(false);
    expect(validAction(s, 3, { kind: 'witch', heal: true, poison: 3 })).toBe(false); // no self-poison
    const spent = { ...s, witch: { healUsed: true, poisonUsed: true } };
    expect(validAction(spent, 3, { kind: 'witch', heal: true })).toBe(false);
    expect(validAction(spent, 3, { kind: 'witch', heal: false, poison: 4 })).toBe(false);
    expect(validAction(spent, 3, { kind: 'witch', heal: false })).toBe(true);
    expect(validAction(s, 5, { kind: 'serialKiller', target: 5 })).toBe(false);
    expect(validAction(s, 5, { kind: 'serialKiller', target: 0 })).toBe(true);
    expect(validAction(s, 4, { kind: 'dummy' })).toBe(true);
  });

  it('resuming never lands on a secret step', () => {
    const d = ready();
    d.send({ t: 'openTurn' });
    expect(resumePhase(d.state).phase).toMatchObject({ t: 'pass', seat: 0, step: 'handoff' });
    const disc = driver(newGame(['werewolf', 'seer', 'villager', 'villager']));
    disc.send({ t: 'revealRole' });
    expect(resumePhase(disc.state).phase).toEqual({ t: 'discovery', seat: 0, revealed: false });
    const glance = driver(game(['werewolf', 'seer', 'villager', 'villager']));
    glance.send({ t: 'nightIntroDone' });
    expect(resumePhase(glance.state).phase).toEqual({ t: 'nightIntro', night: 1 });
    expect(resumePhase(newGame(['werewolf', 'villager', 'villager', 'seer']))).toEqual(
      newGame(['werewolf', 'villager', 'villager', 'seer']),
    );
  });

  it('ignores events that do not belong to the phase', () => {
    const d = ready();
    const before = d.state;
    d.send({ t: 'morningDone' });
    d.send({ t: 'confirmTurn', action: { kind: 'dummy' } }); // handoff step, not action
    expect(d.state).toBe(before);
  });
});

describe('day flow', () => {
  it('discussion timer can pause, resume, add time and end', () => {
    const d = driver(game(['werewolf', 'seer', 'villager', 'villager', 'villager']));
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [4] } : undefined));
    d.send({ t: 'morningDone' });
    expect(d.state.phase).toMatchObject({ t: 'discussion', pausedLeft: null });
    const ph = d.state.phase as { endsAt: number };
    const ends = ph.endsAt;
    d.send({ t: 'addTime' });
    expect(d.state.phase).toMatchObject({ endsAt: ends + EXTRA_DISCUSSION_MS });
    d.tick(10_000);
    d.send({ t: 'pauseDiscussion' });
    // 120 s + 30 s added, 10 s elapsed.
    expect(d.state.phase).toMatchObject({ endsAt: null, pausedLeft: 140_000 });
    d.send({ t: 'addTime' });
    d.tick(60_000);
    d.send({ t: 'resumeDiscussion' });
    expect((d.state.phase as { endsAt: number }).endsAt).toBeGreaterThan(ends);
    d.send({ t: 'endDiscussion' });
    expect(d.state.phase).toEqual({ t: 'vote' });
  });

  it('untimed discussion has no end time', () => {
    const d = driver(
      game(['werewolf', 'seer', 'villager', 'villager', 'villager'], {
        rules: { discussionSeconds: null },
      }),
    );
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [4] } : undefined));
    d.send({ t: 'morningDone' });
    expect(d.state.phase).toEqual({ t: 'discussion', endsAt: null, pausedLeft: null });
    d.send({ t: 'addTime' });
    expect(d.state.phase).toEqual({ t: 'discussion', endsAt: null, pausedLeft: null });
  });

  it('elects a Mayor on day 1 when the house rule says so', () => {
    const d = driver(
      game(['werewolf', 'seer', 'villager', 'villager', 'villager'], {
        rules: { mayor: 'elected' },
      }),
    );
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [4] } : undefined));
    d.send({ t: 'morningDone' });
    expect(d.state.phase).toEqual({ t: 'mayorElection' });
    d.send({ t: 'electMayor', id: 4 }); // dead: ignored
    d.send({ t: 'electMayor', id: 2 });
    expect(d.state.mayor).toBe(2);
    expect(d.state.phase.t).toBe('discussion');
  });

  it('a tie with a living Mayor goes to the Mayor, who can spare everyone', () => {
    const d = driver({
      ...game(['werewolf', 'mayor', 'villager', 'villager', 'villager', 'seer']),
      mayor: 1,
    });
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [4] } : undefined));
    dayToVote(d);
    d.send({ t: 'vote', choice: { t: 'tie', tied: [0, 2] } });
    expect(d.state.phase).toEqual({ t: 'mayorTieBreak', tied: [0, 2] });
    d.send({ t: 'mayorDecide', pick: 3 }); // not tied: ignored
    d.send({ t: 'mayorDecide', pick: null });
    expect(d.state.phase).toEqual({ t: 'execution', playerId: null, effects: [] });
    d.send({ t: 'executionDone' });
    expect(d.state.phase).toEqual({ t: 'nightIntro', night: 2 });
  });

  it('Mayor tie-break executes the chosen player', () => {
    const d = driver({
      ...game(['werewolf', 'mayor', 'villager', 'villager', 'villager', 'seer']),
      mayor: 1,
    });
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [4] } : undefined));
    dayToVote(d);
    d.send({ t: 'vote', choice: { t: 'tie', tied: [0, 2] } });
    d.send({ t: 'mayorDecide', pick: 0 });
    d.send({ t: 'executionDone' });
    expect(d.state.phase).toMatchObject({ t: 'gameOver', result: { outcome: 'village' } });
  });

  it('the Tanner executed wins immediately', () => {
    const d = driver(game(['werewolf', 'tanner', 'villager', 'villager', 'seer', 'villager']));
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [2] } : undefined));
    dayToVote(d);
    d.send({ t: 'vote', choice: { t: 'player', id: 1 } });
    d.send({ t: 'executionDone' });
    expect(d.state.phase).toEqual({
      t: 'gameOver',
      result: { outcome: 'tanner', winners: [1], soloWinners: [1] },
    });
  });

  it('runs the Hunter shot and the Mayor handoff after the morning', () => {
    const d = driver({
      ...game(['werewolf', 'hunter', 'mayor', 'witch', 'villager', 'villager', 'seer']),
      mayor: 2,
    });
    night(d, (s) =>
      s === 0
        ? { kind: 'wolf', targets: [1] }
        : s === 3
          ? { kind: 'witch', heal: false, poison: 2 }
          : undefined,
    );
    d.send({ t: 'morningDone' });
    expect(d.state.phase).toMatchObject({
      t: 'deathEffects',
      queue: [{ t: 'hunterShot' }, { t: 'mayorHandoff' }],
    });
    d.send({ t: 'passBadge', to: 4 }); // not the Hunter's turn yet: ignored
    d.send({ t: 'hunterShoot', target: 1 }); // dead: ignored
    d.send({ t: 'hunterShoot', target: 4 });
    d.send({ t: 'passBadge', to: 5 });
    expect(d.state.mayor).toBe(5);
    expect(d.state.phase.t).toBe('discussion');
  });

  it("the Hunter's shot can end the game", () => {
    const d = driver(game(['werewolf', 'hunter', 'villager', 'villager', 'seer', 'villager']));
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [2] } : undefined));
    dayToVote(d);
    d.send({ t: 'vote', choice: { t: 'player', id: 1 } });
    d.send({ t: 'executionDone' });
    expect(d.state.phase).toMatchObject({ t: 'deathEffects', then: 'night' });
    d.send({ t: 'hunterShoot', target: 0 });
    expect(d.state.phase).toMatchObject({ t: 'gameOver', result: { outcome: 'village' } });
  });
});

describe('full games', () => {
  it('Beginner, 5 players: the village wins', () => {
    // 0 villager, 1 werewolf, 2 seer, 3 villager, 4 villager
    const d = driver(newGame(['villager', 'werewolf', 'seer', 'villager', 'villager']));
    discover(d);
    night(d, (s) =>
      s === 1 ? { kind: 'wolf', targets: [3] } : s === 2 ? { kind: 'seer', target: 1 } : undefined,
    );
    expect(d.state.phase).toMatchObject({
      t: 'morning',
      report: { deaths: [{ playerId: 3, cause: 'wolves' }] },
    });
    dayToVote(d);
    d.send({ t: 'vote', choice: { t: 'player', id: 1 } });
    expect(d.state.phase).toMatchObject({ t: 'execution', playerId: 1 });
    d.send({ t: 'executionDone' });
    expect(d.state.phase).toEqual({
      t: 'gameOver',
      result: { outcome: 'village', winners: [0, 2, 3, 4], soloWinners: [] },
    });
  });

  it('Classic, 8 players: the wolves win', () => {
    const roles: RoleId[] = [
      'werewolf',
      'villager',
      'witch',
      'villager',
      'werewolf',
      'seer',
      'villager',
      'villager',
    ];
    const d = driver(newGame(roles));
    discover(d);
    const wolves = (t: PlayerId) => (s: PlayerId) =>
      roles[s] === 'werewolf' && d.state.players[s]?.alive
        ? { kind: 'wolf' as const, targets: [t] }
        : undefined;
    const lynch = (id: PlayerId) => {
      dayToVote(d);
      d.send({ t: 'vote', choice: { t: 'player', id } });
      d.send({ t: 'executionDone' });
    };
    night(d, wolves(5)); // Seer dies
    lynch(1); // village lynches a villager
    night(d, wolves(2)); // Witch dies
    lynch(3); // 2 wolves vs 2 villagers left: parity
    expect(d.state.phase).toMatchObject({
      t: 'gameOver',
      result: { outcome: 'wolves', winners: [0, 4] },
    });
  });
});

describe('events outside their phase are ignored', () => {
  const ALL: GameEvent[] = [
    { t: 'revealRole' },
    { t: 'hideRole' },
    { t: 'cupidLink', lovers: [1, 2] },
    { t: 'nightIntroDone' },
    { t: 'glanceDone' },
    { t: 'openTurn' },
    { t: 'confirmTurn', action: { kind: 'dummy' } },
    { t: 'morningDone' },
    { t: 'hunterShoot', target: 2 },
    { t: 'passBadge', to: 2 },
    { t: 'electMayor', id: 2 },
    { t: 'pauseDiscussion' },
    { t: 'resumeDiscussion' },
    { t: 'addTime' },
    { t: 'endDiscussion' },
    { t: 'vote', choice: { t: 'none' } },
    { t: 'mayorDecide', pick: null },
    { t: 'executionDone' },
  ];
  const ALLOWED: Record<string, GameEvent['t'][]> = {
    discovery: ['revealRole', 'hideRole', 'cupidLink'],
    nightIntro: ['nightIntroDone'],
    glance: ['glanceDone'],
    pass: ['openTurn', 'confirmTurn'],
    morning: ['morningDone'],
    deathEffects: ['hunterShoot', 'passBadge'],
    mayorElection: ['electMayor'],
    discussion: ['pauseDiscussion', 'resumeDiscussion', 'addTime', 'endDiscussion'],
    vote: ['vote'],
    mayorTieBreak: ['mayorDecide'],
    execution: ['executionDone'],
    gameOver: [],
    setup: [],
  };
  const g = game(['werewolf', 'hunter', 'villager', 'villager', 'seer', 'villager']);
  const report = {
    deaths: [],
    saves: [],
    conversions: [],
    witchHealConsumed: false,
    witchPoisonConsumed: false,
    pending: {},
    nextNight: { wolfKills: 1 as const },
  };
  const phases: GameState['phase'][] = [
    { t: 'setup' },
    { t: 'discovery', seat: 0, revealed: false },
    { t: 'nightIntro', night: 1 },
    { t: 'glance', endsAt: 0 },
    { t: 'pass', seat: 0, step: 'handoff', startedAt: 0, turn: 0 },
    { t: 'morning', report, story: [] },
    { t: 'deathEffects', queue: [{ t: 'hunterShot', hunter: 1 }], then: 'day' },
    { t: 'mayorElection' },
    { t: 'discussion', endsAt: 5, pausedLeft: null },
    { t: 'vote' },
    { t: 'mayorTieBreak', tied: [0, 2] },
    { t: 'execution', playerId: null, effects: [] },
    { t: 'gameOver', result: { outcome: 'draw', winners: [], soloWinners: [] } },
  ];
  it.each(phases.map((p) => [p.t, p] as const))('%s', (t, phase) => {
    const s = { ...g, phase };
    for (const e of ALL.filter((ev) => !ALLOWED[t]?.includes(ev.t))) {
      expect(gameReducer(s, e, { now: 0, rng: seededRng(1) })).toBe(s);
    }
  });

  it('ignores repeated or impossible discussion controls', () => {
    const paused = { ...g, phase: { t: 'discussion' as const, endsAt: null, pausedLeft: 5000 } };
    const ctx = { now: 0, rng: seededRng(1) };
    expect(gameReducer(paused, { t: 'pauseDiscussion' }, ctx)).toBe(paused);
    const running = { ...g, phase: { t: 'discussion' as const, endsAt: 9, pausedLeft: null } };
    expect(gameReducer(running, { t: 'resumeDiscussion' }, ctx)).toBe(running);
  });

  it('runs out of death effects safely and handles a deferred empty queue', () => {
    const s = {
      ...g,
      day: 2,
      phase: { t: 'deathEffects' as const, queue: [], then: 'day' as const },
    };
    expect(
      gameReducer(s, { t: 'hunterShoot', target: 2 }, { now: 0, rng: seededRng(1) }).phase.t,
    ).toBe('discussion');
  });
});

describe('screens per role', () => {
  it('maps every role to its night screen', () => {
    const s = game([
      'werewolf',
      'seer',
      'sorcerer',
      'doctor',
      'witch',
      'serialKiller',
      'hunter',
      'cupid',
    ]);
    expect(s.players.map((p) => expectedAction(s, p.id))).toEqual([
      'wolf',
      'seer',
      'sorcerer',
      'doctor',
      'witch',
      'serialKiller',
      'dummy',
      'dummy',
    ]);
    expect(validAction(s, 2, { kind: 'sorcerer', target: 1 })).toBe(true);
  });
});

describe('more reducer paths', () => {
  it('the Doctor saves the victim through the full flow', () => {
    const d = driver(game(['werewolf', 'doctor', 'villager', 'villager', 'seer']));
    night(d, (s) =>
      s === 0
        ? { kind: 'wolf', targets: [3] }
        : s === 1
          ? { kind: 'doctor', target: 3 }
          : undefined,
    );
    expect(d.state.phase).toMatchObject({
      t: 'morning',
      report: { deaths: [], saves: [{ playerId: 3, by: 'doctor' }] },
    });
    expect(d.state.doctorLastTarget).toBe(3);
  });

  it('a night kill that gives the wolves parity ends the game after the morning', () => {
    const d = driver(game(['werewolf', 'villager', 'seer', 'villager'], { dead: [3] }));
    night(d, (s) => (s === 0 ? { kind: 'wolf', targets: [1] } : undefined));
    d.send({ t: 'morningDone' });
    expect(d.state.phase).toMatchObject({ t: 'gameOver', result: { outcome: 'wolves' } });
  });

  it('a rejected action keeps the turn open', () => {
    const d = driver(game(['werewolf', 'seer', 'villager', 'villager']));
    d.send({ t: 'nightIntroDone' });
    d.send({ t: 'glanceDone' });
    d.send({ t: 'openTurn' });
    d.tick(MIN_TURN);
    d.send({ t: 'confirmTurn', action: { kind: 'wolf', targets: [0] } });
    expect(d.state.phase).toMatchObject({ t: 'pass', seat: 0, step: 'action' });
  });

  it('the badge can only go to a living player', () => {
    const s = {
      ...game(['werewolf', 'mayor', 'villager', 'villager', 'seer'], { dead: [1, 2] }),
      mayor: 1,
    };
    const st = {
      ...s,
      phase: {
        t: 'deathEffects' as const,
        queue: [{ t: 'mayorHandoff' as const, mayor: 1 }],
        then: 'day' as const,
      },
    };
    const ctx = { now: 0, rng: seededRng(1) };
    expect(gameReducer(st, { t: 'passBadge', to: 2 }, ctx)).toBe(st);
    expect(gameReducer(st, { t: 'passBadge', to: null }, ctx).mayor).toBeNull();
  });
});
