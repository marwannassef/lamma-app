import { parseRoomCode, roomCode } from './roomCode';

describe('room codes', () => {
  it('round-trips the addresses phones get on Wi-Fi and hotspots', () => {
    for (const ip of [
      '192.168.1.5',
      '172.20.10.1',
      '10.0.0.138',
      '192.168.43.1',
      '0.0.0.0',
      '255.255.255.255',
    ]) {
      const code = roomCode(ip) as string;
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(parseRoomCode(code)).toBe(`${ip}:47777`);
    }
  });

  it('forgives case, spaces, dashes and look-alike letters', () => {
    const code = roomCode('192.168.1.5') as string;
    const sloppy = ` ${code.toLowerCase().replace('-', ' ').replace(/0/g, 'o').replace(/1/g, 'l')} `;
    expect(parseRoomCode(sloppy)).toBe('192.168.1.5:47777');
  });

  it('carries a non-default port', () => {
    const code = roomCode('10.0.0.2', 5000) as string;
    expect(code.split('-')).toHaveLength(3);
    expect(parseRoomCode(code)).toBe('10.0.0.2:5000');
  });

  it('rejects what is not an address or a code', () => {
    for (const ip of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', 'a.b.c.d', 'fe80::1']) {
      expect(roomCode(ip)).toBeNull();
    }
    for (const code of [
      '',
      'ABC',
      'ABC-DEFU',
      'ZZZ-ZZZZ',
      'ABC-DEFG-0',
      'ABC-DEFG-ZZZZ',
      'ABC-DEF!',
    ]) {
      expect(parseRoomCode(code)).toBeNull();
    }
  });
});
