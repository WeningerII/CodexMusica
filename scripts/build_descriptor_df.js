#!/usr/bin/env node
// build_descriptor_df.js — freeze the descriptor document-frequency table.
//
// PROBLEM THIS SOLVES: descriptor chunks are ordered by (tier asc, corpus
// DOCUMENT FREQUENCY asc, codepoint asc), and DF was a RAW COUNT recomputed at
// runtime over the whole INSTRUMENTS table plus TUNINGS / ROOMS /
// CHAIN_SECTIONS. So adding ONE instrument anywhere could reorder descriptors on
// cards nobody touched. Measured over all traditions (1167 of them at the time of the measurement): of 249,622 adjacent
// token pairs ordered by the DF comparison, 38,831 are decided by a DF margin of
// exactly 1 and 81,478 are DF-tied (order falling to the codepoint tiebreak) —
// ~48% of them are one catalog record away from flipping, and every single
// tradition contains at least one fragile pair. The cost landed on
// tests/regression_snapshot.json (1,171 fixtures), which had to be re-blessed on
// every catalog change; a routinely re-blessed snapshot cannot detect a real
// regression.
//
// THE FIX: the same idiom as scripts/build_signatures.js. DF becomes COMMITTED
// data — `references/_descriptor_df.json` — read by both renderers instead of
// recomputed:
//   - scripts/_recipe_stack.js requires the JSON directly.
//   - src/app.js cannot require() (it is inlined into codex.html), so the table
//     is inlined into it verbatim between the generated-block markers, exactly
//     as TRADITION_SIGNATURES is.
// Tokens ABSENT from the frozen table fall back to 999 in both renderers —
// byte-identical to how an unknown token behaves today.
//
// WHAT CHANGES WHEN YOU REGENERATE: `--freeze` is the ONLY command in the repo
// that can move descriptor order. Re-freezing adopts today's catalog counts, so
// tokens whose DF changed since the last freeze move within their tier, and
// tests/regression_snapshot.json + tests/app_recipe_snapshot.json + api/ +
// codex.html must be rebuilt and re-blessed IN THE SAME COMMIT. That is the
// point: re-blessing becomes a deliberate, reviewable event instead of a side
// effect of adding an instrument.
//
// MODES (mirrors build_signatures.js)
//   node scripts/build_descriptor_df.js            # regen the app.js block from the JSON; verify
//   node scripts/build_descriptor_df.js --freeze   # RE-COUNT from the live catalog, rewrite the
//                                                  # JSON, then regen the app.js block  ← moves output
//   node scripts/build_descriptor_df.js --check    # verify only, no writes (CI/tandem/faults)
//
// EXIT CODES
//   0  ok
//   1  parity drift, coverage below the floor, or a malformed table
//   2  a required source file is missing / unparseable

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'references/_descriptor_df.json');
const APP_PATH = path.join(ROOT, 'src/app.js');

const flags = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, '')));

// ─────────────────────────── staleness budget ───────────────────────────
// A frozen table is ALLOWED to lag the catalog — that lag is the whole feature.
// What must not happen is the lag growing without bound: every token the catalog
// gains after a freeze is unknown to the table and falls to 999, so it piles up
// at the back of every chunk it appears in and the DF ordering stops meaning
// anything. COVERAGE_FLOOR bounds that drift.
//
// Calibration (measured on the catalog this floor was set against: 870
// instruments / 120 tunings / 256 rooms / 253 chain items → 9,044 distinct
// tokens over 26,856 occurrences): 602 instruments own at least one token no
// other record carries, a mean of 8.0 exclusive tokens each. At 0.97 the table
// may go unknown-to ~280 new distinct tokens ≈ 35 new instruments before CI
// demands a re-freeze. Raise the floor to re-freeze more often (finer-grained
// ordering, more snapshot re-blesses); lower it to re-freeze less often.
const COVERAGE_FLOOR = 0.97;

// Codepoint order — locale-invariant, and the same comparator the renderers use
// for the descriptor tiebreak. Key order in the emitted files is cosmetic (both
// consumers do map lookups), but a fixed order keeps the generator a pure
// function of the catalog and keeps re-freeze diffs readable.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ─────────────────────── live DF over the catalog ───────────────────────
// MUST stay semantically identical to the `_ensureDF` / `_ensureDescriptorDF`
// bodies this replaces — including the `v.expanded` skip (universal
// cross-instrument materials don't shift corpus DF). If this and the renderers
// ever disagree about WHAT is counted, the freeze silently reorders output.
function liveCounts() {
  const C = require('./_loader.js');
  const df = new Map();
  const bump = (d) => df.set(d, (df.get(d) || 0) + 1);
  const src = { instruments: 0, variants: 0, tunings: 0, rooms: 0, chain_items: 0 };
  for (const inst of C.INSTRUMENTS || []) {
    src.instruments++;
    for (const part of inst.parts || []) {
      for (const v of part.variants || []) {
        if (v.expanded) continue;
        src.variants++;
        for (const d of v.descriptors || []) bump(d);
      }
    }
  }
  for (const t of C.TUNINGS || []) {
    src.tunings++;
    for (const d of t.descriptors || []) bump(d);
  }
  for (const r of C.ROOMS || []) {
    src.rooms++;
    for (const d of r.descriptors || []) bump(d);
  }
  for (const sec of C.CHAIN_SECTIONS || []) {
    for (const it of sec.items || []) {
      src.chain_items++;
      for (const d of it.descriptors || []) bump(d);
    }
  }
  return { df, src };
}

// A key of `__proto__` in an OBJECT LITERAL sets the prototype instead of
// creating a property, so it would silently vanish from the app.js block while
// surviving in the JSON (JSON.parse special-cases it). No such token exists
// today; refuse to emit one rather than ship the asymmetry.
const FORBIDDEN_KEYS = new Set(['__proto__']);
function assertEmittable(tokens) {
  const bad = tokens.filter((t) => FORBIDDEN_KEYS.has(t));
  if (bad.length)
    throw new Error(`descriptor token(s) cannot be inlined safely: ${bad.join(', ')}`);
  const nonStr = tokens.filter((t) => typeof t !== 'string' || t.length === 0);
  if (nonStr.length) throw new Error(`${nonStr.length} empty/non-string descriptor token(s)`);
}

// ─────────────────────────── file rendering ───────────────────────────
function renderJson(df, src) {
  const keys = [...df.keys()].sort(cmp);
  assertEmittable(keys);
  const lines = keys.map((k) => '    ' + JSON.stringify(k) + ': ' + df.get(k));
  const meta = {
    generator: 'scripts/build_descriptor_df.js',
    note: 'Frozen corpus document frequency. Regenerate ONLY with --freeze; doing so reorders descriptors and requires re-blessing the recipe snapshots in the same commit.',
    source: src,
    tokens: keys.length,
    occurrences: [...df.values()].reduce((a, b) => a + b, 0),
  };
  // Hand-rolled so the df block is one token per line (readable re-freeze
  // diffs) while the meta header stays compact. No timestamp: the file must be
  // a pure function of references/.
  return (
    '{\n' +
    '  "meta": ' +
    JSON.stringify(meta, null, 2).split('\n').join('\n  ') +
    ',\n' +
    '  "df": {\n' +
    lines.join(',\n') +
    '\n  }\n' +
    '}\n'
  );
}

// Single-quoted to satisfy the repo's eslint/prettier conventions for src/.
// One token per line, mirroring the TRADITION_SIGNATURES block's density.
function renderAppBlock(dfObj) {
  const keys = Object.keys(dfObj).sort(cmp);
  assertEmittable(keys);
  const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const lines = keys.map((k) => '  ' + q(k) + ': ' + dfObj[k] + ',');
  return 'const DESCRIPTOR_DF = {\n' + lines.join('\n') + '\n};';
}

const APP_BLOCK_RE = /const DESCRIPTOR_DF = (\{[\s\S]*?\n\});/;

function extractAppBlock() {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const m = app.match(APP_BLOCK_RE);
  if (!m) throw new Error('could not find `const DESCRIPTOR_DF = {…};` in src/app.js');
  // Evaluated, not JSON.parsed: the block is a JS object literal (single quotes).
  return { app, obj: new Function('return ' + m[1])(), raw: m[0] };
}

function readJsonTable() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(
      `${path.relative(ROOT, JSON_PATH)} is missing — run \`node scripts/build_descriptor_df.js --freeze\``
    );
  }
  const j = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  if (!j || typeof j.df !== 'object' || j.df === null) {
    throw new Error(`${path.relative(ROOT, JSON_PATH)} has no "df" object`);
  }
  return j;
}

function writeAppBlock(dfObj) {
  const { app, raw } = extractAppBlock();
  fs.writeFileSync(
    APP_PATH,
    app.replace(raw, () => renderAppBlock(dfObj))
  );
}

// Canonical form for comparison: sorted entries, so neither key-insertion order
// nor the integer-like-key hoisting that JS objects do can produce a false
// mismatch.
function canonical(obj) {
  return JSON.stringify(
    Object.keys(obj)
      .sort(cmp)
      .map((k) => [k, obj[k]])
  );
}

// ─────────────────────────── verification ───────────────────────────
// Every problem is collected and reported, never short-circuited: a truncated
// table breaks BOTH parity and coverage, and the operator needs to see which
// failure is the real one.
function verify() {
  const problems = [];
  const json = readJsonTable();
  const frozen = json.df;
  const frozenKeys = Object.keys(frozen);

  // 1. well-formedness — an empty or corrupt table would otherwise degrade
  //    silently to "every token is unknown" (df 999 everywhere).
  if (frozenKeys.length === 0) {
    problems.push('MALFORMED: the frozen df table is EMPTY (every token would fall back to 999)');
  }
  const badVals = frozenKeys.filter((k) => !Number.isInteger(frozen[k]) || frozen[k] < 1);
  if (badVals.length) {
    problems.push(
      `MALFORMED: ${badVals.length} token(s) have a non-positive-integer count (e.g. ${badVals[0]})`
    );
  }

  // 2. parity — src/app.js must carry exactly the committed table.
  let appObj = null;
  try {
    appObj = extractAppBlock().obj;
  } catch (e) {
    problems.push(`PARITY: ${e.message}`);
  }
  if (appObj && canonical(appObj) !== canonical(frozen)) {
    const a = new Set(Object.keys(appObj));
    const b = new Set(frozenKeys);
    const onlyApp = [...a].filter((k) => !b.has(k));
    const onlyJson = [...b].filter((k) => !a.has(k));
    const diffVal = [...a].filter((k) => b.has(k) && appObj[k] !== frozen[k]);
    problems.push(
      'PARITY: src/app.js DESCRIPTOR_DF != references/_descriptor_df.json ' +
        `(${onlyApp.length} only-in-app, ${onlyJson.length} only-in-json, ${diffVal.length} differing counts` +
        (diffVal.length
          ? `, e.g. ${diffVal[0]}: ${appObj[diffVal[0]]} vs ${frozen[diffVal[0]]}`
          : '') +
        ') — run `node scripts/build_descriptor_df.js`'
    );
  }

  // 3. coverage — how far the frozen table has fallen behind the live catalog.
  const { df: live } = liveCounts();
  const liveKeys = [...live.keys()];
  const unknown = liveKeys.filter((k) => !(k in frozen));
  const coverage = liveKeys.length ? (liveKeys.length - unknown.length) / liveKeys.length : 1;
  let liveOcc = 0;
  let coveredOcc = 0;
  for (const [k, n] of live) {
    liveOcc += n;
    if (k in frozen) coveredOcc += n;
  }
  const occCoverage = liveOcc ? coveredOcc / liveOcc : 1;
  const orphans = frozenKeys.filter((k) => !live.has(k));
  const moved = liveKeys.filter((k) => k in frozen && frozen[k] !== live.get(k));

  if (coverage < COVERAGE_FLOOR) {
    problems.push(
      `COVERAGE: the frozen table knows ${(coverage * 100).toFixed(2)}% of the catalog's ` +
        `${liveKeys.length} distinct descriptor tokens, below the ${(COVERAGE_FLOOR * 100).toFixed(0)}% floor ` +
        `(${unknown.length} unknown token(s) currently fall back to 999). Re-freeze deliberately: ` +
        '`node scripts/build_descriptor_df.js --freeze`, then rebuild api/ + codex.html and re-bless ' +
        'tests/regression_snapshot.json + tests/app_recipe_snapshot.json in the SAME commit.'
    );
  }

  return {
    problems,
    stats: {
      frozenTokens: frozenKeys.length,
      liveTokens: liveKeys.length,
      unknown: unknown.length,
      orphans: orphans.length,
      moved: moved.length,
      coverage,
      occCoverage,
    },
  };
}

function report(stats) {
  console.log(
    `  frozen tokens      ${stats.frozenTokens}\n` +
      `  live catalog tokens ${stats.liveTokens}\n` +
      `  unknown to table   ${stats.unknown} (fall back to df 999)\n` +
      `  orphaned in table  ${stats.orphans} (no longer in the catalog; harmless, never looked up)\n` +
      `  counts drifted     ${stats.moved} (token known but its live count moved since the freeze)\n` +
      `  token coverage     ${(stats.coverage * 100).toFixed(2)}%  (floor ${(COVERAGE_FLOOR * 100).toFixed(0)}%)\n` +
      `  occurrence cover   ${(stats.occCoverage * 100).toFixed(2)}%`
  );
}

// ─────────────────────────── main ───────────────────────────
function main() {
  if (flags.has('freeze')) {
    const { df, src } = liveCounts();
    fs.writeFileSync(JSON_PATH, renderJson(df, src));
    writeAppBlock(Object.fromEntries([...df.keys()].sort(cmp).map((k) => [k, df.get(k)])));
    const { problems, stats } = verify();
    if (problems.length) {
      console.error('freeze failed self-check:');
      for (const p of problems) console.error('  ✗ ' + p);
      process.exit(1);
    }
    console.log(
      `FROZE ${stats.frozenTokens} descriptor tokens into references/_descriptor_df.json and ` +
        'inlined them into src/app.js.'
    );
    console.log(
      'Descriptor ORDER may have moved. Rebuild and re-bless in this commit: `npm run build:api`, ' +
        '`CODEX_OUT_DIR="$(pwd)" node scripts/build_html.js`, then the recipe snapshots.'
    );
    return;
  }

  if (flags.has('check')) {
    const { problems, stats } = verify();
    if (problems.length === 0) {
      console.log(`DESCRIPTOR-DF: PASS — app.js block ≡ references/_descriptor_df.json.`);
      report(stats);
      process.exit(0);
    }
    console.error('DESCRIPTOR-DF: FAIL');
    for (const p of problems) console.error('  ✗ ' + p);
    report(stats);
    process.exit(1);
  }

  // Default: re-emit the app.js block from the (canonical) JSON. Never touches
  // the counts, so it can never move rendered output.
  const json = readJsonTable();
  writeAppBlock(json.df);
  const { problems, stats } = verify();
  if (problems.length) {
    console.error('regeneration did not settle:');
    for (const p of problems) console.error('  ✗ ' + p);
    process.exit(1);
  }
  console.log(
    `regenerated src/app.js DESCRIPTOR_DF from references/_descriptor_df.json (${stats.frozenTokens} tokens).`
  );
  report(stats);
}

try {
  main();
} catch (e) {
  console.error('DESCRIPTOR-DF: ' + e.message);
  process.exit(2);
}
