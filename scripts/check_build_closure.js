#!/usr/bin/env node
'use strict';
// check_build_closure.js — the CI scope decision is sound.
//
// @covers: artifact-reproducible
//
// scripts/_build_closure.js decides whether a diff can move a published
// artifact. Getting that wrong in the `skip` direction ships a stale artifact
// with every gate green, so the decision needs a proof, not a review.
//
// Two independent checks, because they fail differently:
//
// 1. NOTHING IS UNCLASSIFIED. Every tracked file resolves to `closure` or to an
//    `inert` rule that states a reason. This is really a property of the module
//    (deny by default), asserted here so that a future edit which flips the
//    default — or adds a broad inert rule — cannot pass unnoticed.
//
// 2. THE DERIVATION MATCHES A REAL BUILD. All three builders run under
//    scripts/_trace_reads.js, which records every path they and their worker
//    threads actually read, and every recorded path must be in the closure. A
//    dynamic require, a computed path, an fs read of a data file the static
//    parse cannot see — each shows up here as a file the build read and the
//    closure would have called inert.
//
// Check 2 is the one that matters, and it is cheap enough to run every time:
// the api build is traced with --limit, since the SET of files a build reads is
// fixed after the first few traditions even though the work is not. Measured at
// ~5s for --limit=8 against ~30 minutes for the full build.
//
// A traced build writes to a temp directory and never to the repo.
//
// Usage:
//   node scripts/check_build_closure.js              # the gate
//   node scripts/check_build_closure.js --explain    # print the whole closure
//   node scripts/check_build_closure.js --affected a.js b.md   # CI scope query
//     → prints `true`/`false`, exit 0. Used by the workflow's scope step.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, BUILDERS, classify, affected, scriptClosure } = require('./_build_closure.js');

const argv = process.argv.slice(2);

// ── --affected: the query the workflow asks ─────────────────────────────────
if (argv[0] === '--affected') {
  const paths = argv.slice(1).filter(Boolean);
  const hits = affected(paths);
  if (process.env.CODEX_CLOSURE_VERBOSE) {
    for (const p of paths) {
      const c = classify(p);
      process.stderr.write(`  ${c.kind === 'closure' ? '●' : '○'} ${p}  — ${c.why}\n`);
    }
  }
  console.log(hits.length > 0 ? 'true' : 'false');
  process.exit(0);
}

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

if (argv.includes('--explain')) {
  const inClosure = tracked.filter((p) => classify(p).kind === 'closure');
  const byDir = {};
  for (const p of inClosure) {
    const d = p.includes('/') ? p.split('/')[0] + '/' : '(root)';
    byDir[d] = (byDir[d] || 0) + 1;
  }
  console.log('Closure by directory:');
  for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(5)}  ${d}`);
  console.log('\nscripts/ reachable from a builder:');
  for (const s of [...scriptClosure()].sort()) console.log(`  ${s}`);
  process.exit(0);
}

console.log('=== Build closure is sound ===\n');
let failures = 0;

// ── 1. nothing unclassified ─────────────────────────────────────────────────
const unclassified = tracked.filter((p) => {
  const k = classify(p).kind;
  return k !== 'closure' && k !== 'inert';
});
if (unclassified.length) {
  failures++;
  console.log(`  ✗ ${unclassified.length} tracked file(s) resolve to neither closure nor inert`);
  for (const p of unclassified.slice(0, 10)) console.log(`      ${p}`);
} else {
  const nClosure = tracked.filter((p) => classify(p).kind === 'closure').length;
  console.log(
    `  ✓ all ${tracked.length} tracked files classified — ${nClosure} in closure, ${tracked.length - nClosure} inert`
  );
}

// ── 2. the derivation matches a real build ──────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-'));
const traceFile = path.join(tmp, 'reads.txt');
const preload = path.join(__dirname, '_trace_reads.js');
const env = { ...process.env, CODEX_TRACE_OUT: traceFile, NODE_OPTIONS: `--require ${preload}` };

const RUNS = [
  ['scripts/build_static_api.js', '--limit=8', `--out=${path.join(tmp, 'api')}`],
  ['scripts/build_html.js', `--out=${path.join(tmp, 'codex.html')}`, '--quiet'],
  // Discovery reads the committed api/ indexes plus mcp/package.json. Pointed at
  // the real api/ because that is what it reads in a real build; its output goes
  // to the temp dir.
  ['scripts/build_discovery.js', '--api=api', `--out=${path.join(tmp, 'disc')}`],
];

try {
  fs.mkdirSync(path.join(tmp, 'disc'), { recursive: true });
  for (const args of RUNS) {
    try {
      execFileSync(process.execPath, args, {
        cwd: ROOT,
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
        timeout: 600000,
      });
    } catch (e) {
      failures++;
      console.log(
        `  ✗ traced build failed: ${args[0]} — ${String(e.stderr || e.message).slice(0, 200)}`
      );
    }
  }

  const read = new Set(
    (fs.existsSync(traceFile) ? fs.readFileSync(traceFile, 'utf8') : '')
      .split('\n')
      .filter(Boolean)
      .map((p) => path.relative(ROOT, p).split(path.sep).join('/'))
      // Reads of the builders' own OUTPUT inside the temp dir escape ROOT and
      // are already filtered by the tracer; anything still relative-outside is
      // not a repo file.
      .filter((p) => p && !p.startsWith('..'))
  );

  // Refuse to pass on an empty trace: a preload that silently failed to install
  // would make this check trivially true, which is the shape of a green that
  // proves nothing.
  if (read.size === 0) {
    failures++;
    console.log('  ✗ the trace recorded nothing — the preload did not install; check is vacuous');
  } else {
    const escaped = [...read].filter((p) => classify(p).kind !== 'closure');
    if (escaped.length) {
      failures++;
      console.log(`  ✗ ${escaped.length} file(s) a real build READ are classified inert:`);
      for (const p of escaped) console.log(`      ${p}  — ${classify(p).why}`);
      console.log(
        '      A build input outside the closure means CI would skip a rebuild that\n' +
          '      was needed. Add it to the closure (or fix the inert rule that swallowed it).'
      );
    } else {
      console.log(
        `  ✓ all ${read.size} file(s) read by a real build of all three artifacts are in the closure`
      );
    }
    // The builders themselves must be reachable, or RUNS is testing nothing.
    const missedBuilders = BUILDERS.filter((b) => !read.has(b));
    if (missedBuilders.length) {
      failures++;
      console.log(`  ✗ trace never saw these builders run: ${missedBuilders.join(', ')}`);
    } else {
      console.log(`  ✓ all ${BUILDERS.length} artifact builders actually ran under the tracer`);
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('');
if (failures) {
  console.error(
    `BUILD CLOSURE: FAIL — ${failures} problem(s). The CI scope decision cannot be trusted\n` +
      'until these are resolved: a build input outside the closure means a needed rebuild\n' +
      'gets skipped, and a stale artifact ships with every other gate green.'
  );
  process.exitCode = 1;
} else {
  console.log(
    'BUILD CLOSURE: PASS — every tracked file is classified, and every file a real build\n' +
      'of api/ + codex.html + the discovery files reads is inside the closure.'
  );
}
