// Shared loader. Every script does: const C = require('./_loader.js');
// C exposes the live data structures from references/*.js.

const fs = require('fs');
const path = require('path');

const REFS = path.join(__dirname, '..', 'references');
const FILES = [
  '01_family_parts.js',
  '02_instruments.js',
  '03_rooms_chains_tunings.js',
  '04_tree.js',
  '05_traditions.js',
  '06_extras.js',
  '07_preface_lexicon.js',
  '08_asset_manifest.js',
  '09_nav_glyphs.js',
  '10_tradition_signatures.js',
];

const bundle = FILES.map((f) => fs.readFileSync(path.join(REFS, f), 'utf8')).join('\n');

// The data files declare their tables with `const X = ...`. We promote them to
// global scope so we can capture them after evaluation.
const TABLES = [
  'INSTRUMENT_FAMILY_PARTS',
  'INSTRUMENTS',
  'INSTRUMENT_FAMILIES',
  'ROOMS',
  'ROOM_CLUSTERS',
  'CHAIN_SECTIONS',
  'TUNINGS',
  'AXIS_DEFINITIONS',
  'INSTRUMENT_AXIS_DEFINITIONS',
  'CHAIN_ARCHETYPES',
  'PRODUCTION_AESTHETICS',
  'ARRANGEMENTS',
  'TREE_NODES',
  'TRADITIONS',
  'TRADITION_EXTRAS',
  'PREFACE_LEXICON',
  'ICON_PATHS',
  'ICON_ALIASES',
  'EMOJI_SVGS',
  'EMOJI_REGISTRY',
  'FAMILY_FALLBACK_EMOJI',
  'FAMILY_HEADER_EMOJI',
  'NAV_GLYPH_SVGS',
  'NAV_GLYPH_CP',
  'NAV_GLYPH_META',
  'ROOM_CLUSTER_GLYPH',
  'ROOM_GLYPH',
  'PREFACE_CAT_GLYPH',
  'PREFACE_GLYPH',
  'TRADITION_SIGNATURES',
];

const re = new RegExp(`const (${TABLES.join('|')})`, 'g');
const promoted = bundle.replace(re, 'globalThis.$1');

new Function(promoted)();

module.exports = {};
for (const t of TABLES) {
  if (typeof globalThis[t] !== 'undefined') {
    module.exports[t] = globalThis[t];
  }
}

// ─────────── Family-parts merge ───────────
// Each instrument inherits its family's parts (with applies_to filtering and
// full-override / annotation own-part modes). The algorithm lives in
// scripts/_merge.js — the single source shared with the in-page build so the
// engine and the shipped app see identical inst.parts.
const { mergeFamilyParts } = require('./_merge.js');
mergeFamilyParts(module.exports.INSTRUMENTS, module.exports.INSTRUMENT_FAMILY_PARTS);

// ─────────── Retired tradition ids ───────────
// Merged duplicates keep their old id as an alias of the surviving tradition
// (references/_tradition_aliases.json). Resolve at every place a caller hands
// in a TRADITION id — never for instrument or variant ids, some of which share
// a spelling with a retired tradition. An id that is neither live nor an alias
// comes back unchanged, so the caller's own "Unknown tradition" still fires.
const ALIAS_FILE = path.join(REFS, '_tradition_aliases.json');
module.exports.TRADITION_ALIASES = JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf8')).aliases;
// Also a global, as the reference tables are, for src/app.js run under Node.
globalThis.TRADITION_ALIASES = module.exports.TRADITION_ALIASES;
const LIVE_TRADITION_IDS = new Set(module.exports.TRADITIONS.map((t) => t.id));
module.exports.resolveTraditionId = function resolveTraditionId(id) {
  if (typeof id !== 'string' || LIVE_TRADITION_IDS.has(id)) return id;
  const alias = module.exports.TRADITION_ALIASES[id];
  return alias ? alias.of : id;
};
