import { storage } from '@/core/storage';

import { fitScores, rankScores, useSession } from '.';

describe('scoreboard', () => {
  it('fits scores to the roster', () => {
    expect(fitScores([3, 1], 4)).toEqual([3, 1, 0, 0]);
    expect(fitScores([3, 1, 2], 2)).toEqual([3, 1]);
  });

  it('ranks descending with crowns for leaders only once someone scored', () => {
    expect(rankScores([0, 0]).some((r) => r.leader)).toBe(false);
    const rows = rankScores([1, 3, 3], [0, 2, 0]);
    expect(rows.map((r) => r.player)).toEqual([1, 2, 0]);
    expect(rows.map((r) => r.leader)).toEqual([true, true, false]);
    expect(rows[0]?.gain).toBe(2);
  });
});

describe('session store', () => {
  beforeEach(() => {
    storage.clear();
    useSession.getState().reset();
  });

  it('counts rounds, adds points and persists them', () => {
    const s = useSession.getState();
    expect(s.startRound()).toBe(1);
    expect(useSession.getState().startRound()).toBe(2);
    useSession.getState().addPoints([2, 0, 1]);
    useSession.getState().addPoints([1, 1, 0]);
    expect(useSession.getState().scores).toEqual([3, 1, 1]);
    expect(useSession.getState().lastGain).toEqual([1, 1, 0]);
    const saved = JSON.parse(storage.getItem('session') as string).state;
    expect(saved).toMatchObject({ scores: [3, 1, 1], round: 3 });
  });

  it('reset clears scores and the round counter', () => {
    useSession.getState().startRound();
    useSession.getState().addPoints([1]);
    useSession.getState().reset();
    expect(useSession.getState()).toMatchObject({ scores: [], round: 1 });
  });
});
