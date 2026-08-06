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
// WHAT IT COMPARES. For each sampled (tradition, instrument, part, variant):
// run the browser's OWN reconfigureAfterPartEdit on a card, run the connector's
// setVariant on the same card, and require the resulting parts / tuning / room /
// chain / preface to match exactly. The app's real function is called through
// _load_app.js — nothing here re-implements it.
//
// Usage:
//   node scripts/check_edit_parity.js            # default sample
//   node scripts/check_edit_parity.js --limit=200
//   node scripts/check_edit_parity.js --show=5   # print up to N full diffs
// Exit 0 if every edit agrees, 1 otherwise.

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
  '\nEDIT PARITY: PASS — a material edit reshapes the card identically in both surfaces, and the edited workspace RENDERS byte-identically in every format.'
);
process.exit(0);
