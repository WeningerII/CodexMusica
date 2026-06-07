#!/usr/bin/env node
// Cross-reference validator. Run after any edit to references/*.js.
// Exits 0 on clean, 1 with error report on broken refs.
//
// Usage: node scripts/validate.js

const C = require('./_loader.js');

const errors = [];

// ---- Build ID lookup sets ----
const instIds = new Set(C.INSTRUMENTS.map(i => i.id));
const familyIds = new Set(C.INSTRUMENT_FAMILIES.map(f => f.id));
const roomIds = new Set(C.ROOMS.map(r => r.id));
const roomClusterIds = new Set(C.ROOM_CLUSTERS.map(c => c.id));
const tuningIds = new Set(C.TUNINGS.map(t => t.id));
const treeIds = new Set(C.TREE_NODES.map(n => n.id));
const tradIds = new Set(C.TRADITIONS.map(t => t.id));
const archetypeIds = new Set((C.CHAIN_ARCHETYPES || []).map(a => a.id));
const aestheticIds = new Set((C.PRODUCTION_AESTHETICS || []).map(p => p.id));

// CHAIN_SECTIONS items are nested per-section
const chainIds = {};
for (const sec of C.CHAIN_SECTIONS) chainIds[sec.id] = new Set(sec.items.map(i => i.id));

// ---- Instrument validation ----
const REQ_INST_AXES = ['pitchFix','sustain','polyphony','harmonicity','register','range','articulation','transduction','dynamics'];
const seenInst = new Set();
for (const i of C.INSTRUMENTS) {
  if (seenInst.has(i.id)) errors.push(['DUPLICATE_ID', 'instrument', i.id]);
  seenInst.add(i.id);
  if (i.family && !familyIds.has(i.family)) errors.push(['BROKEN_REF', 'instrument.family', i.id, i.family]);
  if (!i.axes) { errors.push(['MISSING_AXES', 'instrument', i.id]); continue; }
  for (const ax of REQ_INST_AXES) {
    const v = i.axes[ax];
    if (v === undefined || v === null) errors.push(['MISSING_AXIS', 'instrument', i.id, ax]);
    else if (!Number.isInteger(v) || v < -2 || v > 2) errors.push(['AXIS_OUT_OF_RANGE', 'instrument', i.id, `${ax}=${v}`]);
  }
  for (const ax of Object.keys(i.axes)) {
    if (!REQ_INST_AXES.includes(ax)) errors.push(['UNKNOWN_AXIS', 'instrument', i.id, ax]);
  }
}

// ---- Room validation ----
const seenRoom = new Set();
for (const r of C.ROOMS) {
  if (seenRoom.has(r.id)) errors.push(['DUPLICATE_ID', 'room', r.id]);
  seenRoom.add(r.id);
  if (r.cluster && !roomClusterIds.has(r.cluster)) errors.push(['BROKEN_REF', 'room.cluster', r.id, r.cluster]);
  if (r.default_chain_archetype && !archetypeIds.has(r.default_chain_archetype)) {
    errors.push(['BROKEN_REF', 'room.default_chain_archetype', r.id, r.default_chain_archetype]);
  }
}

// ---- Chain archetype validation ----
for (const a of (C.CHAIN_ARCHETYPES || [])) {
  if (!a.components) { errors.push(['MISSING_FIELD', 'chain_archetype', a.id, 'components']); continue; }
  const c = a.components;
  if (c.mic && chainIds.mic && !chainIds.mic.has(c.mic)) errors.push(['BROKEN_REF', 'chain_archetype.mic', a.id, c.mic]);
  if (c.pre && chainIds.pre && !chainIds.pre.has(c.pre)) errors.push(['BROKEN_REF', 'chain_archetype.pre', a.id, c.pre]);
  if (c.console && chainIds.console && !chainIds.console.has(c.console)) errors.push(['BROKEN_REF', 'chain_archetype.console', a.id, c.console]);
  if (c.comp && chainIds.comp && !chainIds.comp.has(c.comp)) errors.push(['BROKEN_REF', 'chain_archetype.comp', a.id, c.comp]);
  if (c.eq && chainIds.eq && !chainIds.eq.has(c.eq)) errors.push(['BROKEN_REF', 'chain_archetype.eq', a.id, c.eq]);
  if (c.medium && chainIds.medium && !chainIds.medium.has(c.medium)) errors.push(['BROKEN_REF', 'chain_archetype.medium', a.id, c.medium]);
  if (Array.isArray(c.fx)) {
    for (const fxId of c.fx) {
      if (chainIds.fx && !chainIds.fx.has(fxId)) errors.push(['BROKEN_REF', 'chain_archetype.fx', a.id, fxId]);
    }
  }
}

// ---- Production aesthetic validation ----
const REQ_AESTHETIC = ['id','name','era','description','characteristic_techniques','exemplar_recordings','production_locus'];
for (const p of (C.PRODUCTION_AESTHETICS || [])) {
  for (const f of REQ_AESTHETIC) {
    if (p[f] === undefined || p[f] === null) errors.push(['MISSING_FIELD', 'production_aesthetic', p.id, f]);
  }
}

// ---- Tree node validation ----
for (const n of C.TREE_NODES) {
  if (n.parent && !treeIds.has(n.parent)) errors.push(['BROKEN_REF', 'tree_node.parent', n.id, n.parent]);
}

// ---- Tradition validation ----
for (const t of C.TRADITIONS) {
  if (t.tuning && !tuningIds.has(t.tuning)) errors.push(['BROKEN_REF', 'tradition.tuning', t.id, t.tuning]);
  if (t.room && !roomIds.has(t.room)) errors.push(['BROKEN_REF', 'tradition.room', t.id, t.room]);
  if (t.chain_archetype && !archetypeIds.has(t.chain_archetype)) {
    errors.push(['BROKEN_REF', 'tradition.chain_archetype', t.id, t.chain_archetype]);
  }
  if (t.production_aesthetic) {
    const refs = Array.isArray(t.production_aesthetic) ? t.production_aesthetic : [t.production_aesthetic];
    for (const r of refs) {
      if (!aestheticIds.has(r)) errors.push(['BROKEN_REF', 'tradition.production_aesthetic', t.id, r]);
    }
  }
  if (t.chain_mic && chainIds.mic && !chainIds.mic.has(t.chain_mic)) errors.push(['BROKEN_REF', 'tradition.chain_mic', t.id, t.chain_mic]);
  if (t.chain_pre && chainIds.pre && !chainIds.pre.has(t.chain_pre)) errors.push(['BROKEN_REF', 'tradition.chain_pre', t.id, t.chain_pre]);
  if (t.chain_medium && chainIds.medium && !chainIds.medium.has(t.chain_medium)) errors.push(['BROKEN_REF', 'tradition.chain_medium', t.id, t.chain_medium]);
  if (t.chain_console && chainIds.console && !chainIds.console.has(t.chain_console)) errors.push(['BROKEN_REF', 'tradition.chain_console', t.id, t.chain_console]);
  if (t.chain_comp && chainIds.comp && !chainIds.comp.has(t.chain_comp)) errors.push(['BROKEN_REF', 'tradition.chain_comp', t.id, t.chain_comp]);
  if (t.chain_eq && chainIds.eq && !chainIds.eq.has(t.chain_eq)) errors.push(['BROKEN_REF', 'tradition.chain_eq', t.id, t.chain_eq]);
  if (t.chain_amp && chainIds.amp && !chainIds.amp.has(t.chain_amp)) errors.push(['BROKEN_REF', 'tradition.chain_amp', t.id, t.chain_amp]);
  if (Array.isArray(t.instruments)) {
    const seen = new Set();
    for (const iid of t.instruments) {
      if (!instIds.has(iid)) errors.push(['BROKEN_REF', 'tradition.instruments', t.id, iid]);
      if (seen.has(iid)) errors.push(['DUPLICATE', 'tradition.instruments', t.id, iid]);
      seen.add(iid);
    }
  }
  // Optional tradition.parts — partial part-id → variant-id overrides applied at
  // import time. Validates that every part_id and variant_id exists somewhere
  // in this tradition's instrument set. A pair that doesn't match any
  // instrument is silently ignored at runtime (the makeCard filter), but it's
  // most likely an authoring typo and should be flagged here.
  if (t.parts && typeof t.parts === 'object') {
    // Collect all (part_id, variant_id) pairs valid for any of this tradition's
    // instruments. Lookup helper accessing the C.INSTRUMENTS index.
    const validPairs = new Set();
    for (const iid of (t.instruments || [])) {
      const inst = C.INSTRUMENTS.find(i => i.id === iid);
      if (!inst) continue;
      for (const p of inst.parts) {
        for (const v of p.variants) validPairs.add(p.id + '::' + v.id);
      }
    }
    for (const [pid, vid] of Object.entries(t.parts)) {
      if (!validPairs.has(pid + '::' + vid)) {
        errors.push(['BROKEN_REF', 'tradition.parts', t.id, pid + '=' + vid]);
      }
    }
  }
}

// ---- Tradition ID uniqueness ----
// Duplicate IDs are a schema violation: id-based lookups silently return the
// first match while the rest of the array is unreachable.
{
  const seenIds = new Map();
  for (const t of C.TRADITIONS) {
    if (seenIds.has(t.id)) {
      errors.push(['DUPLICATE_ID', 'tradition', t.id, seenIds.get(t.id)]);
    } else {
      seenIds.set(t.id, t.id);
    }
  }
}

// ---- Tradition name uniqueness ----
// Two traditions with identical names are confusing in the viewer and ambiguous
// for human reference. Names are compared case-insensitively.
{
  const seenNames = new Map();
  for (const t of C.TRADITIONS) {
    const lc = (t.name || '').toLowerCase().trim();
    if (!lc) {
      errors.push(['EMPTY_NAME', 'tradition', t.id, '']);
      continue;
    }
    if (seenNames.has(lc)) {
      errors.push(['DUPLICATE_NAME', 'tradition', t.id, seenNames.get(lc)]);
    } else {
      seenNames.set(lc, t.id);
    }
  }
}

// ---- Tradition extras validation ----
const REQ_AXES = ['harm','pitch','ornament','meter','density','transmission','improv','soundTech','intensity','voice','timbre','percussion','cyclicity'];

// Bidirectional bijection: TRADITIONS ↔ TRADITION_EXTRAS. Historically only the
// extras → tradition direction was checked (orphan-extras catch). The reverse
// — a tradition with no matching extras — slipped through, leaving the tradition
// invisible in the tree-browse UI because tradParent() returns null and the
// tree-walker never places it. The alternative_rock bug of May 2026 is the
// concrete case. Tradition without extras is a hard ERROR: every tradition
// must have parent (tree placement), axes (find-similar), description.
for (const t of C.TRADITIONS) {
  if (!Object.prototype.hasOwnProperty.call(C.TRADITION_EXTRAS, t.id)) {
    errors.push(['MISSING_EXTRAS', 'tradition', t.id, 'no_extras_entry — tradition will be UI-invisible in tree browse']);
  }
}
for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
  const e = C.TRADITION_EXTRAS[tid];
  if (!tradIds.has(tid)) errors.push(['ORPHAN_EXTRAS', 'tradition_extras', tid, 'no_matching_tradition']);
  if (e.parent && !treeIds.has(e.parent)) errors.push(['BROKEN_REF', 'extras.parent', tid, e.parent]);
  if (Array.isArray(e.crossRefs)) {
    for (const cr of e.crossRefs) {
      // crossRefs can be either:
      //   - string: 'parent.path'
      //   - object: { ref: 'parent.path', voice_isolated?: boolean, isolated_parts?: string[] }
      //
      // voice_isolated: true is legacy alias for isolated_parts: ['voice_quality'].
      let ref;
      if (typeof cr === 'string') {
        ref = cr;
      } else if (cr && typeof cr === 'object') {
        ref = cr.ref;
        if (typeof ref !== 'string') {
          errors.push(['MALFORMED_CROSSREF', 'extras.crossRefs', tid, 'object form requires string `ref` field']);
          continue;
        }
        // Reject unknown fields to catch typos early
        for (const k of Object.keys(cr)) {
          if (k !== 'ref' && k !== 'voice_isolated' && k !== 'isolated_parts') {
            errors.push(['MALFORMED_CROSSREF', 'extras.crossRefs', tid, `unknown field ${k}`]);
          }
        }
        if ('isolated_parts' in cr) {
          if (!Array.isArray(cr.isolated_parts) || !cr.isolated_parts.every(p => typeof p === 'string' && p.length > 0)) {
            errors.push(['MALFORMED_CROSSREF', 'extras.crossRefs', tid, 'isolated_parts must be non-empty array of strings']);
          }
        }
      } else {
        errors.push(['MALFORMED_CROSSREF', 'extras.crossRefs', tid, 'must be string or object']);
        continue;
      }
      if (!treeIds.has(ref)) errors.push(['BROKEN_REF', 'extras.crossRefs', tid, ref]);
    }
  }
  if (e.axes) {
    for (const ax of REQ_AXES) {
      const v = e.axes[ax];
      if (v === undefined || v === null) errors.push(['MISSING_AXIS', 'extras.axes', tid, ax]);
      else if (!Number.isInteger(v) || v < -2 || v > 2) errors.push(['AXIS_OUT_OF_RANGE', 'extras.axes', tid, `${ax}=${v}`]);
    }
  }
}

// ---- INSTRUMENT_FAMILY_PARTS applies_to refs ----
// Each variant.applies_to entry must reference an actual instrument id, AND at
// least one applies_to entry must be a member of the part's family (otherwise
// the variant is dead — applies_to filtering happens after family-membership
// filtering, so a variant whose applies_to has zero family-members is unreachable).
const allInstIds = new Set((C.INSTRUMENTS || []).map(i => i.id));
const familyMembersByFamily = {};
for (const i of (C.INSTRUMENTS || [])) {
  if (!familyMembersByFamily[i.family]) familyMembersByFamily[i.family] = new Set();
  familyMembersByFamily[i.family].add(i.id);
}
const fp = C.INSTRUMENT_FAMILY_PARTS || {};
for (const fam of Object.keys(fp)) {
  const members = familyMembersByFamily[fam] || new Set();
  for (const part of fp[fam]) {
    for (const v of (part.variants || [])) {
      if (!Array.isArray(v.applies_to)) continue;
      for (const target of v.applies_to) {
        if (!allInstIds.has(target)) {
          errors.push(['BROKEN_REF', 'family_parts.applies_to', `${fam}.${v.id}`, target]);
        }
      }
      const matchedInFam = v.applies_to.filter(t => members.has(t));
      if (matchedInFam.length === 0) {
        errors.push(['ORPHAN_VARIANT', 'family_parts.applies_to', `${fam}.${v.id}`, `applies_to=[${v.applies_to.join(',')}] matches no ${fam}-family instrument`]);
      }
    }
  }
}

// ---- Instrument-family parts coverage ----
// Every family declared in INSTRUMENT_FAMILIES should have an INSTRUMENT_FAMILY_PARTS
// entry, EXCEPT aggregate families that intentionally use only own-parts:
//   - voice: each voice variant is unique to its instrument; no shared parts
//   - ensemble: aggregate of multiple players; parts modeled per-instrument
// Silent absence of these was historically tolerated by the build_html.js merge
// (`if (fParts.length === 0) inst.parts = ownParts`), making any future missing
// family invisible until shipped. Listing them here locks in the intent: anything
// else missing is a real authoring gap.
const AGGREGATE_FAMILIES_NO_PARTS = new Set(['voice', 'ensemble']);
const familyPartsKeys = new Set(Object.keys(C.INSTRUMENT_FAMILY_PARTS || {}));
for (const fam of C.INSTRUMENT_FAMILIES) {
  if (familyPartsKeys.has(fam.id)) continue;
  if (AGGREGATE_FAMILIES_NO_PARTS.has(fam.id)) continue;
  errors.push(['MISSING_FAMILY_PARTS', 'family', fam.id, 'no INSTRUMENT_FAMILY_PARTS entry — add either an entry or to AGGREGATE_FAMILIES_NO_PARTS in validate.js']);
}
for (const fam of familyPartsKeys) {
  if (!familyIds.has(fam)) errors.push(['ORPHAN_FAMILY_PARTS', 'family_parts', fam, 'no matching INSTRUMENT_FAMILIES entry']);
}


// At most one variant per part may carry `default: true`. Two defaults is
// ambiguous — the engine picks the first encountered, which silently masks
// authoring intent. Also catches the common copy-paste authoring failure.
for (const i of (C.INSTRUMENTS || [])) {
  for (const part of (i.parts || [])) {
    const defaults = (part.variants || []).filter(v => v.default === true).map(v => v.id);
    if (defaults.length > 1) {
      errors.push(['MULTIPLE_DEFAULTS', 'instrument', `${i.id}.${part.id}`, defaults.join(',')]);
    }
  }
}

// ---- Missing-default detection (Layer 12b) ----
// Multi-variant parts post-family-merge MUST have a default. Without one, search
// falls through to array-order tie-break — incidental ordering rather than
// canonical preference. Family-part defaults filtered by applies_to can leave
// instruments orphaned; the engine supports own-part annotations of the form
// `{ id: '<part_id>', default_variant: '<variant_id>' }` to fill these gaps.
for (const i of (C.INSTRUMENTS || [])) {
  for (const part of (i.parts || [])) {
    const variants = part.variants || [];
    if (variants.length < 2) continue;
    const defaults = variants.filter(v => v.default === true);
    if (defaults.length === 0) {
      errors.push(['MISSING_DEFAULT', 'instrument', `${i.id}.${part.id}`, `${variants.length} variants, no default — add own-part annotation { id: '${part.id}', default_variant: '<canonical>' }`]);
    }
  }
}
for (const fam of Object.keys(C.INSTRUMENT_FAMILY_PARTS || {})) {
  for (const part of (C.INSTRUMENT_FAMILY_PARTS[fam] || [])) {
    const defaultVariants = (part.variants || []).filter(v => v.default === true);
    if (defaultVariants.length <= 1) continue;
    // Check whether any pair of defaults could coexist on a single instrument.
    // A variant without `applies_to` is family-wide and always coexists.
    // Two variants with non-overlapping `applies_to` arrays can never both
    // apply to the same instrument — not a real conflict.
    function appliesToSet(v) {
      if (!Array.isArray(v.applies_to)) return null; // family-wide
      return new Set(v.applies_to);
    }
    let conflictPair = null;
    for (let a = 0; a < defaultVariants.length && !conflictPair; a++) {
      for (let b = a + 1; b < defaultVariants.length && !conflictPair; b++) {
        const sa = appliesToSet(defaultVariants[a]);
        const sb = appliesToSet(defaultVariants[b]);
        // Both family-wide, or either family-wide → they overlap → conflict
        if (sa === null || sb === null) {
          conflictPair = [defaultVariants[a].id, defaultVariants[b].id];
          continue;
        }
        // Otherwise check intersection
        for (const x of sa) {
          if (sb.has(x)) { conflictPair = [defaultVariants[a].id, defaultVariants[b].id]; break; }
        }
      }
    }
    if (conflictPair) {
      errors.push(['MULTIPLE_DEFAULTS', 'family_parts', `${fam}.${part.id}`, conflictPair.join(',')]);
    }
  }
}

// ---- Source-level duplicate-key detection (06_extras.js) ----
// TRADITION_EXTRAS is an object literal, so a duplicate key silently collapses on
// eval (the later definition wins) — invisible to every check against the loaded
// object. Scan the raw source so a conflicting redefinition (the inuit_katajjaq
// case) is caught instead of one definition being silently dropped.
{
  const fs = require('fs');
  const path = require('path');
  const extrasSrc = fs.readFileSync(path.join(__dirname, '..', 'references', '06_extras.js'), 'utf8');
  const seenKey = new Set();
  const keyRe = /^ {2}'([a-z0-9_]+)':\s*\{/gm;
  let km;
  while ((km = keyRe.exec(extrasSrc)) !== null) {
    if (seenKey.has(km[1])) {
      errors.push(['DUPLICATE_KEY', 'extras_source', km[1], 'two entries in 06_extras.js — the later one silently wins on eval']);
    }
    seenKey.add(km[1]);
  }
}

// ---- Report ----
if (errors.length === 0) {
  const archCount = (C.CHAIN_ARCHETYPES || []).length;
  const paCount = (C.PRODUCTION_AESTHETICS || []).length;
  console.log(`VALID — ${C.TRADITIONS.length} traditions, ${C.TREE_NODES.length} tree nodes, ${C.INSTRUMENTS.length} instruments, ${C.ROOMS.length} rooms, ${archCount} chain archetypes, ${paCount} production aesthetics. All refs resolve.`);
  process.exit(0);
}

// Group errors by type for readability
const byType = {};
for (const e of errors) {
  const key = `${e[0]} [${e[1]}]`;
  if (!byType[key]) byType[key] = [];
  byType[key].push(e.slice(2));
}
console.error(`INVALID — ${errors.length} errors:`);
for (const [type, list] of Object.entries(byType)) {
  console.error(`\n${type}: ${list.length}`);
  const groups = {};
  for (const item of list) {
    const detail = item[1] || '';
    if (!groups[detail]) groups[detail] = [];
    groups[detail].push(item[0]);
  }
  for (const [detail, items] of Object.entries(groups)) {
    const shown = items.slice(0, 3).join(', ');
    const more = items.length > 3 ? ` +${items.length - 3} more` : '';
    console.error(`  ${detail} (${items.length}x): ${shown}${more}`);
  }
}
process.exit(1);
