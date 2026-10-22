import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { levelAllows } from '@/core/content';
import { openPaywall, useOwned, useTier } from '@/core/entitlements';
import {
  buyItem,
  itemPrices,
  restorePurchases,
  type PurchaseResult,
} from '@/core/entitlements/purchases';
import { useContentLevel } from '@/core/age';
import { useRemoteConfig } from '@/core/remoteConfig';
import { gradients, radius, space } from '@/core/theme';
import { BackHeader, Button, Chip, Hint, Pressable, Screen, Text } from '@/core/ui';
import { shopCatalog, type ShopItem } from '@/shop/catalog';
import { ItemRow } from '@/shop/ItemRow';

type Tab = 'packs' | 'roles';

/**
 * The Shop: buy a single word pack or Werewolf role card, or everything with Premium.
 * Teen packs stay hidden in Kids mode (monetization §7).
 */
export default function Shop() {
  const { t } = useTranslation('common');
  const config = useRemoteConfig();
  const premium = useTier() === 'premium';
  const owned = useOwned();
  const level = useContentLevel();
  const [tab, setTab] = useState<Tab>('packs');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(
    () => shopCatalog(config).filter((i) => i.kind === 'role' || levelAllows(level, i.pack.level)),
    [config, level],
  );
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    void itemPrices(items.map((i) => i.id)).then((p) => live && setPrices(p));
    return () => {
      live = false;
    };
  }, [items]);

  const run = async (key: string, action: () => Promise<PurchaseResult>) => {
    setBusy(key);
    const r = await action();
    setBusy(null);
    if (r.ok || r.reason === 'cancelled') return setMessage(null);
    const text = r.reason === 'failed' ? t('premium.failed') : t('premium.unavailable');
    setMessage(r.detail ? `${text}\n${t('premium.details', { detail: r.detail })}` : text);
  };
  const status = (i: ShopItem) => (premium ? 'premium' : owned.includes(i.id) ? 'owned' : 'buy');
  const shown = items.filter((i) => (tab === 'packs' ? i.kind === 'pack' : i.kind === 'role'));
  const regions = [...new Set(shown.flatMap((i) => (i.kind === 'pack' ? [i.pack.region] : [])))];

  return (
    <Screen>
      <BackHeader title={t('shop.title')} icon="🛍️" />

      {!premium ? (
        <Pressable
          testID="shop-premium"
          accessibilityLabel={`${t('premium.title')}. ${t('shop.premiumPitch')}`}
          onPress={() => openPaywall('settings')}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <Text style={styles.crown} accessible={false}>
              👑
            </Text>
            <View style={styles.flex}>
              <Text variant="heading" style={styles.white}>
                {t('premium.title')}
              </Text>
              <Text variant="caption" style={styles.white}>
                {t('shop.premiumPitch')}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      <View style={styles.tabs} accessibilityRole="radiogroup">
        {(['packs', 'roles'] as const).map((k) => (
          <View key={k} style={styles.flex}>
            <Chip
              compact
              testID={`shop-tab-${k}`}
              emoji={k === 'packs' ? '📚' : '🐺'}
              title={t(`shop.tabs.${k}`)}
              selected={tab === k}
              onPress={() => setTab(k)}
            />
          </View>
        ))}
      </View>

      <Text variant="caption" tone="muted" align="center">
        {tab === 'packs' ? t('shop.packsNote') : t('shop.rolesNote')}
      </Text>

      {message ? <Hint testID="shop-message">{message}</Hint> : null}

      {tab === 'packs'
        ? regions.map((region) => (
            <View key={region} style={styles.stack}>
              <Text variant="heading" accessibilityRole="header">
                {t(`regions.${region}` as 'regions.global')}
              </Text>
              {shown
                .filter((i) => i.kind === 'pack' && i.pack.region === region)
                .map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    price={prices[i.id]}
                    status={status(i)}
                    onBuy={() => busy == null && run(i.id, () => buyItem(i.id))}
                  />
                ))}
            </View>
          ))
        : shown.map((i) => (
            <ItemRow
              key={i.id}
              item={i}
              price={prices[i.id]}
              status={status(i)}
              onBuy={() => busy == null && run(i.id, () => buyItem(i.id))}
            />
          ))}

      <Button
        variant="ghost"
        size="md"
        testID="shop-restore"
        label={t('premium.restore')}
        onPress={() => run('restore', restorePurchases)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.sm },
  tabs: { flexDirection: 'row', gap: space.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    padding: space.lg,
  },
  crown: { fontSize: 36, lineHeight: 44 },
  white: { color: '#FFFFFF' },
});
