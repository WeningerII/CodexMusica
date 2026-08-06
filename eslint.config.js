// ESLint flat config. Two environments:
//   - Node       : the build/query/verification tooling under scripts/
//   - Browser    : the shipped app (src/app.js, added in Phase 3)
// references/*.js are excluded: they are generated data tables (millions of
// characters of catalog literals), validated for syntax by `build:html --check`
// and for semantics by validate.js — linting them for code style is noise.
const js = require('@eslint/js');
const globals = require('globals');

// The collation ban, applied everywhere below.
//
// `a.localeCompare(b)` with no locale argument sorts by the RUNTIME's locale.
// That is a per-machine input to a product whose entire claim is that the same
// workspace renders the same bytes everywhere, and it has already shipped once:
// recipes ordered one way on an en-US machine and another on a da-DK browser.
// The fix was `_cmp`, a codepoint comparator, pinned in six files.
//
// What guarded the pin afterwards was a pair of comments saying check_app_parity
// would catch a regression. It would not, and that was demonstrated: revert one
// `_cmp` to bare `localeCompare` and the gate passes 2503/2503, because both
// sides run in the same Node process under one ICU locale and en-US collation
// happens to agree with codepoint order on today's catalog. A guard that cannot
// fail is not a guard, so here is one that runs on every file in every lint.
//
// Bare calls only. `localeCompare(b, 'en')` names its locale and is stable
// across machines, which is what the two picker sorts in src/app.js want — they
// order a list for human eyes, never recipe bytes.
const NO_BARE_LOCALE_COMPARE = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.property.name='localeCompare'][arguments.length<2]",
      message:
        'Bare localeCompare() collates by the runtime locale and makes output machine-dependent. Use _cmp (codepoint) for anything that reaches a recipe, or pass an explicit locale for human-facing sorts.',
    },
  ],
};

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
      ...NO_BARE_LOCALE_COMPARE,
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
      ...NO_BARE_LOCALE_COMPARE,
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
      ...NO_BARE_LOCALE_COMPARE,
    },
  },
  {
    // ESM tooling under scripts/. The block above covers scripts/**/*.js as
    // CommonJS, and .mjs there matched NOTHING — so a file like
    // probe_gemini.mjs was linted against the bare recommended config with no
    // Node globals at all, which reports every `process` and `console` as
    // undefined. Same environment as the CJS scripts, different module system.
    files: ['scripts/**/*.mjs'],
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
      ...NO_BARE_LOCALE_COMPARE,
    },
  },
  {
    ignores: ['node_modules/**', 'references/**', 'tests/**', '**/*.min.js'],
  },
];
