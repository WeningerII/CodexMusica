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
        // Catalog data tables (references/*.js), the family-parts merge
        // (scripts/_merge.js), and the card-descriptor harvester
        // (scripts/_card_descriptors.js) are injected into the app at build time.
        ARRANGEMENTS: 'readonly',
        AXIS_DEFINITIONS: 'readonly',
        CHAIN_ARCHETYPES: 'readonly',
        CODEX_LAZY_API: 'readonly',
        CHAIN_SECTIONS: 'readonly',
        EMOJI_REGISTRY: 'readonly',
        EMOJI_SVGS: 'readonly',
        FAMILY_FALLBACK_EMOJI: 'readonly',
        FAMILY_HEADER_EMOJI: 'readonly',
        ICON_ALIASES: 'readonly',
        ICON_PATHS: 'readonly',
        INSTRUMENTS: 'readonly',
        INSTRUMENT_AXIS_DEFINITIONS: 'readonly',
        INSTRUMENT_FAMILIES: 'readonly',
        INSTRUMENT_FAMILY_PARTS: 'readonly',
        NAV_GLYPH_CP: 'readonly',
        NAV_GLYPH_META: 'readonly',
        NAV_GLYPH_SVGS: 'readonly',
        PREFACE_CAT_GLYPH: 'readonly',
        PREFACE_GLYPH: 'readonly',
        PREFACE_LEXICON: 'readonly',
        PRODUCTION_AESTHETICS: 'readonly',
        ROOMS: 'readonly',
        ROOM_CLUSTERS: 'readonly',
        ROOM_CLUSTER_GLYPH: 'readonly',
        ROOM_GLYPH: 'readonly',
        TRADITIONS: 'readonly',
        TRADITION_EXTRAS: 'readonly',
        TREE_NODES: 'readonly',
        TUNINGS: 'readonly',
        mergeFamilyParts: 'readonly',
        harvestDescriptors: 'readonly',
        _cardDescriptorSet: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // The MCP server (mcp/) — Node, ESM. Imports the CommonJS engine under
    // scripts/ via createRequire. Its own deps live in mcp/node_modules.
    files: ['mcp/**/*.js', 'mcp/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
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
    ignores: ['node_modules/**', 'references/**', 'tests/**', '**/*.min.js'],
  },
];
