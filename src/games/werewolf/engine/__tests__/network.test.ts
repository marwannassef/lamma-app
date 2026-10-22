import { seededRng, shuffle, type Rng } from '@/core/rng';

import { gameReducer, newGame, type GameEvent } from '../reducer';
import { isPackWolf } from '../roles';
import { game } from '../testing';
import type { GameState, PlayerId, RoleId, SeatAction } from '../types';
import { actingSeat, publicView, viewFor, type SeatView } from '../views';

const MIN_TURN = 4500;

function driver(state: GameState, rng: Rng = seededRng(7)) {
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

/** The action a phone would send: the first allowed target, no potions. */
function actionFrom(v: SeatView): SeatAction {
  const task = v.task;
  if (task?.t !== 'action') throw new Error(`seat ${v.seat} has no action`);
  const first = task.targets.find((id) => id !== v.seat) as PlayerId;
  switch (task.kind) {
    case 'dummy':
      return { kind: 'dummy' };
    case 'wolf':
      return { kind: 'wolf', targets: task.targets.slice(0, task.wolfKills) };
    case 'witch':
      return { kind: 'witch', heal: false };
    default:
      return { kind: task.kind, target: first };
  }
}

const ROLES_8: RoleId[] = [
  'werewolf',
  'seer',
  'doctor',
  'villager',
  'werewolf',
  'witch',
  'villager',
  'hunter',
];

describe('network mode: everyone reveals at once', () => {
  it('starts with every card unseen and goes to night 1 once all seats have seen theirs', () => {
    const d = driver(
      newGame(['werewolf', 'seer', 'villager', 'villager'], {}, { mode: 'network' }),
    );
    expect(d.state.mode).toBe('network');
    expect(d.state.phase).toEqual({ t: 'reveal', seen: [] });
    for (const seat of [2, 0, 3]) d.send({ t: 'seatSeen', seat });
    d.send({ t: 'seatSeen', seat: 2 }); // twice counts once
    d.send({ t: 'seatSeen', seat: 9 }); // no such seat
    expect(d.state.phase).toEqual({ t: 'reveal', seen: [2, 0, 3] });
    d.send({ t: 'seatSeen', seat: 1 });
    expect(d.state.phase).toEqual({ t: 'nightIntro', night: 1 });
  });

  it('Cupid links the lovers from their own phone before finishing', () => {
    const d = driver(
      newGame(['villager', 'cupid', 'werewolf', 'villager'], {}, { mode: 'network' }),
    );
    d.send({ t: 'seatSeen', seat: 1 });
    expect(d.state.phase).toEqual({ t: 'reveal', seen: [] });
    d.send({ t: 'cupidLink', lovers: [0, 3], seat: 0 }); // not the Cupid
    d.send({ t: 'cupidLink', lovers: [2, 2], seat: 1 }); // the same player twice
    d.send({ t: 'cupidLink', lovers: [0, 3] }); // no seat
    expect(d.state.lovers).toBeNull();
    d.send({ t: 'cupidLink', lovers: [0, 3], seat: 1 });
    expect(d.state.lovers).toEqual([0, 3]);
    expect(viewFor(d.state, 1).me.linked).toEqual([0, 3]);
    expect(viewFor(d.state, 0).me.lover).toBe(3);
    expect(viewFor(d.state, 3).me.lover).toBe(0);
    expect(viewFor(d.state, 2).me.lover).toBeNull();
    d.send({ t: 'seatSeen', seat: 1 });
    d.send({ t: 'cupidLink', lovers: [2, 3], seat: 1 }); // finished: can't relink
    expect(d.state.lovers).toEqual([0, 3]);
    expect(viewFor(d.state, 1).task).toEqual({ t: 'reveal', cupid: true, seen: true });
  });
});

describe('network mode: everyone acts at once', () => {
  function toActions(roles: RoleId[], rules = {}) {
    const d = driver(newGame(roles, rules, { mode: 'network' }));
    roles.forEach((_, seat) => d.send({ t: 'seatSeen', seat }));
    d.send({ t: 'nightIntroDone' });
    d.send({ t: 'glanceDone' });
    return d;
  }

  it('takes each seat once, in any order, after the minimum turn time', () => {
    const d = toActions(ROLES_8);
    expect(d.state.phase).toMatchObject({ t: 'actions', acted: [] });
    const act = (seat: PlayerId) =>
      d.send({ t: 'seatAction', seat, action: actionFrom(viewFor(d.state, seat)) });

    act(3);
    expect(d.state.phase).toMatchObject({ acted: [] }); // too early
    d.tick(MIN_TURN);
    act(3);
    act(3); // a second time is ignored
    d.send({ t: 'seatAction', seat: 1, action: { kind: 'dummy' } }); // the Seer must inspect
    d.send({ t: 'seatAction', seat: 1, action: { kind: 'seer', target: 1 } }); // not themselves
    expect(d.state.phase).toMatchObject({ acted: [3] });
    expect(viewFor(d.state, 3).task).toMatchObject({ t: 'action', done: true });
    expect(viewFor(d.state, 1).task).toMatchObject({ t: 'action', kind: 'seer', done: false });

    for (const seat of [7, 1, 0, 6, 2, 5]) act(seat);
    expect(d.state.phase.t).toBe('actions');
    expect(publicView(d.state).phase).toMatchObject({ t: 'actions', done: 7, total: 8 });
    act(4);
    expect(d.state.phase.t).toBe('morning');
  });

  it('resolves exactly like the one-phone pass, whatever the order', () => {
    // The same game and choices, played around one phone and on eight phones.
    const pass = driver(newGame(ROLES_8), seededRng(3));
    while (pass.state.phase.t === 'discovery') {
      pass.send({ t: 'revealRole' });
      pass.send({ t: 'hideRole' });
    }
    pass.send({ t: 'nightIntroDone' });
    pass.send({ t: 'glanceDone' });
    const choices = new Map<PlayerId, SeatAction>();
    while (pass.state.phase.t === 'pass') {
      const seat = pass.state.phase.seat;
      pass.send({ t: 'openTurn' });
      pass.tick(MIN_TURN);
      // The phone's choice comes from the network view of the same night.
      const action = actionFrom(
        viewFor(
          {
            ...pass.state,
            mode: 'network',
            phase: { t: 'actions', startedAt: 0, acted: [] },
          },
          seat,
        ),
      );
      choices.set(seat, action);
      pass.send({ t: 'confirmTurn', action });
    }

    for (const order of [
      [0, 1, 2, 3, 4, 5, 6, 7],
      [7, 6, 5, 4, 3, 2, 1, 0],
      shuffle(seededRng(11), [0, 1, 2, 3, 4, 5, 6, 7]),
    ]) {
      const net = driver(newGame(ROLES_8, {}, { mode: 'network' }), seededRng(3));
      ROLES_8.forEach((_, seat) => net.send({ t: 'seatSeen', seat }));
      net.send({ t: 'nightIntroDone' });
      net.send({ t: 'glanceDone' });
      net.tick(MIN_TURN);
      for (const seat of order) {
        net.send({ t: 'seatAction', seat, action: choices.get(seat) as SeatAction });
      }
      expect(net.state.phase).toEqual(pass.state.phase);
      expect(net.state.players).toEqual(pass.state.players);
      expect(net.state.story).toEqual(pass.state.story);
    }
  });

  it("shows the Seer and Sorcerer their answer on their own phone, and nobody else's", () => {
    const d = toActions(['werewolf', 'seer', 'sorcerer', 'villager', 'villager']);
    d.tick(MIN_TURN);
    d.send({ t: 'seatAction', seat: 1, action: { kind: 'seer', target: 0 } });
    d.send({ t: 'seatAction', seat: 2, action: { kind: 'sorcerer', target: 1 } });
    expect(viewFor(d.state, 1).result).toEqual({ kind: 'seer', target: 0, sawWolf: true });
    expect(viewFor(d.state, 2).result).toEqual({ kind: 'sorcerer', target: 1, isSeer: true });
    expect(viewFor(d.state, 0).result).toBeNull();
    expect(viewFor(d.state, 3).result).toBeNull();
    // The answer stays through the day and is cleared at nightfall.
    for (const seat of [0, 3, 4]) {
      d.send({ t: 'seatAction', seat, action: actionFrom(viewFor(d.state, seat)) });
    }
    expect(d.state.phase.t).toBe('morning');
    expect(viewFor(d.state, 1).result).toMatchObject({ kind: 'seer' });
  });

  it("records the Serial Killer's pick like the one-phone pass", () => {
    const d = toActions(['serialKiller', 'werewolf', 'villager', 'villager', 'seer']);
    d.tick(MIN_TURN);
    d.send({ t: 'seatAction', seat: 0, action: { kind: 'serialKiller', target: 4 } });
    expect(d.state.actions.serialKillerTarget).toBe(4);
  });

  it('gives each role the right targets', () => {
    const d = toActions(['werewolf', 'alpha', 'doctor', 'witch', 'villager', 'seer']);
    const task = (seat: PlayerId) => viewFor(d.state, seat).task;
    expect(task(0)).toMatchObject({ kind: 'wolf', targets: [2, 3, 4, 5], wolfKills: 1 });
    expect(viewFor(d.state, 0).me).toMatchObject({ pack: [1], alpha: 1 });
    expect(task(2)).toMatchObject({ kind: 'doctor', targets: [0, 1, 2, 3, 4, 5] }); // night 1 self ok
    expect(task(3)).toMatchObject({ kind: 'witch', targets: [0, 1, 2, 4, 5] });
    expect(task(4)).toMatchObject({ kind: 'dummy', targets: [0, 1, 2, 3, 4, 5] });
    expect(task(5)).toMatchObject({ kind: 'seer', targets: [0, 1, 2, 3, 4] });
  });
});

describe('network views never leak secrets', () => {
  /** Every seat's role is hidden from `seat` unless the rules let it know (pack, lover, death). */
  const known = (s: GameState, seat: PlayerId, other: PlayerId) => {
    const me = s.players[seat];
    const them = s.players[other];
    if (!me || !them) return true;
    const seesPack = isPackWolf(me.role) || me.role === 'sorcerer';
    return other === seat || (seesPack && isPackWolf(them.role));
  };

  /** Shuffles the roles of every seat `seat` can't know about. */
  function permuteHidden(s: GameState, seat: PlayerId, rng: Rng): GameState {
    const hidden = s.players.filter((p) => !known(s, seat, p.id)).map((p) => p.id);
    const roles = shuffle(
      rng,
      hidden.map((id) => s.players[id]?.role as RoleId),
    );
    const players = s.players.map((p) => {
      const i = hidden.indexOf(p.id);
      return i < 0 ? p : { ...p, role: roles[i] as RoleId, dealtRole: roles[i] as RoleId };
    });
    return { ...s, players };
  }

  const SETUPS: RoleId[][] = [
    ROLES_8,
    ['alpha', 'werewolf', 'sorcerer', 'seer', 'doctor', 'villager', 'tanner', 'lycan'],
    ['serialKiller', 'werewolf', 'witch', 'cursed', 'apprenticeSeer', 'villager', 'hunter'],
  ];

  it('a phone sees the same thing whatever the hidden roles are', () => {
    const rng = seededRng(5);
    for (const roles of SETUPS) {
      const start = newGame(roles, {}, { mode: 'network' });
      const night = {
        ...game(roles, { mode: 'network' }),
        phase: { t: 'actions' as const, startedAt: 0, acted: [] },
      };
      for (const s of [start, night]) {
        for (const seat of roles.keys()) {
          for (let i = 0; i < 5; i++) {
            expect(viewFor(permuteHidden(s, seat, rng), seat)).toEqual(viewFor(s, seat));
          }
        }
      }
    }
  });

  it("other phones acting only moves the public count, never this phone's view", () => {
    const d = driver(game(ROLES_8, { mode: 'network' }));
    d.send({ t: 'nightIntroDone' });
    d.send({ t: 'glanceDone' });
    d.tick(MIN_TURN);
    const before = viewFor(d.state, 6);
    for (const seat of [0, 1, 2, 5]) {
      d.send({ t: 'seatAction', seat, action: actionFrom(viewFor(d.state, seat)) });
    }
    const after = viewFor(d.state, 6);
    expect({ ...after, public: { ...after.public, phase: before.public.phase } }).toEqual(before);
    expect(after.public.phase).toMatchObject({ done: 4 });
  });

  it('hides dead players’ roles in hardcore mode and shows every role at game over', () => {
    const dead = game(ROLES_8, { dead: [0, 1], rules: { revealRoleOnDeath: false } });
    expect(publicView(dead).players.map((p) => p.role)).toEqual(Array(8).fill(null));
    const shown = game(ROLES_8, { dead: [0, 1] });
    expect(
      publicView(shown)
        .players.slice(0, 3)
        .map((p) => p.role),
    ).toEqual(['werewolf', 'seer', null]);
    const over: GameState = {
      ...dead,
      phase: { t: 'gameOver', result: { outcome: 'village', winners: [], soloWinners: [] } },
    };
    expect(publicView(over).players.map((p) => p.role)).toEqual(ROLES_8);
  });

  it('never sends the morning report’s secrets (saves, causes, conversions)', () => {
    const s: GameState = {
      ...game(ROLES_8),
      phase: {
        t: 'morning',
        story: [],
        report: {
          deaths: [{ playerId: 3, cause: 'wolves' }],
          saves: [{ playerId: 2, by: 'doctor' }],
          conversions: [6],
          witchHealConsumed: false,
          witchPoisonConsumed: false,
          pending: {},
          nextNight: { wolfKills: 1 },
        },
      },
    };
    expect(publicView(s).phase).toEqual({ t: 'morning', story: [], deaths: [3] });
  });
});

describe('public steps on one phone', () => {
  it("hands the Hunter's shot and the Mayor's choices to their own phone", () => {
    const hunter: GameState = {
      ...game(ROLES_8, { dead: [7] }),
      phase: { t: 'deathEffects', queue: [{ t: 'hunterShot', hunter: 7 }], then: 'day' },
    };
    expect(actingSeat(hunter)).toBe(7);
    expect(viewFor(hunter, 7).task).toEqual({ t: 'hunterShot', targets: [0, 1, 2, 3, 4, 5, 6] });
    expect(viewFor(hunter, 0).task).toBeNull();
    expect(publicView(hunter).phase).toEqual({
      t: 'deathEffects',
      effect: { t: 'hunterShot', by: 7 },
    });

    const badge: GameState = {
      ...game(ROLES_8, { dead: [2], mayor: 2 }),
      phase: { t: 'deathEffects', queue: [{ t: 'mayorHandoff', mayor: 2 }], then: 'night' },
    };
    expect(viewFor(badge, 2).task).toMatchObject({ t: 'mayorHandoff' });

    const tie: GameState = {
      ...game(ROLES_8, { mayor: 4 }),
      phase: { t: 'mayorTieBreak', tied: [1, 3] },
    };
    expect(actingSeat(tie)).toBe(4);
    expect(viewFor(tie, 4).task).toEqual({ t: 'mayorTieBreak', tied: [1, 3] });
    expect(viewFor(tie, 1).task).toBeNull();
    expect(publicView(tie).players[4]?.mayor).toBe(true);
  });

  it('passes public phases through as they are and has no acting seat outside effects', () => {
    const base = game(ROLES_8, { mode: 'network' });
    expect(publicView({ ...base, phase: { t: 'setup' } }).phase).toEqual({ t: 'pass' });
    for (const phase of [
      { t: 'nightIntro', night: 1 },
      { t: 'glance', endsAt: 5 },
      { t: 'mayorElection' },
      { t: 'discussion', endsAt: 10, pausedLeft: null },
      { t: 'vote' },
    ] as const) {
      expect(publicView({ ...base, phase }).phase).toEqual(phase);
      expect(actingSeat({ ...base, phase })).toBeNull();
      expect(viewFor({ ...base, phase }, 0).task).toBeNull();
    }
    const executed: GameState = { ...base, phase: { t: 'execution', playerId: 2, effects: [] } };
    expect(publicView(executed).phase).toEqual({ t: 'execution', playerId: 2 });
    const settled: GameState = { ...base, phase: { t: 'deathEffects', queue: [], then: 'day' } };
    expect(publicView(settled).phase).toEqual({ t: 'deathEffects', effect: null });
    expect(actingSeat(settled)).toBeNull();
    expect(viewFor(settled, 0).task).toBeNull();
    expect(() => viewFor(base, 8)).toThrow();
  });

  it('ignores anything but cards being seen while everyone reveals', () => {
    const d = driver(
      newGame(['werewolf', 'seer', 'villager', 'villager'], {}, { mode: 'network' }),
    );
    const before = d.state;
    d.send({ t: 'nightIntroDone' });
    d.send({ t: 'revealRole' });
    expect(d.state).toBe(before);
  });

  it('shows pass-and-play phases as a plain "pass" to anyone listening', () => {
    expect(publicView(newGame(ROLES_8)).phase).toEqual({ t: 'pass' });
    expect(viewFor(newGame(ROLES_8), 0).task).toBeNull();
  });
});
