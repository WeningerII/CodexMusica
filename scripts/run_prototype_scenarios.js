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
// THE RUN IS RECONCILED (#665 6675529176). Discovery (_prototype_scenarios.js,
// which check_prototype_manifest.js shares) walks every file under
// prototype/scenarios/, dotfiles included. A scenario is
// prototype/scenarios/<lane>/<name>.cjs or .mjs, its name not starting with a
// dot; any other file there fails the run by name, because nothing would run
// it. After the last scenario, the run fails unless the scenarios it ran
// are exactly the ones it discovered, less EXCLUDED, each once: a scenario
// dropped from the loop, run twice, or run without being discovered fails by
// name, however the others did. An exclusion names a discovered scenario and
// says why, and every run prints it.
//
// THE SAME RUN PROVES THE MANIFEST'S ROWS (#665 6675529176). The runner
// writes what it ran, the git blob of each scenario before and after it ran
// and how it ended, to a results file under the OS temp dir (never
// committed), then runs check_prototype_manifest.js --after-run on that file
// with this run's id. A row marked done counts only if its scenario declares
// it and passed here, at the bytes now on disk. The acceptance runs inside
// this process, not as a step after it: CI's run_parallel deals
// test:prototype's steps out as concurrent leaves, on two machines, so a
// separate step could not see this run's file.
//
//   node scripts/run_prototype_scenarios.js
//   node scripts/run_prototype_scenarios.js --self-check
//
// --self-check runs no lane scenario. It copies this runner,
// check_prototype_manifest.js and _prototype_scenarios.js into scratch trees
// of trivial scenarios, with a fixture shell registry and manifest, and runs
// each check in CHECKS there, then plants each defect in PLANTED (an edit to
// one of those three files, as check_prototype_hosts.js plants host.js
// defects) and fails unless every planted copy fails its check.
//
// Exit 0 if every scenario passes, 1 if any fails or times out, the run
// doesn't reconcile, or the manifest doesn't accept it, 2 if there are none
// to run or SCENARIO_TIMEOUT_MS is not a positive whole number.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { discoverScenarios } = require('./_prototype_scenarios.js');

const ROOT = path.resolve(__dirname, '..');

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

const { scenarios, strays } = discoverScenarios(ROOT);
const problems = strays.map(
  (f) =>
    `${f} is not a scenario this runner runs (prototype/scenarios/<lane>/<name>.cjs or .mjs, the name not starting with a dot)`
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

// This run, and the bytes each scenario ran at (its git blob, as the
// manifest check reads it back).
const RUN_ID = crypto.randomUUID();
const RESULTS = path.join(os.tmpdir(), 'codex-prototype-scenarios', `${RUN_ID}.json`);
const started = new Date().toISOString();
const blobOf = (rel) => {
  try {
    const bytes = fs.readFileSync(path.join(ROOT, rel));
    return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  } catch {
    return null;
  }
};

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
const record = [];
const failed = [];
for (const rel of planned) {
  const blob = blobOf(rel);
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
  record.push({
    path: rel,
    blob,
    blob_after: blobOf(rel),
    status: ok ? 'pass' : timedOut ? 'timeout' : 'fail',
    seconds: Number(secs),
  });
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

// The manifest's acceptance of this run.
fs.mkdirSync(path.dirname(RESULTS), { recursive: true });
fs.writeFileSync(
  RESULTS,
  JSON.stringify(
    {
      run_id: RUN_ID,
      root: ROOT,
      started,
      finished: new Date().toISOString(),
      complete: true,
      discovered: scenarios,
      excluded: EXCLUDED,
      problems,
      scenarios: record,
    },
    null,
    2
  ) + '\n'
);
console.log(`results: ${RESULTS} (run ${RUN_ID})`);
const accept = spawnSync(
  process.execPath,
  ['scripts/check_prototype_manifest.js', `--after-run=${RESULTS}`, `--run-id=${RUN_ID}`],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
const acceptance = `${accept.stdout || ''}${accept.stderr || ''}`.trim();
if (acceptance) console.log(acceptance);
if (accept.status !== 0)
  problems.push(
    `the manifest does not accept this run (check_prototype_manifest.js --after-run exited ${accept.status})`
  );

const lead = `${scenarios.length} discovered, ${Object.keys(EXCLUDED).length} excluded`;
if (failed.length || problems.length) {
  console.error(
    `run_prototype_scenarios: FAIL — ${failed.length} of ${ran.length} scenarios run failed${failed.length ? `: ${failed.join(', ')}` : ''}; ${problems.length} problem(s) with the run (${lead})`
  );
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(
  `run_prototype_scenarios: ${ran.length}/${ran.length} lane scenarios pass (${lead}); the manifest accepts the run`
);

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
  const CATEGORIES = 'prototype/scenarios/genre-categories/categories.cjs';
  // A shell that registers Categories, Find a sound and #760's instrument
  // detail (whose files aren't in the build), and a manifest whose row 1 is
  // done on the Categories scenario, which declares it.
  const row = (n, status, scenario) => ({ n, id: `row-${n}`, status, scenario });
  const manifest = (...r) => JSON.stringify({ rows: r });
  const BASE = {
    [CATEGORIES]: `// rows: 1\n${pass}`,
    [TARGETS]: pass,
    [LIBRARY]: pass,
    'prototype/app.js': [
      "const a = () => import('./features/genre-categories/categories.js');",
      "const b = () => import('./features/genre-targets/targets.js');",
      "const c = () => import('./features/instrument-detail/detail.js');",
    ].join('\n'),
    'prototype/features/genre-categories/categories.js': 'export {};\n',
    'prototype/features/genre-targets/targets.js': 'export {};\n',
    'prototype/manifest.json': manifest(row(1, 'done', CATEGORIES), row(2, 'pending', null)),
    'scripts/check_prototype_manifest.js': fs.readFileSync(
      path.join(__dirname, 'check_prototype_manifest.js'),
      'utf8'
    ),
    'scripts/_inventory_parser.js': fs.readFileSync(
      path.join(__dirname, '_inventory_parser.js'),
      'utf8'
    ),
    'scripts/_prototype_scenarios.js': fs.readFileSync(
      path.join(__dirname, '_prototype_scenarios.js'),
      'utf8'
    ),
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
    // A name starting with a dot is not skipped (#810 review of 03d848acf):
    // a failing .targets.cjs, or a scenario in a lane folder starting with a
    // dot, fails the run as a file nothing runs.
    'a dot-named file fails': {
      files: {
        'prototype/scenarios/genre-targets/.targets.cjs': 'process.exit(1);\n',
        'prototype/scenarios/.genre-x/x.cjs': 'process.exit(1);\n',
      },
      ok: (r) =>
        r.status === 1 &&
        says(
          r,
          'prototype/scenarios/genre-targets/.targets.cjs is not a scenario this runner runs'
        ) &&
        says(r, 'prototype/scenarios/.genre-x/x.cjs is not a scenario this runner runs'),
    },
    'a failing scenario fails': {
      files: { [TARGETS]: 'process.exit(3);\n' },
      ok: (r) => r.status === 1 && says(r, `FAIL  ${TARGETS}`),
    },
    // The manifest's same-run acceptance. 3PO's discriminators (#665
    // 6675513892): false completion evidence, a stale blob, a missing
    // registered Categories, and malformed declarations; the omitted Targets
    // scenario is "a scenario dropped from the loop" above.
    'a done row is proven by this run': {
      ok: (r) => r.status === 0 && says(r, '1 done row(s) proven by this run'),
    },
    'a done row its scenario does not declare fails': {
      files: {
        'prototype/manifest.json': manifest(row(1, 'done', LIBRARY), row(2, 'pending', null)),
      },
      ok: (r) => r.status === 1 && says(r, `done, but ${LIBRARY} does not declare row 1`),
    },
    'a done row whose scenario did not run fails': {
      edits: [exclude(LIBRARY, 'a fixture exclusion')],
      files: {
        [LIBRARY]: `// rows: 1\n${pass}`,
        [CATEGORIES]: pass,
        'prototype/manifest.json': manifest(row(1, 'done', LIBRARY), row(2, 'pending', null)),
      },
      ok: (r) => r.status === 1 && says(r, `done, but ${LIBRARY} did not run in this run`),
    },
    'a done row whose scenario failed fails': {
      files: { [CATEGORIES]: '// rows: 1\nprocess.exit(1);\n' },
      ok: (r) => r.status === 1 && says(r, `done, but ${CATEGORIES} did not pass in this run`),
    },
    'another run’s results fail': {
      after: (tree, r) => accept(tree, r, { runId: crypto.randomUUID() }),
      ok: (r) => r.status === 1 && says(r, 'is from another run'),
    },
    'a scenario changed since it ran fails': {
      after: (tree, r) => {
        fs.appendFileSync(path.join(tree, CATEGORIES), '// edited after the run\n');
        return accept(tree, r);
      },
      ok: (r) => r.status === 1 && says(r, `${CATEGORIES} has changed since it ran`),
    },
    'a scenario changed while it ran fails': {
      files: {
        [CATEGORIES]: "// rows: 1\nrequire('fs').appendFileSync(__filename, '// ran\\n');\n",
      },
      ok: (r) => r.status === 1 && says(r, `${CATEGORIES} changed while it ran`),
    },
    'a registered lane with no passing scenario fails': {
      files: {
        [CATEGORIES]: null,
        'prototype/manifest.json': manifest(row(1, 'pending', null), row(2, 'pending', null)),
      },
      ok: (r) =>
        r.status === 1 &&
        says(r, 'genre-categories is registered in prototype/app.js, but no scenario of it passed'),
    },
    'a registered lane with no module fails': {
      files: { 'prototype/features/genre-categories/categories.js': null },
      ok: (r) =>
        r.status === 1 &&
        says(
          r,
          'its module prototype/features/genre-categories/categories.js is not in this build'
        ),
    },
    'the #760 exception ends when its files arrive': {
      files: { 'prototype/features/instrument-detail/detail.js': 'export {};\n' },
      ok: (r) => r.status === 1 && says(r, 'instrument-detail is in this build now'),
    },
    // Scenario files are their lanes': a comment that only mentions rows,
    // in the header or below it, is prose, not a declaration (#810 review of
    // 8345248ac).
    'a comment that mentions rows is not a declaration': {
      files: {
        [CATEGORIES]: `// rows: 1\n// Rows 1-2 (#668): the Categories lane.\n${pass}// rows come back ranked\n`,
      },
      ok: (r) => r.status === 0 && says(r, '1 done row(s) proven by this run'),
    },
    'a row declared twice fails': {
      files: { [CATEGORIES]: `// rows: 1, 1\n${pass}` },
      ok: (r) => r.status === 1 && says(r, `${CATEGORIES}: declares row 1 twice`),
    },
    'a malformed declaration fails': {
      files: { [CATEGORIES]: `// rows: 1,2\n${pass}` },
      ok: (r) => r.status === 1 && says(r, 'malformed rows declaration "// rows: 1,2"'),
    },
    'two declarations fail': {
      files: { [CATEGORIES]: `// rows: 1\n// rows: 2\n${pass}` },
      ok: (r) => r.status === 1 && says(r, `${CATEGORIES}: 2 rows declarations`),
    },
    'a declaration below the header fails': {
      files: { [CATEGORIES]: `${pass}// rows: 1\n` },
      ok: (r) => r.status === 1 && says(r, 'the rows declaration is below the header'),
    },
    'a declaration of a row the manifest lacks fails': {
      files: { [CATEGORIES]: `// rows: 1, 9\n${pass}` },
      ok: (r) => r.status === 1 && says(r, 'declares row 9, but the manifest has no row 9'),
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
      edits: [['const problems = strays.map(', 'const problems = [].map(']],
    },
    // In _prototype_scenarios.js, which the runner and the manifest check
    // share: the dotfile filter 03d848acf had.
    'dot-named files are skipped': {
      check: 'a dot-named file fails',
      in: 'discovery',
      edits: [
        [
          '{ withFileTypes: true }).flatMap(',
          "{ withFileTypes: true }).filter((d) => !d.name.startsWith('.')).flatMap(",
        ],
      ],
    },
    'a failing scenario is not a failure': {
      check: 'a failing scenario fails',
      edits: [['const ok = !r.error && r.status === 0;', 'const ok = !r.error;']],
    },
    // In the runner (the default) or, with in: 'manifest', in
    // check_prototype_manifest.js (with in: 'discovery', in
    // _prototype_scenarios.js, above).
    'the acceptance never runs': {
      check: 'a done row is proven by this run',
      edits: [['const accept = spawnSync(', 'const accept = { status: 0 } || spawnSync(']],
    },
    'an undeclared done row passes': {
      check: 'a done row its scenario does not declare fails',
      in: 'manifest',
      edits: [['(declares.get(r.scenario) || []).includes(r.n),', 'true,']],
    },
    'a done row that did not run passes': {
      check: 'a done row whose scenario did not run fails',
      in: 'manifest',
      edits: [['expect(!!s, `row', 'expect(true, `row']],
    },
    'a done row that failed passes': {
      check: 'a done row whose scenario failed fails',
      in: 'manifest',
      edits: [["s.status === 'pass',", 'true,']],
    },
    'another run’s results pass': {
      check: 'another run’s results fail',
      in: 'manifest',
      edits: [['results.run_id === runId,', 'true,']],
    },
    'a stale blob passes': {
      check: 'a scenario changed since it ran fails',
      in: 'manifest',
      edits: [['now === s.blob,', 'true,']],
    },
    'the blob after a run is not read': {
      check: 'a scenario changed while it ran fails',
      edits: [['    blob_after: blobOf(rel),', '    blob_after: blob,']],
    },
    'a registered lane needs no scenario': {
      check: 'a registered lane with no passing scenario fails',
      in: 'manifest',
      edits: [['passed(lane),', 'true,']],
    },
    'a registered lane needs no module': {
      check: 'a registered lane with no module fails',
      in: 'manifest',
      edits: [['fs.existsSync(path.join(root, module)),', 'true,']],
    },
    'the #760 exception never ends': {
      check: 'the #760 exception ends when its files arrive',
      in: 'manifest',
      edits: [['expect(!arrived,', 'expect(true,']],
    },
    'any comment on rows is a declaration': {
      check: 'a comment that mentions rows is not a declaration',
      in: 'manifest',
      edits: [
        [
          'const ROWS_LINE = /^\\s*\\/\\/\\s*rows\\s*:/i;',
          'const ROWS_LINE = /^\\s*\\/\\/\\s*rows\\b/i;',
        ],
      ],
    },
    'a row declared twice passes': {
      check: 'a row declared twice fails',
      in: 'manifest',
      edits: [['if (out.includes(n)) bad.push(', 'if (false) bad.push(']],
    },
    'a malformed declaration passes': {
      check: 'a malformed declaration fails',
      in: 'manifest',
      edits: [['if (!m) {', 'if (!m) {\n      continue;']],
    },
    'two declarations pass': {
      check: 'two declarations fail',
      in: 'manifest',
      edits: [['if (at.length > 1)', 'if (false)']],
    },
    'a declaration below the header passes': {
      check: 'a declaration below the header fails',
      in: 'manifest',
      edits: [['if (i >= end)', 'if (false)']],
    },
    'a declaration of a missing row passes': {
      check: 'a declaration of a row the manifest lacks fails',
      in: 'manifest',
      edits: [['if (!known.has(n))', 'if (false)']],
    },
  };

  // A runner edit applies to the runner above this section only (below,
  // every `from` also occurs as a literal); a manifest or discovery edit, to
  // all of check_prototype_manifest.js or _prototype_scenarios.js. Each
  // `from` must occur exactly once.
  const SRC = fs.readFileSync(__filename, 'utf8');
  const cut = SRC.indexOf('\n// ── --self-check');
  const MANIFEST_CHECK = 'scripts/check_prototype_manifest.js';
  const DISCOVERY = 'scripts/_prototype_scenarios.js';
  const FILE_OF = {
    manifest: 'check_prototype_manifest.js',
    discovery: '_prototype_scenarios.js',
  };
  const edit = (src, edits) => {
    for (const [from, to] of edits) {
      if (src.split(from).length !== 2) return null;
      src = src.replace(from, () => to);
    }
    return src;
  };
  // The runner, the manifest check and the discovery with these edits, or
  // null if one doesn't apply. A planted defect is in the runner unless it
  // says in: 'manifest' or in: 'discovery'.
  const plant = ({ runner = [], manifest = [], discovery = [] }) => {
    const head = edit(SRC.slice(0, cut), runner);
    const check = edit(BASE[MANIFEST_CHECK], manifest);
    const found = edit(BASE[DISCOVERY], discovery);
    return head === null || check === null || found === null
      ? null
      : { runner: head + SRC.slice(cut), check, discovery: found };
  };
  const where = (planted) => ({ [planted.in || 'runner']: planted.edits });
  // The manifest check's --after-run, again, on the results a run printed.
  const accept = (tree, r, { runId } = {}) => {
    const m = /^results: (.+) \(run ([0-9a-f-]+)\)$/m.exec(r.out);
    if (!m) return { status: null, out: `no results line in: ${r.out}` };
    const a = spawnSync(
      process.execPath,
      [MANIFEST_CHECK, `--after-run=${m[1]}`, `--run-id=${runId || m[2]}`],
      { cwd: tree, encoding: 'utf8' }
    );
    return { status: a.status, out: `${a.stdout || ''}${a.stderr || ''}` };
  };
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'prototype-runner-'));
  let trees = 0;
  const run = (check, planted = { edits: [] }) => {
    const p = where(planted);
    const src = plant({
      runner: [...(check.edits || []), ...(p.runner || [])],
      manifest: p.manifest,
      discovery: p.discovery,
    });
    if (src === null) return null;
    const tree = path.join(scratch, String(trees++));
    const files = {
      ...BASE,
      ...(check.files || {}),
      'scripts/run_prototype_scenarios.js': src.runner,
      [MANIFEST_CHECK]: src.check,
      [DISCOVERY]: src.discovery,
    };
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
    const first = { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
    const out = check.after ? check.after(tree, first) : first;
    // The run's results file, which this tree's run wrote, goes with it.
    const m = /^results: (.+) \(run /m.exec(first.out);
    if (m) fs.rmSync(m[1], { force: true });
    return out;
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
  for (const [name, planted] of Object.entries(PLANTED)) {
    const { check } = planted;
    if (!CHECKS[check]) {
      bad.push(`the planted defect "${name}" names no check (${check})`);
      continue;
    }
    if (plant(where(planted)) === null) {
      bad.push(
        `the planted defect "${name}" no longer applies to ${FILE_OF[planted.in] || 'the runner'}`
      );
      continue;
    }
    const r = run(CHECKS[check], planted);
    // A planted copy still runs to its verdict: a defect that only breaks
    // the file would fail every check and prove nothing.
    if (!r || !/^(run_prototype_scenarios|check_prototype_manifest --after-run): /m.test(r.out))
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
    `run_prototype_scenarios --self-check: ${held}/${total} checks hold on the runner and the manifest's acceptance; ${caught}/${planted} planted defects fail their checks`
  );
  return 0;
}
