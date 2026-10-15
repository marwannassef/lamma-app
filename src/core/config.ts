/**
 * Build-time flags. EXPO_PUBLIC_* values are inlined when the bundle is built, so code behind
 * `if (ADULT_ENABLED)` is dropped from builds where it is false (every store profile in eas.json).
 */
export const ADULT_ENABLED = process.env.EXPO_PUBLIC_ENABLE_ADULT === 'true';
