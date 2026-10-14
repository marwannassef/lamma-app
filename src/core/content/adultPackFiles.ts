// Only reachable from a branch guarded by ADULT_ENABLED, so store builds never bundle it.
export const adultPackFiles = require.context('../../../content/packs/adult', false, /\.json$/);
