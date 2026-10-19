import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** Round back button, optional game logo, and screen title. The arrow flips in RTL. */
export function BackHeader({
  title,
  icon,
  image,
}: {
  title: string;
  /** Emoji before the title (e.g. Settings). */
  icon?: string;
  /** A game's logo, shown instead of an emoji so it matches the home screen. */
  image?: ImageSourcePropType;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        testID="back"
        accessibilityLabel={t('a11y.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text
          variant="heading"
          tone="secondary"
          style={I18nManager.isRTL && { transform: [{ scaleX: -1 }] }}
        >
          ←
        </Text>
      </Pressable>
      {image ? (
        <Image
          source={image}
          style={styles.logo}
          accessible={false}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text variant="title" style={styles.title} numberOfLines={1}>
        {icon && !image ? `${icon} ${title}` : title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 44, height: 44, borderRadius: 11 },
  title: { flex: 1 },
});
