// Metro bundles every locales/<code>/<namespace>.json matched here. Jest swaps this module for an
// fs-based version (jest.setup.ts) because require.context is Metro-only.
export const localeFiles = require.context(
  '../../../locales',
  true,
  /^\.\/[A-Za-z-]+\/[a-z]+\.json$/,
);
