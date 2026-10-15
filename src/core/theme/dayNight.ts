import { getCalendars } from 'expo-localization';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { sunTimes } from './sun';
import timezones from './timezones.json';
import type { ColorScheme } from './tokens';

/** Fallback day hours when sunrise/sunset can't be worked out. */
export const DAY_STARTS = 7;
export const NIGHT_STARTS = 19;

export type Place = readonly [lat: number, lon: number];

/**
 * Approximate position from the phone's time zone (the zone's main city in the tz database).
 * No location permission and nothing leaves the device.
 */
export function placeForTimeZone(zone: string | null | undefined): Place | null {
  if (!zone) return null;
  return (timezones as unknown as Record<string, Place>)[zone] ?? null;
}

export const devicePlace = () => placeForTimeZone(getCalendars()[0]?.timeZone);

/** Local noon of the day `offset` days from `date`, so sun times land on the right local day. */
function noonOf(date: Date, offset = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d;
}

function atHour(date: Date, hour: number, offset = 0) {
  const d = noonOf(date, offset);
  d.setHours(hour);
  return d;
}

/** Day boundaries for the local day containing `date`: real sun times, or 07:00–19:00. */
function dayWindow(date: Date, place: Place | null, offset = 0) {
  const sun = place ? sunTimes(noonOf(date, offset), place[0], place[1]) : null;
  if (sun) return { start: sun.sunrise, end: sun.sunset };
  return { start: atHour(date, DAY_STARTS, offset), end: atHour(date, NIGHT_STARTS, offset) };
}

export function schemeAt(date: Date, place: Place | null = null): ColorScheme {
  const { start, end } = dayWindow(date, place);
  return date >= start && date < end ? 'light' : 'dark';
}

/** Milliseconds until the next sunrise or sunset (or 07:00 / 19:00 without a place). */
export function msUntilSwitch(date: Date, place: Place | null = null): number {
  const today = dayWindow(date, place);
  const next =
    date < today.start
      ? today.start
      : date < today.end
        ? today.end
        : dayWindow(date, place, 1).start;
  return Math.max(60_000, next.getTime() - date.getTime());
}

/**
 * Light by day, dark by night, using sunrise and sunset where the phone is (estimated from its
 * time zone). Re-checks when the app comes back to the foreground and switches live while open.
 */
export function useDayNight(enabled: boolean, place: Place | null = devicePlace()): ColorScheme {
  const [lat, lon] = place ?? [NaN, NaN];
  const [scheme, setScheme] = useState(() => schemeAt(new Date(), place));
  useEffect(() => {
    if (!enabled) return;
    const where: Place | null = Number.isNaN(lat) ? null : [lat, lon];
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setScheme(schemeAt(now, where));
      timer = setTimeout(update, msUntilSwitch(now, where) + 1000);
    };
    update();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && update());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [enabled, lat, lon]);
  return scheme;
}
