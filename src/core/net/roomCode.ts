// A short code a guest can type to reach the host when automatic discovery doesn't work
// (docs/games/werewolf-network.md §4). It's the host's IPv4 address in Crockford base 32:
// 7 characters shown as "ABC-DEFG", no I/L/O/U, and typos like O for 0 are forgiven.
import { DEFAULT_PORT } from './transport';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTH = 7;

/** "192.168.1.5" → "60N-80G5"; a non-default port is appended ("60N-80G5-1HQ"). */
export function roomCode(ip: string, port = DEFAULT_PORT): string | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  const s = encode(
    parts.reduce((acc, b) => acc * 256 + b, 0),
    LENGTH,
  );
  const code = `${s.slice(0, 3)}-${s.slice(3)}`;
  return port === DEFAULT_PORT ? code : `${code}-${encode(port, 1)}`;
}

/** `n` in base 32, at least `min` characters. */
function encode(n: number, min: number): string {
  let s = '';
  while (s.length < min || n > 0) {
    s = ALPHABET[n % 32] + s;
    n = Math.floor(n / 32);
  }
  return s;
}

function digits(s: string): number | null {
  let n = 0;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    n = n * 32 + v;
  }
  return n;
}

/** The "ip:port" a typed code points to, or null if it isn't a room code. */
export function parseRoomCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[\s-]/g, '');
  if (clean.length < LENGTH) return null;
  const ip = digits(clean.slice(0, LENGTH));
  const port = clean.length > LENGTH ? digits(clean.slice(LENGTH)) : DEFAULT_PORT;
  if (ip == null || ip > 0xffffffff || port == null || port < 1 || port > 65535) return null;
  const octets = [24, 16, 8, 0].map((shift) => Math.floor(ip / 2 ** shift) % 256);
  return `${octets.join('.')}:${port}`;
}
