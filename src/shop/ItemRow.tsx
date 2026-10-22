import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { localized } from '@/core/content';
import { radius, space, useTheme } from '@/core/theme';
import { Badge, Button, Text } from '@/core/ui';
import { useWerewolfT } from '@/games/werewolf/components/i18n';
import { RoleIcon } from '@/games/werewolf/components/RoleIcon';

import type { ShopItem } from './catalog';

/** A Shop item: art, name, what it's for, and its price, "Owned" or "In Premium". */
export function ItemRow({
  item,
  price,
  status,
  onBuy,
}: {
  item: ShopItem;
  price?: string;
  status: 'buy' | 'owned' | 'premium';
  onBuy(): void;
}) {
  const { t, i18n } = useTranslation('common');
  const { t: tw } = useWerewolfT();
  const { colors } = useTheme();
  const name =
    item.kind === 'pack' ? localized(item.pack.name, i18n.language) : tw(`roles.${item.role}.name`);
  const sub =
    item.kind === 'pack'
      ? t('shop.packSub', { count: item.pack.words.length })
      : tw(`roles.${item.role}.ability`);
  return (
    <View
      testID={`shop-${item.id}`}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {item.kind === 'pack' ? (
        <View style={[styles.bubble, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={styles.emoji} accessible={false}>
            {item.pack.emoji}
          </Text>
        </View>
      ) : (
        <RoleIcon role={item.role} size={52} />
      )}
      <View style={styles.text}>
        <Text variant="label">{name}</Text>
        <Text variant="caption" tone="muted">
          {sub}
        </Text>
        {item.kind === 'pack' && item.pack.level === 'teen' ? (
          <Badge tone="neutral" icon="🙊" label={t('teen.tag')} />
        ) : null}
      </View>
      {status === 'buy' ? (
        <View style={styles.buy}>
          <Button
            size="md"
            testID={`buy-${item.id}`}
            label={price ?? t('shop.buy')}
            accessibilityHint={t('shop.buyHint', { name })}
            onPress={onBuy}
          />
        </View>
      ) : (
        <Badge
          tone={status === 'owned' ? 'secondary' : 'gold'}
          icon="✓"
          label={status === 'owned' ? t('shop.owned') : t('shop.inPremium')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
  },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26, lineHeight: 34 },
  text: { flex: 1, gap: 2, alignItems: 'flex-start' },
  buy: { minWidth: 96 },
});
