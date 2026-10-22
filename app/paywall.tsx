import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { PaywallTrigger } from '@/core/entitlements';
import {
  purchase,
  restorePurchases,
  storePrices,
  watchRewardedAd,
  type ProductId,
  type PurchaseResult,
} from '@/core/entitlements/purchases';
import { useRemoteConfig } from '@/core/remoteConfig';
import { gradients, radius, space, useTheme } from '@/core/theme';
import { Badge, Button, Hint, Panel, Pressable, Screen, Text } from '@/core/ui';

const PRODUCTS: ProductId[] = ['partyPass', 'annual', 'lifetime'];
const TRIGGERS: PaywallTrigger[] = ['cap', 'locked', 'gameEnd', 'offline', 'settings'];

/** Lamma Premium (monetization §4). Opened only from a limit, a locked item, a game end or Settings. */
export default function Paywall() {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const config = useRemoteConfig();
  const params = useLocalSearchParams<{ trigger?: string; max?: string }>();
  const trigger: PaywallTrigger = TRIGGERS.includes(params.trigger as PaywallTrigger)
    ? (params.trigger as PaywallTrigger)
    : 'settings';
  const [selected, setSelected] = useState<ProductId>('lifetime');
  const [message, setMessage] = useState<string | null>(null);

  // The store's localized prices once they load; the configured defaults until then.
  const [local, setLocal] = useState<Partial<Record<ProductId, string>>>({});
  useEffect(() => {
    let live = true;
    void storePrices().then((p) => live && setLocal(p));
    return () => {
      live = false;
    };
  }, []);
  const price = { ...config.prices, ...local };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const run = async (action: () => Promise<PurchaseResult>, unavailable: string) => {
    const r = await action();
    if (r.ok) return close();
    if (r.reason === 'cancelled') return setMessage(null);
    const text = r.reason === 'failed' ? t('premium.failed') : unavailable;
    setMessage(r.detail ? `${text}\n${t('premium.details', { detail: r.detail })}` : text);
  };

  return (
    <Screen
      footer={
        <View style={styles.stack}>
          {message ? <Hint testID="paywall-message">{message}</Hint> : null}
          <Button
            testID="paywall-buy"
            icon="✨"
            label={`${t('premium.buy')} · ${price[selected]}`}
            onPress={() => run(() => purchase(selected), t('premium.unavailable'))}
          />
        </View>
      }
    >
      <View style={styles.top}>
        <Pressable
          testID="paywall-close"
          accessibilityLabel={t('premium.close')}
          onPress={close}
          style={[styles.close, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="label" tone="muted" accessible={false}>
            ✖
          </Text>
        </Pressable>
      </View>

      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroEmoji} accessible={false}>
          👑
        </Text>
        <Text variant="title" align="center" style={styles.white}>
          {t('premium.title')}
        </Text>
        <Text variant="label" align="center" style={styles.white} testID="paywall-headline">
          {t(`premium.triggers.${trigger}`, { max: params.max ?? 16 })}
        </Text>
      </LinearGradient>

      <Panel>
        {(t('premium.benefits', { returnObjects: true }) as string[]).map((b) => (
          <View key={b} style={styles.benefit}>
            <Text variant="label" tone="success" accessible={false}>
              ✓
            </Text>
            <Text variant="body" style={styles.flex}>
              {b}
            </Text>
          </View>
        ))}
      </Panel>

      <View style={styles.stack} accessibilityRole="radiogroup">
        {PRODUCTS.map((id) => {
          const on = selected === id;
          return (
            <Pressable
              key={id}
              testID={`product-${id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t(`premium.${id}.name`)}, ${price[id]}, ${t(`premium.${id}.sub`)}`}
              onPress={() => setSelected(id)}
              style={[
                styles.product,
                {
                  backgroundColor: on ? colors.surfaceRaised : colors.surface,
                  borderColor: on ? colors.secondary : colors.border,
                },
              ]}
            >
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text variant="heading">
                    {on ? `✓ ${t(`premium.${id}.name`)}` : t(`premium.${id}.name`)}
                  </Text>
                  {id === 'lifetime' ? (
                    <Badge tone="primary" label={t('premium.bestValue')} />
                  ) : null}
                </View>
                <Text variant="caption" tone="muted">
                  {t(`premium.${id}.sub`)}
                </Text>
              </View>
              <Text variant="heading" tone="secondary">
                {price[id]}
              </Text>
            </Pressable>
          );
        })}
        <Text variant="caption" tone="muted" align="center">
          {t('premium.priceNote')}
        </Text>
      </View>

      {trigger === 'cap' || trigger === 'locked' ? (
        <>
          <Text variant="caption" tone="muted" align="center">
            {t('premium.or')}
          </Text>
          <Button
            variant="ghost"
            size="md"
            icon="🎬"
            testID="paywall-rewarded"
            label={trigger === 'cap' ? t('premium.rewardedCap') : t('premium.rewardedPack')}
            onPress={() => run(watchRewardedAd, t('premium.adsUnavailable'))}
          />
        </>
      ) : null}

      <View style={styles.links}>
        <Pressable
          testID="paywall-restore"
          onPress={() => run(restorePurchases, t('premium.unavailable'))}
          style={styles.link}
        >
          <Text variant="caption" tone="secondary">
            {t('premium.restore')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setMessage(t('premium.linkSoon'))} style={styles.link}>
          <Text variant="caption" tone="secondary">
            {t('premium.terms')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setMessage(t('premium.linkSoon'))} style={styles.link}>
          <Text variant="caption" tone="secondary">
            {t('premium.privacy')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { borderRadius: radius.card, padding: space.xl, gap: space.xs, alignItems: 'center' },
  heroEmoji: { fontSize: 48, lineHeight: 60 },
  white: { color: '#FFFFFF' },
  benefit: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.md },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
});
