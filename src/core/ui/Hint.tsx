import { Text } from './Text';

/** Inline explanation shown when an action can't happen yet (instead of disabling it). */
export function Hint({ children, testID }: { children: string; testID?: string }) {
  return (
    <Text
      variant="caption"
      tone="danger"
      align="center"
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      {children}
    </Text>
  );
}
