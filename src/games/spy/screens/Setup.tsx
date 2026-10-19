import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { localized, type Pack } from '@/core/content';
import { clampPlayers, MAX_NAME_LENGTH, usePlayers } from '@/core/players';
import { useAge } from '@/core/age';
import { openPaywall, usePackLocked, useTier } from '@/core/entitlements';
import { LEVELS, usePunishments, type PunishmentLevel } from '@/core/punishments';
import { useRemoteConfig } from '@/core/remoteConfig';
import { usePacks, useRegions } from '@/core/settings/content';
import { fitScores, useSession } from '@/core/session';
import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import {
  Avatar,
  BackHeader,
  Button,
  Chip,
  ConfirmInline,
  Hint,
  HowToPlay,
  Panel,
  Pressable,
  Scoreboard,
  Screen,
  Stepper,
  Text,
  Toggle,
} from '@/core/ui';

import { spy as spyGame } from '..';
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
  const tier = useTier();
  const isLocked = usePackLocked();
  const caps = useRemoteConfig().caps.spy;
  const free = tier === 'free';
  const { teenConfirmed, confirmTeen } = useAge();
  const playable = packs.filter((p) => !isLocked(p));
  const levelLocked = (l: PunishmentLevel) => free && !caps.punishmentLevels.includes(l);

  // Free users play Light punishments only (monetization §3).
  useEffect(() => {
    if (levelLocked(punishments.level)) punishments.setLevel('light');
  });

  const [confirmReset, setConfirmReset] = useState(false);
  const [noPacksHint, setNoPacksHint] = useState(false);

  // The shared roster goes up to 16 (Werewolf); Spy plays with at most 12.
  useEffect(() => {
    if (count > spyGame.maxPlayers) setCount(spyGame.maxPlayers);
  }, [count, setCount]);

  const spies = Math.min(clampSpies(spy.spies, count), free ? caps.spies : Infinity);
  const scores = fitScores(session.scores, count);
  const hasScores = scores.some((s) => s > 0);
  const choiceAvailable = playable.some((p) => p.id === spy.choice);
  const randomSelected = spy.choice === RANDOM || !choiceAvailable;

  const changePlayers = (n: number) => {
    if (free && n > caps.players)
      return openPaywall('cap', { game: 'spy', max: spyGame.maxPlayers });
    const next = clampPlayers(n, spyGame.minPlayers, spyGame.maxPlayers);
    setCount(next);
    if (spy.spies > maxSpies(next)) spy.setSpies(maxSpies(next));
  };

  const start = () => {
    if (free && count > caps.players)
      return openPaywall('cap', { game: 'spy', max: spyGame.maxPlayers });
    if (playable.length === 0) return setNoPacksHint(true);
    spy.start({ players: count, spies, packs: playable, no: session.startRound() });
    router.push('/games/spy/play');
  };

  // Teen packs are their own categories: never in random play, and the table confirms cheeky
  // words once per session before the first one is used.
  const teenPacks = packs.filter((p) => p.level === 'teen');
  const [askTeenFor, setAskTeenFor] = useState<Pack | null>(null);
  const choosePack = (pack: Pack) => {
    if (isLocked(pack)) return openPaywall('locked', { game: 'spy' });
    if (pack.level === 'teen' && !teenConfirmed) return setAskTeenFor(pack);
    spy.setChoice(pack.id);
  };

  const groups = regions
    .map((region) => ({
      region,
      packs: packs.filter((p) => p.region === region && p.level !== 'teen'),
    }))
    .filter((g) => g.packs.length > 0);

  return (
    <Screen
      footer={
        <Button
          testID="start"
          icon="🚀"
          label={t('setup.start', { n: session.round })}
          onPress={start}
        />
      }
    >
      <BackHeader title={t('title')} image={spyGame.icon} />
      <Text variant="body" tone="muted" align="center">
        {t('setup.lead')}
      </Text>

      <HowToPlay
        setup={t('howTo.setup', { returnObjects: true }) as string[]}
        play={t('howTo.play', { returnObjects: true }) as string[]}
      />

      <Stepper
        testID="players"
        icon="👥"
        label={t('setup.players')}
        sublabel={free ? t('common:premium.freeCap', { n: caps.players }) : undefined}
        value={count}
        min={spyGame.minPlayers}
        max={spyGame.maxPlayers}
        onChange={changePlayers}
        decreaseLabel={t('setup.fewerPlayers')}
        increaseLabel={t('setup.morePlayers')}
        minHint={t('setup.minPlayers')}
        maxHint={t('setup.maxPlayers')}
      />
      <Stepper
        testID="spies"
        icon="🕵️"
        label={t('setup.spies')}
        sublabel={t('setup.spiesSub')}
        value={spies}
        min={1}
        max={maxSpies(count)}
        onChange={(n) =>
          free && n > caps.spies ? openPaywall('locked', { game: 'spy' }) : spy.setSpies(n)
        }
        decreaseLabel={t('setup.fewerSpies')}
        increaseLabel={t('setup.moreSpies')}
        minHint={t('setup.minSpies')}
        maxHint={count < 7 ? t('setup.needMorePlayers') : t('setup.maxSpies')}
      />

      <Panel title={t('setup.names')} icon="✍️">
        <View style={styles.names}>
          {Array.from({ length: count }, (_, i) => {
            const value = names[i] ?? '';
            const placeholder = t('common:players.defaultName', { n: i + 1 });
            return (
              <View
                key={i}
                style={[
                  styles.nameCell,
                  { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                ]}
              >
                <Avatar player={i} size={32} />
                <TextInput
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
                      color: colors.text,
                      fontFamily: fontFamilyFor(value || placeholder, 'body', 'bold'),
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </Panel>

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
              size="md"
              icon="♻️"
              testID="reset-scores"
              label={t('common:scores.reset')}
              onPress={() => setConfirmReset(true)}
            />
          )}
        </Panel>
      ) : null}

      <Panel title={t('setup.categories')} icon="🗂️">
        <Pressable
          testID="cat-random"
          accessibilityRole="radio"
          accessibilityState={{ checked: randomSelected }}
          accessibilityLabel={`${t('setup.random')}, ${t('setup.randomSub')}`}
          onPress={() => spy.setChoice(RANDOM)}
          style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}
        >
          <LinearGradient
            colors={
              randomSelected
                ? colors.secondaryGradient
                : [colors.surfaceRaised, colors.surfaceRaised]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.random,
              {
                borderColor: randomSelected ? colors.glow : colors.border,
                borderStyle: randomSelected ? 'solid' : 'dashed',
              },
            ]}
          >
            <Text style={styles.dice} accessible={false}>
              🎲
            </Text>
            <View style={styles.randomText}>
              <Text
                variant="heading"
                style={{ color: randomSelected ? colors.onSecondary : colors.text }}
              >
                {randomSelected ? `✓ ${t('setup.random')}` : t('setup.random')}
              </Text>
              <Text
                variant="caption"
                style={{ color: randomSelected ? colors.onSecondary : colors.textMuted }}
              >
                {t('setup.randomSub')}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        <Text variant="label" tone="muted">
          {t('setup.orPick')}
        </Text>
        {groups.map((g) => (
          <View key={g.region} style={styles.group}>
            {groups.length > 1 ? (
              <Text variant="caption" tone="muted">
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
                    locked={isLocked(p)}
                    lockedLabel={t('common:premium.lockedTag')}
                    onPress={() => choosePack(p)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
        {teenPacks.map((p) => (
          <Chip
            key={p.id}
            testID={`cat-${p.id}`}
            emoji={p.emoji}
            title={`${localized(p.name, lang)} · ${t('common:teen.tag')}`}
            subtitle={p.subtitle ? localized(p.subtitle, lang) : undefined}
            selected={!randomSelected && spy.choice === p.id}
            warning
            locked={isLocked(p)}
            lockedLabel={t('common:premium.lockedTag')}
            onPress={() => choosePack(p)}
          />
        ))}
        {askTeenFor ? (
          <ConfirmInline
            testID="teen-confirm"
            question={t('common:teen.ask')}
            confirmLabel={t('common:teen.yes')}
            cancelLabel={t('common:actions.cancel')}
            onConfirm={() => {
              confirmTeen();
              spy.setChoice(askTeenFor.id);
              setAskTeenFor(null);
            }}
            onCancel={() => setAskTeenFor(null)}
          />
        ) : null}
        {packs.length === 0 || noPacksHint ? <Hint>{t('setup.noPacks')}</Hint> : null}
      </Panel>

      <Panel title={t('common:punishments.title')} icon="😈">
        <View style={styles.levels} accessibilityRole="radiogroup">
          {LEVELS.map((level) => (
            <View key={level} style={styles.levelCell}>
              <Chip
                compact
                testID={`level-${level}`}
                emoji={LEVEL_EMOJI[level]}
                title={t(`common:punishments.levels.${level}`)}
                selected={punishments.level === level}
                locked={levelLocked(level)}
                lockedLabel={t('common:premium.lockedTag')}
                onPress={() =>
                  levelLocked(level)
                    ? openPaywall('locked', { game: 'spy' })
                    : punishments.setLevel(level)
                }
              />
            </View>
          ))}
        </View>
      </Panel>

      <Toggle
        testID="spy-sees"
        label={t('setup.spySees')}
        sublabel={t('setup.spySeesSub')}
        value={spy.spySeesCategory}
        onChange={spy.setSpySeesCategory}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  nameCell: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.xs,
  },
  nameInput: { flex: 1, minHeight: 48, fontSize: 16, paddingHorizontal: space.xs },
  random: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.md,
  },
  dice: { fontSize: 40, lineHeight: 50 },
  randomText: { flex: 1 },
  group: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '48.5%', flexDirection: 'row' },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  levelCell: { width: '31.5%', flexDirection: 'row' },
});
