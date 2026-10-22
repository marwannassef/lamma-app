import { seededRng } from '@/core/rng';
import en from '@/locales/en/werewolf.json';
import ar from '@/locales/ar/werewolf.json';

import { gameReducer } from '../reducer';
import {
  BEATS,
  drawVariant,
  KIDS_BEATS,
  pickSetting,
  SETTINGS,
  stageOf,
  storyKey,
  tellDawn,
  type Beat,
} from '../story';
import { game } from '../testing';
import type { GameState, NightReport, RoleId } from '../types';

const ROLES: RoleId[] = ['werewolf', 'seer', 'doctor', 'cursed', 'villager', 'villager'];

const report = (over: Partial<NightReport> = {}): NightReport => ({
  deaths: [],
  saves: [],
  conversions: [],
  witchHealConsumed: false,
  witchPoisonConsumed: false,
  pending: {},
  nextNight: { wolfKills: 1 },
  ...over,
});

const tell = (
  g: GameState,
  r: NightReport,
  seer?: { target: number; sawWolf: boolean },
  seed = 1,
) => tellDawn(g, r, seer, seededRng(seed));

const beats = (g: GameState, r: NightReport, seer?: { target: number; sawWolf: boolean }) =>
  tell(g, r, seer).lines.map((l) => l.beat);

describe('dawn story (§16)', () => {
  it('opens and closes by game stage', () => {
    expect(stageOf(1, 8)).toBe('first');
    expect(stageOf(3, 6)).toBe('mid');
    expect(stageOf(3, 4)).toBe('final');
    const first = beats(game(ROLES), report());
    expect(first[0]).toBe('openingFirst');
    expect(first.at(-1)).toBe('closingFirst');
    expect(first).not.toContain('tension');
    const late = beats(game(ROLES, { night: 3, dead: [4, 5] }), report());
    expect(late[0]).toBe('openingFinal');
    expect(late).toContain('tension');
    expect(late.at(-1)).toBe('closingFinal');
  });

  it('tells every death and heartbreak, with the right names', () => {
    const g = game(ROLES, { lovers: [4, 5], dead: [1, 4, 5] });
    const { lines } = tell(
      g,
      report({
        deaths: [
          { playerId: 1, cause: 'wolves' },
          { playerId: 4, cause: 'poison' },
          { playerId: 5, cause: 'heartbreak' },
        ],
      }),
    );
    const many = lines.find((l) => l.beat === 'deathMany');
    expect(many).toMatchObject({ names: [1, 4], count: 2 });
    expect(lines.find((l) => l.beat === 'heartbreak')).toMatchObject({ name: 5, lover: 4 });
    const one = tell(
      game(ROLES, { dead: [1] }),
      report({ deaths: [{ playerId: 1, cause: 'wolves' }] }),
    );
    expect(one.lines.find((l) => l.beat === 'deathOne')).toMatchObject({ name: 1 });
  });

  it('says a quiet night was quiet, and that an attack failed without naming who saved', () => {
    expect(beats(game(ROLES), report())).toContain('quiet');
    const saved = report({ saves: [{ playerId: 2, by: 'doctor' }] });
    const b = beats(game(ROLES), saved);
    expect(b).toContain('stopped');
    expect(b).not.toContain('quiet');
    expect(b).not.toContain('savedDoctor');
  });

  it('names the saving role and the cause only with detailed narration', () => {
    const r = report({
      deaths: [{ playerId: 4, cause: 'poison' }],
      saves: [{ playerId: 2, by: 'witch' }],
    });
    const plain = beats(game(ROLES, { dead: [4] }), r);
    expect(plain).not.toContain('causePoison');
    expect(plain).not.toContain('savedWitch');
    const detailed = game(ROLES, { dead: [4], rules: { detailedNarration: true } });
    expect(beats(detailed, r)).toEqual(expect.arrayContaining(['causePoison', 'savedWitch']));
    // Kids mode never describes how someone died.
    expect(beats({ ...detailed, kids: true }, r)).not.toContain('causePoison');
  });

  it('never mentions a Cursed conversion', () => {
    const b = beats(game(ROLES), report({ conversions: [3] }));
    expect(b).toContain('quiet');
    expect(b.join()).not.toMatch(/cursed|convert/i);
  });

  it('reports the Seer exactly per the house rule, a Lycan seen as a werewolf', () => {
    const r = report();
    expect(beats(game(ROLES), r, { target: 0, sawWolf: true })).not.toContain('seerFound');
    const result = game(ROLES, { rules: { seerAtDawn: 'result' } });
    expect(beats(result, r, { target: 0, sawWolf: true })).toContain('seerFound');
    expect(beats(result, r, { target: 4, sawWolf: false })).toContain('seerInnocent');
    expect(beats(result, r)).toContain('seerNone');
    const named = game(ROLES, { rules: { seerAtDawn: 'named' } });
    const found = tell(named, r, { target: 0, sawWolf: true }).lines;
    expect(found.find((l) => l.beat === 'seerFoundNamed')).toMatchObject({ name: 0 });

    // A Lycan looks like a werewolf to the Seer, and the dawn story says what the Seer saw.
    const lycan = game(['werewolf', 'seer', 'lycan', 'villager', 'villager'], {
      rules: { seerAtDawn: 'result' },
      phase: { t: 'pass', seat: 1, step: 'action', startedAt: 0, turn: 0 },
      startSeat: 1,
    });
    const after = gameReducer(
      lycan,
      { t: 'confirmTurn', action: { kind: 'seer', target: 2 } },
      { now: 60_000, rng: seededRng(1) },
    );
    expect(after.actions.seerCheck).toEqual({ target: 2, sawWolf: true });
  });

  it('calls back to yesterday and to a streak of quiet nights', () => {
    const quietStreak = game(ROLES, {
      night: 3,
      story: { setting: 'fog', decks: {}, quietNights: 1, lastVote: null },
    });
    const seen = new Set<Beat>();
    for (let seed = 1; seed < 40; seed++) {
      for (const l of tell(quietStreak, report(), undefined, seed).lines) seen.add(l.beat as Beat);
    }
    expect(seen.has('callbackQuiet')).toBe(true);
    const afterVote = game(ROLES, {
      night: 2,
      dead: [4],
      story: { setting: 'fog', decks: {}, quietNights: 0, lastVote: 4 },
    });
    const lines = Array.from(
      { length: 40 },
      (_, s) =>
        tell(afterVote, report({ deaths: [{ playerId: 5, cause: 'wolves' }] }), undefined, s).lines,
    ).flat();
    expect(lines.find((l) => l.beat === 'callbackVote')).toMatchObject({ name: 4 });
    expect(tell(game(ROLES), report()).lines.some((l) => l.beat.startsWith('callback'))).toBe(
      false,
    );
  });

  it('counts quiet nights and resets them after a death', () => {
    const g = game(ROLES, { story: { setting: 'fog', decks: {}, quietNights: 2 } });
    expect(tell(g, report()).story.quietNights).toBe(3);
    expect(tell(g, report({ deaths: [{ playerId: 4, cause: 'wolves' }] })).story.quietNights).toBe(
      0,
    );
  });

  it('never repeats a variant in one game while unused ones remain', () => {
    let decks = {};
    const rng = seededRng(7);
    const drawn: number[] = [];
    for (let i = 0; i < BEATS.quiet; i++) {
      const d = drawVariant(decks, 'quiet', rng);
      decks = d.decks;
      drawn.push(d.variant);
    }
    expect(new Set(drawn).size).toBe(BEATS.quiet);
    // The deck refills once every variant was used.
    expect(drawVariant(decks, 'quiet', rng).variant).toBeLessThan(BEATS.quiet);
  });

  it('picks a new setting each night, from the theme', () => {
    const rng = seededRng(3);
    let last: string | null = null;
    for (let i = 0; i < 50; i++) {
      const s = pickSetting('werewolf', last, rng);
      expect(SETTINGS.werewolf).toContain(s);
      expect(s).not.toBe(last);
      last = s;
    }
  });

  it('runs through the reducer: a setting at nightfall and a story at dawn', () => {
    const start = game(['werewolf', 'seer', 'villager', 'villager'], {
      phase: { t: 'discovery', seat: 3, revealed: true },
      night: 0,
    });
    const ctx = { now: 0, rng: seededRng(2) };
    const night = gameReducer(start, { t: 'hideRole' }, ctx);
    expect(night.phase.t).toBe('nightIntro');
    expect(SETTINGS.werewolf).toContain(night.story.setting);
  });

  it('uses the Kids variants for deaths and heartbreak only', () => {
    expect(storyKey({ beat: 'deathOne', variant: 0 }, 'werewolf', true)).toBe(
      'story.werewolf.deathOneKids',
    );
    expect(storyKey({ beat: 'quiet', variant: 0 }, 'werewolf', true)).toBe('story.werewolf.quiet');
    expect(storyKey({ beat: 'deathOne', variant: 0 }, 'mafia', false)).toBe('story.mafia.deathOne');
  });

  it('has every beat, Kids variant and setting in each language', () => {
    for (const locale of [en, ar]) {
      const story = (locale as { story: Record<string, Record<string, unknown>> }).story.werewolf!;
      for (const [beat, n] of Object.entries(BEATS))
        expect([beat, (story[beat] as unknown[]).length]).toEqual([beat, n]);
      for (const beat of KIDS_BEATS)
        expect((story[`${beat}Kids`] as unknown[]).length).toBe(BEATS[beat]);
      const settings = story.settings as Record<string, { scene: string; fall: string }>;
      for (const s of SETTINGS.werewolf) {
        expect(settings[s]?.scene).toBeTruthy();
        expect(settings[s]?.fall).toBeTruthy();
      }
    }
  });
});
