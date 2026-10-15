// Sunrise/sunset from latitude/longitude, fully offline. Formulas from the NOAA solar
// calculator as implemented in SunCalc (Vladimir Agafonkin, BSD-2-Clause).
const rad = Math.PI / 180;
const dayMs = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
const obliquity = rad * 23.4397;
/** Sun's upper edge on the horizon, corrected for refraction. */
const horizon = -0.833 * rad;

const toDays = (date: Date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs);
const meanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);

function eclipticLongitude(M: number) {
  const center = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  return M + center + rad * 102.9372 + Math.PI;
}

const transit = (ds: number, M: number, L: number) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

/**
 * Sunrise and sunset for the day containing `date` at the given place.
 * Returns null during polar day or night, when the sun doesn't rise or set.
 */
export function sunTimes(date: Date, lat: number, lon: number): SunTimes | null {
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(date);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = meanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(L));
  const cosW =
    (Math.sin(horizon) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW);
  const noon = transit(ds, M, L);
  const set = transit(J0 + (w + lw) / (2 * Math.PI) + n, M, L);
  return { sunrise: fromJulian(noon - (set - noon)), sunset: fromJulian(set) };
}
