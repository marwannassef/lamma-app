import { act, renderHook } from '@testing-library/react-native';

import { msUntilSwitch, placeForTimeZone, schemeAt, useDayNight, type Place } from './dayNight';
import { sunTimes } from './sun';

const MIN = 60_000;
const near = (actual: Date, expectedIso: string, toleranceMin = 4) =>
  expect(Math.abs(actual.getTime() - Date.parse(expectedIso))).toBeLessThan(toleranceMin * MIN);

// Tests run with TZ=Africa/Cairo (test/globalSetup.js).
const cairo = placeForTimeZone('Africa/Cairo') as Place;
const at = (iso: string) => new Date(iso);

describe('sun times', () => {
  it('matches published sunrise and sunset', () => {
    // Cairo, 21 June 2026: 05:55 / 19:59 local (UTC+3, summer time).
    const june = sunTimes(at('2026-06-21T12:00:00+03:00'), 30.05, 31.25);
    near(june!.sunrise, '2026-06-21T02:55:00Z');
    near(june!.sunset, '2026-06-21T16:59:00Z');
    // New York, 21 December 2026: 07:16 / 16:32 local (UTC−5).
    const dec = sunTimes(at('2026-12-21T12:00:00-05:00'), 40.71, -74.01);
    near(dec!.sunrise, '2026-12-21T12:16:00Z');
    near(dec!.sunset, '2026-12-21T21:32:00Z');
  });

  it('returns null when the sun never sets or rises', () => {
    expect(sunTimes(at('2026-12-21T12:00:00Z'), 78.22, 15.65)).toBeNull(); // Svalbard, polar night
    expect(sunTimes(at('2026-06-21T12:00:00Z'), 78.22, 15.65)).toBeNull(); // midnight sun
  });
});

describe('place from time zone', () => {
  it('uses the zone main city, or nothing', () => {
    expect(cairo).toEqual([30.05, 31.25]);
    expect(placeForTimeZone('Asia/Riyadh')).toEqual([24.63, 46.72]);
    expect(placeForTimeZone('Mars/Olympus')).toBeNull();
    expect(placeForTimeZone(null)).toBeNull();
  });
});

describe('day & night scheme', () => {
  it('follows sunrise and sunset when the place is known', () => {
    // Cairo in June: light at 06:30, which the fixed 07:00 rule would call dark.
    expect(schemeAt(at('2026-06-21T06:30:00+03:00'), cairo)).toBe('light');
    expect(schemeAt(at('2026-06-21T05:30:00+03:00'), cairo)).toBe('dark');
    expect(schemeAt(at('2026-06-21T19:30:00+03:00'), cairo)).toBe('light');
    expect(schemeAt(at('2026-06-21T20:30:00+03:00'), cairo)).toBe('dark');
  });

  it('falls back to 07:00–19:00 without a place or during polar day/night', () => {
    expect(schemeAt(at('2026-06-21T06:59:00+03:00'))).toBe('dark');
    expect(schemeAt(at('2026-06-21T07:00:00+03:00'))).toBe('light');
    expect(schemeAt(at('2026-06-21T19:00:00+03:00'), [78.22, 15.65])).toBe('dark');
  });

  it('schedules the next switch at the next sun event', () => {
    const dawn = msUntilSwitch(at('2026-06-21T04:00:00+03:00'), cairo);
    near(new Date(Date.parse('2026-06-21T04:00:00+03:00') + dawn), '2026-06-21T02:55:00Z');
    const dusk = msUntilSwitch(at('2026-06-21T12:00:00+03:00'), cairo);
    near(new Date(Date.parse('2026-06-21T12:00:00+03:00') + dusk), '2026-06-21T16:59:00Z');
    const night = msUntilSwitch(at('2026-06-21T22:00:00+03:00'), cairo);
    near(new Date(Date.parse('2026-06-21T22:00:00+03:00') + night), '2026-06-22T02:55:00Z');
    expect(msUntilSwitch(at('2026-06-21T18:30:00+03:00'))).toBe(30 * MIN);
  });

  it('switches live while the app is open', () => {
    jest.useFakeTimers();
    jest.setSystemTime(at('2026-06-21T19:58:00+03:00'));
    const { result } = renderHook(() => useDayNight(true, cairo));
    expect(result.current).toBe('light');
    act(() => jest.advanceTimersByTime(5 * MIN));
    expect(result.current).toBe('dark');
    jest.useRealTimers();
  });
});
