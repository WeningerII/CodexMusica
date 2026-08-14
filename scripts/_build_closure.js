'use strict';
// _build_closure.js — which files can change a published artifact.
//
// The CI scope step used to answer this with a docs-only allowlist: skip the
// ~30-minute rebuild when every changed path is Markdown, rebuild otherwise.
// Correct, and blunt — a one-line edit to a gate script or to mcp/engine.js paid
// the full catalog rebuild despite no artifact builder ever reading either.
//
// THE OBJECTION THAT SHAPED THIS FILE. The old step said, in as many words, that
// it deliberately does NOT work out the build's dependency closure, because
// "guessing that closure wrong fails in the dangerous direction, silently" —
// decide `rebuild` needlessly and you burn runner minutes, decide `skip`
// wrongly and you ship a stale artifact, which is the exact failure the
// freshness gate exists to catch and which has already happened twice here.
//
// That objection is right about GUESSING. So nothing here is guessed:
//
//   1. The script side is DERIVED — the transitive require() graph of the three
//      artifact builders, computed from source on every run, not written down.
//   2. Everything else is DENY-BY-DEFAULT. A path is in the closure unless it
//      matches an explicit inert rule carrying a reason. A file nobody has
//      classified is in the closure, so the answer for anything new or
//      unrecognised is `rebuild`, exactly as before.
//   3. The derivation is CHECKED against a real build. check_build_closure.js
//      runs all three builders under scripts/_trace_reads.js and fails if any
//      file they actually read is outside the closure — which is what catches a
//      dynamic require or an fs read that step 1's static parse cannot see.
//
// Step 2 is what keeps the asymmetry pointing the safe way, and step 3 is what
// stops step 1 from quietly rotting.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// The three programs whose output check_artifact_fresh compares byte-for-byte.
// If a fourth ever joins them it belongs here, and the trace check will say so
// loudly when its inputs turn up outside the closure.
const BUILDERS = [
  'scripts/build_static_api.js',
  'scripts/build_html.js',
  'scripts/build_discovery.js',
];

// Inert: provably cannot reach a build input. Each rule states why, because a
// rule without a reason is how this list starts absorbing things that do
// matter. Everything not matched here is in the closure.
const INERT = [
  { re: /\.md$/, why: 'no artifact builder reads a .md file' },
  { re: /^docs\//, why: 'prose only; not read by any builder' },
  { re: /^LICENSE$/, why: 'prose only' },
  {
    re: /^\.github\//,
    why: 'CI and issue-template config: changes how the build is RUN, never what it emits',
  },
  {
    re: /^tests\//,
    why: 'fixtures and expectations consumed by gates; no builder reads tests/',
  },
  {
    // mcp/package.json is the exception and is NOT inert: build_discovery.js
    // reads it to stamp server.json, which check_artifact_fresh gates. That one
    // file is why this rule is a carve-out rather than a whole-directory skip.
    re: /^mcp\/(?!package\.json$)/,
    why: 'the connector is a separate package; only mcp/package.json feeds server.json',
  },
  {
    // Added 2026-08-14, after this list was written and after the directory
    // arrived. Deny-by-default had been doing its job in the meantime — every
    // .py edit under it read as `closure` and bought a full rebuild — which is
    // the correct direction to be wrong in and an expensive one: 32.9
    // runner-minutes per run (a 7.7-minute rebuild plus 25.2 runner-minutes of
    // catalog shards, measured 2026-08-14 from run 31769893295) spent on a
    // change no artifact builder can read.
    //
    // The claim is NOT that the harness is unimportant. ci.yml's `record` and
    // `suites` jobs run it on every pull request and neither consults this
    // list, so nothing about its coverage changes here. The claim is only that
    // it cannot move api/ or codex.html — and that claim is PROVED on every
    // run rather than asserted, because check_build_closure.js traces a real
    // build of all three artifacts and fails on any file the build reads that
    // this list calls inert.
    re: /^lyric-harness\//,
    why: 'a separate Python program with its own CI jobs; the three artifact builders are Node and none of them reads it',
  },
  { re: /^render\.yaml$/, why: 'deployment config for the connector; not a build input' },
  { re: /^eslint\.config\.js$/, why: 'lint config; not read by any builder' },
  { re: /^\.(gitignore|prettierrc|prettierignore|npmrc|nvmrc)/, why: 'tooling config' },
  { re: /^\.gitattributes$/, why: 'tooling config' },
];

// ── the derived half: transitive require() graph from each builder ──────────
// Relative literals only. A computed or dynamic require would be invisible
// here, which is precisely what the trace check in check_build_closure.js
// exists to catch — this parse is a fast approximation that is then verified,
// not a claim taken on faith.
const REQUIRE_RE = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function scriptClosure() {
  const seen = new Set();
  const queue = [...BUILDERS];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    seen.add(rel);
    let src;
    try {
      src = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    REQUIRE_RE.lastIndex = 0;
    let m;
    while ((m = REQUIRE_RE.exec(src)) !== null) {
      let target = path.resolve(path.dirname(abs), m[1]);
      if (!fs.existsSync(target) && fs.existsSync(target + '.js')) target += '.js';
      if (!fs.existsSync(target)) continue;
      const targetRel = path.relative(ROOT, target).split(path.sep).join('/');
      if (!seen.has(targetRel)) queue.push(targetRel);
    }
  }
  // Inputs a builder pulls in BY PATH rather than by require(), which the parse
  // above cannot see:
  //   _compile_worker.js   — spawned as a worker_threads entry point
  //   _card_descriptors.js — build_html.js reads its @inline region as text and
  //                          splices it into the page (build_html.js:215)
  //
  // This list is short and hand-written, which would normally be the weak point.
  // It is not, because check_build_closure.js traces a real build and fails on
  // any file the build reads that the closure calls inert — _card_descriptors.js
  // was found that way rather than by reading build_html.js, on the gate's first
  // run. A future by-path input announces itself the same way.
  for (const extra of ['scripts/_compile_worker.js', 'scripts/_card_descriptors.js']) {
    if (fs.existsSync(path.join(ROOT, extra))) seen.add(extra);
  }
  return seen;
}

let _scripts = null;
const scripts = () => (_scripts ||= scriptClosure());

// ── classification ──────────────────────────────────────────────────────────
// 'closure' — a change here can move an artifact; rebuild and re-verify.
// 'inert'   — matched an explicit rule with a reason.
function classify(rel) {
  const p = rel.split(path.sep).join('/');
  // scripts/ splits: reachable from a builder → closure, otherwise inert.
  if (p.startsWith('scripts/')) {
    if (scripts().has(p)) return { kind: 'closure', why: 'reachable from an artifact builder' };
    return { kind: 'inert', why: 'a gate or CLI; not reachable from any artifact builder' };
  }
  for (const rule of INERT) if (rule.re.test(p)) return { kind: 'inert', why: rule.why };
  // Deny by default. references/ and src/ are catalog and app source; api/,
  // codex.html and the discovery files are OUTPUTS, and a hand-edit to one of
  // them is exactly what the freshness gate must be allowed to catch, so they
  // count as closure too. package.json / package-lock.json pin the toolchain.
  return { kind: 'closure', why: 'not matched by any inert rule (deny by default)' };
}

const affected = (paths) => paths.filter((p) => p && classify(p).kind === 'closure');

module.exports = { ROOT, BUILDERS, INERT, classify, affected, scriptClosure };
