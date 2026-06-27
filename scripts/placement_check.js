#!/usr/bin/env node
// Check whether a proposed new tradition would slot cleanly into the codex.
// Reports placement (parent path), conflicts (id clashes), and missing references.
//
// Usage:
//   node scripts/placement_check.js --id <new_id> --parent <tree_path> \
//       [--instruments id1,id2,id3] [--room <id>] [--archetype <id>] \
//       [--aesthetic <id>] [--tuning <id>]
//
// Run this BEFORE adding a new tradition to references/05_traditions.js to
// confirm every referenced id resolves and the proposed parent path exists.

const C = require('./_loader.js');

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else {
        flags[a.slice(2)] = true;
      }
    }
  }
}

if (!flags.id || !flags.parent) {
  console.error('Usage: placement_check.js --id <new_id> --parent <tree_path> [options]');
  console.error('  --id           proposed tradition id');
  console.error('  --parent       tree-node id where it should attach');
  console.error('  --instruments  comma-separated instrument ids');
  console.error('  --room         room id');
  console.error('  --archetype    chain_archetype id');
  console.error('  --aesthetic    production_aesthetic id');
  console.error('  --tuning       tuning id');
  process.exit(2);
}

const issues = [];
const ok = [];

// 1. ID conflict?
const tradIds = new Set(C.TRADITIONS.map((t) => t.id));
if (tradIds.has(flags.id)) issues.push(`ID_CONFLICT: tradition "${flags.id}" already exists`);
else ok.push(`id "${flags.id}" is available`);

// 2. Parent path exists?
const treeIds = new Set(C.TREE_NODES.map((n) => n.id));
if (!treeIds.has(flags.parent)) {
  issues.push(`BROKEN_PARENT: tree node "${flags.parent}" does not exist`);
  // Suggest near matches
  const near = [...treeIds]
    .filter((id) => {
      const segs = flags.parent.split('.');
      return segs.some((s) => id.toLowerCase().includes(s.toLowerCase()));
    })
    .slice(0, 5);
  if (near.length) issues.push(`  near matches: ${near.join(', ')}`);
} else {
  // How many other traditions live under that parent?
  const siblings = Object.keys(C.TRADITION_EXTRAS).filter(
    (tid) => C.TRADITION_EXTRAS[tid].parent === flags.parent
  );
  ok.push(`parent "${flags.parent}" exists with ${siblings.length} existing sibling(s)`);
  if (siblings.length > 0 && siblings.length <= 8) {
    ok.push(`  siblings: ${siblings.join(', ')}`);
  } else if (siblings.length > 8) {
    ok.push(`  siblings (first 8 of ${siblings.length}): ${siblings.slice(0, 8).join(', ')}`);
  }
}

// 3. Instruments resolve?
if (flags.instruments) {
  const instIds = new Set(C.INSTRUMENTS.map((i) => i.id));
  const requested = String(flags.instruments)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const missing = requested.filter((id) => !instIds.has(id));
  if (missing.length) issues.push(`UNKNOWN_INSTRUMENTS: ${missing.join(', ')}`);
  else ok.push(`all ${requested.length} instruments resolve`);
}

// 4. Room exists?
if (flags.room) {
  const roomIds = new Set(C.ROOMS.map((r) => r.id));
  if (!roomIds.has(flags.room)) issues.push(`UNKNOWN_ROOM: "${flags.room}"`);
  else ok.push(`room "${flags.room}" exists`);
}

// 5. Chain archetype exists?
if (flags.archetype) {
  const archIds = new Set((C.CHAIN_ARCHETYPES || []).map((a) => a.id));
  if (!archIds.has(flags.archetype)) issues.push(`UNKNOWN_ARCHETYPE: "${flags.archetype}"`);
  else ok.push(`chain_archetype "${flags.archetype}" exists`);
}

// 6. Production aesthetic exists?
if (flags.aesthetic) {
  const paIds = new Set((C.PRODUCTION_AESTHETICS || []).map((p) => p.id));
  if (!paIds.has(flags.aesthetic)) issues.push(`UNKNOWN_AESTHETIC: "${flags.aesthetic}"`);
  else ok.push(`production_aesthetic "${flags.aesthetic}" exists`);
}

// 7. Tuning exists?
if (flags.tuning) {
  const tuningIds = new Set(C.TUNINGS.map((t) => t.id));
  if (!tuningIds.has(flags.tuning)) issues.push(`UNKNOWN_TUNING: "${flags.tuning}"`);
  else ok.push(`tuning "${flags.tuning}" exists`);
}

// Report
if (flags.json) {
  console.log(
    JSON.stringify(
      {
        proposed_id: flags.id,
        proposed_parent: flags.parent,
        clean: issues.length === 0,
        ok,
        issues,
      },
      null,
      2
    )
  );
  process.exit(issues.length === 0 ? 0 : 1);
}

console.log(`Placement check: id="${flags.id}" parent="${flags.parent}"`);
console.log('');
if (ok.length) {
  console.log('OK:');
  for (const o of ok) console.log(`  ✓ ${o}`);
}
if (issues.length) {
  console.log('');
  console.log('ISSUES:');
  for (const i of issues) console.log(`  ✗ ${i}`);
  process.exit(1);
}
console.log('');
console.log('CLEAN — proposed tradition can be added without dependency fixes.');
