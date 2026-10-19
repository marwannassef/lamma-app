import { storage } from '@/core/storage';

import { capFor, effectiveLevel, isValidPin, useAge } from '.';

describe('content level (monetization §7)', () => {
  it('takes the lower of the age cap and the chosen level', () => {
    expect(capFor('under13')).toBe('kids');
    expect(capFor('13to17')).toBe('teen');
    expect(capFor('unknown')).toBe('teen');
    expect(effectiveLevel('teen', 'under13')).toBe('kids');
    expect(effectiveLevel('teen', '18plus')).toBe('teen');
    expect(effectiveLevel('kids', 'unknown')).toBe('kids');
    expect(effectiveLevel(null, 'unknown')).toBe('kids'); // not asked yet: be safe
  });

  it('checks PIN format', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
});

describe('parent PIN', () => {
  beforeEach(() => {
    storage.clear();
    useAge.setState({ audience: null, pin: null, signal: 'unknown', teenConfirmed: false });
  });

  it('needs the PIN to go from Kids to Teen', () => {
    const s = useAge.getState();
    s.setPin('4321');
    s.setAudience('kids');
    useAge.getState().setAudience('teen'); // ignored: the PIN guards it
    expect(useAge.getState().audience).toBe('kids');
    expect(useAge.getState().unlockTeen('0000')).toBe(false);
    expect(useAge.getState().unlockTeen('4321')).toBe(true);
    expect(useAge.getState().audience).toBe('teen');
  });

  it('an under-13 signal cannot be unlocked with the PIN', () => {
    useAge.setState({ audience: 'kids', pin: '1111', signal: 'under13' });
    expect(useAge.getState().unlockTeen('1111')).toBe(false);
  });

  it('remembers the choice but not the per-session cheeky confirmation', () => {
    useAge.getState().setAudience('teen');
    useAge.getState().confirmTeen();
    const saved = JSON.parse(storage.getItem('age') as string).state;
    expect(saved.audience).toBe('teen');
    expect(saved.teenConfirmed).toBeUndefined();
  });

  it('rejects a malformed PIN', () => {
    useAge.getState().setPin('12');
    expect(useAge.getState().pin).toBeNull();
  });
});
