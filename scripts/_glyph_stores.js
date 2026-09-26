// The page's three glyph artwork stores, read from the committed files, and the
// rule that ties them together.
//
//   TRADITION_GLYPH_SVGS  src/app.js                    (hand-kept)
//   EMOJI_SVGS            references/08_asset_manifest.js (scripts/build_emoji.js)
//   NAV_GLYPH_SVGS        references/09_nav_glyphs.js     (scripts/build_nav_glyphs.js)
//
// Each picture is stored once. A codepoint whose Twemoji artwork is byte-identical
// in NAV_GLYPH_SVGS is left out of the other two stores, and the page falls back
// to NAV_GLYPH_SVGS for it (_sharedGlyphInner() in src/app.js). So a codepoint that
// TRADITION_GLYPH_CP, EMOJI_REGISTRY, FAMILY_FALLBACK_EMOJI or FAMILY_HEADER_EMOJI
// names, and that its own store lacks, is drawn only because NAV_GLYPH_SVGS has it.
// NAV_GLYPH_SVGS is built from room and preface assignments, so reassigning one
// preface could otherwise drop artwork a dozen instruments draw with, and nothing
// would say so. Two guards read this module:
//   - scripts/build_nav_glyphs.js keeps every codepoint another store relies on;
//   - scripts/check_glyph_skin.js fails when any named codepoint resolves nowhere.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_FILE = path.join(ROOT, 'src', 'app.js');
const EMOJI_FILE = path.join(ROOT, 'references', '08_asset_manifest.js');
const NAV_FILE = path.join(ROOT, 'references', '09_nav_glyphs.js');

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

// Every codepoint a table names, with the store the page reads first for it.
function glyphReferences(s) {
  const refs = [];
  for (const [ch, cp] of Object.entries(s.TRADITION_GLYPH_CP))
    refs.push({ table: 'TRADITION_GLYPH_CP', key: ch, cp, own: 'TRADITION_GLYPH_SVGS' });
  for (const table of ['EMOJI_REGISTRY', 'FAMILY_FALLBACK_EMOJI', 'FAMILY_HEADER_EMOJI'])
    for (const [key, cp] of Object.entries(s[table]))
      refs.push({ table, key, cp, own: 'EMOJI_SVGS' });
  for (const [ch, cp] of Object.entries(s.NAV_GLYPH_CP))
    refs.push({ table: 'NAV_GLYPH_CP', key: ch, cp, own: 'NAV_GLYPH_SVGS' });
  return refs;
}

// codepoint → ['TABLE:key', …] for every codepoint that resolves only through
// NAV_GLYPH_SVGS: named by a tradition or emoji table, absent from its own store.
function reliedOnNav(s) {
  const out = new Map();
  for (const r of glyphReferences(s)) {
    if (r.own === 'NAV_GLYPH_SVGS' || s[r.own][r.cp]) continue;
    if (!out.has(r.cp)) out.set(r.cp, []);
    out.get(r.cp).push(`${r.table}:${r.key}`);
  }
  return out;
}

// References whose codepoint has artwork in neither its own store nor
// NAV_GLYPH_SVGS: the page draws nothing for them.
function unresolvedGlyphs(s) {
  return glyphReferences(s).filter((r) => !s[r.own][r.cp] && !s.NAV_GLYPH_SVGS[r.cp]);
}

module.exports = { readGlyphStores, glyphReferences, reliedOnNav, unresolvedGlyphs };
