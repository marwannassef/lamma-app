import { games, homeOrder } from '../registry';
import { audioCue } from './audio';
import { game } from './engine/testing';
import type { GameState, Phase } from './engine';
import { isTheme, regionTheme } from './theme';

describe('Werewolf / Mafia themes (§15)', () => {
  it('puts Mafia first where the game is known as Mafia', () => {
    for (const r of ['EG', 'sa', 'RU', 'PL', 'IT'])
      expect([r, regionTheme(r)]).toEqual([r, 'mafia']);
    for (const r of ['US', 'GB', 'DE', 'BR']) expect([r, regionTheme(r)]).toEqual([r, 'werewolf']);
    expect(regionTheme(null)).toBe('werewolf');
    expect(isTheme('mafia')).toBe(true);
    expect(isTheme('vampire')).toBe(false);
  });

  it('shows two home tiles and swaps them by the preferred theme', () => {
    const ids = (list: readonly { id: string }[]) => list.map((g) => g.id);
    expect(ids(homeOrder(games, 'werewolf'))).toEqual([
      'spy',
      'werewolf',
      'mafia',
      'blendIn',
      'mystery',
    ]);
    expect(ids(homeOrder(games, 'mafia'))).toEqual([
      'spy',
      'mafia',
      'werewolf',
      'blendIn',
      'mystery',
    ]);
  });

  const cue = (phase: Phase, patch: Partial<GameState> = {}) =>
    audioCue(
      {
        ...game(['werewolf', 'seer', 'villager', 'villager'], { theme: 'mafia', ...patch }),
        phase,
      },
      (id) => `P${id}`,
      (r) => r,
      () => [],
    );
  const report = {
    deaths: [{ playerId: 2, cause: 'wolves' as const }],
    saves: [],
    conversions: [],
    witchHealConsumed: false,
    witchPoisonConsumed: false,
    pending: {},
    nextNight: { wolfKills: 1 as const },
  };

  it('plays the noir city soundscape for Mafia', () => {
    expect(
      cue({ t: 'pass', seat: 0, step: 'handoff', startedAt: 0, turn: 0 }).loops?.ambience,
    ).toMatchObject({ id: 'cityAmbience' });
    expect(cue({ t: 'discussion', endsAt: 0, pausedLeft: null }).loops?.music).toMatchObject({
      id: 'noirJazz',
    });
    expect(cue({ t: 'morning', report, story: [] }).sfx).toBe('siren');
    expect(cue({ t: 'execution', playerId: 0, effects: [] }).sfx).toBe('jailClang');
    expect(cue({ t: 'execution', playerId: 1, effects: [] }).sfx).toBe('cameraFlash');
  });

  it('softens the harsh Mafia stingers in Kids mode', () => {
    expect(cue({ t: 'morning', report, story: [] }, { kids: true }).sfx).toBe('softKnock');
    expect(cue({ t: 'execution', playerId: 0, effects: [] }, { kids: true }).sfx).toBe('softKnock');
  });
});
