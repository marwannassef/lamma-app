const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

// Physical-direction style keys break RTL. Use start/end variants instead.
const PHYSICAL_KEYS = [
  'left',
  'right',
  'marginLeft',
  'marginRight',
  'paddingLeft',
  'paddingRight',
  'borderLeftWidth',
  'borderRightWidth',
  'borderLeftColor',
  'borderRightColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
];

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', 'ios/*', 'android/*', 'docs/reference/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: `Property[key.name=/^(${PHYSICAL_KEYS.join('|')})$/]`,
          message: 'Use start/end (e.g. marginStart, paddingEnd, start) so layouts flip in RTL.',
        },
        {
          selector: "Property[key.name='textAlign'][value.value=/^(left|right)$/]",
          message: "Omit textAlign or use 'auto' so text follows the writing direction.",
        },
      ],
    },
  },
  {
    // A game may import from core, but never from another game.
    files: ['src/games/*/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/games/*'], message: 'Games must not import other games.' }] },
      ],
    },
  },
]);
