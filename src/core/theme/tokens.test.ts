import { colors } from './tokens';

function luminance(hex: string) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(['light', 'dark'] as const)('%s theme meets WCAG AA', (scheme) => {
  const c = colors[scheme];
  const pairs: [string, string, string][] = [
    ['text', c.text, c.bg],
    ['text on surface', c.text, c.surface],
    ['text on surfaceRaised', c.text, c.surfaceRaised],
    ['textMuted', c.textMuted, c.bg],
    ['textMuted on surface', c.textMuted, c.surface],
    ['onPrimary on primary', c.onPrimary, c.primary],
    ['onSecondary on secondary', c.onSecondary, c.secondary],
    ['secondary on bg', c.secondary, c.bg],
    ['secondary on surface', c.secondary, c.surface],
    ['danger on bg', c.danger, c.bg],
    ['success on bg', c.success, c.bg],
  ];
  it.each(pairs)('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
