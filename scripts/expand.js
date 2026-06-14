#!/usr/bin/env node
// Expand any catalog entry by following its references one level deep.
// Resolves ids to full objects so you see the descriptor content, not just ids.
//
// Usage:
//   node scripts/expand.js --tradition <id>      tradition + its room + its archetype + extras
//   node scripts/expand.js --instrument <id>     instrument + all parts + all variants + descriptors
//   node scripts/expand.js --room <id>           room + its default archetype expanded
//   node scripts/expand.js --archetype <id>      archetype + each component resolved to chain section item
//   node scripts/expand.js --aesthetic <id>      aesthetic with its full body
//   node scripts/expand.js --tree <id>           tree node + its children + traditions under it

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
      if (next && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; }
      else flags[a.slice(2)] = true;
    }
  }
}

function resolveChainItem(sectionId, itemId) {
  const sec = C.CHAIN_SECTIONS.find(s => s.id === sectionId);
  if (sec) {
    const it = sec.items.find(x => x.id === itemId);
    if (it) return it;
  }
  return { id: itemId, name: '(unresolved)', descriptors: [] };
}

// Success paths set `process.exitCode` and let the process exit naturally rather
// than calling `process.exit(0)`. `process.exit()` tears the process down before a
// large async stdout write has drained, truncating piped JSON at the OS pipe buffer
// (~64 KiB) — e.g. `expand.js --tradition <id> | jq` was losing everything past byte
// 65524. Letting the event loop flush stdout first avoids that. Error paths keep
// `process.exit(2)`: they write a tiny message to stderr and must halt immediately.
if (flags.tradition) {
  const t = C.TRADITIONS.find(x => x.id === flags.tradition);
  if (!t) { console.error(`Unknown tradition: ${flags.tradition}`); process.exit(2); }
  const e = C.TRADITION_EXTRAS[flags.tradition] || {};
  const room = t.room ? C.ROOMS.find(r => r.id === t.room) : null;
  const arch = t.chain_archetype ? C.CHAIN_ARCHETYPES.find(a => a.id === t.chain_archetype) : null;
  const tuning = t.tuning ? C.TUNINGS.find(tu => tu.id === t.tuning) : null;
  const aestheticId = Array.isArray(t.production_aesthetic) ? t.production_aesthetic[0] : t.production_aesthetic;
  const aesthetic = aestheticId ? (C.PRODUCTION_AESTHETICS || []).find(p => p.id === aestheticId) : null;
  const instruments = (t.instruments || []).map(iid => {
    const i = C.INSTRUMENTS.find(x => x.id === iid);
    return i ? { id: iid, name: i.short || i.name, family: i.family, parts: i.parts } : { id: iid, error: 'unresolved' };
  });
  const out = {
    id: t.id, name: t.name, family: t.family, lineage: t.lineage,
    parent: e.parent, axes: e.axes, description: e.description,
    exemplars: e.exemplars, crossRefs: e.crossRefs, status: e.status,
    instruments,
    room, chain_archetype: arch, tuning, aesthetic,
    inline_chain: { mic: t.chain_mic, pre: t.chain_pre, console: t.chain_console, medium: t.chain_medium },
  };
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 0;
} else if (flags.instrument) {
  const i = C.INSTRUMENTS.find(x => x.id === flags.instrument);
  if (!i) { console.error(`Unknown instrument: ${flags.instrument}`); process.exit(2); }
  console.log(JSON.stringify(i, null, 2));
  process.exitCode = 0;
} else if (flags.room) {
  const r = C.ROOMS.find(x => x.id === flags.room);
  if (!r) { console.error(`Unknown room: ${flags.room}`); process.exit(2); }
  const arch = r.default_chain_archetype ? C.CHAIN_ARCHETYPES.find(a => a.id === r.default_chain_archetype) : null;
  const out = { ...r, default_chain_archetype_resolved: arch };
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 0;
} else if (flags.archetype) {
  const a = C.CHAIN_ARCHETYPES.find(x => x.id === flags.archetype);
  if (!a) { console.error(`Unknown archetype: ${flags.archetype}`); process.exit(2); }
  const resolved = {};
  for (const [k, v] of Object.entries(a.components)) {
    if (Array.isArray(v)) resolved[k] = v.map(itemId => resolveChainItem(k, itemId));
    else resolved[k] = resolveChainItem(k, v);
  }
  const out = { ...a, components_resolved: resolved };
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 0;
} else if (flags.aesthetic) {
  const p = (C.PRODUCTION_AESTHETICS || []).find(x => x.id === flags.aesthetic);
  if (!p) { console.error(`Unknown aesthetic: ${flags.aesthetic}`); process.exit(2); }
  console.log(JSON.stringify(p, null, 2));
  process.exitCode = 0;
} else if (flags.tree) {
  const n = C.TREE_NODES.find(x => x.id === flags.tree);
  if (!n) { console.error(`Unknown tree node: ${flags.tree}`); process.exit(2); }
  const children = C.TREE_NODES.filter(x => x.parent === n.id);
  const traditions = C.TRADITIONS.filter(t => {
    const e = C.TRADITION_EXTRAS[t.id];
    return e && e.parent === n.id;
  });
  console.log(JSON.stringify({ ...n, children, traditions: traditions.map(t => t.id) }, null, 2));
  process.exitCode = 0;
} else {
  console.error('Specify what to expand: --tradition, --instrument, --room, --archetype, --aesthetic, --tree');
  process.exit(2);
}
