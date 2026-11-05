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
//   node scripts/run_prototype_scenarios.js
//
// Exit 0 if every scenario passes, 1 if any fails or times out, 2 if there
// are none to run or SCENARIO_TIMEOUT_MS is not a positive whole number.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'prototype', 'scenarios');
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

const scenarios = fs.existsSync(DIR)
  ? fs
      .readdirSync(DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) =>
        fs
          .readdirSync(path.join(DIR, d.name))
          .filter((f) => /\.(cjs|mjs)$/.test(f))
          .map((f) => path.join('prototype', 'scenarios', d.name, f))
      )
      .sort()
  : [];

if (!scenarios.length) {
  console.error('run_prototype_scenarios: no scenarios under prototype/scenarios/');
  process.exit(2);
}

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

const failed = [];
for (const rel of scenarios) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [rel], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024 * 1024,
  });
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

if (failed.length) {
  console.error(
    `run_prototype_scenarios: FAIL — ${failed.length} of ${scenarios.length} scenarios: ${failed.join(', ')}`
  );
  process.exit(1);
}
console.log(`run_prototype_scenarios: ${scenarios.length}/${scenarios.length} lane scenarios pass`);
