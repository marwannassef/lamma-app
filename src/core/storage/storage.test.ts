import { useSettings } from '@/core/settings/store';

import { storage } from '.';

describe('storage', () => {
  beforeEach(() => storage.clear());

  it('round-trips values', () => {
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('persists settings', () => {
    useSettings.getState().setAppearance('dark');
    expect(JSON.parse(storage.getItem('settings') as string).state.appearance).toBe('dark');
  });
});
