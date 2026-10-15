import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, StyleSheet, View } from 'react-native';

import { space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** Round back button plus screen title. The arrow flips in RTL. */
export function BackHeader({ title, icon }: { title: string; icon?: string }) {
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
      <Text variant="title" style={styles.title} numberOfLines={1}>
        {icon ? `${icon} ${title}` : title}
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
  title: { flex: 1 },
});
