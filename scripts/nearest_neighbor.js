#!/usr/bin/env node
// Find nearest neighbors for any catalog entity. The catalog is a relational graph
// at multiple scales — traditions, instruments, variants, tree nodes, chain items,
// rooms. Different scales need different distance functions; this script unifies them.

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
        flags[a.slice(2)] = next; i++;
      } else {
        flags[a.slice(2)] = true;
      }
    }
  }
}

const limit = parseInt(flags.limit) || 5;
const useJson = !!flags.json;
const type = flags.type || 'tradition';

function usage() {
  console.error('Usage:');
  console.error('  nearest_neighbor.js --type tradition --keyword <term>');
  console.error('  nearest_neighbor.js --type tradition --axes "harm:1,..."');
  console.error('  nearest_neighbor.js --type tradition --id <tradition_id>');
  console.error('  nearest_neighbor.js --type variant --id <instrument_id>:<part_id>:<variant_id>');
  console.error('  nearest_neighbor.js --type instrument --id <instrument_id>');
  console.error('  nearest_neighbor.js --type tree-node --id <node.path>');
  console.error('  nearest_neighbor.js --type chain-item --id <section_id>:<item_id>');
  console.error('  nearest_neighbor.js --type room --id <room_id>');
  process.exit(2);
}

// ───────────────────────── helpers ─────────────────────────

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function axisL1(a, b) {
  if (!a || !b) return Infinity;
  let dist = 0;
  let matched = 0;
  for (const k of Object.keys(a)) {
    if (b[k] !== undefined) { dist += Math.abs(a[k] - b[k]); matched++; }
  }
  return matched === 0 ? Infinity : dist / matched;
}

function normDesc(d) {
  return String(d).toLowerCase().replace(/-canonical$/, '');
}

function parentPathDistance(p1, p2) {
  if (!p1 || !p2) return 99;
  const a = p1.split('.');
  const b = p2.split('.');
  let common = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) common++;
    else break;
  }
  return (a.length - common) + (b.length - common);
}

// ───────────────────────── tradition ─────────────────────────

function tradition_byKeyword(q) {
  q = q.toLowerCase();
  const results = [];
  for (const t of C.TRADITIONS) {
    const e = C.TRADITION_EXTRAS[t.id] || {};
    let score = 0;
    if (t.id.toLowerCase().includes(q)) score += 10;
    if (t.name.toLowerCase().includes(q)) score += 8;
    if ((t.lineage || '').toLowerCase().includes(q)) score += 4;
    for (const ex of (e.exemplars || [])) {
      if (ex.toLowerCase().includes(q)) score += 5;
    }
    if ((e.description || '').toLowerCase().includes(q)) score += 1;
    if (score > 0) results.push({ id: t.id, name: t.name, parent: e.parent, exemplars: e.exemplars || [], score });
  }
  return results.sort((a, b) => b.score - a.score);
}

function tradition_byAxes(target) {
  const results = [];
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.axes) continue;
    let dist = 0;
    let matched = 0;
    for (const k of Object.keys(target)) {
      if (e.axes[k] !== undefined) {
        dist += Math.abs(target[k] - e.axes[k]);
        matched++;
      }
    }
    if (matched === 0) continue;
    const t = C.TRADITIONS.find(x => x.id === tid);
    if (!t) continue;
    results.push({ id: tid, name: t.name, parent: e.parent, exemplars: e.exemplars || [], score: -dist, distance: dist, matched });
  }
  return results.sort((a, b) => b.score - a.score);
}

function tradition_byId(tid) {
  const seedExtras = C.TRADITION_EXTRAS[tid];
  if (!seedExtras) return null;
  const seedAxes = seedExtras.axes || {};
  const seedParent = seedExtras.parent || '';
  const seedCrossRefs = new Set(seedExtras.crossRefs || []);

  const results = [];
  for (const otherTid of Object.keys(C.TRADITION_EXTRAS)) {
    if (otherTid === tid) continue;
    const e = C.TRADITION_EXTRAS[otherTid];
    if (!e.axes) continue;
    const t = C.TRADITIONS.find(x => x.id === otherTid);
    if (!t) continue;

    const axisDist = axisL1(seedAxes, e.axes);
    const pathDist = parentPathDistance(seedParent, e.parent || '');
    const otherCrossRefs = new Set(e.crossRefs || []);
    let crossOverlap = 0;
    for (const cr of seedCrossRefs) if (otherCrossRefs.has(cr)) crossOverlap++;
    if (seedParent && otherCrossRefs.has(seedParent)) crossOverlap += 2;
    if (e.parent && seedCrossRefs.has(e.parent)) crossOverlap += 2;

    const score = -axisDist - 0.5 * pathDist + 1.0 * crossOverlap;
    results.push({
      id: otherTid, name: t.name, parent: e.parent,
      exemplars: e.exemplars || [],
      score, axisDist, pathDist, crossOverlap,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

// ───────────────────────── variant ─────────────────────────

function findVariantById(idStr) {
  if (idStr.includes(':')) {
    const [instId, partId, variantId] = idStr.split(':');
    const inst = C.INSTRUMENTS.find(i => i.id === instId);
    if (!inst) return null;
    const part = (inst.parts || []).find(p => p.id === partId);
    if (!part) return null;
    const variant = part.variants.find(v => v.id === variantId);
    if (!variant) return null;
    return { instrumentId: instId, partId, variant };
  }
  for (const inst of C.INSTRUMENTS) {
    for (const part of (inst.parts || [])) {
      const variant = part.variants.find(v => v.id === idStr);
      if (variant) return { instrumentId: inst.id, partId: part.id, variant };
    }
  }
  return null;
}

function variant_byId(idStr) {
  const seed = findVariantById(idStr);
  if (!seed) return null;
  const seedDescs = new Set((seed.variant.descriptors || []).map(normDesc));
  // Post canonical-suffix → canonical_tags refactor: read the structural field
  // directly instead of parsing the '-canonical' suffix off descriptor strings.
  const seedCanonicals = new Set((seed.variant.canonical_tags || []).map(normDesc));

  const results = [];
  for (const inst of C.INSTRUMENTS) {
    for (const part of (inst.parts || [])) {
      for (const v of (part.variants || [])) {
        if (inst.id === seed.instrumentId && part.id === seed.partId && v.id === seed.variant.id) continue;
        const vDescs = new Set((v.descriptors || []).map(normDesc));
        const vCanonicals = new Set((v.canonical_tags || []).map(normDesc));
        const jacc = jaccard(seedDescs, vDescs);
        let canonicalOverlap = 0;
        for (const c of seedCanonicals) if (vCanonicals.has(c)) canonicalOverlap++;
        if (jacc === 0 && canonicalOverlap === 0) continue;
        const score = jacc + 0.5 * canonicalOverlap;
        results.push({
          id: `${inst.id}:${part.id}:${v.id}`,
          variantId: v.id, partId: part.id, instrumentId: inst.id,
          name: v.name, descriptors: v.descriptors || [],
          score, jaccard: jacc, canonicalOverlap,
        });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

// ───────────────────────── instrument ─────────────────────────

function instrument_byId(iid) {
  const seed = C.INSTRUMENTS.find(i => i.id === iid);
  if (!seed) return null;
  const seedParts = new Set((seed.parts || []).map(p => p.id));
  const seedAxes = seed.axes || {};
  const seedFamily = seed.family;

  const results = [];
  for (const other of C.INSTRUMENTS) {
    if (other.id === iid) continue;
    const otherParts = new Set((other.parts || []).map(p => p.id));
    const partJacc = jaccard(seedParts, otherParts);
    const axisDist = axisL1(seedAxes, other.axes || {});
    const familyBonus = (other.family === seedFamily) ? 0.3 : 0;
    const axisScore = isFinite(axisDist) ? 1 / (1 + axisDist) : 0;
    const score = 0.5 * partJacc + 0.5 * axisScore + familyBonus;
    if (score === 0) continue;
    results.push({
      id: other.id, name: other.name, family: other.family,
      score, partJacc, axisDist,
      partCount: (other.parts || []).length,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

// ───────────────────────── tree-node ─────────────────────────

function treeNode_byId(pathStr) {
  const seedNode = C.TREE_NODES.find(n => n.id === pathStr);
  if (!seedNode) return null;

  const results = [];
  for (const other of C.TREE_NODES) {
    if (other.id === pathStr) continue;
    const dist = parentPathDistance(pathStr, other.id);
    if (dist > 6) continue;
    const score = -dist;
    results.push({
      id: other.id, name: other.name || other.id,
      score, distance: dist,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

// ───────────────────────── chain-item ─────────────────────────

function findChainItem(idStr) {
  if (idStr.includes(':')) {
    const [sectionId, itemId] = idStr.split(':');
    const section = C.CHAIN_SECTIONS.find(s => s.id === sectionId);
    if (!section) return null;
    const item = section.items.find(x => x.id === itemId);
    if (!item) return null;
    return { sectionId, item };
  }
  for (const sec of C.CHAIN_SECTIONS) {
    const item = sec.items.find(x => x.id === idStr);
    if (item) return { sectionId: sec.id, item };
  }
  return null;
}

function chainItem_byId(idStr) {
  const seed = findChainItem(idStr);
  if (!seed) return null;
  const seedDescs = new Set((seed.item.descriptors || []).map(normDesc));
  const seedEra = seed.item.era || null;

  const results = [];
  const sections = [C.CHAIN_SECTIONS.find(s => s.id === seed.sectionId)];
  for (const sec of sections) {
    if (!sec) continue;
    for (const item of sec.items) {
      if (item.id === seed.item.id) continue;
      const itemDescs = new Set((item.descriptors || []).map(normDesc));
      const jacc = jaccard(seedDescs, itemDescs);
      const eraBonus = (seedEra && item.era === seedEra) ? 0.2 : 0;
      const score = jacc + eraBonus;
      if (score === 0) continue;
      results.push({
        id: `${sec.id}:${item.id}`, sectionId: sec.id, name: item.name || item.id,
        descriptors: item.descriptors || [], era: item.era || null,
        score, jaccard: jacc,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

// ───────────────────────── room ─────────────────────────

function room_byId(rid) {
  const seed = C.ROOMS.find(r => r.id === rid);
  if (!seed) return null;
  const seedDescs = new Set((seed.descriptors || []).map(normDesc));
  const seedCluster = seed.cluster || null;
  const seedEra = seed.era || null;
  const seedRegion = seed.region || null;
  const seedScale = seed.scale_tier || null;

  const results = [];
  for (const other of C.ROOMS) {
    if (other.id === rid) continue;
    const oDescs = new Set((other.descriptors || []).map(normDesc));
    const descJacc = jaccard(seedDescs, oDescs);
    const clusterMatch = (seedCluster && other.cluster === seedCluster) ? 0.3 : 0;
    const eraMatch = (seedEra && other.era === seedEra) ? 0.2 : 0;
    const regionMatch = (seedRegion && other.region === seedRegion) ? 0.2 : 0;
    const scaleMatch = (seedScale && other.scale_tier === seedScale) ? 0.1 : 0;
    // Descriptor jaccard reweighted to 0.8 (was 0.4 + 0.4 genre-tag jaccard).
    // Rooms are physical/acoustic — descriptors are the substantive similarity
    // signal; cluster/era/region/scale are the categorical signal.
    const score = 0.8 * descJacc + clusterMatch + eraMatch + regionMatch + scaleMatch;
    if (score === 0) continue;
    results.push({
      id: other.id, name: other.name || other.id,
      cluster: other.cluster, era: other.era, region: other.region,
      score, descJacc,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

// ───────────────────────── output ─────────────────────────

function emit(results, header) {
  if (useJson) {
    console.log(JSON.stringify(results.slice(0, limit), null, 2));
    return;
  }
  if (!results || results.length === 0) {
    console.log('No matches.');
    return;
  }
  console.log(header);
  console.log('');
  const top = results.slice(0, limit);
  for (const r of top) {
    const scoreStr = (r.score === undefined ? '' : `score=${(typeof r.score === 'number' ? r.score.toFixed(2) : r.score)}`);
    if (r.descriptors && Array.isArray(r.descriptors)) {
      const descPreview = r.descriptors.slice(0, 5).map(normDesc).join(', ');
      console.log(`  ${r.id.padEnd(48)} ${scoreStr}`);
      console.log(`    ${r.name || ''}`);
      if (descPreview) console.log(`    [${descPreview}]`);
    } else {
      console.log(`  ${r.id.padEnd(48)} ${scoreStr}`);
      if (r.name) console.log(`    ${r.name}`);
      if (r.parent) console.log(`    parent: ${r.parent}`);
      if (r.cluster) console.log(`    cluster: ${r.cluster}, era: ${r.era || '?'}, region: ${r.region || '?'}`);
      if (r.exemplars && r.exemplars.length) {
        console.log(`    examples: ${r.exemplars.slice(0, 2).join(' | ')}`);
      }
    }
    console.log('');
  }
}

// ───────────────────────── dispatch ─────────────────────────

let results = null;
let header = '';

if (type === 'tradition') {
  if (flags.keyword) {
    results = tradition_byKeyword(String(flags.keyword));
    header = `Top ${Math.min(limit, results.length)} traditions matching keyword="${flags.keyword}":`;
  } else if (flags.axes) {
    const target = {};
    for (const pair of String(flags.axes).split(',')) {
      const [k, v] = pair.split(':');
      if (k && v !== undefined) target[k.trim()] = parseInt(v);
    }
    results = tradition_byAxes(target);
    header = `Top ${Math.min(limit, results.length)} traditions by axis distance:`;
  } else if (flags.id) {
    results = tradition_byId(String(flags.id));
    if (results === null) { console.error(`Tradition not found: ${flags.id}`); process.exit(2); }
    header = `Top ${Math.min(limit, results.length)} neighbors of tradition "${flags.id}":`;
  } else {
    usage();
  }
} else if (type === 'variant') {
  if (!flags.id) usage();
  results = variant_byId(String(flags.id));
  if (results === null) { console.error(`Variant not found: ${flags.id}`); process.exit(2); }
  header = `Top ${Math.min(limit, results.length)} variant neighbors of "${flags.id}":`;
} else if (type === 'instrument') {
  if (!flags.id) usage();
  results = instrument_byId(String(flags.id));
  if (results === null) { console.error(`Instrument not found: ${flags.id}`); process.exit(2); }
  header = `Top ${Math.min(limit, results.length)} instrument neighbors of "${flags.id}":`;
} else if (type === 'tree-node') {
  if (!flags.id) usage();
  results = treeNode_byId(String(flags.id));
  if (results === null) { console.error(`Tree node not found: ${flags.id}`); process.exit(2); }
  header = `Top ${Math.min(limit, results.length)} tree-node neighbors of "${flags.id}":`;
} else if (type === 'chain-item') {
  if (!flags.id) usage();
  results = chainItem_byId(String(flags.id));
  if (results === null) { console.error(`Chain item not found: ${flags.id}`); process.exit(2); }
  header = `Top ${Math.min(limit, results.length)} chain-item neighbors of "${flags.id}":`;
} else if (type === 'room') {
  if (!flags.id) usage();
  results = room_byId(String(flags.id));
  if (results === null) { console.error(`Room not found: ${flags.id}`); process.exit(2); }
  header = `Top ${Math.min(limit, results.length)} room neighbors of "${flags.id}":`;
} else {
  console.error(`Unknown --type: ${type}`);
  usage();
}

emit(results, header);
