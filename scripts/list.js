#!/usr/bin/env node
// Browse the catalog. The foundation primitive — every other script calls this
// internally to enumerate eligible candidates per slot type, and it's the
// developer-facing tool when grooming descriptors.
//
// Usage:
//   node scripts/list.js --section <id>                    chain section items (mic|pre|console|comp|eq|medium|fx|amp)
//   node scripts/list.js --rooms [--cluster=X] [--era=X] [--region=X] [--scale=X]
//   node scripts/list.js --instruments [--family=X] [--has-part=X]
//   node scripts/list.js --variants --instrument=X [--part=Y]
//   node scripts/list.js --archetypes [--era=X] [--region=X] [--scale=X]
//   node scripts/list.js --aesthetics [--era=X]
//   node scripts/list.js --traditions [--parent=X] [--family=X]
//   node scripts/list.js --tunings
//   node scripts/list.js --tree [--root=X] [--depth=N]
//   node scripts/list.js --axes                            13 axis definitions
//   node scripts/list.js --inst-axes                       9 instrument axis definitions
//
// Add --json for machine-readable output. Add --ids to list bare ids only.

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
      } else flags[a.slice(2)] = true;
    }
  }
}

function emit(items, fields) {
  if (flags.ids) {
    for (const it of items) console.log(it.id);
    return;
  }
  if (flags.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  for (const it of items) {
    const parts = [it.id];
    for (const f of fields || []) {
      if (it[f] !== undefined && it[f] !== null) {
        const v = Array.isArray(it[f]) ? it[f].join(',') : it[f];
        parts.push(`${f}=${v}`);
      }
    }
    console.log(parts.join('  '));
  }
}

function filterBy(items, mapping) {
  let result = items;
  for (const [flagKey, fieldKey] of Object.entries(mapping)) {
    if (flags[flagKey] !== undefined && flags[flagKey] !== true) {
      const want = String(flags[flagKey]);
      result = result.filter((it) => {
        const v = it[fieldKey];
        if (v === undefined || v === null) return false;
        if (Array.isArray(v)) return v.includes(want);
        return String(v) === want || String(v).includes(want);
      });
    }
  }
  return result;
}

// --section
if (flags.section) {
  const sec = C.CHAIN_SECTIONS.find((s) => s.id === flags.section);
  if (!sec) {
    console.error(`Unknown section: ${flags.section}`);
    console.error(`Available: ${C.CHAIN_SECTIONS.map((s) => s.id).join(', ')}`);
    process.exit(2);
  }
  emit(sec.items, ['name', 'descriptors']);
  process.exit(0);
}

// --rooms
if (flags.rooms !== undefined) {
  const filtered = filterBy(C.ROOMS, {
    cluster: 'cluster',
    era: 'era',
    region: 'region',
    scale: 'scale_tier',
  });
  emit(filtered, ['cluster', 'era', 'region', 'scale_tier', 'descriptors']);
  process.exit(0);
}

// --instruments
if (flags.instruments !== undefined) {
  let filtered = C.INSTRUMENTS;
  if (flags.family && flags.family !== true)
    filtered = filtered.filter((i) => i.family === flags.family);
  if (flags['has-part'] && flags['has-part'] !== true) {
    filtered = filtered.filter((i) => (i.parts || []).some((p) => p.id === flags['has-part']));
  }
  if (flags.json) {
    console.log(JSON.stringify(filtered, null, 2));
    process.exit(0);
  }
  if (flags.ids) {
    for (const i of filtered) console.log(i.id);
    process.exit(0);
  }
  for (const i of filtered) {
    const partCount = (i.parts || []).length;
    console.log(`${i.id}  family=${i.family}  parts=${partCount}  ${i.short || i.name}`);
  }
  process.exit(0);
}

// --variants
if (flags.variants !== undefined) {
  if (!flags.instrument) {
    console.error('--variants requires --instrument=<id>');
    process.exit(2);
  }
  const inst = C.INSTRUMENTS.find((i) => i.id === flags.instrument);
  if (!inst) {
    console.error(`Unknown instrument: ${flags.instrument}`);
    process.exit(2);
  }
  let parts = inst.parts || [];
  if (flags.part) parts = parts.filter((p) => p.id === flags.part);
  if (flags.json) {
    console.log(JSON.stringify(parts, null, 2));
    process.exit(0);
  }
  for (const p of parts) {
    console.log(`${p.id}  (${p.name})`);
    for (const v of p.variants || []) {
      const desc = (v.descriptors || []).join(', ');
      console.log(`  ${v.id}  ${v.name}  [${desc}]`);
    }
  }
  process.exit(0);
}

// --archetypes
if (flags.archetypes !== undefined) {
  const filtered = filterBy(C.CHAIN_ARCHETYPES || [], {
    era: 'era',
    region: 'region',
    scale: 'scale_tier',
  });
  if (flags.json) {
    console.log(JSON.stringify(filtered, null, 2));
    process.exit(0);
  }
  if (flags.ids) {
    for (const a of filtered) console.log(a.id);
    process.exit(0);
  }
  for (const a of filtered) {
    console.log(`${a.id}  era=${a.era}  region=${a.region}  scale=${a.scale_tier}`);
    console.log(
      `  components: ${Object.entries(a.components)
        .map(([k, v]) => k + '=' + (Array.isArray(v) ? v.join('+') : v))
        .join('  ')}`
    );
  }
  process.exit(0);
}

// --aesthetics
if (flags.aesthetics !== undefined) {
  const filtered = filterBy(C.PRODUCTION_AESTHETICS || [], { era: 'era' });
  if (flags.json) {
    console.log(JSON.stringify(filtered, null, 2));
    process.exit(0);
  }
  for (const p of filtered) {
    console.log(`${p.id}  era=${p.era}  locus=${p.production_locus}`);
    console.log(`  techniques: ${(p.characteristic_techniques || []).join(', ')}`);
  }
  process.exit(0);
}

// --traditions
if (flags.traditions !== undefined) {
  let filtered = C.TRADITIONS;
  if (flags.family && flags.family !== true)
    filtered = filtered.filter((t) => t.family === flags.family);
  if (flags.parent && flags.parent !== true) {
    filtered = filtered.filter((t) => {
      const e = C.TRADITION_EXTRAS[t.id];
      return e && e.parent === flags.parent;
    });
  }
  if (flags.json) {
    console.log(JSON.stringify(filtered, null, 2));
    process.exit(0);
  }
  if (flags.ids) {
    for (const t of filtered) console.log(t.id);
    process.exit(0);
  }
  for (const t of filtered) {
    const e = C.TRADITION_EXTRAS[t.id];
    const parent = e ? e.parent : '?';
    console.log(`${t.id}  parent=${parent}  family=${t.family}  ${t.name}`);
  }
  process.exit(0);
}

// --tunings
if (flags.tunings !== undefined) {
  emit(C.TUNINGS, ['name', 'descriptors']);
  process.exit(0);
}

// --tree
if (flags.tree !== undefined) {
  let nodes = C.TREE_NODES;
  if (flags.root && flags.root !== true) {
    nodes = nodes.filter((n) => n.id === flags.root || n.id.startsWith(flags.root + '.'));
  }
  const maxDepth = flags.depth ? parseInt(flags.depth) : 99;
  nodes = nodes.filter((n) => (n.id.match(/\./g) || []).length <= maxDepth);
  if (flags.json) {
    console.log(JSON.stringify(nodes, null, 2));
    process.exit(0);
  }
  for (const n of nodes) {
    const depth = (n.id.match(/\./g) || []).length;
    const indent = '  '.repeat(depth);
    console.log(`${indent}${n.id}  ${n.name || ''}`);
  }
  process.exit(0);
}

// --axes
if (flags.axes !== undefined) {
  if (flags.json) {
    console.log(JSON.stringify(C.AXIS_DEFINITIONS, null, 2));
    process.exit(0);
  }
  for (const a of C.AXIS_DEFINITIONS) {
    console.log(`${a.id.padEnd(14)} ${a.name}`);
    console.log(`  -2 ← ${a.neg}  ${a.neg_anchor ? '(' + a.neg_anchor + ')' : ''}`);
    console.log(`  +2 → ${a.pos}  ${a.pos_anchor ? '(' + a.pos_anchor + ')' : ''}`);
  }
  process.exit(0);
}

// --inst-axes
if (flags['inst-axes'] !== undefined) {
  if (flags.json) {
    console.log(JSON.stringify(C.INSTRUMENT_AXIS_DEFINITIONS, null, 2));
    process.exit(0);
  }
  for (const a of C.INSTRUMENT_AXIS_DEFINITIONS) {
    console.log(`${a.id.padEnd(14)} ${a.name}`);
    console.log(`  -2 ← ${a.neg}`);
    console.log(`  +2 → ${a.pos}`);
  }
  process.exit(0);
}

// No mode given
console.error('Specify a mode: --section, --rooms, --instruments, --variants, --archetypes,');
console.error('               --aesthetics, --traditions, --tunings, --tree, --axes, --inst-axes');
console.error('Add --help for syntax.');
process.exit(2);
