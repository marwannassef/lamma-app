import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { localized, type Pack } from '@/core/content';
import {
  clampPlayers,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  usePlayers,
} from '@/core/players';
import { LEVELS, usePunishments, type PunishmentLevel } from '@/core/punishments';
import { usePacks, useRegions } from '@/core/settings/content';
import { fitScores, useSession } from '@/core/session';
import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import {
  BackHeader,
  Button,
  Chip,
  ConfirmInline,
  Hint,
  Panel,
  Pressable,
  Scoreboard,
  Screen,
  Stepper,
  Text,
  Toggle,
} from '@/core/ui';

import { clampSpies, maxSpies, RANDOM } from '../logic';
import { useSpy } from '../store';

const LEVEL_EMOJI: Record<PunishmentLevel, string> = {
  off: '🚫',
  light: '😅',
  medium: '😬',
  hard: '💪',
  public: '🤪',
  mix: '🎲',
};

export default function Setup() {
  const { t, i18n } = useTranslation(['spy', 'common']);
  const { colors } = useTheme();
  const lang = i18n.language;

  const { count, names, setCount, setName } = usePlayers();
  const spy = useSpy();
  const session = useSession();
  const punishments = usePunishments();
  const packs = usePacks('spy');
  const regions = useRegions();

  const [confirmReset, setConfirmReset] = useState(false);
  const [noPacksHint, setNoPacksHint] = useState(false);

  const spies = clampSpies(spy.spies, count);
  const scores = fitScores(session.scores, count);
  const hasScores = scores.some((s) => s > 0);
  const choiceAvailable = packs.some((p) => p.id === spy.choice);
  const randomSelected = spy.choice === RANDOM || !choiceAvailable;

  const changePlayers = (n: number) => {
    const next = clampPlayers(n);
    setCount(next);
    if (spy.spies > maxSpies(next)) spy.setSpies(maxSpies(next));
  };

  const start = () => {
    if (packs.length === 0) return setNoPacksHint(true);
    spy.start({ players: count, spies, packs, no: session.startRound() });
    router.push('/games/spy/play');
  };

  // +18 packs are their own categories: never in random play, and only after confirming 18+.
  const adultPacks = packs.filter((p) => p.adult);
  const [askAdultFor, setAskAdultFor] = useState<Pack | null>(null);
  const chooseAdult = (pack: Pack) => {
    if (spy.choice === pack.id) return;
    setAskAdultFor(pack);
  };

  const groups = regions
    .map((region) => ({
      region,
      packs: packs.filter((p) => p.region === region && !p.adult),
    }))
    .filter((g) => g.packs.length > 0);

  return (
    <Screen>
      <BackHeader title={t('title')} />
      <Text variant="body" tone="muted" align="center">
        {t('setup.lead')}
      </Text>

      <Stepper
        testID="players"
        label={t('setup.players')}
        value={count}
        min={MIN_PLAYERS}
        max={MAX_PLAYERS}
        onChange={changePlayers}
        decreaseLabel={t('setup.fewerPlayers')}
        increaseLabel={t('setup.morePlayers')}
        minHint={t('setup.minPlayers')}
        maxHint={t('setup.maxPlayers')}
      />
      <Stepper
        testID="spies"
        label={t('setup.spies')}
        sublabel={t('setup.spiesSub')}
        value={spies}
        min={1}
        max={maxSpies(count)}
        onChange={spy.setSpies}
        decreaseLabel={t('setup.fewerSpies')}
        increaseLabel={t('setup.moreSpies')}
        minHint={t('setup.minSpies')}
        maxHint={count < 7 ? t('setup.needMorePlayers') : t('setup.maxSpies')}
      />

      <Text variant="heading">{t('setup.names')}</Text>
      <View style={styles.names}>
        {Array.from({ length: count }, (_, i) => {
          const value = names[i] ?? '';
          const placeholder = t('common:players.defaultName', { n: i + 1 });
          return (
            <TextInput
              key={i}
              testID={`name-${i}`}
              value={value}
              onChangeText={(v) => setName(i, v)}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_NAME_LENGTH}
              accessibilityLabel={t('setup.nameLabel', { n: i + 1 })}
              autoCorrect={false}
              returnKeyType="done"
              maxFontSizeMultiplier={2}
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  color: colors.text,
                  fontFamily: fontFamilyFor(value || placeholder, 'body', 'bold'),
                },
              ]}
            />
          );
        })}
      </View>

      {hasScores ? (
        <Panel title={t('common:scores.title')}>
          <Scoreboard scores={scores} testID="setup-scores" />
          {confirmReset ? (
            <ConfirmInline
              testID="reset-confirm"
              question={t('common:scores.resetConfirm')}
              confirmLabel={t('common:scores.resetYes')}
              cancelLabel={t('common:actions.cancel')}
              onConfirm={() => {
                session.reset();
                setConfirmReset(false);
              }}
              onCancel={() => setConfirmReset(false)}
            />
          ) : (
            <Button
              variant="ghost"
              testID="reset-scores"
              label={t('common:scores.reset')}
              onPress={() => setConfirmReset(true)}
            />
          )}
        </Panel>
      ) : null}

      <Pressable
        testID="cat-random"
        accessibilityRole="radio"
        accessibilityState={{ checked: randomSelected }}
        accessibilityLabel={`${t('setup.random')}, ${t('setup.randomSub')}`}
        onPress={() => spy.setChoice(RANDOM)}
        style={[
          styles.random,
          {
            borderColor: colors.secondary,
            borderStyle: randomSelected ? 'solid' : 'dashed',
            backgroundColor: randomSelected ? colors.secondary : 'transparent',
          },
        ]}
      >
        <Text
          variant="heading"
          align="center"
          style={{ color: randomSelected ? colors.onSecondary : colors.secondary }}
        >
          {randomSelected ? `✓ ${t('setup.random')}` : t('setup.random')}
        </Text>
        <Text
          variant="caption"
          align="center"
          style={{ color: randomSelected ? colors.onSecondary : colors.textMuted }}
        >
          {t('setup.randomSub')}
        </Text>
      </Pressable>

      <Text variant="heading">{t('setup.orPick')}</Text>
      {groups.map((g) => (
        <View key={g.region} style={styles.group}>
          {groups.length > 1 ? (
            <Text variant="label" tone="muted">
              {t(`common:regions.${g.region}` as 'common:regions.global', {
                defaultValue: g.region.toUpperCase(),
              })}
            </Text>
          ) : null}
          <View style={styles.grid} accessibilityRole="radiogroup">
            {g.packs.map((p) => (
              <View key={p.id} style={styles.cell}>
                <Chip
                  testID={`cat-${p.id}`}
                  emoji={p.emoji}
                  title={localized(p.name, lang)}
                  subtitle={p.subtitle ? localized(p.subtitle, lang) : undefined}
                  selected={!randomSelected && spy.choice === p.id}
                  onPress={() => spy.setChoice(p.id)}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      {adultPacks.map((p) => (
        <Chip
          key={p.id}
          testID={`cat-${p.id}`}
          emoji={p.emoji}
          title={localized(p.name, lang)}
          subtitle={p.subtitle ? localized(p.subtitle, lang) : undefined}
          selected={!randomSelected && spy.choice === p.id}
          warning
          onPress={() => chooseAdult(p)}
        />
      ))}
      {askAdultFor ? (
        <ConfirmInline
          testID="adult-confirm"
          question={t('common:adult.ask')}
          confirmLabel={t('common:adult.yes')}
          cancelLabel={t('common:actions.cancel')}
          onConfirm={() => {
            spy.setChoice(askAdultFor.id);
            setAskAdultFor(null);
          }}
          onCancel={() => setAskAdultFor(null)}
        />
      ) : null}
      {packs.length === 0 || noPacksHint ? <Hint>{t('setup.noPacks')}</Hint> : null}

      <Text variant="heading">{t('common:punishments.title')}</Text>
      <View style={styles.levels} accessibilityRole="radiogroup">
        {LEVELS.map((level) => (
          <View key={level} style={styles.levelCell}>
            <Chip
              compact
              testID={`level-${level}`}
              emoji={LEVEL_EMOJI[level]}
              title={t(`common:punishments.levels.${level}`)}
              selected={punishments.level === level}
              onPress={() => punishments.setLevel(level)}
            />
          </View>
        ))}
      </View>

      <Toggle
        testID="spy-sees"
        label={t('setup.spySees')}
        sublabel={t('setup.spySeesSub')}
        value={spy.spySeesCategory}
        onChange={spy.setSpySeesCategory}
      />

      <Button testID="start" label={t('setup.start', { n: session.round })} onPress={start} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  nameInput: {
    width: '48.5%',
    minHeight: 48,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  random: {
    borderWidth: 3,
    borderRadius: radius.lg,
    padding: space.md,
    alignItems: 'center',
  },
  group: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '48.5%' },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  levelCell: { width: '31.5%' },
});
