import { act, renderHook } from '@testing-library/react-native';

import { msUntilSwitch, schemeAt, useDayNight } from './dayNight';

const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m, 0, 0);

describe('day & night appearance', () => {
  it('is light from 07:00 to 18:59 and dark otherwise', () => {
    expect(schemeAt(at(6, 59))).toBe('dark');
    expect(schemeAt(at(7))).toBe('light');
    expect(schemeAt(at(18, 59))).toBe('light');
    expect(schemeAt(at(19))).toBe('dark');
    expect(schemeAt(at(0))).toBe('dark');
  });

  it('knows when the next switch is', () => {
    const H = 3_600_000;
    expect(msUntilSwitch(at(6))).toBe(H);
    expect(msUntilSwitch(at(18, 30))).toBe(H / 2);
    expect(msUntilSwitch(at(23))).toBe(8 * H);
  });

  it('switches live while the app is open', () => {
    jest.useFakeTimers();
    jest.setSystemTime(at(18, 59));
    const { result } = renderHook(() => useDayNight(true));
    expect(result.current).toBe('light');
    act(() => jest.advanceTimersByTime(2 * 60_000));
    expect(result.current).toBe('dark');
    jest.useRealTimers();
  });
});
