import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { openPaywall, softPaywallDue, useEntitlements, useTier } from '@/core/entitlements';
import { useRemoteConfig } from '@/core/remoteConfig';

import { Button } from './Button';
import { Panel } from './Panel';
import { Text } from './Text';

/** "Loved it? Get everything." after a game, for free users, at most once per day (§4). */
export function SoftUpsell() {
  const { t } = useTranslation('common');
  const tier = useTier();
  const config = useRemoteConfig();
  const { softShownAt, markSoftShown } = useEntitlements();
  // Decided once when the card mounts, so marking it shown doesn't hide it straight away.
  const [show] = useState(
    () => tier === 'free' && softPaywallDue(softShownAt, Date.now(), config.softPaywallHours),
  );
  useEffect(() => {
    if (show) markSoftShown();
  }, [markSoftShown, show]);
  if (!show) return null;
  return (
    <Panel title={t('premium.softTitle')} icon="✨" testID="soft-upsell">
      <Text variant="body" tone="muted">
        {t('premium.softSub')}
      </Text>
      <Button
        size="md"
        variant="secondary"
        testID="soft-upsell-open"
        label={t('premium.softCta')}
        onPress={() => openPaywall('gameEnd')}
      />
    </Panel>
  );
}
