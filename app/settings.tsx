import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { ADULT_ENABLED } from '@/core/config';
import { allRegions } from '@/core/content';
import { localeMeta, supportedLanguages, switchLanguage } from '@/core/i18n';
import { useRegions } from '@/core/settings/content';
import { useSettings, type Appearance, type LanguagePref } from '@/core/settings/store';
import { radius, space, useTheme } from '@/core/theme';
import { BackHeader, ConfirmInline, Hint, Panel, Pressable, Screen, Text, Toggle } from '@/core/ui';

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
  ];

  const regions = useRegions();
  const [lastRegionHint, setLastRegionHint] = useState(false);
  const [askAdult, setAskAdult] = useState(false);

  const toggleRegion = (region: string, on: boolean) => {
    const next = on ? [...regions, region] : regions.filter((r) => r !== region);
    if (next.length === 0) return setLastRegionHint(true);
    setLastRegionHint(false);
    s.setRegions(allRegions.filter((r) => next.includes(r)));
  };

  return (
    <Screen>
      <BackHeader title={t('settings.title')} />

      <Panel>
        <Text variant="heading">{t('settings.language')}</Text>
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

      <Panel>
        <Text variant="heading">{t('regions.title')}</Text>
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
        {ADULT_ENABLED ? (
          <>
            <Toggle
              surface={false}
              testID="adult"
              label={t('adult.label')}
              sublabel={t('adult.hint')}
              value={s.adultMode}
              onChange={(on) => (on ? setAskAdult(true) : s.setAdultMode(false))}
            />
            {askAdult ? (
              <ConfirmInline
                question={t('adult.ask')}
                confirmLabel={t('adult.yes')}
                cancelLabel={t('actions.cancel')}
                onConfirm={() => {
                  s.setAdultMode(true);
                  setAskAdult(false);
                }}
                onCancel={() => setAskAdult(false)}
              />
            ) : null}
          </>
        ) : null}
      </Panel>

      <Panel>
        <Text variant="heading">{t('settings.appearance')}</Text>
        <OptionGroup
          testID="appearance"
          options={appearances}
          value={s.appearance}
          onChange={s.setAppearance}
        />
      </Panel>

      <Panel>
        <Text variant="heading">{t('settings.feedback')}</Text>
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

      <Panel>
        <Text variant="heading">{t('settings.about')}</Text>
        <Image
          source={require('@/assets/images/publisher-logo.jpg')}
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
  logo: { width: '100%', height: 180, borderRadius: radius.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
});
