import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { localized, type Pack } from '@/core/content';
import { clampPlayers, MAX_NAME_LENGTH, usePlayers } from '@/core/players';
import { useAge } from '@/core/age';
import { openPaywall, packProductId, usePackLocked, useTier } from '@/core/entitlements';
import { LEVELS, usePunishments, type PunishmentLevel } from '@/core/punishments';
import { useRemoteConfig } from '@/core/remoteConfig';
import { usePacks, useRegions } from '@/core/settings/content';
import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import {
  Avatar,
  BackHeader,
  Button,
  Chip,
  ConfirmInline,
  CustomizeSummary,
  Hint,
  HowToPlay,
  Panel,
  Pressable,
  Screen,
  SetupTabs,
  Stepper,
  Text,
  Toggle,
  type SetupTab,
} from '@/core/ui';

import { blendIn as module } from '..';
import { playable, RANDOM, type Difficulty, type GameLength, type Settings } from '../logic';
import { useBlendIn } from '../store';

const LEVEL_EMOJI: Record<PunishmentLevel, string> = {
  off: '🚫',
  light: '😅',
  medium: '😬',
  hard: '💪',
  public: '🤪',
  mix: '🎲',
};

function Options<T>({
  label,
  options,
  value,
  onChange,
  testID,
  same = (a, b) => a === b,
  locked = () => false,
  lockedLabel,
}: {
  label: string;
  options: { value: T; label: string; id: string }[];
  value: T;
  onChange(v: T): void;
  testID: string;
  same?: (a: T, b: T) => boolean;
  /** Premium-only options stay visible with a 🔒 and open the paywall. */
  locked?: (v: T) => boolean;
  lockedLabel?: string;
}) {
  return (
    <View style={styles.stack}>
      <Text variant="label">{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((o) => (
          <View key={o.id} style={styles.option}>
            <Chip
              compact
              testID={`${testID}-${o.id}`}
              title={o.label}
              selected={same(o.value, value)}
              locked={locked(o.value)}
              lockedLabel={lockedLabel}
              onPress={() =>
                locked(o.value) ? openPaywall('locked', { game: 'blendIn' }) : onChange(o.value)
              }
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Setup() {
  const { t, i18n } = useTranslation(['blendIn', 'common']);
  const { colors } = useTheme();
  const lang = i18n.language;
  const { count, names, setCount, setName } = usePlayers();
  const { settings, setSettings, start, game, quit } = useBlendIn();
  const punishments = usePunishments();
  const regions = useRegions();
  const packs = playable(usePacks('spy'), settings.mode);
  const isLocked = usePackLocked();
  const free = useTier() === 'free';
  const caps = useRemoteConfig().caps.blendIn;
  const { teenConfirmed, confirmTeen } = useAge();
  const unlocked = packs.filter((p) => !isLocked(p));
  const modeLocked = (m: string) => free && !caps.modes.includes(m);
  const escapeLocked = (d: string) => free && !caps.escape.includes(d);
  const [askTeenFor, setAskTeenFor] = useState<Pack | null>(null);
  const [tab, setTab] = useState<SetupTab>('play');

  // Free users play Classic at Normal difficulty (monetization §3).
  useEffect(() => {
    if (modeLocked(settings.mode)) setSettings({ mode: 'classic' });
    if (escapeLocked(settings.escape)) setSettings({ escape: 'normal' });
  });
  const [noPacksHint, setNoPacksHint] = useState(false);

  // The roster is shared (up to 16); Blend In plays with 3–12.
  useEffect(() => {
    if (count > module.maxPlayers) setCount(module.maxPlayers);
  }, [count, setCount]);

  const set = (patch: Partial<Settings>) => setSettings(patch);
  const randomSelected =
    settings.choice === RANDOM || !unlocked.some((p) => p.id === settings.choice);
  const groups = regions
    .map((region) => ({
      region,
      packs: packs.filter((p) => p.region === region && p.level !== 'teen'),
    }))
    .filter((g) => g.packs.length > 0);
  const teenPacks = packs.filter((p) => p.level === 'teen');
  const choosePack = (pack: Pack) => {
    if (isLocked(pack)) {
      return openPaywall('locked', { game: 'blendIn', item: packProductId(pack.id) });
    }
    if (pack.level === 'teen' && !teenConfirmed) return setAskTeenFor(pack);
    set({ choice: pack.id });
  };

  const begin = () => {
    if (free && count > caps.players) {
      return openPaywall('cap', { game: 'blendIn', max: module.maxPlayers });
    }
    if (unlocked.length === 0) {
      setTab('customize');
      return setNoPacksHint(true);
    }
    start(count, unlocked);
    router.push('/games/blend-in/play');
  };

  const chosen = packs.find((p) => p.id === settings.choice);
  const summary = [
    `${settings.mode === 'classic' ? '🦎' : '🕶️'} ${t('common:setupTabs.item', {
      label: t('setup.mode'),
      value: t(`setup.modes.${settings.mode}.name`),
    })}`,
    `🗂️ ${t('common:setupTabs.item', {
      label: t('setup.topic'),
      value: randomSelected || !chosen ? t('setup.random') : localized(chosen.name, lang),
    })}`,
    `${LEVEL_EMOJI[punishments.level]} ${t('common:setupTabs.item', {
      label: t('common:punishments.title'),
      value: t(`common:punishments.levels.${punishments.level}`),
    })}`,
  ];

  return (
    <Screen footer={<Button testID="start" icon="🦎" label={t('setup.start')} onPress={begin} />}>
      <BackHeader title={t('title')} image={module.icon} />
      <Text variant="body" tone="muted" align="center">
        {t('setup.lead')}
      </Text>

      <SetupTabs value={tab} onChange={setTab} />

      {tab === 'play' ? (
        <>
          {game && game.phase.t !== 'over' ? (
            <Panel title={t('setup.inProgress')} icon="⏯️" testID="in-progress">
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    size="md"
                    variant="secondary"
                    testID="resume"
                    label={t('setup.resume')}
                    onPress={() => router.push('/games/blend-in/play')}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    size="md"
                    variant="ghost"
                    testID="discard"
                    label={t('host.quit')}
                    onPress={quit}
                  />
                </View>
              </View>
            </Panel>
          ) : null}

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
            min={module.minPlayers}
            max={module.maxPlayers}
            onChange={(n) =>
              free && n > caps.players
                ? openPaywall('cap', { game: 'blendIn', max: module.maxPlayers })
                : setCount(clampPlayers(n, module.minPlayers, module.maxPlayers))
            }
            decreaseLabel={t('setup.fewerPlayers')}
            increaseLabel={t('setup.morePlayers')}
            minHint={t('setup.minPlayers')}
            maxHint={t('setup.maxPlayers')}
          />
          {count < 4 || count > 8 ? (
            <Text
              variant="caption"
              tone="muted"
              align="center"
              accessibilityLabel={t('setup.bestWith')}
            >
              {`💡 ${t('setup.bestWith')}`}
            </Text>
          ) : null}

          <CustomizeSummary lines={summary} onPress={() => setTab('customize')} />
        </>
      ) : (
        <>
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

          <Panel title={t('setup.mode')} icon="🎭">
            {(['classic', 'undercover'] as const).map((m) => (
              <Chip
                key={m}
                testID={`mode-${m}`}
                emoji={m === 'classic' ? '🦎' : '🕶️'}
                title={t(`setup.modes.${m}.name`)}
                subtitle={t(`setup.modes.${m}.sub`)}
                selected={settings.mode === m}
                locked={modeLocked(m)}
                lockedLabel={t('common:premium.lockedTag')}
                onPress={() =>
                  modeLocked(m) ? openPaywall('locked', { game: 'blendIn' }) : set({ mode: m })
                }
              />
            ))}
          </Panel>

          <Panel title={t('setup.topic')} icon="🗂️">
            <Pressable
              testID="topic-random"
              accessibilityRole="radio"
              accessibilityState={{ checked: randomSelected }}
              accessibilityLabel={`${t('setup.random')}, ${t('setup.randomSub')}`}
              onPress={() => set({ choice: RANDOM })}
            >
              <LinearGradient
                colors={
                  randomSelected
                    ? colors.secondaryGradient
                    : [colors.surfaceRaised, colors.surfaceRaised]
                }
                style={[
                  styles.random,
                  { borderColor: randomSelected ? colors.glow : colors.border },
                ]}
              >
                <Text style={styles.dice} accessible={false}>
                  🎲
                </Text>
                <View style={styles.flex}>
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
            {groups.map((g) => (
              <View key={g.region} style={styles.stack}>
                {groups.length > 1 ? (
                  <Text variant="caption" tone="muted">
                    {t(`common:regions.${g.region}` as 'common:regions.global', {
                      defaultValue: g.region,
                    })}
                  </Text>
                ) : null}
                <View style={styles.grid}>
                  {g.packs.map((p) => (
                    <View key={p.id} style={styles.cell}>
                      <Chip
                        testID={`topic-${p.id}`}
                        emoji={p.emoji}
                        title={localized(p.name, lang)}
                        subtitle={p.subtitle ? localized(p.subtitle, lang) : undefined}
                        selected={!randomSelected && settings.choice === p.id}
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
                testID={`topic-${p.id}`}
                emoji={p.emoji}
                title={`${localized(p.name, lang)} · ${t('common:teen.tag')}`}
                subtitle={p.subtitle ? localized(p.subtitle, lang) : undefined}
                selected={!randomSelected && settings.choice === p.id}
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
                  set({ choice: askTeenFor.id });
                  setAskTeenFor(null);
                }}
                onCancel={() => setAskTeenFor(null)}
              />
            ) : null}
            {packs.length === 0 || noPacksHint ? <Hint>{t('setup.noPacks')}</Hint> : null}
          </Panel>

          <Panel title={t('common:punishments.title')} icon="😈">
            <View style={styles.row} accessibilityRole="radiogroup">
              {LEVELS.map((level) => (
                <View key={level} style={styles.level}>
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
          </Panel>

          <Panel title={t('setup.options')} icon="⚙️" testID="options">
            <Options<GameLength>
              testID="length"
              label={t('setup.length')}
              value={settings.length}
              onChange={(length) => set({ length })}
              same={(a, b) =>
                a.t === b.t && (a.t === 'target' || (b.t === 'rounds' && a.n === b.n))
              }
              options={[
                ...([3, 5, 8] as const).map((n) => ({
                  id: `r${n}`,
                  value: { t: 'rounds' as const, n },
                  label: t('setup.rounds', { n }),
                })),
                { id: 'target', value: { t: 'target' as const }, label: t('setup.target') },
              ]}
            />
            <Options<1 | 2>
              testID="clue-rounds"
              label={t('setup.clueRounds')}
              value={settings.clueRounds}
              onChange={(clueRounds) => set({ clueRounds })}
              options={[1, 2].map((n) => ({ id: String(n), value: n as 1 | 2, label: `${n}×` }))}
            />
            <Options<Settings['clueTimer']>
              testID="timer"
              label={t('setup.clueTimer')}
              value={settings.clueTimer}
              onChange={(clueTimer) => set({ clueTimer })}
              options={([0, 10, 15, 20] as const).map((n) => ({
                id: String(n),
                value: n,
                label: n ? t('setup.seconds', { n }) : t('setup.off'),
              }))}
            />
            {settings.mode === 'classic' ? (
              <Options<Difficulty>
                testID="escape"
                label={t('setup.escape')}
                value={settings.escape}
                onChange={(escape) => set({ escape })}
                locked={escapeLocked}
                lockedLabel={t('common:premium.lockedTag')}
                options={(['easy', 'normal', 'hard'] as const).map((d) => ({
                  id: d,
                  value: d,
                  label: t(`setup.escapeLevels.${d}`),
                }))}
              />
            ) : null}
            <Toggle
              surface={false}
              testID="never-first"
              label={t('setup.neverFirst')}
              sublabel={t('setup.neverFirstSub')}
              value={settings.chameleonNeverFirst}
              onChange={(chameleonNeverFirst) => set({ chameleonNeverFirst })}
            />
          </Panel>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: { width: '23%', minWidth: 70, flexDirection: 'row' },
  level: { width: '31.5%', flexDirection: 'row' },
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
  nameInput: { flex: 1, minHeight: 48, fontSize: 16 },
  random: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.md,
  },
  dice: { fontSize: 40, lineHeight: 50 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '48.5%', flexDirection: 'row' },
});
