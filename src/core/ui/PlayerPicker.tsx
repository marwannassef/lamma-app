import { StyleSheet, View } from 'react-native';

import { usePlayerName } from '@/core/players';
import { radius, space } from '@/core/theme';
import { Avatar } from './Avatar';
import { Pressable } from './Pressable';
import { Text } from './Text';

type PlayerId = number;
export interface PickablePlayer {
  id: PlayerId;
  alive: boolean;
}

export interface PickerTag {
  label: string;
  color?: string;
}

/**
 * Grid of players to tap. `disabled` players stay visible (with their tag) but can't be picked.
 * Colours are passed in so the same picker works on stealth and public screens.
 */
export function PlayerPicker<P extends PickablePlayer>({
  players,
  selected,
  onToggle,
  include = (p) => p.alive,
  disabled = () => false,
  tags = () => undefined,
  fg,
  muted,
  bg,
  accent,
}: {
  players: readonly P[];
  selected: readonly PlayerId[];
  onToggle(id: PlayerId): void;
  include?: (p: P) => boolean;
  disabled?: (id: PlayerId) => boolean;
  tags?: (id: PlayerId) => PickerTag | undefined;
  fg: string;
  muted: string;
  bg: string;
  accent: string;
}) {
  const nameOf = usePlayerName();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {players.filter(include).map((p) => {
        const on = selected.includes(p.id);
        const off = disabled(p.id);
        const tag = tags(p.id);
        const name = nameOf(p.id);
        return (
          <Pressable
            key={p.id}
            testID={`pick-${p.id}`}
            haptic={false}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: off }}
            accessibilityLabel={[name, tag?.label].filter(Boolean).join(', ')}
            onPress={() => !off && onToggle(p.id)}
            style={[
              styles.cell,
              {
                backgroundColor: bg,
                borderColor: on ? accent : 'transparent',
                opacity: off ? 0.45 : 1,
              },
            ]}
          >
            <Avatar player={p.id} size={40} ring={on ? accent : undefined} />
            <Text variant="caption" align="center" numberOfLines={1} style={{ color: fg }}>
              {on ? `✓ ${name}` : name}
            </Text>
            {tag ? (
              <Text
                variant="caption"
                align="center"
                numberOfLines={1}
                style={{ color: tag.color ?? muted }}
              >
                {tag.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  cell: {
    width: '30.5%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderWidth: 2,
  },
});
