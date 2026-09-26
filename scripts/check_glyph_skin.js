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
// It also checks the eager/lazy split (scripts/_glyph_stores.js): the page draws
// tradition glyphs and instrument emoji on first paint from the two eager stores,
// and fetches NAV_GLYPH_SVGS only when a room or preface list draws. A codepoint
// a first-paint table names that has artwork only in the lazy store would draw
// blank until that fetch — or forever, on a page that never opens those lists —
// with every other check still green. So would a nav codepoint with no artwork
// anywhere. And each picture is stored once.

const { inFaceRange, NON_HUMAN_SKIN_YELLOW } = require('./_glyph_skin.js');
const {
  EAGER_STORES,
  LAZY_STORE,
  readGlyphStores,
  glyphReferences,
  unresolvedGlyphs,
  storedTwice,
} = require('./_glyph_stores.js');

const STORE_FILES = {
  TRADITION_GLYPH_SVGS: 'src/app.js',
  EMOJI_SVGS: 'references/08_asset_manifest.js',
  NAV_GLYPH_SVGS: 'references/09_nav_glyphs.js',
};

function describe(r) {
  if (r.eager && r.lazyOnly)
    return `${r.table}:${r.key} → ${r.cp} — drawn on first paint, but its artwork is only in the lazy ${LAZY_STORE}`;
  return `${r.table}:${r.key} → ${r.cp} — no artwork in ${r.eager ? EAGER_STORES.join(' or ') : 'any store'}`;
}

// Returns the failures and the control's result.
function checkResolution(stores) {
  const refs = glyphReferences(stores);
  // Control: plant the failure this check exists for — a first-paint codepoint
  // whose artwork has moved from the eager stores into the lazy one — and
  // require the check to name every first-paint reference to it and none of the
  // nav references, which still resolve. Planted on the codepoint the most
  // first-paint references name.
  const count = new Map();
  for (const r of refs) if (r.eager) count.set(r.cp, (count.get(r.cp) || 0) + 1);
  const plantCp = [...count.keys()].sort(
    (a, b) => count.get(b) - count.get(a) || (a < b ? -1 : 1)
  )[0];
  const planted = { ...stores, [LAZY_STORE]: { ...stores[LAZY_STORE] } };
  for (const st of EAGER_STORES) {
    planted[st] = { ...stores[st] };
    if (planted[st][plantCp]) planted[LAZY_STORE][plantCp] = planted[st][plantCp];
    delete planted[st][plantCp];
  }
  const expected = count.get(plantCp) || 0;
  const hits = unresolvedGlyphs(planted).filter((r) => r.cp === plantCp);
  const caught = hits.filter((r) => r.eager && r.lazyOnly).length;
  const failures = unresolvedGlyphs(stores).map(describe);
  for (const [cp, sts] of storedTwice(stores))
    failures.push(`${cp} — stored twice, in ${sts.join(' and ')}; keep one copy`);
  if (!expected || caught !== expected || hits.length !== caught)
    failures.push(
      `control: moving ${plantCp} into the lazy store should fail ${expected} first-paint reference(s) and nothing else; the check saw ${caught} of ${hits.length}`
    );
  return { failures, refs: refs.length, plantCp, caught };
}

function main() {
  const all = readGlyphStores();
  const stores = [...EAGER_STORES, LAZY_STORE].map((st) => ({
    name: `${st} (${STORE_FILES[st]})`,
    data: all[st],
  }));

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

  const res = checkResolution(all);
  if (res.failures.length) {
    console.error(
      `check_glyph_skin: FAIL — ${res.failures.length} glyph problem(s) in the eager/lazy split`
    );
    res.failures.slice(0, 30).forEach((f) => console.error('  ✗', f));
    console.error(
      '  first-paint artwork belongs in TRADITION_GLYPH_SVGS or EMOJI_SVGS; see scripts/_glyph_stores.js'
    );
    process.exit(1);
  }

  console.log(
    `check_glyph_skin: OK — ${checked} glyphs across ${stores.length} store(s) follow the skin convention; ` +
      `${res.refs} glyph references resolve, first-paint ones eagerly, each picture stored once ` +
      `(control: moving ${res.plantCp} to the lazy store fails ${res.caught})`
  );
}

main();
