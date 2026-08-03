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

const fs = require('fs');
const path = require('path');
const { inFaceRange, NON_HUMAN_SKIN_YELLOW } = require('./_glyph_skin.js');

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

  console.log(
    `check_glyph_skin: OK — ${checked} glyphs across ${stores.length} store(s) follow the skin convention`
  );
}

main();
