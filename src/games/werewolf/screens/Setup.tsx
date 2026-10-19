import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { clampPlayers, MAX_NAME_LENGTH, usePlayerName, usePlayers } from '@/core/players';
import { openPaywall, useTier } from '@/core/entitlements';
import { useRemoteConfig } from '@/core/remoteConfig';
import { mathRng } from '@/core/rng';
import { useSettings } from '@/core/settings/store';
import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import {
  Avatar,
  BackHeader,
  Badge,
  Button,
  Chip,
  ConfirmInline,
  Hint,
  HowToPlay,
  Panel,
  Pressable,
  Screen,
  Stepper,
  Text,
  Toggle,
} from '@/core/ui';

import { werewolf as module } from '..';
import { TEAM_COLOR } from '../components/meta';
import { RoleIcon } from '../components/RoleIcon';
import {
  ALL_ROLES,
  balance,
  dealRoles,
  DEFAULT_RULES,
  estimatedMinutes,
  fillVillagers,
  maxRounds,
  newGame,
  preselect,
  recommendedSetups,
  ROLES,
  surpriseMe,
  TIERS,
  total,
  tryNextTier,
  validateSetup,
  type HouseRules,
  type RoleCounts,
  type Tier,
} from '../engine';
import { useWerewolf, type SavedSetup, type SetupChoice } from '../store';

/** Every role ships, core and expansion (W5). */
const AVAILABLE = ALL_ROLES;
/** Surprise me is offered from this many players (§5.4). */
const SURPRISE_FROM = 7;
const COMPLEXITY: Record<Tier, number> = { basic: 1, gentle: 1, classic: 2, party: 3, chaos: 3 };

function RoleChips({ roles }: { roles: RoleCounts }) {
  const { t } = useTranslation('werewolf');
  return (
    <View style={styles.chips}>
      {ALL_ROLES.filter((r) => roles[r]).map((r) => (
        <View
          key={r}
          style={[styles.roleChip, { borderColor: TEAM_COLOR[ROLES[r].team] }]}
          accessible
          accessibilityLabel={`${roles[r]} × ${t(`roles.${r}.name`)}`}
        >
          <RoleIcon role={r} size={22} />
          <Text variant="caption">{`${roles[r]}× ${t(`roles.${r}.name`)}`}</Text>
        </View>
      ))}
    </View>
  );
}

/** Balance meter from −10 (wolves) to +10 (village) with its label (§5.3). */
function BalanceMeter({ roles }: { roles: RoleCounts }) {
  const { t } = useTranslation('werewolf');
  const { colors } = useTheme();
  const b = balance(roles);
  const pos = Math.max(0, Math.min(1, (b.score + 10) / 20));
  return (
    <View
      style={styles.meterWrap}
      accessible
      accessibilityLabel={`${t(`setup.balance.${b.label}`)} (${b.score > 0 ? '+' : ''}${b.score})`}
    >
      <View style={[styles.meter, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[styles.meterHalf, { backgroundColor: TEAM_COLOR.wolves }]} />
        <View style={[styles.meterHalf, { backgroundColor: TEAM_COLOR.village }]} />
        <View style={[styles.marker, { start: `${pos * 100}%`, borderColor: colors.text }]} />
      </View>
      <Text variant="caption" tone="muted">
        {`${t(`setup.balance.${b.label}`)} · ${b.score > 0 ? '+' : ''}${b.score}`}
      </Text>
    </View>
  );
}

function SetupCard({
  tier,
  roles,
  selected,
  nudge,
  onPick,
  onEdit,
  discussion,
  locked,
}: {
  tier: Tier;
  roles: RoleCounts;
  selected: boolean;
  nudge: boolean;
  onPick(): void;
  onEdit(): void;
  discussion: number | null;
  /** Premium-only setup: visible with a 🔒; every button opens the paywall. */
  locked: boolean;
}) {
  const { t } = useTranslation(['werewolf', 'common']);
  const { colors } = useTheme();
  const pick = locked ? () => openPaywall('locked', { game: 'werewolf' }) : onPick;
  const editOrPay = locked ? () => openPaywall('locked', { game: 'werewolf' }) : onEdit;
  return (
    <Pressable
      testID={`setup-${tier}`}
      haptic={false}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[
        t(`setup.tiers.${tier}.name`),
        t(`setup.tiers.${tier}.pitch`),
        locked && t('common:premium.lockedTag'),
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={pick}
      style={[
        styles.setupCard,
        {
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
          borderColor: selected ? colors.secondary : colors.border,
        },
      ]}
    >
      <View style={styles.cardHead}>
        <Text variant="heading" style={styles.flex}>
          {selected ? `✓ ${t(`setup.tiers.${tier}.name`)}` : t(`setup.tiers.${tier}.name`)}
        </Text>
        {locked ? <Badge tone="gold" icon="🔒" label={t('common:premium.lockedTag')} /> : null}
        {nudge && !locked ? <Badge tone="primary" label={t('setup.tryNext')} /> : null}
        <Text variant="caption" tone="muted" accessible={false}>
          {'●'.repeat(COMPLEXITY[tier]) + '○'.repeat(3 - COMPLEXITY[tier])}
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {t(`setup.tiers.${tier}.pitch`)}
      </Text>
      <RoleChips roles={roles} />
      <BalanceMeter roles={roles} />
      <Text variant="caption" tone="muted">
        {t('setup.length', {
          rounds: maxRounds(roles),
          minutes: Math.round(estimatedMinutes(roles, discussion)),
        })}
      </Text>
      <View style={styles.cardButtons}>
        <View style={styles.flex}>
          <Button
            size="md"
            variant={selected ? 'secondary' : 'ghost'}
            label={selected ? t('setup.selected') : t('setup.playThis')}
            onPress={pick}
          />
        </View>
        <View style={styles.flex}>
          <Button size="md" variant="ghost" icon="✏️" label={t('setup.edit')} onPress={editOrPay} />
        </View>
      </View>
    </Pressable>
  );
}

function CustomEditor({
  roles,
  players,
  onChange,
}: {
  roles: RoleCounts;
  players: number;
  onChange(roles: RoleCounts): void;
}) {
  const { t } = useTranslation('werewolf');
  const filled = fillVillagers(roles, players);
  const teams = ['wolves', 'village', 'neutral'] as const;
  return (
    <View style={styles.stack}>
      {teams.map((team) => (
        <View key={team} style={styles.stack}>
          <Text variant="label" style={{ color: TEAM_COLOR[team] }}>
            {t(`teams.${team}`)}
          </Text>
          {AVAILABLE.filter((r) => r !== 'villager' && ROLES[r].team === team).map((r) => (
            <Stepper
              key={r}
              testID={`custom-${r}`}
              icon={<RoleIcon role={r} size={36} />}
              label={t(`roles.${r}.name`)}
              value={roles[r] ?? 0}
              min={0}
              max={ROLES[r].maxPerGame}
              onChange={(n) => onChange({ ...roles, [r]: n })}
              decreaseLabel={`− ${t(`roles.${r}.name`)}`}
              increaseLabel={`+ ${t(`roles.${r}.name`)}`}
              minHint=" "
              maxHint={t('setup.errors.tooManyOfRole')}
            />
          ))}
        </View>
      ))}
      <View style={styles.cardHead}>
        <RoleIcon role="villager" size={28} />
        <Text variant="label" tone="muted">
          {t('setup.villagersFill', { n: filled.villager ?? 0 })}
        </Text>
      </View>
      <BalanceMeter roles={filled} />
    </View>
  );
}

function Options<T extends string | number | null>({
  options,
  value,
  onChange,
  label,
  testID,
  locked = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
  label: string;
  testID: string;
  /** House rules are Premium: other choices show a 🔒 and open the paywall. */
  locked?: boolean;
}) {
  return (
    <View style={styles.stack}>
      <Text variant="label">{label}</Text>
      <View style={styles.optionRow} accessibilityRole="radiogroup">
        {options.map((o) => (
          <View key={String(o.value)} style={styles.option}>
            <Chip
              compact
              testID={`${testID}-${String(o.value)}`}
              title={o.label}
              selected={o.value === value}
              locked={locked && o.value !== value}
              onPress={() => onChange(o.value)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A setup card's frame: a radio that highlights when chosen. */
function CardFrame({
  testID,
  label,
  selected,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  selected: boolean;
  onPress(): void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      haptic={false}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.setupCard,
        {
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
          borderColor: selected ? colors.secondary : colors.border,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** "🎲 Surprise me" (§5.4): a random balanced setup, rerolled on demand. */
function SurpriseCard({
  roles,
  locked,
  onRoll,
}: {
  /** The rolled setup while this card is chosen. */
  roles: RoleCounts | null;
  locked: boolean;
  onRoll(): void;
}) {
  const { t } = useTranslation(['werewolf', 'common']);
  const roll = locked ? () => openPaywall('locked', { game: 'werewolf' }) : onRoll;
  return (
    <CardFrame
      testID="setup-surprise"
      label={`${t('setup.surprise')}, ${t('setup.surprisePitch')}`}
      selected={roles != null}
      onPress={() => (roles ? undefined : roll())}
    >
      <View style={styles.cardHead}>
        <Text variant="heading" style={styles.flex}>
          {roles ? `✓ 🎲 ${t('setup.surprise')}` : `🎲 ${t('setup.surprise')}`}
        </Text>
        {locked ? <Badge tone="gold" icon="🔒" label={t('common:premium.lockedTag')} /> : null}
      </View>
      <Text variant="caption" tone="muted">
        {t('setup.surprisePitch')}
      </Text>
      {roles ? (
        <>
          <RoleChips roles={roles} />
          <BalanceMeter roles={roles} />
          <Button
            size="md"
            variant="ghost"
            icon="🔀"
            testID="surprise-reroll"
            label={t('setup.reroll')}
            onPress={roll}
          />
        </>
      ) : null}
    </CardFrame>
  );
}

/** A setup the group saved from Custom (§5.6). Deleting asks inline first. */
function SavedCard({
  setup,
  selected,
  onPick,
  onDelete,
}: {
  setup: SavedSetup;
  selected: boolean;
  onPick(): void;
  onDelete(): void;
}) {
  const { t } = useTranslation(['werewolf', 'common']);
  const [ask, setAsk] = useState(false);
  return (
    <CardFrame
      testID={`saved-${setup.id}`}
      label={`${setup.name}, ${t('setup.savedTag')}`}
      selected={selected}
      onPress={onPick}
    >
      <View style={styles.cardHead}>
        <Text variant="heading" style={styles.flex}>
          {selected ? `✓ ⭐ ${setup.name}` : `⭐ ${setup.name}`}
        </Text>
        <Badge tone="primary" label={t('setup.savedTag')} />
      </View>
      <RoleChips roles={setup.roles} />
      <BalanceMeter roles={setup.roles} />
      {ask ? (
        <ConfirmInline
          testID={`saved-delete-confirm-${setup.id}`}
          question={t('setup.deleteConfirm', { name: setup.name })}
          confirmLabel={t('setup.delete')}
          cancelLabel={t('common:actions.cancel')}
          onConfirm={onDelete}
          onCancel={() => setAsk(false)}
        />
      ) : (
        <View style={styles.cardButtons}>
          <View style={styles.flex}>
            <Button
              size="md"
              variant={selected ? 'secondary' : 'ghost'}
              label={selected ? t('setup.selected') : t('setup.playThis')}
              onPress={onPick}
            />
          </View>
          <View style={styles.flex}>
            <Button
              size="md"
              variant="ghost"
              icon="🗑️"
              testID={`saved-delete-${setup.id}`}
              label={t('setup.delete')}
              onPress={() => setAsk(true)}
            />
          </View>
        </View>
      )}
    </CardFrame>
  );
}

/** Names and saves the custom setup being edited. */
function SaveCustom({ onSave }: { onSave(name: string): void }) {
  const { t } = useTranslation('werewolf');
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <View style={styles.stack}>
      <View style={styles.cardButtons}>
        <TextInput
          testID="save-name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSaved(false);
          }}
          placeholder={t('setup.saveName')}
          placeholderTextColor={colors.textMuted}
          maxLength={24}
          accessibilityLabel={t('setup.saveName')}
          maxFontSizeMultiplier={2}
          style={[
            styles.seat,
            styles.flex,
            {
              color: colors.text,
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              fontFamily: fontFamilyFor(name || t('setup.saveName'), 'body', 'bold'),
            },
          ]}
        />
        <Button
          size="md"
          variant="secondary"
          icon="⭐"
          testID="save-setup"
          label={t('setup.save')}
          onPress={() => {
            onSave(name.trim() || t('setup.saveName'));
            setName('');
            setSaved(true);
          }}
        />
      </View>
      {saved ? (
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {t('setup.savedDone')}
        </Text>
      ) : null}
    </View>
  );
}

export default function Setup() {
  const { t } = useTranslation(['werewolf', 'common']);
  const { colors } = useTheme();
  const { count, names, setCount, setName, move } = usePlayers();
  const nameOf = usePlayerName();
  const store = useWerewolf();
  const narration = useSettings((st) => st.narration);
  const setNarration = useSettings((st) => st.setNarration);
  const free = useTier() === 'free';
  const caps = useRemoteConfig().caps.werewolf;
  const tierLocked = (tier: Tier) => free && !caps.setupTiers.includes(tier);
  // Free games use the default house rules (monetization §3: "all house rules" is Premium).
  const rules = free ? DEFAULT_RULES : store.rules;

  // The roster is shared with Spy (3+); Werewolf needs 4–16.
  useEffect(() => {
    if (count < module.minPlayers) setCount(module.minPlayers);
  }, [count, setCount]);

  const cards = useMemo(() => recommendedSetups(count, AVAILABLE), [count]);
  const nudge = tryNextTier(store.recentTiers, cards);
  const [choice, setChoice] = useState<SetupChoice | null>(null);
  const preselected = preselect(
    cards.filter((c) => !tierLocked(c.tier)),
    { lastTier: store.lastTierByCount[count] ?? null },
  );
  // Keep the chosen tier across player-count changes when it still exists (§5.4).
  const saved = store.savedSetups.filter((x) => x.players === count);
  const current: SetupChoice =
    choice?.kind === 'custom'
      ? choice
      : choice?.kind === 'surprise' && total(choice.roles) === count && !free
        ? choice
        : choice?.kind === 'saved' && saved.some((x) => x.id === choice.id)
          ? choice
          : choice?.kind === 'curated' &&
              cards.some((c) => c.tier === choice.tier) &&
              !tierLocked(choice.tier)
            ? choice
            : { kind: 'curated', tier: preselected?.tier ?? 'basic' };
  const roles: RoleCounts =
    current.kind === 'custom'
      ? fillVillagers(current.roles, count)
      : current.kind === 'surprise'
        ? current.roles
        : current.kind === 'saved'
          ? (saved.find((x) => x.id === current.id)?.roles ?? {})
          : (cards.find((c) => c.tier === current.tier)?.roles ?? {});
  const check = validateSetup(roles, count);
  const [showErrors, setShowErrors] = useState(false);

  const edit = (from: RoleCounts) => {
    const custom = { ...from, villager: 0 };
    store.setCustomRoles(custom);
    setChoice({ kind: 'custom', roles: custom });
  };

  const start = () => {
    if (free && count > caps.players) {
      return openPaywall('cap', { game: 'werewolf', max: module.maxPlayers });
    }
    if (check.errors.length > 0) return setShowErrors(true);
    const dealt = dealRoles(roles, count, mathRng);
    store.start(newGame(dealt, rules), current.kind === 'curated' ? current.tier : null);
    router.push('/games/werewolf/play');
  };

  // Surprise me draws from the chosen tier's roles (Classic at least), Party when nothing fits.
  const rollSurprise = () => {
    const tier: Tier =
      current.kind === 'curated' && TIERS.indexOf(current.tier) >= TIERS.indexOf('classic')
        ? current.tier
        : 'party';
    const rolled = surpriseMe(count, tier, mathRng, AVAILABLE);
    setChoice(rolled ? { kind: 'surprise', roles: rolled } : { kind: 'curated', tier: 'party' });
  };

  const setRules = (patch: Partial<HouseRules>) =>
    free ? openPaywall('locked', { game: 'werewolf' }) : store.setRules(patch);

  return (
    <Screen
      footer={<Button testID="start-game" icon="🌙" label={t('setup.start')} onPress={start} />}
    >
      <BackHeader title={t('title')} image={module.icon} />
      <Text variant="body" tone="muted" align="center">
        {t('setup.lead')}
      </Text>

      <HowToPlay
        setup={t('howTo.setup', { returnObjects: true }) as string[]}
        play={t('howTo.play', { returnObjects: true }) as string[]}
      />

      {store.game && store.game.phase.t !== 'gameOver' ? (
        <Panel title={t('setup.inProgress')} icon="⏯️" testID="in-progress">
          <View style={styles.cardButtons}>
            <View style={styles.flex}>
              <Button
                size="md"
                variant="secondary"
                testID="resume"
                label={t('setup.resume')}
                onPress={() => router.push('/games/werewolf/play')}
              />
            </View>
            <View style={styles.flex}>
              <Button
                size="md"
                variant="ghost"
                testID="discard"
                label={t('setup.discard')}
                onPress={store.quit}
              />
            </View>
          </View>
        </Panel>
      ) : null}

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
            ? openPaywall('cap', { game: 'werewolf', max: module.maxPlayers })
            : setCount(clampPlayers(n, module.minPlayers, module.maxPlayers))
        }
        decreaseLabel={t('setup.fewerPlayers')}
        increaseLabel={t('setup.morePlayers')}
        minHint={t('setup.minPlayers')}
        maxHint={t('setup.maxPlayers')}
      />

      <Panel title={t('setup.seating')} icon="🪑">
        <Text variant="caption" tone="muted">
          {t('setup.seatingHint')}
        </Text>
        {Array.from({ length: count }, (_, i) => {
          const value = names[i] ?? '';
          const placeholder = t('common:players.defaultName', { n: i + 1 });
          return (
            <View
              key={i}
              style={[
                styles.seat,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <Text variant="label" tone="muted" style={styles.seatNo}>
                {String(i + 1)}
              </Text>
              <Avatar player={i} size={32} />
              <TextInput
                testID={`seat-${i}`}
                value={value}
                onChangeText={(v) => setName(i, v)}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_NAME_LENGTH}
                accessibilityLabel={t('setup.nameLabel', { n: i + 1 })}
                autoCorrect={false}
                maxFontSizeMultiplier={2}
                style={[
                  styles.seatInput,
                  {
                    color: colors.text,
                    fontFamily: fontFamilyFor(value || placeholder, 'body', 'bold'),
                  },
                ]}
              />
              <Pressable
                accessibilityLabel={t('setup.moveUp', { name: nameOf(i) })}
                onPress={() => move(i, i - 1)}
                style={[styles.move, { opacity: i === 0 ? 0.3 : 1 }]}
              >
                <Text variant="heading" tone="secondary">
                  ▲
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('setup.moveDown', { name: nameOf(i) })}
                onPress={() => move(i, i + 1)}
                style={[styles.move, { opacity: i === count - 1 ? 0.3 : 1 }]}
              >
                <Text variant="heading" tone="secondary">
                  ▼
                </Text>
              </Pressable>
            </View>
          );
        })}
      </Panel>

      <Text variant="heading">{`🃏 ${t('setup.setups')}`}</Text>
      {cards.map((c) => (
        <SetupCard
          key={c.tier}
          tier={c.tier}
          roles={c.roles}
          selected={current.kind === 'curated' && current.tier === c.tier}
          nudge={nudge === c.tier}
          onPick={() => setChoice({ kind: 'curated', tier: c.tier })}
          onEdit={() => edit(c.roles)}
          discussion={rules.discussionSeconds}
          locked={tierLocked(c.tier)}
        />
      ))}

      {saved.map((x) => (
        <SavedCard
          key={x.id}
          setup={x}
          selected={current.kind === 'saved' && current.id === x.id}
          onPick={() => setChoice({ kind: 'saved', id: x.id })}
          onDelete={() => store.deleteSetup(x.id)}
        />
      ))}

      {count >= SURPRISE_FROM ? (
        <SurpriseCard
          roles={current.kind === 'surprise' ? current.roles : null}
          locked={free}
          onRoll={rollSurprise}
        />
      ) : null}

      <Pressable
        testID="setup-custom"
        haptic={false}
        accessibilityRole="radio"
        accessibilityState={{ checked: current.kind === 'custom' }}
        onPress={() =>
          free
            ? openPaywall('locked', { game: 'werewolf' })
            : current.kind !== 'custom' &&
              edit(store.customRoles ?? cards[0]?.roles ?? { werewolf: 1, seer: 1 })
        }
        style={[
          styles.setupCard,
          {
            backgroundColor: current.kind === 'custom' ? colors.surfaceRaised : colors.surface,
            borderColor: current.kind === 'custom' ? colors.secondary : colors.border,
          },
        ]}
      >
        <Text variant="heading">
          {free
            ? `🔒 ✏️ ${t('setup.custom')}`
            : current.kind === 'custom'
              ? `✓ ✏️ ${t('setup.custom')}`
              : `✏️ ${t('setup.custom')}`}
        </Text>
        <Text variant="caption" tone="muted">
          {t('setup.customPitch')}
        </Text>
        {current.kind === 'custom' ? (
          <CustomEditor
            roles={current.roles}
            players={count}
            onChange={(r) => {
              store.setCustomRoles(r);
              setChoice({ kind: 'custom', roles: r });
            }}
          />
        ) : null}
        {current.kind === 'custom' && check.errors.length === 0 ? (
          <SaveCustom
            onSave={(name) => {
              const id = store.saveSetup(name, count, roles);
              setChoice({ kind: 'saved', id });
            }}
          />
        ) : null}
      </Pressable>

      {(showErrors || current.kind === 'custom') && check.errors.length > 0
        ? check.errors.map((e) => <Hint key={e}>{t(`setup.errors.${e}`)}</Hint>)
        : null}
      {current.kind === 'custom'
        ? check.warnings.map((w) => (
            <Text key={w} variant="caption" tone="muted" align="center">
              {`⚠️ ${t(`setup.warnings.${w}`)}`}
            </Text>
          ))
        : null}

      <Panel title={t('setup.sound')} icon="🔊">
        <Toggle
          surface={false}
          testID="narrator"
          label={t('setup.narrator')}
          sublabel={t('setup.narratorSub')}
          value={narration}
          onChange={setNarration}
        />
        <Options
          testID="ambience"
          label={t('setup.ambience')}
          value={rules.ambienceVolume}
          onChange={(v) => store.setRules({ ambienceVolume: v })}
          options={[0, 0.4, 0.7, 1].map((v) => ({
            value: v,
            label: v === 0 ? t('setup.ambienceOff') : `${Math.round(v * 100)}%`,
          }))}
        />
      </Panel>

      <Panel title={t('setup.rules')} icon="📜">
        <Options
          testID="discussion"
          locked={free}
          label={t('setup.discussion')}
          value={rules.discussionSeconds}
          onChange={(v) => setRules({ discussionSeconds: v })}
          options={[
            { value: 60 as const, label: t('setup.seconds', { n: 60 }) },
            { value: 120 as const, label: t('setup.seconds', { n: 120 }) },
            { value: 180 as const, label: t('setup.seconds', { n: 180 }) },
            { value: null, label: t('setup.untimed') },
          ]}
        />
        <Options
          testID="glance"
          locked={free}
          label={t('setup.glance')}
          value={rules.glanceSeconds}
          onChange={(v) => setRules({ glanceSeconds: v })}
          options={[8, 10, 12, 15].map((n) => ({ value: n, label: t('setup.seconds', { n }) }))}
        />
        <Options
          testID="min-turn"
          locked={free}
          label={t('setup.minTurn')}
          value={rules.minTurnSeconds}
          onChange={(v) => setRules({ minTurnSeconds: v })}
          options={[3, 4.5, 6, 8].map((n) => ({ value: n, label: t('setup.seconds', { n }) }))}
        />
        <Options
          testID="doctor-self"
          locked={free}
          label={t('setup.doctorSelf')}
          value={rules.doctorSelfProtect}
          onChange={(v) => setRules({ doctorSelfProtect: v })}
          options={(['never', 'night1', 'always'] as const).map((v) => ({
            value: v,
            label: t(`setup.doctorSelfOptions.${v}`),
          }))}
        />
        <Options
          testID="mayor"
          locked={free}
          label={t('setup.mayor')}
          value={rules.mayor === 'elected' ? 'elected' : 'off'}
          onChange={(v) => setRules({ mayor: v })}
          options={(['off', 'elected'] as const).map((v) => ({
            value: v,
            label: t(`setup.mayorOptions.${v}`),
          }))}
        />
        <Toggle
          surface={false}
          testID="reveal-on-death"
          label={t('setup.revealOnDeath')}
          sublabel={t('setup.revealOnDeathSub')}
          value={rules.revealRoleOnDeath}
          onChange={(v) => setRules({ revealRoleOnDeath: v })}
        />
        <Toggle
          surface={false}
          testID="detailed"
          label={t('setup.detailed')}
          sublabel={t('setup.detailedSub')}
          value={rules.detailedNarration}
          onChange={(v) => setRules({ detailedNarration: v })}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingStart: 3,
    paddingEnd: space.sm,
  },
  meterWrap: { gap: 2 },
  meter: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'visible' },
  meterHalf: { flex: 1, opacity: 0.35 },
  marker: {
    position: 'absolute',
    top: -4,
    width: 6,
    height: 18,
    marginStart: -3,
    borderRadius: 3,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  setupCard: { borderWidth: 2, borderRadius: radius.card - 4, padding: space.lg, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardButtons: { flexDirection: 'row', gap: space.sm },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    minHeight: 52,
  },
  seatNo: { width: 22, textAlign: 'center' },
  seatInput: { flex: 1, minHeight: 48, fontSize: 16 },
  move: { width: 40, alignItems: 'center', justifyContent: 'center' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: { width: '23%', minWidth: 72, flexDirection: 'row' },
});
