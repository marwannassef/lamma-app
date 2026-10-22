import en from '@/locales/en/werewolf.json';
import ar from '@/locales/ar/werewolf.json';

import { audioCue, audioKey } from './audio';
import { game } from './engine/testing';
import type { GameState, NightReport, Phase, StoryLine } from './engine';

const nameOf = (id: number) => `P${id}`;
const roleName = (r: string) => r.toUpperCase();
const at = (phase: Phase, g: GameState = game(['werewolf', 'seer', 'villager', 'villager'])) =>
  audioCue({ ...g, phase }, nameOf, roleName, tell);
const tell = (_g: GameState, lines: readonly StoryLine[]) =>
  lines.map((l) => `${l.beat}#${l.variant}`);
const line = (c: { line?: { key: string } | { text: string } }) =>
  c.line && 'key' in c.line ? c.line.key : c.line?.text;

const report = (deaths: number[]): NightReport => ({
  deaths: deaths.map((playerId) => ({ playerId, cause: 'wolves' })),
  saves: [],
  conversions: [],
  witchHealConsumed: false,
  witchPoisonConsumed: false,
  pending: {},
  nextNight: { wolfKills: 1 },
});

const has = (locale: object, key: string) => {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], locale);
  return Array.isArray(v) && v.length > 0;
};

describe('Werewolf audio cues', () => {
  it('keys on the phase, not the seat', () => {
    const g = game(['werewolf', 'seer', 'villager', 'villager']);
    const pass = (seat: number): GameState => ({
      ...g,
      phase: { t: 'pass', seat, step: 'action', startedAt: 0, turn: seat },
    });
    expect(audioKey(pass(0))).toBe(audioKey(pass(2)));
    expect(audioKey(pass(0))).not.toBe(audioKey(g));
  });

  it('opens the night with ambience at the house-rule volume', () => {
    const g = game(['werewolf', 'seer', 'villager', 'villager'], {
      rules: { ambienceVolume: 0.4 },
    });
    expect(at({ t: 'nightIntro', night: 1 }, g)).toEqual({
      loops: { ambience: { id: 'nightAmbience', volume: 0.4 }, music: null },
      sfx: 'nightFall',
      line: { key: 'say.nightFall' },
    });
    // With tonight's setting picked, nightfall uses the setting's line (§16.3).
    const set = { ...g, story: { ...g.story, setting: 'fog' } };
    expect(line(at({ t: 'nightIntro', night: 1 }, set))).toBe('story.werewolf.settings.fog.fall');
    expect(at({ t: 'discovery', seat: 0, revealed: false }).loops).toEqual({
      ambience: null,
      music: null,
    });
  });

  it('beats a heart during the glance and masks the pass with ambience', () => {
    expect(at({ t: 'glance', endsAt: 0 })).toMatchObject({
      loops: { music: { id: 'heartbeat' } },
      line: { key: 'say.wolvesWake' },
    });
    const twice = game(['werewolf', 'seer', 'villager', 'villager'], { wolfKills: 2 });
    expect(line(at({ t: 'glance', endsAt: 0 }, twice))).toBe('say.wolvesTwice');
    const pass = at({ t: 'pass', seat: 0, step: 'handoff', startedAt: 0, turn: 0 });
    expect(pass.loops?.ambience).toEqual({ id: 'nightAmbience', volume: 0.7 });
    expect(pass.sfx).toBeUndefined();
  });

  it('reads the dawn story aloud as shown, with a sting only after a death', () => {
    const story: StoryLine[] = [
      { beat: 'openingFirst', variant: 2 },
      { beat: 'quiet', variant: 0 },
    ];
    expect(at({ t: 'morning', report: report([]), story })).toEqual({
      loops: { ambience: null, music: null },
      line: { text: 'openingFirst#2 quiet#0' },
    });
    expect(at({ t: 'morning', report: report([1]), story }).sfx).toBe('dawnSting');
  });

  it('plays tavern music for the discussion and counts down the vote', () => {
    expect(at({ t: 'discussion', endsAt: 0, pausedLeft: null }).loops?.music).toMatchObject({
      id: 'tavern',
    });
    expect(at({ t: 'vote' })).toEqual({
      loops: { music: null },
      line: { key: 'say.voteCountdown' },
    });
  });

  it('reveals the banished player by team, or not at all by house rule', () => {
    const exec = (playerId: number | null): Phase => ({ t: 'execution', playerId, effects: [] });
    expect(line(at(exec(null)))).toBe('say.nobody');
    expect(at(exec(0))).toMatchObject({
      sfx: 'revealWolves',
      line: { key: 'say.reveal.wolves', params: { name: 'P0', role: 'WEREWOLF' } },
    });
    expect(at(exec(1))).toMatchObject({
      sfx: 'revealVillage',
      line: { key: 'say.reveal.village' },
    });
    const hidden = game(['werewolf', 'seer', 'villager', 'villager'], {
      rules: { revealRoleOnDeath: false },
    });
    expect(at(exec(1), hidden).line).toEqual({ key: 'say.banished', params: { name: 'P1' } });
    expect(line(at(exec(9)))).toBe('say.banished');
  });

  it('ends with the outcome line', () => {
    const over = (outcome: 'village' | 'wolves'): Phase => ({
      t: 'gameOver',
      result: { outcome, winners: [], soloWinners: [] },
    });
    expect(at(over('village'))).toMatchObject({ sfx: 'fanfare', line: { key: 'say.win.village' } });
    expect(at(over('wolves')).sfx).toBe('revealWolves');
    expect(at({ t: 'mayorElection' })).toEqual({});
  });

  it('has 2–3 variants for the spec lines and every line in each language', () => {
    const keys = [
      'say.nightFall',
      'say.wolvesWake',
      'say.wolvesTwice',
      'say.wolvesSleep',
      'say.passStart',
      'say.voteCountdown',
      'say.banished',
      'say.nobody',
      ...['village', 'wolves', 'neutral'].map((t) => `say.reveal.${t}`),
      ...['village', 'wolves', 'tanner', 'serialKiller', 'lovers', 'draw'].map(
        (o) => `say.win.${o}`,
      ),
    ];
    keys.forEach((k) => {
      expect([k, has(en, k)]).toEqual([k, true]);
      expect([k, has(ar, k)]).toEqual([k, true]);
    });
    expect(en.say.nightFall).toHaveLength(3);
  });
});
