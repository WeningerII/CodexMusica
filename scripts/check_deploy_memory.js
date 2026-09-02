#!/usr/bin/env node
// check_deploy_memory.js — the deployed instance must hold the harness's own
// measured peak (M-157). A service sized below its instrument is not a config
// choice, it is an outage that waits for the first real request.
//
// WHAT HAPPENED (2026-08-28): the flash battery's first two live rounds each
// OOM-killed the Render Starter instance — Render's own events read "Instance
// failed: Ran out of memory (used over 512MB)" at 21:33Z and 21:48Z, one per
// round — and every request the transcripts recorded as a bare 502 had died
// with the box, not with the model. The peaks were then measured locally with
// the exact connector argv (scripts/measure_verb_memory.py, the committed
// form of that sitting's scratch instrument):
//
//   lyric_grade  (song step)   seed 55, 27 lines  exit 3  88.4s   829 MB
//   lyric_revise (first call)  seed 31, 22 lines  exit 4  78.9s   826 MB
//   lyric_revise (first call)  seed 55, 27 lines  exit 4  88.5s   829 MB
//   lyric_revise (first call)  seed 11, 50 lines  exit 4  205.5s  882 MB
//
// FLAT ACROSS THE ENVELOPE: 826 MB at the planner's 22-line floor against
// 882 MB at 50 lines — the peak is the lexicon-wide candidate machinery, not
// the draft — so no song the planner can emit fits a 512 MB box, and the
// verbs run STRICTLY SERIAL (mcp/lyric_tools.js enqueue), so this is one
// ordinary call's cost, not a concurrency story.
//
// THE GATE: render.yaml's declared plan must provide at least the measured
// peak times a declared margin. The margin is a BAND, not a tuning knob: it
// covers the serving Node process ~~and the warm worker's residual beside the
// child at peak (worker measured 181 MB resident after one light call;~~ (the
// Node process is deliberately not pretended to a number here), allocator
// variance across containers, and the unmeasured growth of a revise call as
// answers accumulate on its record. Move MEASURED_PEAK_MB only by re-running
// the instrument, with the old value struck and dated beside the new one
// (doctrine 17); moving MARGIN is a ruling, not a repair.
//
// THE STRIKE ABOVE IS 2026-09-01 (`MISSING.md` M-187) AND IT CORRECTS THE
// PREMISE, NOT THE NUMBER. Two things were wrong with the struck clause. The
// residual after one HEAVY call is not 181 MB: measured through
// `scripts/measure_verb_memory.py --seed=31 --worker --rounds=3` (22 lines;
// plan, fill and three grade+revise rounds in ONE worker), the worker retains
// 594 MB after the first round and 602 MB after the third (+8 MB over two
// more rounds, 638 MB at most between calls) against a peak of 661 MB for
// the whole sequence — the cold rows on the same seed the same day read 666
// and 665 MB. And the residual is never BESIDE a child at peak: the worker is
// the process doing the work, and mcp/lyric_tools.js SIGKILLs it on every
// path that falls back cold, so the box holds ONE harness process at a time
// and its residual is inside the peak the constant below banks. Until that
// day the worker had never run on Render at all — the Dockerfile did not ship
// it — which is why the clause was a premise and not a measurement.
// MEASURED_PEAK_MB stays at the 50-line envelope figure: seed 31 reads 666
// today against the 826 banked for it on 2026-08-28, a FALL, and a pin moves
// only by re-running the whole table, never one row of it.
//
// The check reads the DECLARED plan because the declaration is what this
// repository can see — render.yaml already carries two long comments about
// dashboard-only settings being invisible drift, and this gate is that
// argument applied to instance sizing.

const fs = require('fs');
const path = require('path');

// Render web-service plans this repo is prepared to reason about, in MB.
// An unknown plan REFUSES rather than guesses: a new tier gets a row here in
// the same commit that declares it, or the gate cannot say anything true.
const PLAN_MEMORY_MB = {
  starter: 512,
  standard: 2048,
  pro: 4096,
};

// Measured 2026-08-28 (table above): the envelope-wide peak of one verb call.
const MEASURED_PEAK_MB = 882;
// Declared margin (see the header): everything beside the child at its peak.
const MARGIN = 2.0;

const yamlPath = path.join(__dirname, '..', 'render.yaml');
const text = fs.readFileSync(yamlPath, 'utf8');

const plans = [...text.matchAll(/^\s*plan:\s*([^\s#]+)\s*$/gm)].map((m) => m[1]);
if (plans.length !== 1) {
  console.error(
    `DEPLOY MEMORY: REFUSED — expected exactly one \`plan:\` line in render.yaml, found ${plans.length}`
  );
  process.exit(1);
}
const plan = plans[0];
const planMb = PLAN_MEMORY_MB[plan];
if (planMb == null) {
  console.error(
    `DEPLOY MEMORY: REFUSED — plan '${plan}' has no memory row in PLAN_MEMORY_MB; ` +
      'declare the tier in the same commit that adopts it'
  );
  process.exit(1);
}

const requiredMb = Math.ceil(MEASURED_PEAK_MB * MARGIN);
if (planMb < requiredMb) {
  console.error(
    `DEPLOY MEMORY: FAIL — render.yaml declares plan '${plan}' (${planMb} MB), and the harness's ` +
      `measured peak is ${MEASURED_PEAK_MB} MB (x${MARGIN} margin = ${requiredMb} MB required). ` +
      'A single lyric_grade or lyric_revise call OOM-kills this instance; re-run ' +
      'scripts/measure_verb_memory.py before moving the constant.'
  );
  process.exit(1);
}
console.log(
  `DEPLOY MEMORY: PASS — plan '${plan}' provides ${planMb} MB against ${requiredMb} MB required ` +
    `(measured peak ${MEASURED_PEAK_MB} MB x ${MARGIN}).`
);
process.exit(0);
