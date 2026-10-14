import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { ColorScheme } from './tokens';

/** Local hours that count as day; outside them the "day & night" appearance goes dark. */
export const DAY_STARTS = 7;
export const NIGHT_STARTS = 19;

export function schemeAt(date: Date): ColorScheme {
  const h = date.getHours();
  return h >= DAY_STARTS && h < NIGHT_STARTS ? 'light' : 'dark';
}

/** Milliseconds until the next 07:00 or 19:00 in local time. */
export function msUntilSwitch(date: Date): number {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  const h = date.getHours();
  if (h < DAY_STARTS) next.setHours(DAY_STARTS);
  else if (h < NIGHT_STARTS) next.setHours(NIGHT_STARTS);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_STARTS);
  }
  return next.getTime() - date.getTime();
}

/**
 * Light by day, dark by night, from the device's local time. Re-checks when the app comes
 * back to the foreground and switches live at 07:00 / 19:00 while it is open.
 */
export function useDayNight(enabled: boolean): ColorScheme {
  const [scheme, setScheme] = useState(() => schemeAt(new Date()));
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setScheme(schemeAt(now));
      timer = setTimeout(update, msUntilSwitch(now) + 1000);
    };
    update();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && update());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [enabled]);
  return scheme;
}
