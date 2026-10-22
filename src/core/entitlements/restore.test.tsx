import { renderHook } from '@testing-library/react-native';

import { initI18n } from '@/core/i18n';

import { useRestoreMessage } from './restore';

beforeAll(() => initI18n('en'));

describe('what Restore says', () => {
  it('says restored, nothing found, cancelled (nothing) or the failure with its detail', () => {
    const { result } = renderHook(() => useRestoreMessage());
    const say = result.current;
    expect(say({ ok: true, found: true })).toBe('Purchases restored ✓');
    expect(say({ ok: true, found: false })).toMatch(/No purchases found.*Party Pass/);
    expect(say({ ok: false, reason: 'cancelled' })).toBeNull();
    expect(say({ ok: false, reason: 'failed', detail: 'NETWORK_ERROR: offline' })).toBe(
      "The store couldn't complete this. Please try again.\nDetails: NETWORK_ERROR: offline",
    );
    expect(say({ ok: false, reason: 'unavailable' })).toBe("Purchases aren't available right now.");
  });
});
