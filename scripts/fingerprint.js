#!/usr/bin/env node
// Fingerprint a recording in parameter space.
//
// Usage:
//   node scripts/fingerprint.js <tradition_id>
//   node scripts/fingerprint.js <tradition_id> --aesthetic=<aesthetic_id>
//   node scripts/fingerprint.js <tradition_id> --json   (machine-readable output)
//
// The tradition_id must already exist in references/05_traditions.js. To find
// the right tradition_id from a freeform recording description, use
// nearest_neighbor.js first.
//
// Examples:
//   node scripts/fingerprint.js british_invasion_rb
//   node scripts/fingerprint.js post_punk --aesthetic=isolation_post_punk_aesthetic
//   node scripts/fingerprint.js khayal --json

const C = require('./_loader.js');

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of args) {
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    flags[k] = v === undefined ? true : v;
  } else {
    positional.push(a);
  }
}

const tradId = positional[0];
if (!tradId) {
  console.error('Usage: fingerprint.js <tradition_id> [--aesthetic=<id>] [--json]');
  console.error('Run nearest_neighbor.js first if you need to find the right tradition_id.');
  process.exit(2);
}

const t = C.TRADITIONS.find(x => x.id === tradId);
const e = C.TRADITION_EXTRAS[tradId];
if (!t) {
  console.error(`No tradition with id="${tradId}". Try nearest_neighbor.js to find a match.`);
  process.exit(2);
}

const room = t.room ? C.ROOMS.find(r => r.id === t.room) : null;
const arch = t.chain_archetype ? C.CHAIN_ARCHETYPES.find(a => a.id === t.chain_archetype) : null;
const tuning = t.tuning ? C.TUNINGS.find(tu => tu.id === t.tuning) : null;
const aestheticId = flags.aesthetic || (Array.isArray(t.production_aesthetic) ? t.production_aesthetic[0] : t.production_aesthetic);
const aesthetic = aestheticId ? (C.PRODUCTION_AESTHETICS || []).find(p => p.id === aestheticId) : null;

const instruments = (t.instruments || []).map(iid => {
  const inst = C.INSTRUMENTS.find(i => i.id === iid);
  return inst ? { id: iid, name: inst.short || inst.name, family: inst.family } : { id: iid, name: '?', family: '?' };
});

// Inline chain (the values directly on the tradition) — useful when chain_archetype isn't set
const inlineChain = {
  mic: t.chain_mic || null,
  pre: t.chain_pre || null,
  console: t.chain_console || null,
  medium: t.chain_medium || null,
};

const result = {
  tradition: {
    id: t.id,
    name: t.name,
    family: t.family,
    lineage: t.lineage,
    parent: e?.parent || null,
    description: e?.description || null,
    exemplars: e?.exemplars || [],
    crossRefs: e?.crossRefs || [],
  },
  room: room ? {
    id: room.id,
    name: room.name,
    cluster: room.cluster,
    era: room.era || null,
    region: room.region || null,
    scale_tier: room.scale_tier || null,
    descriptors: room.descriptors || [],
    note: room.note || null,
  } : null,
  chain_archetype: arch ? {
    id: arch.id,
    name: arch.name,
    era: arch.era,
    region: arch.region,
    scale_tier: arch.scale_tier,
    components: arch.components,
    note: arch.note || null,
  } : null,
  inline_chain: arch ? null : inlineChain, // only show inline if archetype isn't doing the job
  production_aesthetic: aesthetic ? {
    id: aesthetic.id,
    name: aesthetic.name,
    era: aesthetic.era,
    description: aesthetic.description,
    characteristic_techniques: aesthetic.characteristic_techniques,
    production_locus: aesthetic.production_locus,
  } : null,
  tuning: tuning ? { id: tuning.id, name: tuning.name } : (t.tuning ? { id: t.tuning, name: '(unresolved)' } : null),
  instruments,
  axes: e?.axes || null,
  status: e?.status || 'unknown',
};

// Machine-readable output if requested
if (flags.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// Human-readable output
const r = result;
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  FINGERPRINT: ${r.tradition.name}`);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`TRADITION       ${r.tradition.id}`);
console.log(`  family:       ${r.tradition.family}`);
console.log(`  parent:       ${r.tradition.parent || '—'}`);
console.log(`  lineage:      ${r.tradition.lineage}`);
if (r.tradition.exemplars.length) {
  console.log(`  exemplars:    ${r.tradition.exemplars.slice(0, 3).join('; ')}`);
  if (r.tradition.exemplars.length > 3) {
    console.log(`                ${r.tradition.exemplars.slice(3).join('; ')}`);
  }
}
console.log('');

if (r.room) {
  console.log(`ROOM            ${r.room.id}`);
  if (r.room.scale_tier || r.room.era || r.room.region) {
    console.log(`  scale:        ${r.room.scale_tier || '—'} / era: ${r.room.era || '—'} / region: ${r.room.region || '—'}`);
  }
  if (r.room.descriptors.length) {
    console.log(`  descriptors:  ${r.room.descriptors.join(', ')}`);
  }
  console.log('');
}

if (r.chain_archetype) {
  console.log(`CHAIN ARCHETYPE ${r.chain_archetype.id}`);
  console.log(`  era/region:   ${r.chain_archetype.era}  ${r.chain_archetype.region}  ${r.chain_archetype.scale_tier}`);
  for (const [k, v] of Object.entries(r.chain_archetype.components)) {
    if (Array.isArray(v)) console.log(`  ${k.padEnd(13)} ${v.join(', ')}`);
    else console.log(`  ${k.padEnd(13)} ${v}`);
  }
  console.log('');
} else if (r.inline_chain) {
  console.log('INLINE CHAIN    (no archetype reference; using tradition\'s inline chain fields)');
  for (const [k, v] of Object.entries(r.inline_chain)) {
    if (v) console.log(`  ${k.padEnd(13)} ${v}`);
  }
  console.log('');
}

if (r.production_aesthetic) {
  console.log(`AESTHETIC       ${r.production_aesthetic.id}`);
  console.log(`  era:          ${r.production_aesthetic.era}`);
  console.log(`  locus:        ${r.production_aesthetic.production_locus}`);
  console.log('');
}

console.log(`TUNING          ${r.tuning ? r.tuning.id + ' (' + r.tuning.name + ')' : '—'}`);
console.log('');

if (r.instruments.length) {
  console.log('INSTRUMENTS');
  for (const i of r.instruments) {
    console.log(`  ${i.id.padEnd(32)} ${i.name}`);
  }
  console.log('');
}

if (r.axes) {
  console.log('AXES (13)');
  const ax = r.axes;
  console.log(`  harm:${String(ax.harm).padEnd(3)} pitch:${String(ax.pitch).padEnd(3)} ornament:${String(ax.ornament).padEnd(3)} meter:${String(ax.meter).padEnd(3)} density:${String(ax.density).padEnd(3)}`);
  console.log(`  transmission:${String(ax.transmission).padEnd(3)} improv:${String(ax.improv).padEnd(3)} soundTech:${String(ax.soundTech).padEnd(3)} intensity:${String(ax.intensity).padEnd(3)}`);
  console.log(`  voice:${String(ax.voice).padEnd(3)} timbre:${String(ax.timbre).padEnd(3)} percussion:${String(ax.percussion).padEnd(3)} cyclicity:${String(ax.cyclicity).padEnd(3)}`);
  console.log('');
}

if (r.tradition.crossRefs.length) {
  console.log(`CROSSREFS       ${r.tradition.crossRefs.join(', ')}`);
}
