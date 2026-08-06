#!/usr/bin/env node
'use strict';
// check_edit_parity.js — the app and the connector must EDIT alike, not just
// render alike.
//
// @covers: connector-edit-parity
//
// WHY THIS EXISTS. check_app_parity.js proves that for a given workspace every
// format renders byte-identically to the browser. That is a statement about
// SEED + RENDER, and it says nothing about what happens in between. So when
// `set_variant` was a bare field assignment while the browser ran an inverse
// cascade around the same edit, the two surfaces produced different recipes
// from the same user action and every gate stayed green.
//
// The discrepancy was not even hidden — _inverse_configure.js carried it in a
// comment ("the browser passes pin when a material edit triggers the cascade;
// the connector/CLI don't pin today"). A known difference that no test asserts
// is a difference that is free to grow, and mcp/README.md meanwhile promised
// the connector was "the headless twin of the browser app".
//
// WHAT IT COMPARES. Three edit actions, each run through BOTH surfaces, with
// the resulting card AND the rendered recipe compared:
//
//   set_variant      app reconfigureAfterPartEdit  vs  W.setVariant
//   set_preface      app commitPrefaceChange       vs  W.setPreface
//   set_environment  the app's field write         vs  W.setEnvironment
//
// The app's real functions are called through _load_app.js — nothing here
// re-implements a cascade. The one exception is set_environment, where the app
// has no callable entry point (its handler assigns the field inline), so that
// section mirrors the assignment and pins the mirroring with a source tripwire;
// see the note above it.
//
// RENDERING IS PART OF THE COMPARISON, and was not always. This gate used to
// compare card STATE and stop, while check_app_parity rendered only fresh seeds
// — so "the connector renders what the app renders" was gated over exactly the
// workspaces where nothing had been edited. A real divergence lived in that
// seam: the two renderers keyed preface locking on different fields, so every
// set_variant produced a different recipe from the same cards, in all four
// formats, with both gates green. Matching state is necessary and not
// sufficient, because the two surfaces are different functions OF that state.
//
// Each section refuses to pass vacuously — a run where no cascade fired, no
// preface reshaped a card, or no environment case ran fails rather than
// reporting agreement it never tested.
//
// Usage:
//   node scripts/check_edit_parity.js            # default sample
//   node scripts/check_edit_parity.js --limit=200
//   node scripts/check_edit_parity.js --show=5   # print up to N full diffs
// Exit 0 if every edit agrees, 1 otherwise.

const fs = require('fs');
const path = require('path');
const C = require('./_loader.js'); // populates globalThis for app.js
const { loadApp } = require('./_load_app.js');
const W = require('./_workspace_ops.js');
const { renderWorkspace } = require('./_seed_workspace.js');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const LIMIT = parseInt(flag('limit', '120'), 10);
const SHOW = parseInt(flag('show', '3'), 10);

let app;
try {
  app = loadApp();
} catch (e) {
  console.error('Could not load src/app.js headlessly:\n  ' + e.message);
  process.exit(2);
}

const clone = (x) => JSON.parse(JSON.stringify(x));

// Render-parity constants, matching check_app_parity.js so the two gates make
// the same claim about the same formats at the same ceiling — one covering
// seeded workspaces, this one covering edited ones.
const FORMATS = ['rich', 'tags', 'prose', 'compact'];
const CEILING = 1000;
const firstDiff = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
};

// Compare only what an edit can write. `id` and `traditionId` are identity, and
// prefaceLock is connector-only bookkeeping the app has no concept of — folding
// either into the comparison would report a difference that is not one.
function shapeOf(card) {
  return {
    parts: card.parts || {},
    tuning: card.tuning ?? null,
    room: card.room ?? null,
    chain: card.chain || {},
    preface: card.preface ?? null,
    prefaceAuto: card.prefaceAuto !== false,
  };
}

function diff(a, b) {
  const out = [];
  const A = shapeOf(a);
  const B = shapeOf(b);
  for (const key of ['tuning', 'room', 'preface', 'prefaceAuto']) {
    if (A[key] !== B[key]) out.push(`${key}: app=${A[key]} connector=${B[key]}`);
  }
  for (const partId of new Set([...Object.keys(A.parts), ...Object.keys(B.parts)])) {
    if (A.parts[partId] !== B.parts[partId])
      out.push(`parts.${partId}: app=${A.parts[partId]} connector=${B.parts[partId]}`);
  }
  const norm = (v) => (Array.isArray(v) ? v.join('\0') : (v ?? null));
  for (const stage of new Set([...Object.keys(A.chain), ...Object.keys(B.chain)])) {
    if (norm(A.chain[stage]) !== norm(B.chain[stage]))
      out.push(
        `chain.${stage}: app=${JSON.stringify(A.chain[stage])} connector=${JSON.stringify(B.chain[stage])}`
      );
  }
  return out;
}

// Sample across the catalog rather than one favourite tradition: the cascade's
// behaviour depends on the tradition signature and the instrument's axes, so a
// single-tradition check would pass while most of the catalog diverged. Strided
// so the selection is deterministic and spread, not the alphabetical head.
function sample() {
  const trads = (C.TRADITIONS || []).filter((t) => (t.instruments || []).length);
  const cases = [];
  const stride = Math.max(1, Math.floor(trads.length / LIMIT));
  for (let i = 0; i < trads.length && cases.length < LIMIT; i += stride) {
    const trad = trads[i];
    const cards = W.seed([trad.id]).cards;
    if (!cards.length) continue;
    const card = cards[i % cards.length];
    const inst = (C.INSTRUMENTS || []).find((x) => x.id === card.instrumentId);
    if (!inst) continue;
    // A part with a real choice, and a variant that is NOT the current pick —
    // editing to the value already there would exercise nothing.
    //
    // ROTATE which eligible part is taken, rather than always the first. The
    // sample used to `break` on the first ≥2-variant part of every instrument,
    // which sounds like sampling but is not: across the whole run it always
    // exercised the same slot of each instrument, so any part that is never
    // first was never once compared, in any tradition. That is a systematic
    // blind spot rather than a random one — the class of thing sampling is
    // supposed to eliminate. Striding by `i` keeps the selection deterministic
    // (same cases every run, so a failure reproduces) while spreading coverage
    // across the parts an instrument actually has.
    const eligible = [];
    for (const part of inst.parts || []) {
      const variants = part.variants || [];
      if (variants.length < 2) continue;
      const alt = variants.find((v) => v.id !== card.parts[part.id]);
      if (alt) eligible.push({ part: part.id, variant: alt.id });
    }
    if (eligible.length) {
      const pick = eligible[i % eligible.length];
      cases.push({ tradition: trad.id, card, part: pick.part, variant: pick.variant });
    }
  }
  return cases;
}

const cases = sample();
console.log(`=== Edit parity: app reconfigureAfterPartEdit vs connector set_variant ===`);
console.log(`  ${cases.length} (tradition, instrument, part) case(s)\n`);

let mismatches = 0;
let shown = 0;
let cascaded = 0;
let renderMismatches = 0;
let rendersCompared = 0;
for (const c of cases) {
  // APP: mutate the part on its own card copy, then run the browser's cascade.
  const appCard = clone(c.card);
  appCard.parts[c.part] = c.variant;
  app.reconfigureAfterPartEdit(appCard, c.part);

  // CONNECTOR: the same edit through the workspace op.
  const ws = { cards: [clone(c.card)] };
  const after = W.setVariant(ws, c.card.id, c.part, c.variant);
  const connCard = after.cards[0];

  // Did the cascade actually do something beyond the edited part? A run where
  // every case was a no-op would pass trivially and prove nothing.
  const before = clone(c.card);
  if (
    Object.keys(connCard.parts).some((k) => k !== c.part && connCard.parts[k] !== before.parts[k])
  )
    cascaded++;

  const d = diff(appCard, connCard);
  if (d.length) {
    mismatches++;
    if (shown < SHOW) {
      shown++;
      console.log(`  ✗ ${c.tradition} / ${c.card.instrumentId} / ${c.part} → ${c.variant}`);
      for (const line of d.slice(0, 8)) console.log(`      ${line}`);
    }
  }
  // The user's pick is the one thing a cascade may never revert.
  if (connCard.parts[c.part] !== c.variant) {
    mismatches++;
    console.log(
      `  ✗ ${c.tradition} / ${c.card.instrumentId}: the pin failed — ${c.part} came back ${connCard.parts[c.part]}, not ${c.variant}`
    );
  }

  // AND THEN RENDER BOTH, which is the check this gate was missing.
  //
  // Matching card STATE is necessary and not sufficient: the two surfaces are
  // different functions OF that state, so they can agree on every field above
  // and still print different recipes. That is not hypothetical — it is what
  // happened. The app treated `prefaceAuto === false` as a dedup lock while the
  // Node renderer keyed on `prefaceLock`, a field set_variant does not write, so
  // after every material edit the connector re-deduped a preface the app had
  // pinned: same cards, different words. 72 of 1,200 post-edit renders diverged.
  //
  // Neither parity gate could see it. check_app_parity renders only fresh seeds,
  // where no card is pinned and the predicates coincide; this gate compared
  // state and stopped. The defect lived in the seam between two green gates, and
  // AGENTS.md promised byte-identical renders "for the same workspace" the whole
  // time. shapeOf() even excludes prefaceLock as "a difference that is not one",
  // which was true about the card and false about the output.
  //
  // So: every sampled edit is now rendered through BOTH engines in EVERY format
  // and compared byte-for-byte, exactly as check_app_parity does for seeds.
  for (const format of FORMATS) {
    const appOut = app.compileRecipeStack([clone(appCard)], format, { ceiling: CEILING });
    const connOut = renderWorkspace(clone(after.cards), { format, ceiling: CEILING });
    rendersCompared++;
    if (appOut !== connOut) {
      renderMismatches++;
      if (shown < SHOW) {
        shown++;
        const at = firstDiff(appOut, connOut);
        console.log(
          `  ✗ RENDER ${c.tradition} / ${c.card.instrumentId} / ${c.part} → ${c.variant} [${format}] diverges at char ${at}`
        );
        console.log(`      app:       ${appOut.slice(Math.max(0, at - 30), at + 60)}`);
        console.log(`      connector: ${connOut.slice(Math.max(0, at - 30), at + 60)}`);
      }
    }
  }
}

console.log(`\n  cases where the cascade moved something else: ${cascaded}/${cases.length}`);
if (cascaded === 0) {
  console.log(
    '\nEDIT PARITY: FAIL — no case exercised the cascade, so agreement here proves nothing.'
  );
  process.exit(1);
}
console.log(`  post-edit renders compared: ${rendersCompared} (${FORMATS.length} formats × cases)`);

// ── set_preface ─────────────────────────────────────────────────────────────
//
// The second unfilled cell. set_variant was gated (above) and set_preface was
// not, though it is the edit the connector's own instructions push hardest —
// "mood/feel words → search_prefaces, then set_preface on EACH instrument".
//
// Both sides run their REAL implementation: the app's commitPrefaceChange
// (exported through _load_app.js) against the connector's setPreface. Nothing
// here re-implements the cascade, so the gate cannot drift into agreeing with
// itself.
//
// The two are deliberately NOT identical in state — setPreface writes
// prefaceLock and the app has no such field — which is exactly why the render
// comparison carries the weight. shapeOf() excludes prefaceLock as "a difference
// that is not one"; that is true of the card and was famously false of the
// output until the renderers were aligned on prefaceAuto.
console.log('\n=== Preface parity: app commitPrefaceChange vs connector set_preface ===');
const prefaces = (C.PREFACE_LEXICON || []).map((p) => p.id);
let prefaceCases = 0;
let prefaceRefused = 0;
let prefaceReshaped = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const prefaceId = prefaces[i % prefaces.length];
  if (!prefaceId) break;

  // The connector REFUSES a preface it cannot inverse-configure onto an
  // instrument; the app falls back to labelling without reshaping. That is a
  // known, deliberate difference in error policy rather than in output, so
  // those pairs are skipped and counted — not silently swallowed.
  let after;
  try {
    after = W.setPreface({ cards: [clone(c.card)] }, c.card.id, prefaceId);
  } catch {
    prefaceRefused++;
    continue;
  }
  const connCard = after.cards[0];

  const appCard = clone(c.card);
  app.commitPrefaceChange(appCard, prefaceId);
  prefaceCases++;
  if (JSON.stringify(appCard.parts) !== JSON.stringify(c.card.parts)) prefaceReshaped++;

  const d = diff(appCard, connCard);
  if (d.length) {
    mismatches++;
    if (shown < SHOW) {
      shown++;
      console.log(`  ✗ ${c.tradition} / ${c.card.instrumentId} → preface ${prefaceId}`);
      for (const line of d.slice(0, 8)) console.log(`      ${line}`);
    }
  }
  for (const format of FORMATS) {
    const appOut = app.compileRecipeStack([clone(appCard)], format, { ceiling: CEILING });
    const connOut = renderWorkspace(clone(after.cards), { format, ceiling: CEILING });
    rendersCompared++;
    if (appOut !== connOut) {
      renderMismatches++;
      if (shown < SHOW) {
        shown++;
        const at = firstDiff(appOut, connOut);
        console.log(
          `  ✗ RENDER ${c.tradition} / ${c.card.instrumentId} → preface ${prefaceId} [${format}] diverges at char ${at}`
        );
        console.log(`      app:       ${appOut.slice(Math.max(0, at - 30), at + 60)}`);
        console.log(`      connector: ${connOut.slice(Math.max(0, at - 30), at + 60)}`);
      }
    }
  }
}
console.log(
  `  ${prefaceCases} preface edit(s) compared, ${prefaceReshaped} of which reshaped parts (${prefaceRefused} refused by the connector and skipped)`
);
// A run where every preface landed as a bare relabel would pass while proving
// nothing about the inverse cascade — the same anti-vacuity rule the set_variant
// section applies to its own cascade counter.
if (prefaceCases === 0 || prefaceReshaped === 0) {
  console.log(
    '\nEDIT PARITY: FAIL — no preface case reshaped a card, so agreement here proves nothing.'
  );
  process.exit(1);
}

// ── set_environment ─────────────────────────────────────────────────────────
//
// The third unfilled cell, and the one that needs a word about method.
//
// The app has no callable set_environment: its handler writes the field inline
// (src/app.js — `card.tuning = t.dataset.setTuning || null`, `card.room = ...`,
// `card.chain[sId] = itemId || null`) and re-renders. So this section performs
// that same assignment rather than calling an app function, which is the one
// place in this gate where the app side is reproduced instead of invoked.
//
// That reproduction is held honest by the source tripwire below: if the app's
// handler ever stops being a plain assignment, the assertion fails and whoever
// changed it has to update this gate deliberately. A copied one-liner with no
// tripwire is how a parity gate quietly starts testing itself.
//
// What is actually being gated is downstream of the assignment anyway: the
// renderer reads tuning/room/chain from the PRIMARY card only, so the question
// is whether both surfaces agree about what an environment edit does to the
// output — and the app's real compileRecipeStack answers for the app side.
console.log('\n=== Environment parity: app field write vs connector set_environment ===');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const ENV_WRITES = [
  { label: 'tuning', re: /card\.tuning\s*=\s*t\.dataset\.setTuning\s*\|\|\s*null/ },
  { label: 'room', re: /card\.room\s*=\s*t\.dataset\.setRoom\s*\|\|\s*null/ },
  { label: 'chain stage', re: /card\.chain\[sId\]\s*=\s*itemId\s*\|\|\s*null/ },
];
let tripwireOk = true;
for (const w of ENV_WRITES) {
  if (!w.re.test(appSrc)) {
    tripwireOk = false;
    mismatches++;
    console.log(
      `  ✗ TRIPWIRE: the app's ${w.label} handler is no longer the plain assignment this section mirrors — re-read src/app.js and update it.`
    );
  }
}
if (tripwireOk) console.log('  ✓ the app still writes room/tuning/chain by plain assignment');

const rooms = (C.ROOMS || []).map((r) => r.id);
const tunings = (C.TUNINGS || []).map((t) => t.id);
const singleStages = (C.CHAIN_SECTIONS || []).filter(
  (s) => !s.multiSelect && (s.items || []).length
);
let envCases = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const room = rooms[i % rooms.length];
  const tuning = tunings[i % tunings.length];
  const stage = singleStages[i % singleStages.length];
  if (!room || !tuning || !stage) break;
  const item = stage.items[i % stage.items.length];

  const appCard = clone(c.card);
  appCard.room = room || null;
  appCard.tuning = tuning || null;
  appCard.chain[stage.id] = item.id || null;

  const after = W.setEnvironment({ cards: [clone(c.card)] }, c.card.id, {
    room,
    tuning,
    chain: { [stage.id]: item.id },
  });
  const connCard = after.cards[0];
  envCases++;

  const d = diff(appCard, connCard);
  if (d.length) {
    mismatches++;
    if (shown < SHOW) {
      shown++;
      console.log(
        `  ✗ ${c.tradition} / ${c.card.instrumentId} → room=${room} tuning=${tuning} ${stage.id}=${item.id}`
      );
      for (const line of d.slice(0, 8)) console.log(`      ${line}`);
    }
  }
  for (const format of FORMATS) {
    const appOut = app.compileRecipeStack([clone(appCard)], format, { ceiling: CEILING });
    const connOut = renderWorkspace(clone(after.cards), { format, ceiling: CEILING });
    rendersCompared++;
    if (appOut !== connOut) {
      renderMismatches++;
      if (shown < SHOW) {
        shown++;
        const at = firstDiff(appOut, connOut);
        console.log(
          `  ✗ RENDER ${c.tradition} / ${c.card.instrumentId} → environment [${format}] diverges at char ${at}`
        );
        console.log(`      app:       ${appOut.slice(Math.max(0, at - 30), at + 60)}`);
        console.log(`      connector: ${connOut.slice(Math.max(0, at - 30), at + 60)}`);
      }
    }
  }
}
console.log(`  ${envCases} environment edit(s) compared`);
if (envCases === 0) {
  console.log('\nEDIT PARITY: FAIL — no environment case ran; agreement here proves nothing.');
  process.exit(1);
}

// Same anti-vacuity rule the cascade check above uses: a render comparison that
// never ran is not a render comparison that passed.
if (rendersCompared === 0) {
  console.log('\nEDIT PARITY: FAIL — no post-edit render was compared; agreement proves nothing.');
  process.exit(1);
}
if (mismatches || renderMismatches) {
  if (mismatches)
    console.log(`\nEDIT PARITY: FAIL — ${mismatches} case(s) diverged in card state.`);
  if (renderMismatches)
    console.log(
      `EDIT PARITY: FAIL — ${renderMismatches}/${rendersCompared} post-edit render(s) diverged.`
    );
  process.exit(1);
}
console.log(
  `\nEDIT PARITY: PASS — set_variant, set_preface and set_environment each reshape the card identically in both surfaces, and all ${rendersCompared} post-edit renders are byte-identical across every format.`
);
process.exit(0);
