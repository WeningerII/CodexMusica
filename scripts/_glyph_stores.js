// The page's three glyph artwork stores, read from the committed files, and the
// rules that tie them together.
//
//   TRADITION_GLYPH_SVGS  src/app.js                       eager (hand-kept)
//   EMOJI_SVGS            references/08_asset_manifest.js  eager (scripts/build_emoji.js)
//   NAV_GLYPH_SVGS        references/09_nav_glyphs.js      LAZY  (scripts/build_nav_glyphs.js)
//
// First paint draws tradition glyphs (the Genre list) and instrument emoji, so
// that artwork is in the page. NAV_GLYPH_SVGS is drawn only by the room and
// preface lists, so the lazy shell leaves it out of codex.html and fetches it
// from api/nav_glyphs.json the first time one of those lists draws
// (navGlyphSvg() in src/app.js).
//
// Each picture is stored once, and a picture first paint needs is stored eagerly:
//   - EMOJI_SVGS leaves out a codepoint byte-identical in TRADITION_GLYPH_SVGS;
//   - NAV_GLYPH_SVGS leaves out a codepoint byte-identical in either eager
//     store, and the page draws that nav glyph from the eager copy.
// scripts/check_glyph_skin.js fails when a codepoint that TRADITION_GLYPH_CP,
// EMOJI_REGISTRY, FAMILY_FALLBACK_EMOJI or FAMILY_HEADER_EMOJI names has no
// eager artwork (it would draw blank until the nav set arrived, or never), when
// a nav codepoint resolves nowhere, and when one codepoint is stored twice.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_FILE = path.join(ROOT, 'src', 'app.js');
const EMOJI_FILE = path.join(ROOT, 'references', '08_asset_manifest.js');
const NAV_FILE = path.join(ROOT, 'references', '09_nav_glyphs.js');

const EAGER_STORES = ['TRADITION_GLYPH_SVGS', 'EMOJI_SVGS'];
const LAZY_STORE = 'NAV_GLYPH_SVGS';

// src/app.js is a runtime file, not data, so its two tables are read as the JSON
// literals they are rather than by running the file.
function jsonConst(src, name, file) {
  const m = src.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});\\n`));
  if (!m) throw new Error(`${path.relative(ROOT, file)}: no \`const ${name} = {…};\``);
  return JSON.parse(m[1]);
}

// The reference files are plain const declarations.
function evalConsts(file, names) {
  return new Function(fs.readFileSync(file, 'utf8') + `\nreturn { ${names.join(', ')} };`)();
}

function readGlyphStores() {
  const app = fs.readFileSync(APP_FILE, 'utf8');
  return {
    TRADITION_GLYPH_CP: jsonConst(app, 'TRADITION_GLYPH_CP', APP_FILE),
    TRADITION_GLYPH_SVGS: jsonConst(app, 'TRADITION_GLYPH_SVGS', APP_FILE),
    ...evalConsts(EMOJI_FILE, [
      'EMOJI_SVGS',
      'EMOJI_REGISTRY',
      'FAMILY_FALLBACK_EMOJI',
      'FAMILY_HEADER_EMOJI',
    ]),
    // build_nav_glyphs.js writes this file, so it may not exist yet.
    ...(fs.existsSync(NAV_FILE)
      ? evalConsts(NAV_FILE, ['NAV_GLYPH_SVGS', 'NAV_GLYPH_CP'])
      : { NAV_GLYPH_SVGS: {}, NAV_GLYPH_CP: {} }),
  };
}

// Every codepoint a table names. `eager` marks the tables first paint draws.
function glyphReferences(s) {
  const refs = [];
  for (const [ch, cp] of Object.entries(s.TRADITION_GLYPH_CP))
    refs.push({ table: 'TRADITION_GLYPH_CP', key: ch, cp, eager: true });
  for (const table of ['EMOJI_REGISTRY', 'FAMILY_FALLBACK_EMOJI', 'FAMILY_HEADER_EMOJI'])
    for (const [key, cp] of Object.entries(s[table])) refs.push({ table, key, cp, eager: true });
  for (const [ch, cp] of Object.entries(s.NAV_GLYPH_CP))
    refs.push({ table: 'NAV_GLYPH_CP', key: ch, cp, eager: false });
  return refs;
}

const eagerArt = (s, cp) => EAGER_STORES.map((st) => s[st][cp]).find(Boolean) || null;

// References the page cannot draw as promised: an eager table's codepoint with
// no eager artwork (`lazyOnly` when only NAV_GLYPH_SVGS has it), or a nav
// codepoint with artwork nowhere.
function unresolvedGlyphs(s) {
  return glyphReferences(s)
    .filter((r) => !eagerArt(s, r.cp) && (r.eager || !s[LAZY_STORE][r.cp]))
    .map((r) => ({ ...r, lazyOnly: !!s[LAZY_STORE][r.cp] }));
}

// codepoint → [store, …] for every codepoint stored in more than one store.
function storedTwice(s) {
  const seen = new Map();
  for (const st of [...EAGER_STORES, LAZY_STORE])
    for (const cp of Object.keys(s[st])) seen.set(cp, [...(seen.get(cp) || []), st]);
  return new Map([...seen].filter(([, sts]) => sts.length > 1));
}

module.exports = {
  EAGER_STORES,
  LAZY_STORE,
  readGlyphStores,
  glyphReferences,
  eagerArt,
  unresolvedGlyphs,
  storedTwice,
};
