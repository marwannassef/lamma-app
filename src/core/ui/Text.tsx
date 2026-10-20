import { Children, type ReactNode } from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { fontFamilyFor, useTheme, type FontRole, type FontWeight } from '@/core/theme';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';
type Tone = 'default' | 'muted' | 'primary' | 'secondary' | 'danger' | 'success' | 'onPrimary';

const variants: Record<Variant, { role: FontRole; weight: FontWeight; size: number }> = {
  hero: { role: 'display', weight: 'extrabold', size: 52 },
  title: { role: 'display', weight: 'bold', size: 32 },
  heading: { role: 'display', weight: 'bold', size: 22 },
  body: { role: 'body', weight: 'regular', size: 17 },
  label: { role: 'body', weight: 'bold', size: 17 },
  caption: { role: 'body', weight: 'semibold', size: 14 },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: 'auto' | 'center';
}

function plainText(children: ReactNode): string {
  return Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('');
}

/**
 * The only text component screens should use. Picks Latin or Arabic fonts from the
 * string's own script, scales with dynamic type (capped at 2x) and follows writing direction.
 */
export function Text({
  variant = 'body',
  tone = 'default',
  align = 'auto',
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const v = variants[variant];
  const color: Record<Tone, string> = {
    default: colors.text,
    muted: colors.textMuted,
    primary: colors.primary,
    secondary: colors.secondary,
    danger: colors.danger,
    success: colors.success,
    onPrimary: colors.onPrimary,
  };
  const base: TextStyle = {
    fontFamily: fontFamilyFor(plainText(children), v.role, v.weight),
    fontSize: v.size,
    lineHeight: Math.round(v.size * (v.role === 'display' ? 1.25 : 1.45)),
    color: color[tone],
    // 'left' means "start of the line": React Native flips it to the right in RTL on both platforms.
    // ('auto' follows each string's own language on iOS, so Arabic UI text landed on the left.)
    textAlign: align === 'auto' ? 'left' : align,
    writingDirection: 'auto',
  };
  return (
    <RNText
      maxFontSizeMultiplier={2}
      accessibilityRole={variant === 'hero' || variant === 'title' ? 'header' : undefined}
      style={[base, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
