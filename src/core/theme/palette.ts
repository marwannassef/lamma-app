// Sampled from the AN Ventures Labs logo (docs/brand/an-ventures-labs.jpg).
// Components must not import this directly; use semantic tokens from useTheme().
export const palette = {
  // brand
  sky: '#4F8FDB',
  cyan: '#2FB8C9',
  violet: '#6B3FC6',
  grape: '#3A1D6E',
  magenta: '#D23C82',
  coral: '#E8605A',
  orange: '#EF7A3C',
  orangeDark: '#B9541F',
  leaf: '#6DBE45',
  // neutrals
  cream: '#FDFAF1',
  sand: '#F4EBDD',
  cocoa: '#89553D',
  ink: '#2B1A12',
  night: '#1A1030',
  nightUp: '#261A44',
} as const;

export const gradients = {
  brand: [palette.sky, palette.violet, palette.magenta, palette.orange],
  spy: [palette.grape, palette.violet, palette.magenta],
} as const;
