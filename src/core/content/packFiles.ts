// Metro bundles every content/packs/*.json (not subfolders). Jest swaps this for an fs version.
export const packFiles = require.context('../../../content/packs', false, /\.json$/);
