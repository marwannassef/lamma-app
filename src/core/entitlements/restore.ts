import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { PurchaseResult } from './purchases';

/**
 * What to tell the user after Restore: restored, nothing found (with why a Party Pass can't come
 * back), or the failure with its detail. Null when they cancelled.
 */
export function useRestoreMessage() {
  const { t } = useTranslation('common');
  return useCallback(
    (r: PurchaseResult): string | null => {
      if (r.ok) return r.found ? t('premium.restored') : t('premium.nothingToRestore');
      if (r.reason === 'cancelled') return null;
      const text = r.reason === 'failed' ? t('premium.failed') : t('premium.unavailable');
      return r.detail ? `${text}\n${t('premium.details', { detail: r.detail })}` : text;
    },
    [t],
  );
}
