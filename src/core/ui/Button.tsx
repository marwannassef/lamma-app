import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: Variant;
  /** Leading emoji, e.g. "▶". */
  icon?: string;
  size?: 'lg' | 'md';
  testID?: string;
  accessibilityHint?: string;
}

const LIP = 6;
/** Labels up to this many characters never wrap. */
const SHORT_LABEL = 18;

/** Chunky 3D game button: gradient face on a darker lip; it squishes down when pressed. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'lg',
  testID,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const pressed = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * (LIP - 2) }, { scale: 1 - pressed.value * 0.02 }],
  }));
  const content = (color: string) => (
    <View style={styles.content}>
      {icon ? (
        <Text variant={size === 'lg' ? 'heading' : 'label'} accessible={false} style={{ color }}>
          {icon}
        </Text>
      ) : null}
      <Text
        variant={size === 'lg' ? 'heading' : 'label'}
        align="center"
        // Short labels stay on one line and shrink a little with large text; long ones wrap.
        numberOfLines={label.length <= SHORT_LABEL ? 1 : undefined}
        adjustsFontSizeToFit={label.length <= SHORT_LABEL}
        minimumFontScale={0.7}
        style={[styles.label, { color }, size === 'lg' && styles.lgText]}
      >
        {label}
      </Text>
    </View>
  );

  const common = {
    testID,
    accessibilityLabel: label,
    accessibilityHint,
    onPress,
    onPressIn: () => {
      pressed.value = withSpring(1, { damping: 18, stiffness: 500 });
    },
    onPressOut: () => {
      pressed.value = withSpring(0, { damping: 12, stiffness: 300 });
    },
  };

  if (variant === 'ghost') {
    return (
      <Pressable {...common} haptic={false}>
        <Animated.View
          style={[
            styles.ghost,
            size === 'md' && styles.md,
            { borderColor: colors.border, backgroundColor: colors.surface },
            faceStyle,
          ]}
        >
          {content(colors.text)}
        </Animated.View>
      </Pressable>
    );
  }

  const face =
    variant === 'primary'
      ? colors.primaryGradient
      : variant === 'secondary'
        ? colors.secondaryGradient
        : colors.dangerGradient;
  const lip =
    variant === 'primary'
      ? colors.primaryLip
      : variant === 'secondary'
        ? colors.secondaryLip
        : colors.secondaryLip;
  const textColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.onSecondary
        : colors.onDanger;

  return (
    <Pressable {...common}>
      <View style={[styles.lip, { backgroundColor: lip, shadowColor: face[1] }]}>
        <Animated.View style={faceStyle}>
          <LinearGradient
            colors={face}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.face, size === 'md' && styles.md]}
          >
            <View style={styles.shine} pointerEvents="none" />
            {content(textColor)}
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: {
    borderRadius: radius.lg,
    paddingBottom: LIP,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  face: {
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 60,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  md: { minHeight: 48, paddingVertical: space.sm },
  shine: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderTopStartRadius: radius.lg,
    borderTopEndRadius: radius.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  label: { flexShrink: 1 },
  lgText: { fontSize: 24, lineHeight: 32 },
  ghost: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    minHeight: 52,
    justifyContent: 'center',
  },
});
