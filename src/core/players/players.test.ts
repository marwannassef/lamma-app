import { clampPlayers, MAX_PLAYERS, usePlayers } from '.';

describe('roster', () => {
  beforeEach(() => usePlayers.setState({ count: 5, names: ['Ana', 'Bo', '', 'Dee'] }));

  it('goes up to 16 players, each game narrowing it', () => {
    expect(MAX_PLAYERS).toBe(16);
    expect(clampPlayers(20)).toBe(16);
    expect(clampPlayers(20, 3, 12)).toBe(12);
    expect(clampPlayers(2, 4, 16)).toBe(4);
  });

  it('moves players to another seat', () => {
    usePlayers.getState().move(0, 2);
    expect(usePlayers.getState().names).toEqual(['Bo', '', 'Ana', 'Dee', '']);
    usePlayers.getState().move(4, 0);
    expect(usePlayers.getState().names.slice(0, 2)).toEqual(['', 'Bo']);
  });

  it('ignores moves off the ends', () => {
    const before = usePlayers.getState().names;
    usePlayers.getState().move(0, -1);
    usePlayers.getState().move(4, 5);
    expect(usePlayers.getState().names).toBe(before);
  });
});
