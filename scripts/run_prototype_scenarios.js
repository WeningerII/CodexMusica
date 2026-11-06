#!/usr/bin/env node
'use strict';
// run_prototype_scenarios.js — every integrated lane's own scenario, run as a
// gate (#670). A lane PR brings prototype/scenarios/<lane>/*.cjs|*.mjs with its
// three files; once the lane is integrated, this runs it here with no second
// registration edit, so a lane's scenario can't silently stop running.
//
// Each scenario runs in its own Node process, one at a time (several drive a
// browser), with a hard timeout so one that hangs fails by name instead of
// holding CI. The scenarios read CHROMIUM_PATH (one reads CHROMIUM); where
// neither is set, both are pointed at Playwright's own Chromium, which CI
// installs, rather than each scenario's local default.
//
// THE RUN IS RECONCILED (#665 6675529176). Discovery walks every file under
// prototype/scenarios/. A scenario is prototype/scenarios/<lane>/<name>.cjs
// or .mjs; any other file there fails the run by name, because nothing would
// run it. After the last scenario, the run fails unless the scenarios it ran
// are exactly the ones it discovered, less EXCLUDED, each once: a scenario
// dropped from the loop, run twice, or run without being discovered fails by
// name, however the others did. An exclusion names a discovered scenario and
// says why, and every run prints it.
//
//   node scripts/run_prototype_scenarios.js
//   node scripts/run_prototype_scenarios.js --self-check
//
// --self-check runs no lane scenario. It copies this runner into scratch
// trees of trivial scenarios and runs each check in CHECKS on it, then plants
// each defect in PLANTED (an edit to this file, as check_prototype_hosts.js
// plants host.js defects) and fails unless every planted copy fails its check.
//
// Exit 0 if every scenario passes, 1 if any fails or times out or the run
// doesn't reconcile, 2 if there are none to run or SCENARIO_TIMEOUT_MS is not
// a positive whole number.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'prototype', 'scenarios');

// Discovered scenarios this runner does not run, each with its reason. Every
// run prints them. An entry that names no discovered scenario fails the run,
// so one can't outlive its file.
const EXCLUDED = {};

if (process.argv.includes('--self-check')) process.exit(selfCheck());

const TIMEOUT_MS = timeoutSetting(process.env.SCENARIO_TIMEOUT_MS);

// SCENARIO_TIMEOUT_MS, when set, must be a positive whole number of
// milliseconds; anything else is refused by name rather than reaching
// spawnSync (where a negative value throws) or silently becoming the default.
function timeoutSetting(raw) {
  if (raw === undefined || raw === '') return 300000;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    console.error(
      `run_prototype_scenarios: SCENARIO_TIMEOUT_MS must be a positive whole number of milliseconds, got "${raw}"`
    );
    process.exit(2);
  }
  return n;
}

// Every file under dir, as /-separated paths relative to it; dotfiles (an
// editor's or the OS's) aside.
function walk(dir, rel = '') {
  return fs
    .readdirSync(path.join(dir, rel), { withFileTypes: true })
    .filter((d) => !d.name.startsWith('.'))
    .flatMap((d) => {
      const r = rel ? `${rel}/${d.name}` : d.name;
      return d.isDirectory() ? walk(dir, r) : [r];
    });
}

const SCENARIO = /^[a-z0-9-]+\/[^/]+\.(cjs|mjs)$/;
const found = fs.existsSync(DIR) ? walk(DIR).sort() : [];
const scenarios = found.filter((f) => SCENARIO.test(f)).map((f) => `prototype/scenarios/${f}`);
const problems = found
  .filter((f) => !SCENARIO.test(f))
  .map(
    (f) =>
      `prototype/scenarios/${f} is not a scenario this runner runs (prototype/scenarios/<lane>/<name>.cjs or .mjs)`
  );

if (!scenarios.length) {
  console.error('run_prototype_scenarios: no scenarios under prototype/scenarios/');
  process.exit(2);
}

const excluded = (rel) => Object.hasOwn(EXCLUDED, rel);
for (const [rel, reason] of Object.entries(EXCLUDED)) {
  console.log(`SKIP  ${rel} — ${reason}`);
}
const planned = scenarios.filter((rel) => !excluded(rel));

const env = { ...process.env };
if (!env.CHROMIUM_PATH || !env.CHROMIUM) {
  let exe = env.CHROMIUM_PATH || env.CHROMIUM;
  if (!exe) {
    try {
      exe = require('playwright').chromium.executablePath();
    } catch {
      exe = '';
    }
  }
  if (exe) {
    env.CHROMIUM_PATH = env.CHROMIUM_PATH || exe;
    env.CHROMIUM = env.CHROMIUM || exe;
  }
}

const ran = [];
const failed = [];
for (const rel of planned) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [rel], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024 * 1024,
  });
  ran.push(rel);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  const ok = !r.error && r.status === 0;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${rel}  (${secs}s${timedOut ? `, timed out at ${TIMEOUT_MS / 1000}s` : ''})`
  );
  if (!ok) {
    failed.push(rel);
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-40).join('\n');
    if (out) console.log(out.replace(/^/gm, '    '));
    if (r.error && !timedOut) console.log(`    ${r.error.message}`);
  }
}

problems.push(...reconcile(scenarios, ran));
const lead = `${scenarios.length} discovered, ${Object.keys(EXCLUDED).length} excluded`;
if (failed.length || problems.length) {
  console.error(
    `run_prototype_scenarios: FAIL — ${failed.length} of ${ran.length} scenarios run failed${failed.length ? `: ${failed.join(', ')}` : ''}; ${problems.length} problem(s) with the run (${lead})`
  );
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`run_prototype_scenarios: ${ran.length}/${ran.length} lane scenarios pass (${lead})`);

// The scenarios run, against the ones discovered and EXCLUDED.
function reconcile(discovered, run) {
  const out = [];
  for (const [rel, reason] of Object.entries(EXCLUDED)) {
    if (!discovered.includes(rel))
      out.push(`EXCLUDED names ${rel}, which is not a discovered scenario; remove it`);
    if (typeof reason !== 'string' || !reason.trim())
      out.push(`EXCLUDED names ${rel} with no reason; give one, or run it`);
  }
  const times = new Map();
  for (const rel of run) times.set(rel, (times.get(rel) || 0) + 1);
  for (const [rel, n] of times) {
    if (n > 1) out.push(`${rel} ran ${n} times`);
    if (!discovered.includes(rel)) out.push(`${rel} ran, but was not discovered`);
    if (excluded(rel)) out.push(`${rel} ran, but EXCLUDED names it`);
  }
  for (const rel of discovered) {
    if (!excluded(rel) && !times.has(rel))
      out.push(`${rel} was discovered but did not run, and EXCLUDED does not name it`);
  }
  return out;
}

// ── --self-check ────────────────────────────────────────────────────────────
// Each check is a scratch tree: this runner (with the check's own edits, such
// as an exclusion) and the trivial scenarios in BASE, with the check's files
// added (or, as null, removed). On this file as committed every check must
// hold; with each planted defect, the check it names must not. A planted
// defect's edits must each apply exactly once.
function selfCheck() {
  const EXCL = 'const EXCLUDED = {';
  const exclude = (rel, reason) => [
    EXCL,
    `${EXCL}\n  ${JSON.stringify(rel)}: ${JSON.stringify(reason)},`,
  ];
  const TARGETS = 'prototype/scenarios/genre-targets/targets.cjs';
  const LIBRARY = 'prototype/scenarios/library/explore.mjs';
  const pass = 'process.exit(0);\n';
  const BASE = {
    'prototype/scenarios/genre-categories/categories.cjs': pass,
    [TARGETS]: pass,
    [LIBRARY]: pass,
  };
  // The committed exclusions' files, so they are discovered here too.
  for (const rel of Object.keys(EXCLUDED)) BASE[rel] = pass;
  const scenarioCount = Object.keys(BASE).filter((f) =>
    f.startsWith('prototype/scenarios/')
  ).length;
  const n = scenarioCount - Object.keys(EXCLUDED).length;
  const says = (r, text) => r.out.includes(text);
  const CHECKS = {
    // 3PO's measured gap (#665 6675513892): a scenario dropped from the run
    // was reported as N/N.
    'every discovered scenario runs once': {
      ok: (r) => r.status === 0 && says(r, `${n}/${n} lane scenarios pass`),
    },
    'an exclusion is printed with its reason': {
      edits: [exclude(LIBRARY, 'a fixture exclusion')],
      ok: (r) =>
        r.status === 0 &&
        says(r, `SKIP  ${LIBRARY} — a fixture exclusion`) &&
        says(r, `${n - 1}/${n - 1} lane scenarios pass`),
    },
    'an exclusion without a reason fails': {
      edits: [exclude(LIBRARY, ' ')],
      ok: (r) => r.status === 1 && says(r, `EXCLUDED names ${LIBRARY} with no reason`),
    },
    'a stale exclusion fails': {
      edits: [exclude('prototype/scenarios/genre-gone/gone.cjs', 'its lane left')],
      ok: (r) => r.status === 1 && says(r, 'which is not a discovered scenario'),
    },
    'a file the runner would not run fails': {
      files: { 'prototype/scenarios/genre-targets/nested/deep.cjs': pass },
      ok: (r) =>
        r.status === 1 &&
        says(
          r,
          'prototype/scenarios/genre-targets/nested/deep.cjs is not a scenario this runner runs'
        ),
    },
    'a failing scenario fails': {
      files: { [TARGETS]: 'process.exit(3);\n' },
      ok: (r) => r.status === 1 && says(r, `FAIL  ${TARGETS}`),
    },
  };
  const PLANTED = {
    'a scenario dropped from the loop': {
      check: 'every discovered scenario runs once',
      edits: [
        [
          'for (const rel of planned) {',
          "for (const rel of planned.filter((r) => !r.includes('/genre-targets/'))) {",
        ],
      ],
    },
    'a scenario run twice': {
      check: 'every discovered scenario runs once',
      edits: [['for (const rel of planned) {', 'for (const rel of [...planned, planned[0]]) {']],
    },
    'an excluded scenario run anyway': {
      check: 'an exclusion is printed with its reason',
      edits: [
        [
          'const planned = scenarios.filter((rel) => !excluded(rel));',
          'const planned = scenarios;',
        ],
      ],
    },
    'exclusions not printed': {
      check: 'an exclusion is printed with its reason',
      edits: [['  console.log(`SKIP  ${rel} — ${reason}`);\n', '']],
    },
    'an exclusion needs no reason': {
      check: 'an exclusion without a reason fails',
      edits: [["if (typeof reason !== 'string' || !reason.trim())", 'if (false)']],
    },
    'a stale exclusion is kept': {
      check: 'a stale exclusion fails',
      edits: [
        [
          '    if (!discovered.includes(rel))\n      out.push(`EXCLUDED names',
          '    if (false)\n      out.push(`EXCLUDED names',
        ],
      ],
    },
    'files the runner would not run are ignored': {
      check: 'a file the runner would not run fails',
      edits: [
        [
          'const problems = found\n  .filter((f) => !SCENARIO.test(f))',
          'const problems = found\n  .filter(() => false)',
        ],
      ],
    },
    'a failing scenario is not a failure': {
      check: 'a failing scenario fails',
      edits: [['const ok = !r.error && r.status === 0;', 'const ok = !r.error;']],
    },
  };

  // Edits apply to the runner above this section only, where each `from`
  // must occur exactly once (below, every one also occurs as a literal).
  const SRC = fs.readFileSync(__filename, 'utf8');
  const cut = SRC.indexOf('\n// ── --self-check');
  const plant = (edits) => {
    let src = SRC.slice(0, cut);
    for (const [from, to] of edits) {
      if (src.split(from).length !== 2) return null;
      src = src.replace(from, () => to);
    }
    return src + SRC.slice(cut);
  };
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'prototype-runner-'));
  let trees = 0;
  const run = (check, planted = []) => {
    const src = plant([...(check.edits || []), ...planted]);
    if (src === null) return null;
    const tree = path.join(scratch, String(trees++));
    const files = { ...BASE, ...(check.files || {}), 'scripts/run_prototype_scenarios.js': src };
    for (const [rel, text] of Object.entries(files)) {
      if (text === null) continue;
      fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true });
      fs.writeFileSync(path.join(tree, rel), text);
    }
    const r = spawnSync(process.execPath, ['scripts/run_prototype_scenarios.js'], {
      cwd: tree,
      env: { ...process.env, SCENARIO_TIMEOUT_MS: '30000' },
      encoding: 'utf8',
      timeout: 60000,
    });
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };

  const bad = [];
  let held = 0;
  for (const [name, check] of Object.entries(CHECKS)) {
    const r = run(check);
    if (r && check.ok(r)) held++;
    else
      bad.push(
        `the check "${name}" fails on the runner as committed: ${r ? r.out.trim() : 'its edits no longer apply'}`
      );
  }
  const named = new Set(Object.values(PLANTED).map((p) => p.check));
  for (const name of Object.keys(CHECKS)) {
    if (!named.has(name)) bad.push(`the check "${name}" has no planted defect`);
  }
  let caught = 0;
  for (const [name, { check, edits }] of Object.entries(PLANTED)) {
    if (!CHECKS[check]) {
      bad.push(`the planted defect "${name}" names no check (${check})`);
      continue;
    }
    if (plant(edits) === null) {
      bad.push(`the planted defect "${name}" no longer applies to the runner`);
      continue;
    }
    const r = run(CHECKS[check], edits);
    // A planted copy still runs to its verdict: a defect that only breaks
    // the file would fail every check and prove nothing.
    if (!r || !/^run_prototype_scenarios: /m.test(r.out))
      bad.push(`the planted defect "${name}" broke the runner instead: ${r ? r.out.trim() : ''}`);
    else if (!CHECKS[check].ok(r)) caught++;
    else bad.push(`with the planted defect "${name}", the check "${check}" still holds`);
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const total = Object.keys(CHECKS).length;
  const planted = Object.keys(PLANTED).length;
  if (bad.length) {
    console.error(`run_prototype_scenarios --self-check: FAIL — ${bad.length} problem(s)`);
    for (const b of bad) console.error(`  ✗ ${b}`);
    return 1;
  }
  console.log(
    `run_prototype_scenarios --self-check: ${held}/${total} checks hold on the runner; ${caught}/${planted} planted runner defects fail their checks`
  );
  return 0;
}
