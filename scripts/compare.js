#!/usr/bin/env node
// Structural diff between two catalog entries of the same type.
//
// Usage:
//   node scripts/compare.js --traditions <id_a> <id_b>      axis deltas, instrument Venn, room/chain diff
//   node scripts/compare.js --traditions=<id_a>,<id_b>      (comma form, parity with sibling scripts)
//   node scripts/compare.js --instruments <id_a> <id_b>     parts overlap, axis deltas, family
//   node scripts/compare.js --rooms <id_a> <id_b>           era/region/scale, descriptors
//   node scripts/compare.js --archetypes <id_a> <id_b>      component-by-component diff
//
// Output is structured (key:value lines) for both human reading and easy parsing
// by other scripts (e.g., the search engine's coherence scorer).

const C = require('./_loader.js');

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  } else {
    positional.push(a);
  }
}

// Accepts two ids from either:
//   --flag=a,b      (comma-separated, in line with sibling scripts)
//   --flag a b      (positional, original form)
// Returns [idA, idB] or [null, null] if not provided.
function twoIds(flagValue, positional) {
  if (typeof flagValue === 'string' && flagValue.includes(',')) {
    const [a, b] = flagValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return [a || null, b || null];
  }
  return [positional[0] || null, positional[1] || null];
}

function venn(a, b) {
  const setA = new Set(a || []);
  const setB = new Set(b || []);
  const both = [...setA].filter((x) => setB.has(x));
  const onlyA = [...setA].filter((x) => !setB.has(x));
  const onlyB = [...setB].filter((x) => !setA.has(x));
  return { both, onlyA, onlyB };
}

function axisDeltas(axA, axB) {
  if (!axA || !axB) return null;
  const keys = Object.keys(axA);
  const deltas = {};
  let totalDist = 0;
  for (const k of keys) {
    if (axB[k] !== undefined) {
      const d = axA[k] - axB[k];
      deltas[k] = { a: axA[k], b: axB[k], delta: d };
      totalDist += Math.abs(d);
    }
  }
  return { deltas, totalDist };
}

if (flags.traditions) {
  const [idA, idB] = twoIds(flags.traditions, positional);
  if (!idA || !idB) {
    console.error('--traditions requires two ids — use --traditions=a,b or --traditions a b');
    process.exit(2);
  }
  const tA = C.TRADITIONS.find((x) => x.id === idA);
  const tB = C.TRADITIONS.find((x) => x.id === idB);
  const eA = C.TRADITION_EXTRAS[idA] || {};
  const eB = C.TRADITION_EXTRAS[idB] || {};
  if (!tA || !tB) {
    console.error('Unknown tradition');
    process.exit(2);
  }

  const result = {
    A: {
      id: idA,
      name: tA.name,
      parent: eA.parent,
      family: tA.family,
      room: tA.room,
      archetype: tA.chain_archetype,
      tuning: tA.tuning,
    },
    B: {
      id: idB,
      name: tB.name,
      parent: eB.parent,
      family: tB.family,
      room: tB.room,
      archetype: tB.chain_archetype,
      tuning: tB.tuning,
    },
    instruments: venn(tA.instruments, tB.instruments),
    crossRefs: venn(
      (eA.crossRefs || []).map((cr) => (cr && typeof cr === 'object' ? cr.ref : cr)),
      (eB.crossRefs || []).map((cr) => (cr && typeof cr === 'object' ? cr.ref : cr))
    ),
    axes: axisDeltas(eA.axes, eB.axes),
    same_parent: eA.parent === eB.parent,
    same_family: tA.family === tB.family,
    same_room: tA.room === tB.room,
    same_tuning: tA.tuning === tB.tuning,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (flags.instruments) {
  const [idA, idB] = twoIds(flags.instruments, positional);
  if (!idA || !idB) {
    console.error('--instruments requires two ids — use --instruments=a,b or --instruments a b');
    process.exit(2);
  }
  const iA = C.INSTRUMENTS.find((x) => x.id === idA);
  const iB = C.INSTRUMENTS.find((x) => x.id === idB);
  if (!iA || !iB) {
    console.error('Unknown instrument');
    process.exit(2);
  }

  const partsA = (iA.parts || []).map((p) => p.id);
  const partsB = (iB.parts || []).map((p) => p.id);

  const result = {
    A: { id: idA, name: iA.name, family: iA.family, axes: iA.axes },
    B: { id: idB, name: iB.name, family: iB.family, axes: iB.axes },
    parts: venn(partsA, partsB),
    axes: axisDeltas(iA.axes, iB.axes),
    same_family: iA.family === iB.family,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (flags.rooms) {
  const [idA, idB] = twoIds(flags.rooms, positional);
  if (!idA || !idB) {
    console.error('--rooms requires two ids — use --rooms=a,b or --rooms a b');
    process.exit(2);
  }
  const rA = C.ROOMS.find((x) => x.id === idA);
  const rB = C.ROOMS.find((x) => x.id === idB);
  if (!rA || !rB) {
    console.error('Unknown room');
    process.exit(2);
  }

  const result = {
    A: {
      id: idA,
      name: rA.name,
      cluster: rA.cluster,
      era: rA.era,
      region: rA.region,
      scale_tier: rA.scale_tier,
      archetype: rA.default_chain_archetype,
    },
    B: {
      id: idB,
      name: rB.name,
      cluster: rB.cluster,
      era: rB.era,
      region: rB.region,
      scale_tier: rB.scale_tier,
      archetype: rB.default_chain_archetype,
    },
    descriptors: venn(rA.descriptors, rB.descriptors),
    same_cluster: rA.cluster === rB.cluster,
    same_era: rA.era === rB.era,
    same_region: rA.region === rB.region,
    same_scale: rA.scale_tier === rB.scale_tier,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (flags.archetypes) {
  const [idA, idB] = twoIds(flags.archetypes, positional);
  if (!idA || !idB) {
    console.error('--archetypes requires two ids — use --archetypes=a,b or --archetypes a b');
    process.exit(2);
  }
  const aA = C.CHAIN_ARCHETYPES.find((x) => x.id === idA);
  const aB = C.CHAIN_ARCHETYPES.find((x) => x.id === idB);
  if (!aA || !aB) {
    console.error('Unknown archetype');
    process.exit(2);
  }

  const componentDiff = {};
  const allKeys = new Set([...Object.keys(aA.components), ...Object.keys(aB.components)]);
  for (const k of allKeys) {
    const vA = aA.components[k];
    const vB = aB.components[k];
    componentDiff[k] = {
      a: vA || null,
      b: vB || null,
      same: JSON.stringify(vA) === JSON.stringify(vB),
    };
  }

  const result = {
    A: { id: idA, name: aA.name, era: aA.era, region: aA.region, scale_tier: aA.scale_tier },
    B: { id: idB, name: aB.name, era: aB.era, region: aB.region, scale_tier: aB.scale_tier },
    components: componentDiff,
    same_era: aA.era === aB.era,
    same_region: aA.region === aB.region,
    same_scale: aA.scale_tier === aB.scale_tier,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.error('Specify a comparison type: --traditions, --instruments, --rooms, --archetypes');
process.exit(2);
