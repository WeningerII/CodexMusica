// ESLint flat config. Two environments:
//   - Node       : the build/query/verification tooling under scripts/
//   - Browser    : the shipped app (src/app.js, added in Phase 3)
// references/*.js are excluded: they are generated data tables (millions of
// characters of catalog literals), validated for syntax by `build:html --check`
// and for semantics by validate.js — linting them for code style is noise.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['scripts/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // The shipped browser app — present from Phase 3 onward.
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Catalog data tables (references/*.js) and the family-parts merge
        // (scripts/_merge.js) are injected into the app at build time.
        ARRANGEMENTS: 'readonly',
        AXIS_DEFINITIONS: 'readonly',
        CHAIN_ARCHETYPES: 'readonly',
        CHAIN_SECTIONS: 'readonly',
        EMOJI_REGISTRY: 'readonly',
        EMOJI_SVGS: 'readonly',
        FAMILY_FALLBACK_EMOJI: 'readonly',
        ICON_ALIASES: 'readonly',
        ICON_PATHS: 'readonly',
        INSTRUMENTS: 'readonly',
        INSTRUMENT_AXIS_DEFINITIONS: 'readonly',
        INSTRUMENT_FAMILIES: 'readonly',
        INSTRUMENT_FAMILY_PARTS: 'readonly',
        PREFACE_LEXICON: 'readonly',
        PRODUCTION_AESTHETICS: 'readonly',
        ROOMS: 'readonly',
        ROOM_CLUSTERS: 'readonly',
        TRADITIONS: 'readonly',
        TRADITION_EXTRAS: 'readonly',
        TREE_NODES: 'readonly',
        TUNINGS: 'readonly',
        mergeFamilyParts: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ['node_modules/**', 'references/**', 'tests/**', '**/*.min.js'],
  },
];
