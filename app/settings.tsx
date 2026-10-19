import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { allRegions } from '@/core/content';
import { localeMeta, supportedLanguages, switchLanguage } from '@/core/i18n';
import { useRegions } from '@/core/settings/content';
import { useSettings, type Appearance, type LanguagePref } from '@/core/settings/store';
import { radius, space, useTheme } from '@/core/theme';
import { BackHeader, Hint, Panel, Pressable, Screen, Text, Toggle } from '@/core/ui';

// The dark variant has the brown script recoloured to cream so it stays readable.
const LOGO_LIGHT = require('@/assets/images/publisher-logo-light.png');
const LOGO_DARK = require('@/assets/images/publisher-logo-dark.png');

interface Option<T extends string> {
  value: T;
  label: string;
}

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: Option<T>[];
  value: T;
  onChange(v: T): void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.secondary : colors.surfaceRaised,
                borderColor: selected ? colors.secondary : colors.border,
              },
            ]}
          >
            <Text variant="label" style={{ color: selected ? colors.onSecondary : colors.text }}>
              {selected ? `✓ ${o.label}` : o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const s = useSettings();

  const languages: Option<LanguagePref>[] = [
    { value: 'system', label: t('settings.languageSystem') },
    ...supportedLanguages.map((code) => ({
      value: code,
      label: localeMeta[code]?.nativeName ?? code,
    })),
  ];
  const appearances: Option<Appearance>[] = [
    { value: 'system', label: t('settings.appearanceSystem') },
    { value: 'light', label: t('settings.appearanceLight') },
    { value: 'dark', label: t('settings.appearanceDark') },
    { value: 'auto', label: t('settings.appearanceAuto') },
  ];

  const regions = useRegions();
  const [lastRegionHint, setLastRegionHint] = useState(false);

  const toggleRegion = (region: string, on: boolean) => {
    const next = on ? [...regions, region] : regions.filter((r) => r !== region);
    if (next.length === 0) return setLastRegionHint(true);
    setLastRegionHint(false);
    s.setRegions(allRegions.filter((r) => next.includes(r)));
  };

  return (
    <Screen>
      <BackHeader title={t('settings.title')} icon="⚙️" />

      <Panel title={t('settings.language')} icon="🌐">
        <OptionGroup
          testID="lang"
          options={languages}
          value={s.language}
          onChange={(v) => {
            s.setLanguage(v);
            void switchLanguage(v);
          }}
        />
        <Text variant="caption" tone="muted">
          {t('settings.directionNote')}
        </Text>
      </Panel>

      <Panel title={t('regions.title')} icon="🗺️">
        {allRegions.map((region) => (
          <Toggle
            key={region}
            surface={false}
            testID={`region-${region}`}
            label={t(`regions.${region}` as 'regions.global', {
              defaultValue: region.toUpperCase(),
            })}
            value={regions.includes(region)}
            onChange={(on) => toggleRegion(region, on)}
          />
        ))}
        {lastRegionHint ? <Hint>{t('regions.needOne')}</Hint> : null}
      </Panel>

      <Panel title={t('settings.appearance')} icon="🎨">
        <OptionGroup
          testID="appearance"
          options={appearances}
          value={s.appearance}
          onChange={s.setAppearance}
        />
        {s.appearance === 'auto' ? (
          <Text variant="caption" tone="muted">
            {t('settings.appearanceAutoNote')}
          </Text>
        ) : null}
      </Panel>

      <Panel title={t('settings.feedback')} icon="🔊">
        <Toggle
          surface={false}
          testID="haptics"
          label={t('settings.haptics')}
          value={s.haptics}
          onChange={s.setHaptics}
        />
        <Toggle
          surface={false}
          testID="sound"
          label={t('settings.sound')}
          value={s.sound}
          onChange={s.setSound}
        />
      </Panel>

      <Panel title={t('settings.about')} icon="ℹ️">
        <Image
          source={scheme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel={t('publisher')}
        />
        <Text variant="label">{t('appName')}</Text>
        <Text variant="caption" tone="muted">
          {t('publisher')} · {t('settings.version', { version: Constants.expoConfig?.version })}
        </Text>
        <Text variant="body">{t('settings.privacy')}</Text>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Transparent artwork, so no frame: it sits directly on the panel in both themes.
  logo: { width: 190, height: 243, alignSelf: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
});
