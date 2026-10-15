// Every content/punishments/<locale>.json. Jest swaps this for an fs version.
export const punishmentFiles = require.context('../../../content/punishments', false, /\.json$/);
