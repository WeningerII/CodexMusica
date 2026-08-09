#!/usr/bin/env node
'use strict';
// check_edit_differential.js — property-style differential testing of the two
// edit surfaces: the same SEEDED RANDOM edit script, applied through the app and
// through the connector, must leave both in states that render byte-identically
// after EVERY step.
//
// @covers: connector-edit-parity
//
// WHY THIS, WHEN check_edit_parity ALREADY EXISTS
//
// check_edit_parity is a matrix: three edit actions, each applied ONCE to a
// freshly seeded card, compared, done. It is precise and it is finite, and its
// finiteness is the problem. It answers "does set_variant agree in isolation?"
// It cannot answer "does set_variant agree on a card that a set_preface already
// reshaped, in a workspace whose first card was removed?" — and divergence
// between two hand-maintained forks of the same renderer is exactly the kind of
// thing that hides in the third move, not the first.
//
// The audit's argument for this file was that one property harness subsumes most
// of a 1,107-cell hand-picked matrix and would have caught F015/F054/F077/F090
// mechanically. Both gates are kept: the matrix names specific behaviours in
// readable prose and localises a failure to one action, while this one explores
// the composition space the matrix cannot enumerate.
//
// WHAT IS COMPARED
//
// A script is a sequence of ops drawn from the vocabulary both surfaces really
// expose. Each op is applied to both, then all four formats are rendered on both
// and byte-compared — after every op, not just at the end, so a divergence is
// reported at the step that caused it rather than at the end of the script.
//
// Cards are addressed POSITIONALLY. The two surfaces mint their own card ids
// from independent counters, so comparing by id would be comparing bookkeeping;
// index is the only shared address, and it is also what a user manipulating a
// roster actually means.
//
// The app side calls the app's own functions through _load_app.js — importTradition,
// addCard, rmCard, reconfigureAfterPartEdit, commitPrefaceChange, compileRecipeStack.
// Nothing here re-implements a cascade. The single exception is set_environment,
// where the app has no callable entry point (its handler assigns the field
// inline); that op mirrors the assignment and is pinned by the same source
// tripwire check_edit_parity uses, for the same reason — a copied one-liner with
// no tripwire is how a parity gate quietly starts testing itself.
//
// WHAT IS DELIBERATELY NOT COMPARED
//
// Render-time side effects. Both renderers auto-assign deduped prefaces onto
// cards as part of rendering, but the connector renders through a clone
// (_workspace_ops.render) while the app renders app.cards directly. Rendering
// four formats after every op would therefore accumulate mutation on one side
// only, and every subsequent comparison would be measuring that asymmetry
// instead of the edit semantics. So both sides render from a snapshot. This gate
// asserts "same edit script → same state → same bytes"; the clone-vs-mutate
// difference is real and out of scope here, noted so it is not mistaken for
// covered ground.
//
// NON-VACUITY
//
// A random harness that silently degenerates is worse than none, so this refuses
// to report success unless it actually explored:
//   • every op in the vocabulary applied at least MIN_PER_OP times,
//   • at least one comparison made against a roster of 2+ cards,
//   • at least one state reached where cards[0] carries NO environment — the
//     shape that produced the env-less-recipe bug this harness was written
//     alongside. That state is only reachable by composing ops (add a bare
//     instrument, drop the tradition that seeded the workspace), which is
//     precisely what a single-action matrix cannot construct.
// Each of those is reported as a count, and a shortfall fails the run.
//
// Usage:
//   node scripts/check_edit_differential.js
//   node scripts/check_edit_differential.js --scripts=40 --ops=12
//   node scripts/check_edit_differential.js --seed=12345   # replay one failure
//   node scripts/check_edit_differential.js --show=3       # print full diffs
// Exit 0 if every step of every script agrees.

const fs = require('fs');
const path = require('path');
const C = require('./_loader.js'); // populates globalThis for app.js
const { loadApp } = require('./_load_app.js');
const W = require('./_workspace_ops.js');
const { renderWorkspace } = require('./_seed_workspace.js');

const argv = process.argv.slice(2);
const num = (flag, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${flag}=`));
  return a ? Number(a.slice(flag.length + 3)) : dflt;
};
const SCRIPTS = num('scripts', 24);
const OPS = num('ops', 10);
const SHOW = num('show', 2);
const BASE_SEED = num('seed', 0x5eed1e);
const FORMATS = ['rich', 'prose', 'tags', 'compact'];
const CEILING = 1000;
const MIN_PER_OP = 3;

const app = loadApp();

// ── seeded PRNG ─────────────────────────────────────────────────────────────
// Same LCG constants as scripts/search.js's hill-climb restarts. Deterministic
// and replayable: every failure prints its seed, and --seed reruns that exact
// script.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── candidate pools ─────────────────────────────────────────────────────────
// Small fixed pools rather than the whole catalog: the point is to explore
// COMPOSITIONS of edits, and a wide id space would spend every script on ids
// that never interact. These cover a range of roster sizes and families.
const TRADITIONS = ['afrobeat', 'bluegrass', 'gamelan', 'zydeco', 'bossa_nova'].filter((id) =>
  (C.TRADITIONS || []).some((t) => t.id === id)
);
const INSTRUMENTS = ['kithara', 'guqin', 'concert_harp', 'drum_kit', 'saxophone'].filter((id) =>
  (C.INSTRUMENTS || []).some((i) => i.id === id)
);
const ROOMS = (C.ROOMS || []).slice(0, 12).map((r) => r.id);
const TUNINGS = (C.TUNINGS || []).slice(0, 8).map((t) => t.id);
const PREFACES = (C.PREFACE_LEXICON || []).slice(0, 24).map((p) => p.id);

if (!TRADITIONS.length || !INSTRUMENTS.length) {
  console.error('FAIL — catalog pools empty; refusing to pass vacuously');
  process.exit(1);
}

// ── the app's inline environment write, mirrored + tripwired ────────────────
// The app has no callable set_environment; its handler assigns the field inline
// and re-renders. Same three writes check_edit_parity pins, same reason: if the
// handler stops being a plain assignment, this fails loudly instead of silently
// testing a stale copy of the app.
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const ENV_WRITES = [
  { label: 'tuning', re: /card\.tuning\s*=\s*t\.dataset\.setTuning\s*\|\|\s*null/ },
  { label: 'room', re: /card\.room\s*=\s*t\.dataset\.setRoom\s*\|\|\s*null/ },
  { label: 'chain stage', re: /card\.chain\[sId\]\s*=\s*itemId\s*\|\|\s*null/ },
];
const tripwireBroken = ENV_WRITES.filter((w) => !w.re.test(appSrc));

const cloneCards = (cards) => JSON.parse(JSON.stringify(cards));
const hasEnv = (c) =>
  !!c &&
  (c.tuning ||
    c.room ||
    Object.values(c.chain || {}).some((v) => (Array.isArray(v) ? v.length > 0 : !!v)));

// ── the op vocabulary ───────────────────────────────────────────────────────
// Each op knows how to describe itself, apply itself to the app, and apply
// itself to the connector. `plan` picks concrete arguments from the CURRENT
// state so an op is always well-formed for the workspace it lands in — a script
// of mostly-invalid ops would explore nothing.
const OPS_TABLE = {
  add_tradition: {
    plan: (rnd) => ({ tid: TRADITIONS[Math.floor(rnd() * TRADITIONS.length)] }),
    label: (a) => `add_tradition(${a.tid})`,
    appply: (a) => app.importTradition(a.tid),
    conn: (ws, a) => W.addTradition(ws, a.tid),
  },
  remove_tradition: {
    // Only offered when a tradition is actually present, so it is a real removal
    // rather than a no-op that pads the op counter.
    plan: (rnd, st) => {
      const ids = [...new Set(st.conn.cards.map((c) => c.traditionId).filter(Boolean))];
      return ids.length ? { tid: ids[Math.floor(rnd() * ids.length)] } : null;
    },
    label: (a) => `remove_tradition(${a.tid})`,
    appply: (a) => {
      for (const c of app.app.cards.filter((c) => c.traditionId === a.tid))
        app.rmCard(c.id, { skipHistory: true });
    },
    conn: (ws, a) => W.removeTradition(ws, a.tid),
  },
  add_instrument: {
    // The BARE form on both sides — app addCard(id, {}) and W.addInstrument(ws,
    // id) with no tradition context. The tradition-context form is excluded
    // because the app reaches it through UI code with no headless entry point,
    // and inventing one here would mean comparing the connector against this
    // file's idea of the app.
    plan: (rnd) => ({ iid: INSTRUMENTS[Math.floor(rnd() * INSTRUMENTS.length)] }),
    label: (a) => `add_instrument(${a.iid})`,
    appply: (a) => app.addCard(a.iid, {}),
    conn: (ws, a) => W.addInstrument(ws, a.iid),
  },
  remove_instrument: {
    plan: (rnd, st) =>
      st.conn.cards.length ? { idx: Math.floor(rnd() * st.conn.cards.length) } : null,
    label: (a) => `remove_instrument(#${a.idx})`,
    appply: (a) => app.rmCard(app.app.cards[a.idx].id, {}),
    conn: (ws, a) => W.removeInstrument(ws, ws.cards[a.idx].id),
  },
  set_variant: {
    plan: (rnd, st) => {
      if (!st.conn.cards.length) return null;
      const idx = Math.floor(rnd() * st.conn.cards.length);
      const inst = (C.INSTRUMENTS || []).find((i) => i.id === st.conn.cards[idx].instrumentId);
      const parts = (inst && inst.parts) || [];
      if (!parts.length) return null;
      const part = parts[Math.floor(rnd() * parts.length)];
      const vs = part.variants || [];
      if (!vs.length) return null;
      return { idx, part: part.id, variant: vs[Math.floor(rnd() * vs.length)].id };
    },
    label: (a) => `set_variant(#${a.idx}, ${a.part}=${a.variant})`,
    // applyPartEdit, not reconfigureAfterPartEdit: the latter is the cascade the
    // browser runs ONLY for material parts, so calling it directly reached past
    // the guard and made this harness blind to the difference on the 1052 of
    // 1406 instruments that have no material part.
    appply: (a) => {
      const card = app.app.cards[a.idx];
      card.parts[a.part] = a.variant;
      app.applyPartEdit(card, a.part);
    },
    conn: (ws, a) => W.setVariant(ws, ws.cards[a.idx].id, a.part, a.variant),
  },
  set_preface: {
    plan: (rnd, st) => {
      if (!st.conn.cards.length || !PREFACES.length) return null;
      return {
        idx: Math.floor(rnd() * st.conn.cards.length),
        word: PREFACES[Math.floor(rnd() * PREFACES.length)],
      };
    },
    label: (a) => `set_preface(#${a.idx}, ${a.word})`,
    appply: (a) => app.commitPrefaceChange(app.app.cards[a.idx], a.word),
    conn: (ws, a) => W.setPreface(ws, ws.cards[a.idx].id, a.word),
  },
  set_environment: {
    plan: (rnd, st) => {
      if (!st.conn.cards.length) return null;
      const idx = Math.floor(rnd() * st.conn.cards.length);
      const pick = rnd();
      if (pick < 0.5 && ROOMS.length)
        return { idx, patch: { room: ROOMS[Math.floor(rnd() * ROOMS.length)] } };
      if (TUNINGS.length)
        return { idx, patch: { tuning: TUNINGS[Math.floor(rnd() * TUNINGS.length)] } };
      return null;
    },
    label: (a) => `set_environment(#${a.idx}, ${JSON.stringify(a.patch)})`,
    // Mirrors the app's inline assignment; held honest by the tripwire above.
    appply: (a) => Object.assign(app.app.cards[a.idx], a.patch),
    conn: (ws, a) => W.setEnvironment(ws, ws.cards[a.idx].id, a.patch),
  },
};
const OP_NAMES = Object.keys(OPS_TABLE);

// ── rendering both surfaces from a snapshot ─────────────────────────────────
function renderBoth(format) {
  const appOut = app.compileRecipeStack(cloneCards(app.app.cards), format, { ceiling: CEILING });
  const connOut = renderWorkspace(cloneCards(state.conn.cards), { format, ceiling: CEILING });
  return [appOut, connOut];
}

const firstDiff = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
};

// ── run ─────────────────────────────────────────────────────────────────────
console.log('=== Differential: random edit scripts through both surfaces ===\n');
if (tripwireBroken.length) {
  for (const w of tripwireBroken)
    console.log(
      `  ✗ TRIPWIRE: the app's ${w.label} handler is no longer the plain assignment set_environment mirrors.`
    );
}

let state = null;
const applied = Object.fromEntries(OP_NAMES.map((n) => [n, 0]));
let comparisons = 0;
let mismatches = 0;
let shown = 0;
let multiCardComparisons = 0;
let envlessHeadStates = 0;
const failures = [];

for (let s = 0; s < SCRIPTS; s++) {
  const seed = (BASE_SEED + s * 7919) >>> 0;
  const rnd = lcg(seed);

  // Both surfaces start from the same seeded tradition, through their own code.
  const startTid = TRADITIONS[Math.floor(rnd() * TRADITIONS.length)];
  app.app.cards = [];
  app.app.collapsedTraditionGroups = new Set();
  app.importTradition(startTid);
  state = { conn: W.seed([startTid]) };

  const trace = [`seed(${startTid})`];

  for (let o = 0; o < OPS; o++) {
    // Choose an op that can actually be planned against the current state.
    let name = null;
    let args = null;
    for (let tries = 0; tries < 12 && args == null; tries++) {
      name = OP_NAMES[Math.floor(rnd() * OP_NAMES.length)];
      args = OPS_TABLE[name].plan(rnd, state);
    }
    if (args == null) continue;
    const op = OPS_TABLE[name];

    try {
      op.appply(args);
      state.conn = op.conn(state.conn, args);
    } catch (e) {
      failures.push({ seed, step: o, trace: [...trace], note: `threw: ${e.message}` });
      mismatches++;
      break;
    }
    applied[name]++;
    trace.push(op.label(args));

    // Rosters must match before bytes can mean anything.
    if (app.app.cards.length !== state.conn.cards.length) {
      mismatches++;
      failures.push({
        seed,
        step: o,
        trace: [...trace],
        note: `roster size diverged: app=${app.app.cards.length} conn=${state.conn.cards.length}`,
      });
      break;
    }
    if (state.conn.cards.length > 1) multiCardComparisons++;
    if (state.conn.cards.length && !hasEnv(state.conn.cards[0])) envlessHeadStates++;

    let stepBad = false;
    for (const format of FORMATS) {
      const [a, b] = renderBoth(format);
      comparisons++;
      if (a !== b) {
        mismatches++;
        stepBad = true;
        if (shown < SHOW) {
          shown++;
          const at = firstDiff(a, b);
          console.log(`  ✗ seed=${seed} step=${o} format=${format}`);
          console.log(`      script: ${trace.join(' → ')}`);
          console.log(`      first difference at char ${at}`);
          console.log(`      app : …${a.slice(Math.max(0, at - 40), at + 60)}`);
          console.log(`      conn: …${b.slice(Math.max(0, at - 40), at + 60)}`);
        }
        failures.push({ seed, step: o, trace: [...trace], note: `${format} bytes differ` });
      }
    }
    if (stepBad) break;
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`  scripts: ${SCRIPTS} × up to ${OPS} ops`);
console.log(`  comparisons: ${comparisons} (${FORMATS.length} formats after every applied op)`);
console.log(`  ops applied: ${OP_NAMES.map((n) => `${n}=${applied[n]}`).join('  ')}`);
console.log(`  multi-card comparisons: ${multiCardComparisons}`);
console.log(`  states with an env-less cards[0]: ${envlessHeadStates}`);

const thin = OP_NAMES.filter((n) => applied[n] < MIN_PER_OP);
const problems = [];
if (tripwireBroken.length) problems.push(`${tripwireBroken.length} source tripwire(s) broken`);
if (thin.length)
  problems.push(`op(s) barely exercised (<${MIN_PER_OP}): ${thin.join(', ')} — widen the run`);
if (!multiCardComparisons) problems.push('never compared a roster of 2+ cards');
if (!envlessHeadStates)
  problems.push(
    'never reached a state where cards[0] has no environment — the composition this harness exists to reach'
  );

console.log('');
if (mismatches === 0 && problems.length === 0) {
  console.log(
    `EDIT DIFFERENTIAL: PASS — ${comparisons} byte comparisons across ${SCRIPTS} random edit\n` +
      'scripts; the app and the connector never diverged, and the run exercised every op,\n' +
      'multi-card rosters, and env-less-head states.'
  );
} else {
  if (mismatches) {
    console.error(`\nEDIT DIFFERENTIAL: FAIL — ${mismatches} divergence(s).`);
    for (const f of failures.slice(0, 10))
      console.error(`  seed=${f.seed} step=${f.step}: ${f.note}\n     ${f.trace.join(' → ')}`);
    console.error('\n  Replay one with: node scripts/check_edit_differential.js --seed=<seed>');
  }
  for (const p of problems) console.error(`  ✗ ${p}`);
  if (!mismatches)
    console.error(
      '\nEDIT DIFFERENTIAL: FAIL — no divergence found, but the run did not explore enough\n' +
        'to mean anything. A green from an unexplored space is worse than a red.'
    );
  process.exitCode = 1;
}
