#!/usr/bin/env node
// audit_voice_picks.js — voice-specific shorthand for `audit_picks.js`.
//
// Equivalent to `audit_picks.js --instrument=voice --part=voice_quality`.
// Writes to `tests/voice_audit.json` and produces the same record shape as
// the canonical voice audit (the JSON tandem.js consumes for
// `voice audit classifications coherent`).
//
// ⚠ RUNNING THIS SCRIPT REGENERATES tests/voice_audit.json — IT IS NOT
//   READ-ONLY. The companion file tests/voice_audit_classifications.json
//   is HAND-CURATED to match a specific snapshot of voice_audit.json's
//   mismatch set (each tid bucketed A/B/C with rationale). The tandem
//   check `voice audit classifications coherent` enforces the alignment.
//
//   If the catalog has drifted since the last classifications refresh,
//   re-running this script will surface real drift but will break the
//   tandem check until classifications are updated (add new mismatch
//   classifications, remove stale ones). That refresh requires domain
//   knowledge — you have to decide each new mismatch is A vs B vs C and
//   write the rationale.
//
//   If you just want to verify the script still runs without disturbing
//   coherence: `--dry-run` (writes to /tmp instead of tests/).
//
// USAGE
//   node scripts/audit_voice_picks.js
//   node scripts/audit_voice_picks.js --tradition=<id>     # single-tradition mode
//   node scripts/audit_voice_picks.js --out=<path>          # custom markdown output
//   node scripts/audit_voice_picks.js --dry-run             # write JSON to /tmp, not tests/

const { spawnSync } = require('child_process');
const path = require('path');

const args = [
  path.join(__dirname, 'audit_picks.js'),
  '--instrument=voice',
  '--part=voice_quality',
];
for (const a of process.argv.slice(2)) args.push(a);

const r = spawnSync('node', args, { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
