#!/usr/bin/env node
// Build references/09_nav_glyphs.js — the navigation glyph vocabulary for rooms
// and prefaces.
//
// Reads:
//   - scripts/_nav_glyph_map.json          (curated id → glyph assignments)
//   - references/_assets/emoji/*.svg       (Twemoji vendored SVGs, CC-BY 4.0)
//
// Writes:
//   - references/09_nav_glyphs.js
//       NAV_GLYPH_SVGS        codepoint → inner SVG markup (the artwork store)
//       NAV_GLYPH_CP          character  → codepoint
//       NAV_GLYPH_META        character  → { label }   (axis-1 glyphs only)
//       ROOM_CLUSTER_GLYPH    cluster id → character   (axis 1)
//       ROOM_GLYPH            room id    → character   (axis 2)
//       PREFACE_CAT_GLYPH     category   → character   (axis 1)
//       PREFACE_GLYPH         preface id → character   (axis 2)
//
// This mirrors the tradition glyph system in src/app.js: an axis-1 glyph that
// repeats down a whole group, plus an axis-2 glyph specific to the row, drawn
// as a pair. Rooms and prefaces are flat lists rather than a tree, so axis 2 is
// a direct per-id map instead of a nearest-ancestor walk.
//
// Human skin in the artwork is recoloured to the codex green here, at build
// time — see scripts/_glyph_skin.js for the convention and why it lives in the
// build rather than in anybody's hands.
//
// NAV_GLYPH_SVGS is also the shared store: the tradition and instrument emoji
// tables fall back to it for any codepoint whose artwork is byte-identical here
// (scripts/_glyph_stores.js). So this build keeps every codepoint those tables
// rely on even when no room or preface uses it any more — reassigning a preface
// glyph must never blank the maracas.
//
// To regenerate:
//   node scripts/fetch_emoji.js --source=npm && node scripts/build_nav_glyphs.js

const fs = require('fs');
const path = require('path');
const { greenifySkin } = require('./_glyph_skin.js');
const { readGlyphStores, reliedOnNav, unresolvedGlyphs } = require('./_glyph_stores.js');

const MAP_FILE = path.join(__dirname, '_nav_glyph_map.json');
const EMOJI_DIR = path.join(__dirname, '..', 'references', '_assets', 'emoji');
const OUT_FILE = path.join(__dirname, '..', 'references', '09_nav_glyphs.js');

const GROUPS = [
  { key: 'roomClusters', constName: 'ROOM_CLUSTER_GLYPH', axis1: true },
  { key: 'rooms', constName: 'ROOM_GLYPH', axis1: false },
  { key: 'prefaceCategories', constName: 'PREFACE_CAT_GLYPH', axis1: true },
  { key: 'prefaces', constName: 'PREFACE_GLYPH', axis1: false },
];

function extractInner(svgText) {
  const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error('No <svg>...</svg> found');
  return m[1].trim().replace(/\s+/g, ' ').replace(/>\s+</g, '><');
}

// Rooms and prefaces straight from the reference tables. Read directly rather
// than through _loader.js, which loads the very file this script generates.
function catalogIds() {
  const refs = path.join(__dirname, '..', 'references');
  const src =
    fs.readFileSync(path.join(refs, '03_rooms_chains_tunings.js'), 'utf8') +
    '\n' +
    fs.readFileSync(path.join(refs, '07_preface_lexicon.js'), 'utf8') +
    '\nreturn { ROOMS, ROOM_CLUSTERS, PREFACE_LEXICON };';
  const { ROOMS, ROOM_CLUSTERS, PREFACE_LEXICON } = new Function(src)();
  return {
    rooms: ROOMS.map((r) => r.id),
    roomClusters: ROOM_CLUSTERS.map((c) => c.id),
    prefaces: PREFACE_LEXICON.map((p) => p.id),
  };
}

// Every row in these two lists carries a glyph pair, or the pair system is a
// lie — a row with no axis-2 glyph reads as "this one is different" when all it
// means is "nobody curated this one".
function reportCoverage(map, fail) {
  const have = catalogIds();
  const gaps = [];
  for (const [group, ids] of [
    ['rooms', have.rooms],
    ['roomClusters', have.roomClusters],
    ['prefaces', have.prefaces],
  ]) {
    const assigned = new Set(Object.keys(map[group] || {}));
    const missing = ids.filter((id) => !assigned.has(id));
    if (missing.length)
      gaps.push(
        `${group}: ${missing.length} unassigned (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''})`
      );
    const stale = Array.from(assigned).filter((id) => !ids.includes(id));
    if (stale.length)
      gaps.push(
        `${group}: ${stale.length} assigned to ids no longer in the catalog (${stale.slice(0, 6).join(', ')})`
      );
  }
  if (gaps.length) {
    const say = fail ? console.error : console.warn;
    say(`build_nav_glyphs: ${fail ? 'FAIL' : 'warning'} — glyph coverage is incomplete`);
    gaps.forEach((g) => say('  ' + (fail ? '✗' : '!') + ' ' + g));
    if (fail) process.exit(1);
  }
  return gaps.length === 0;
}

// A row whose own glyph is its cluster's glyph renders the pair as the same
// picture twice — ⛪⛪ for the cathedral, 🌲🌲 for the taiga. It happens to the
// archetypal member of a cluster, precisely because it is the obvious pick for
// both axes, and it looks like a rendering bug rather than a statement.
function checkAxisCollisions(map) {
  const roomCluster = {};
  const refs = path.join(__dirname, '..', 'references');
  const { ROOMS } = new Function(
    fs.readFileSync(path.join(refs, '03_rooms_chains_tunings.js'), 'utf8') + '\nreturn { ROOMS };'
  )();
  ROOMS.forEach((r) => (roomCluster[r.id] = r.cluster));

  const collisions = [];
  for (const id of Object.keys(map.rooms || {})) {
    const axis1 = (map.roomClusters || {})[roomCluster[id]];
    if (axis1 && axis1.cp === map.rooms[id].cp)
      collisions.push(`room ${id} repeats its cluster glyph ${axis1.char}`);
  }
  // Preface categories are derived at render time from tokens, so the same
  // check for prefaces lives in the app's data rather than here; what is
  // checkable at build time is that no preface reuses a category glyph at all.
  const catCps = new Set(Object.values(map.prefaceCategories || {}).map((v) => v.cp));
  for (const id of Object.keys(map.prefaces || {})) {
    if (catCps.has(map.prefaces[id].cp))
      collisions.push(`preface ${id} uses a category glyph ${map.prefaces[id].char}`);
  }

  if (collisions.length) {
    console.error(
      `build_nav_glyphs: FAIL — ${collisions.length} row(s) would draw the same glyph twice`
    );
    collisions.slice(0, 20).forEach((c) => console.error('  ✗', c));
    process.exit(1);
  }
}

// The artwork store and the per-axis tables for one assignment map. `relied` is
// codepoint → ['TABLE:key', …] from reliedOnNav(): every codepoint the tradition
// or emoji tables draw only from this store. One no room or preface uses is
// kept anyway, so dropping it is never a side effect of reassigning a row.
function generate(map, relied) {
  const svgs = {}; // codepoint → inner markup
  const charToCp = {};
  const meta = {};
  const emitted = {};
  const missing = [];
  let greened = 0;
  const addArt = (cp) => {
    const raw = extractInner(fs.readFileSync(path.join(EMOJI_DIR, cp + '.svg'), 'utf8'));
    const { svg, changed } = greenifySkin(raw, cp);
    if (changed) greened++;
    svgs[cp] = svg;
  };

  for (const group of GROUPS) {
    const entries = map[group.key] || {};
    const out = {};
    for (const id of Object.keys(entries).sort()) {
      const { cp, char, label } = entries[id];
      if (!fs.existsSync(path.join(EMOJI_DIR, cp + '.svg'))) {
        missing.push(`${group.key}/${id} → ${cp}`);
        continue;
      }
      if (!svgs[cp]) addArt(cp);
      charToCp[char] = cp;
      if (group.axis1 && label) meta[char] = { label };
      out[id] = char;
    }
    emitted[group.constName] = out;
  }

  const kept = [];
  for (const cp of Array.from(relied.keys()).sort()) {
    if (svgs[cp]) continue;
    if (!fs.existsSync(path.join(EMOJI_DIR, cp + '.svg'))) {
      missing.push(`${relied.get(cp)[0]} → ${cp} (relied on by another store)`);
      continue;
    }
    addArt(cp);
    kept.push(cp);
  }
  return { svgs, charToCp, meta, emitted, missing, greened, kept };
}

// Control for the keep rule: plant the edit that used to blank a glyph. Take a
// codepoint another store draws only from here, unassign every room and preface
// row that uses it, and require that it is still generated — and, so the plant is
// known to be real, that it is not generated when nothing relies on it.
function keepControl(map, relied) {
  const byUse = Array.from(relied.keys()).filter((cp) =>
    GROUPS.some((g) => Object.values(map[g.key] || {}).some((e) => e.cp === cp))
  );
  if (!byUse.length) return;
  const cp = byUse.sort((a, b) => relied.get(b).length - relied.get(a).length)[0];
  const planted = {};
  for (const [k, v] of Object.entries(map))
    planted[k] =
      v && typeof v === 'object' && GROUPS.some((g) => g.key === k)
        ? Object.fromEntries(Object.entries(v).filter(([, e]) => e.cp !== cp))
        : v;
  const kept = generate(planted, relied).svgs[cp];
  const dropped = !generate(planted, new Map()).svgs[cp];
  if (!kept || !dropped) {
    console.error(
      `build_nav_glyphs: FAIL — keep control: unassigning ${cp} (${relied.get(cp).length} dependent(s)) ` +
        (!dropped ? 'did not remove it, so the control proves nothing' : 'dropped its artwork')
    );
    process.exit(1);
  }
}

function main() {
  const check = process.argv.includes('--check');
  const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  reportCoverage(map, true);
  checkAxisCollisions(map);

  const stores = readGlyphStores();
  const relied = reliedOnNav(stores);
  const { svgs, charToCp, meta, emitted, missing, greened, kept } = generate(map, relied);

  if (missing.length) {
    console.error(`build_nav_glyphs: ${missing.length} assignments have no vendored SVG:`);
    missing.slice(0, 20).forEach((m) => console.error('  ✗', m));
    console.error('  run: node scripts/fetch_emoji.js --source=npm');
    process.exit(1);
  }

  // Every codepoint the tradition, emoji and nav tables name must still draw
  // with the store this run produces.
  const blank = unresolvedGlyphs({ ...stores, NAV_GLYPH_SVGS: svgs, NAV_GLYPH_CP: charToCp });
  if (blank.length) {
    console.error(
      `build_nav_glyphs: FAIL — ${blank.length} glyph reference(s) would draw nothing:`
    );
    blank.slice(0, 20).forEach((r) => console.error(`  ✗ ${r.table}:${r.key} → ${r.cp}`));
    process.exit(1);
  }

  const j = (o) => JSON.stringify(o);
  const counts = GROUPS.map((g) => `${g.constName}: ${Object.keys(emitted[g.constName]).length}`);
  const distinct = Object.keys(svgs).length;
  const roomChars = new Set(Object.values(emitted.ROOM_GLYPH));
  const prefChars = new Set(Object.values(emitted.PREFACE_GLYPH));

  const body = `// Navigation glyph vocabulary for rooms and prefaces. (auto-generated)
// Source: Twemoji SVGs in references/_assets/emoji/ (CC-BY 4.0)
// Built from scripts/_nav_glyph_map.json via scripts/build_nav_glyphs.js
//
// ${counts.join(' · ')}
// Distinct glyphs: ${distinct} (${roomChars.size} across the rooms, ${prefChars.size} across the prefaces)
// Human-skin glyphs recoloured to the codex green at build time: ${greened}
${kept.length ? `// Kept for the tradition and emoji tables, which no room or preface uses: ${kept.length}\n` : ''}//
// Rendered as an axis-1 + axis-2 pair, the same system the tradition tree uses:
// the cluster/category glyph tells you which neighbourhood you are in, the
// per-row glyph tells you which row. To regenerate, see build_nav_glyphs.js.

const NAV_GLYPH_SVGS = ${j(svgs)};

const NAV_GLYPH_CP = ${j(charToCp)};

const NAV_GLYPH_META = ${j(meta)};

${GROUPS.map((g) => `const ${g.constName} = ${j(emitted[g.constName])};`).join('\n\n')}
`;

  if (check) {
    keepControl(map, relied);
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (current !== body) {
      console.error('build_nav_glyphs: FAIL — references/09_nav_glyphs.js is stale');
      console.error('  run: node scripts/build_nav_glyphs.js');
      process.exit(1);
    }
    console.log('build_nav_glyphs: OK — 09_nav_glyphs.js matches its sources');
    return;
  }

  fs.writeFileSync(OUT_FILE, body);

  console.log(
    `Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(body.length / 1024).toFixed(0)} KB)`
  );
  console.log(`  ${counts.join('\n  ')}`);
  console.log(
    `  distinct glyphs: ${distinct}  (rooms ${roomChars.size}, prefaces ${prefChars.size})`
  );
  console.log(`  skin recoloured: ${greened}`);
  console.log(
    `  shared with the tradition and emoji tables: ${relied.size} codepoint(s) they draw only from here` +
      (kept.length ? `, ${kept.length} kept although no room or preface uses them` : '')
  );
}

main();
