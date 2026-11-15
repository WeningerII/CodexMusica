#!/usr/bin/env node
// check_doc_commands.js — execute the concrete `node scripts/*.js` example
// commands embedded in the agent-facing docs and assert they exit 0.
//
// @covers: documented-commands-run
//
// WHY: check_docs.js verifies canonical counts and that a referenced script
// FILE exists — but it never checks that a documented INVOCATION actually runs.
// That blind spot let a broken `recipe.js --diff <a> <b> --weight=` form ship in
// AGENTS.md / llms.txt (it errored with exit 2). This closes it: every runnable,
// placeholder-free command in the docs is executed and must succeed.
//
// Scope: only a safelist of READ-ONLY query/recipe scripts is executed, and only
// commands with no placeholders (<id>, {id}, …) and no shell helpers (q.js etc.).
// Write/slow tools (build_*, fetch_*, smoke, tandem, regression_*, audit_picks,
// build_signatures, _apply_trad_edits) are never executed.
//
// Usage: node scripts/check_doc_commands.js [--verbose]
// Exit 0 if all documented commands succeed, 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const DOCS = ['AGENTS.md', 'llms.txt', 'README.md', 'SKILL.md'];

// Read-only scripts that are safe (and fast) to execute as a doc-validity probe.
const SAFE_SCRIPTS = new Set([
  'recipe.js',
  'list.js',
  'expand.js',
  'fingerprint.js',
  'compare.js',
  'inspect.js',
  'nearest_neighbor.js',
  'stack.js',
  'placement_check.js',
  'preface_configure.js',
]);
// A command is illustrative-only (not runnable) if it carries a placeholder or
// references one of the "save this snippet" helpers that don't exist in the repo.
const PLACEHOLDER = /[<>{}…]|\.\.\.|\$\{|\bq\.js\b|\bload\.js\b|\brich_recipe\.js\b/;
const CMD_RE = /node\s+scripts\/([A-Za-z0-9_]+\.js)[^\n`]*/g;

// The model-visible docs carry no real catalog ids (#698): a recipe.js example
// is written with placeholders (`--tradition <id>`, `--swap-variant=<instrument>:
// <part>:<variant>`). So that every documented FORM still runs, the argument
// roles below are filled here, at check time, from one coherent fixture derived
// from the catalog (a tradition, two of its instruments, a part with a
// non-default variant on a third, and a second tradition), and each `<number>`
// in an --axis-target is filled with 1. Only these roles are filled; a command
// with any other placeholder stays illustrative.
function recipeFixture() {
  const C = require('./_loader.js');
  const inst = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
  const trads = [...C.TRADITIONS].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  for (const t of trads) {
    const ids = (t.instruments || []).filter((id) => inst.has(id));
    if (ids.length < 3) continue;
    for (const sw of ids) {
      const part = (inst.get(sw).parts || []).find((pt) => (pt.variants || []).length >= 2);
      if (!part) continue;
      const variant = part.variants.find((v) => !v.default) || part.variants[1];
      const others = ids.filter((id) => id !== sw);
      const t2 = trads.find((x) => x.id !== t.id);
      return {
        t: t.id,
        t2: t2.id,
        ex1: others[0],
        ex2: others[1],
        swap: `${sw}:${part.id}:${variant.id}`,
      };
    }
  }
  throw new Error('check_doc_commands: no catalog tradition fits the recipe.js fixture');
}
let FIXTURE = null;
function fillRecipeRoles(cmd) {
  if (!/^node\s+scripts\/recipe\.js\b/.test(cmd) || !/<[^<>]+>/.test(cmd)) return cmd;
  FIXTURE = FIXTURE || recipeFixture();
  const F = FIXTURE;
  return cmd
    .replace(/--swap-variant=<[^<>]+>:<[^<>]+>:<[^<>]+>/g, `--swap-variant=${F.swap}`)
    .replace(/--exclude-instrument=<[^<>]+>,<[^<>]+>/g, `--exclude-instrument=${F.ex1},${F.ex2}`)
    .replace(/--exclude-instrument=<[^<>]+>/g, `--exclude-instrument=${F.ex1}`)
    .replace(/--traditions <[^<>]+>,<[^<>]+>/g, `--traditions ${F.t},${F.t2}`)
    .replace(/(--diff(?: --weight=[0-9.]+)?) <[^<>]+> <[^<>]+>/g, `$1 ${F.t} ${F.t2}`)
    .replace(/--tradition(=| )<[^<>]+>/g, `--tradition$1${F.t}`)
    .replace(/(--axis-target "[^"]*)/g, (m) => m.replace(/<number>/g, '1'));
}

const cmds = new Map(); // normalized command -> "file:line" of first occurrence
for (const rel of DOCS) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((line, i) => {
    let m;
    CMD_RE.lastIndex = 0;
    while ((m = CMD_RE.exec(line)) !== null) {
      let cmd = m[0].trim().replace(/\s+#.*$/, ''); // drop trailing inline comment
      if (!SAFE_SCRIPTS.has(m[1])) continue;
      cmd = fillRecipeRoles(cmd);
      if (PLACEHOLDER.test(cmd)) continue;
      if (!cmds.has(cmd)) cmds.set(cmd, `${rel}:${i + 1}`);
    }
  });
}

let fail = 0;
const results = [];
for (const [cmd, src] of cmds) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'ignore', timeout: 60000 });
    results.push(`  ✓ ${cmd}   (${src})`);
  } catch (e) {
    fail++;
    results.push(`  ✗ ${cmd}   (${src})  -> exit ${e.status == null ? '(killed)' : e.status}`);
  }
}

console.log(`=== Documented command execution (${cmds.size} concrete commands) ===`);
if (VERBOSE || fail) for (const r of results) console.log(r);
// Refuse to pass vacuously: if the scan extracts 0 runnable commands (the docs
// reliably carry several recipe.js examples), the doc formatting or CMD_RE drifted
// and "PASS — all 0 ... exit 0" would be a false green. Fail loudly instead.
if (cmds.size === 0) {
  console.error(
    'FAIL — extracted 0 runnable documented commands; the doc-scan regex or doc formatting drifted (expected several recipe.js examples).'
  );
  process.exit(1);
}
if (fail === 0) {
  console.log(`PASS — all ${cmds.size} documented script commands exit 0.`);
  process.exit(0);
}
console.error(`FAIL — ${fail} documented command(s) errored.`);
process.exit(1);
