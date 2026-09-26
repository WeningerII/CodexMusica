#!/usr/bin/env node
// Enforce the codex skin convention on every glyph the app ships.
//
// This check exists because ✊ (protest song and topical song) and 🫠 shipped
// stock Twemoji yellow for months next to 🤠 and 😴, which had been recoloured
// to the codex green by hand. Nothing caught it but somebody's eye.
//
// Both signals below are pure functions of the committed artwork, so this runs
// without the vendored asset directory (which is gitignored):
//
//   1. #FFDC5D is Twemoji's dedicated skin colour. It appears on all 366 body
//      and hand glyphs in the 15.x set and on nothing else, so a glyph that
//      still carries it has not been through the convention.
//   2. A face-block codepoint still carrying face-base yellow (#FFCC4D) or its
//      shade (#FFAC33) is an unconverted face — this is the 🫠 case.
//
// Objects that are legitimately yellow (🔥 🌽 👑 🌙) are outside both signals
// and stay untouched, which is the point: the convention is about skin, not
// about yellow.
//
// It also checks that every glyph a table names still draws. The stores share
// artwork (scripts/_glyph_stores.js): a tradition or instrument codepoint that is
// byte-identical in NAV_GLYPH_SVGS is stored only there, so losing it there
// would blank that glyph with every other check still green.

const fs = require('fs');
const path = require('path');
const { inFaceRange, NON_HUMAN_SKIN_YELLOW } = require('./_glyph_skin.js');
const {
  readGlyphStores,
  glyphReferences,
  reliedOnNav,
  unresolvedGlyphs,
} = require('./_glyph_stores.js');

const APP_FILE = path.join(__dirname, '..', 'src', 'app.js');
const NAV_FILE = path.join(__dirname, '..', 'references', '09_nav_glyphs.js');

function storeFrom(file, constName) {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(new RegExp(`const ${constName} = (\\{[\\s\\S]*?\\});\\n`));
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Every codepoint TRADITION_GLYPH_CP, EMOJI_REGISTRY, FAMILY_FALLBACK_EMOJI,
// FAMILY_HEADER_EMOJI and NAV_GLYPH_CP name resolves in its own store or in
// NAV_GLYPH_SVGS. Returns the failures and the control's result.
function checkResolution() {
  const stores = readGlyphStores();
  const refs = glyphReferences(stores);
  const relied = reliedOnNav(stores);
  // Control: plant the failure this check exists for — the one shared copy
  // gone — and require the check to name every reference to it. Planted on
  // the codepoint that most references reach only through NAV_GLYPH_SVGS.
  const plantCp = relied.size
    ? Array.from(relied.keys()).sort((a, b) => relied.get(b).length - relied.get(a).length)[0]
    : refs[0].cp;
  const planted = { ...stores };
  for (const store of ['TRADITION_GLYPH_SVGS', 'EMOJI_SVGS', 'NAV_GLYPH_SVGS']) {
    planted[store] = { ...stores[store] };
    delete planted[store][plantCp];
  }
  const expected = refs.filter((r) => r.cp === plantCp).length;
  const caught = unresolvedGlyphs(planted).filter((r) => r.cp === plantCp).length;
  const failures = unresolvedGlyphs(stores).map(
    (r) => `${r.table}:${r.key} → ${r.cp} — no artwork in ${r.own} or NAV_GLYPH_SVGS`
  );
  if (!expected || caught !== expected)
    failures.push(
      `control: removing ${plantCp} should blank ${expected} reference(s), the check saw ${caught}`
    );
  return { failures, refs: refs.length, shared: relied.size, plantCp, caught };
}

function main() {
  const stores = [
    {
      name: 'TRADITION_GLYPH_SVGS (src/app.js)',
      data: storeFrom(APP_FILE, 'TRADITION_GLYPH_SVGS'),
    },
    {
      name: 'NAV_GLYPH_SVGS (references/09_nav_glyphs.js)',
      data: storeFrom(NAV_FILE, 'NAV_GLYPH_SVGS'),
    },
  ].filter((s) => s.data);

  if (!stores.length) {
    console.error('check_glyph_skin: FAIL — found no glyph store to check');
    process.exit(1);
  }

  const failures = [];
  let checked = 0;

  for (const store of stores) {
    for (const cp of Object.keys(store.data)) {
      const svg = store.data[cp];
      const upper = svg.toUpperCase();
      checked++;
      if (NON_HUMAN_SKIN_YELLOW.has(cp.toLowerCase())) continue;
      if (upper.includes('#FFDC5D')) {
        failures.push(`${store.name}  ${cp} — carries Twemoji skin yellow #FFDC5D`);
        continue;
      }
      if (inFaceRange(cp) && (upper.includes('#FFCC4D') || upper.includes('#FFAC33'))) {
        failures.push(
          `${store.name}  ${cp} — face glyph still on Twemoji yellow (#FFCC4D/#FFAC33)`
        );
      }
    }
  }

  if (failures.length) {
    console.error(
      `check_glyph_skin: FAIL — ${failures.length} glyph(s) skipped the codex skin convention`
    );
    failures.forEach((f) => console.error('  ✗', f));
    console.error(
      '  human skin renders codex green: #FFDC5D/#FFCC4D → #77bf57, #EF9645/#FFAC33 → #6ab948'
    );
    console.error('  see scripts/_glyph_skin.js — the build applies this to generated stores');
    process.exit(1);
  }

  const res = checkResolution();
  if (res.failures.length) {
    console.error(
      `check_glyph_skin: FAIL — ${res.failures.length} glyph reference(s) draw nothing`
    );
    res.failures.slice(0, 30).forEach((f) => console.error('  ✗', f));
    console.error(
      '  a codepoint missing from its own store must be in NAV_GLYPH_SVGS; run node scripts/build_nav_glyphs.js'
    );
    process.exit(1);
  }

  console.log(
    `check_glyph_skin: OK — ${checked} glyphs across ${stores.length} store(s) follow the skin convention; ` +
      `${res.refs} glyph references resolve (${res.shared} codepoints only through NAV_GLYPH_SVGS; ` +
      `control: removing ${res.plantCp} blanks ${res.caught})`
  );
}

main();
