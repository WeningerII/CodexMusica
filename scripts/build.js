#!/usr/bin/env node
// build.js — the LOCAL ship-this command: regenerate the artifacts and run the
// gates that are fast enough to want in a tight loop.
//
// IT IS NOT THE COMPLETE GATE SET, and nothing here should imply otherwise.
// .github/workflows/ci.yml is the enforcement surface — it runs eleven check_*
// gates this file does not (api contract, docs drift, promise bijection, preface
// lexicon, dead tokens, lazy-app, connector parity, app parity, workspace ops,
// mobile layout, artifact reproducibility, fault injection). Calling this file
// "canonical" while CI ran a different and larger list is how the two definitions
// drifted apart in the first place; they are now explicitly different jobs:
//
//   node scripts/build.js   — "I changed something, rebuild and sanity-check it."
//   CI                      — "this is allowed to merge."
//
// Every gate now belongs to at least one of the two: smoke.js moved into a third
// parallel CI job, and tandem.js into a weekly one. scripts/audit_coherence.js is
// deliberately in neither — it always exits 0 and only reports patterns worth a
// human's attention (e.g. 203 single-instrument traditions, nearly all of which
// are correct: guqin, shakuhachi, quranic recitation). It is an authoring aid, not
// a gate, and wiring it into CI would only teach people to ignore a green check.
//
// Runs in order:
//   1. validate.js          — verify all cross-references resolve, no orphan extras (FATAL on failure)
//   2. audit.js             — data-quality check (warnings only by default; --strict-audit to fail)
//   3. regression_recipes.js — snapshot-diff for canonical recipes (FATAL on any diff)
//   3b. regression_prefaces.js + check_slot_picks.js — anti-drift gates, fast (FATAL).
//       Formerly tandem-only; folded in so a green build can't hide a preface or
//       frozen-slot-pick regression. Skip with --skip-anti-drift.
//   4. smoke.js             — catalog-wide pipeline health: every tradition + blends + axis-targets
//                             generate working recipes (FATAL on any pipeline crash)
//   5. audit_dead_tokens, audit_profile_size — OPT-IN via --with-lexicon-audits (FATAL on failure)
//   6. build_html.js        — regenerate codex.html from current sources
//   7. ui_reachability_check.js — verify every reachable UI capability resolves (FATAL on failure)
//
// Order matters: smoke runs AFTER regression (regression is faster fail-fast for
// known recipes) and BEFORE build_html (smoke validates the JS pipeline; html-parse
// check inside smoke runs on whichever codex.html is already on disk from the
// previous build). ui_reachability_check runs LAST because it needs the freshly-
// built codex.html on disk and verifies the UI capability inventory still resolves.
//
// validate.js failure exits non-zero (the bundle isn't safe to ship).
// audit.js failure (errors only — warnings are advisory) ALSO exits non-zero.
// regression_recipes.js failure exits non-zero (intentional diffs need explicit --update).
// smoke.js failure exits non-zero (any tradition that crashes the pipeline blocks ship).
// ui_reachability_check.js failure exits non-zero (a reachable inventory entry stopped resolving).
//
// USAGE
//   node scripts/build.js
//   node scripts/build.js --html-out=/path/to/codex.html
//   node scripts/build.js --strict-audit            # treat audit warnings as errors too
//   node scripts/build.js --skip-audit              # skip audit entirely (NOT recommended)
//   node scripts/build.js --skip-regression         # skip regression diff (use during major refactors)
//   node scripts/build.js --skip-smoke              # skip catalog-wide smoke (saves ~16 min during iteration)
//   node scripts/build.js --skip-ui-check           # skip UI reachability check (rarely needed)
//   node scripts/build.js --with-lexicon-audits    # also run audit_dead_tokens + audit_profile_size (extra lexicon checks)

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPTS = __dirname;

function run(name, args = [], { allowFail = false } = {}) {
  console.error(`▶ ${name}`);
  const r = spawnSync('node', [path.join(SCRIPTS, name), ...args], { stdio: 'inherit' });
  if (r.status !== 0 && !allowFail) {
    console.error(`✗ ${name} failed with status ${r.status}`);
    process.exit(r.status);
  }
  return r.status;
}

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      flags[a.slice(2)] = true;
    }
  }
}

run('validate.js');

if (!flags['skip-audit']) {
  const auditArgs = [];
  if (flags['strict-audit']) auditArgs.push('--strict');
  run('audit.js', auditArgs);
}

if (!flags['skip-regression']) {
  run('regression_recipes.js');
}

// Anti-drift gates (fast, < 2s each). Previously these ran only inside tandem.js,
// so the canonical ship command could go green over a frozen-slot-pick drift or a
// preface-assignment regression. Folded here as FATAL steps to close that gap.
// regression_prefaces: 79 byte-equivalent-to-HTML-embed preface fixtures.
// check_slot_picks: frozen (tradition × instrument × part) → variant lock-ins for
// picks that don't surface in rendered recipe text (e.g. isolated cymbal/shell).
if (!flags['skip-anti-drift']) {
  run('regression_prefaces.js');
  run('check_slot_picks.js');
  run('app_recipe_regression.js');
  // Behavioral browser↔node equivalence — asserts the shipped HTML and the CLI
  // primitives produce identical descriptor sets + preface picks on shared
  // fixtures (textual parity checks in tandem.js can't catch output drift).
  run('equivalence.js');
}

if (!flags['skip-smoke']) {
  run('smoke.js');
}

// Optional lexicon-shape audits — opt-in via --with-lexicon-audits. These are
// informational gates for in-progress lexicon-correction work; enable them once
// the lexicon is in good shape.
if (flags['with-lexicon-audits']) {
  run('audit_dead_tokens.js');
  run('audit_profile_size.js');
}

const buildHtmlArgs = [];
if (flags['html-out']) buildHtmlArgs.push(`--out=${flags['html-out']}`);
run('build_html.js', buildHtmlArgs);

// UI reachability gate — verifies every `status: reachable` entry in the
// UI capability inventory resolves to ≥ 1 DOM element under its precondition.
// This catches silent UI regressions like the master-detail refactor's lost
// stack-signature panel, tradition-group delete, and drag-drop interactions.
// Runs AFTER build_html.js because it loads the freshly-built codex.html.
if (!flags['skip-ui-check']) {
  const uiArgs = [];
  if (flags['html-out']) uiArgs.push(`--html=${flags['html-out']}`);
  run('ui_reachability_check.js', uiArgs);
}

console.error('✓ build complete');
