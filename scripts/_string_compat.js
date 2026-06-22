'use strict';
// _string_compat.js — compatibility model for the (proposed) "expanded / advanced"
// string-options pool. READ-ONLY over the catalog; nothing imports this yet.
//
// Problem it solves: an instrument's `class` is single-valued, so it can't say an
// upright bass is bass AND plucked AND bowed, and it lumps an acoustic upright in
// with an electronic 808 (both were just "bass"-ish). This module derives a
// MULTI-AXIS profile and uses it to compute, for a target instrument, which string
// MATERIALS from across the catalog are physically compatible — broad enough to
// "play freely", coherent enough that electronic/percussion parts and electric
// windings never bleed onto an acoustic string instrument.
//
// Multi-axis profile:
//   soundType — from inst.family: 'string-acoustic' | 'string-electric' | 'nonstring'
//   register  — from inst.class:  'bass' | 'standard'         (governs SET/gauge, not material)
//   modes     — subset of {plucked, bowed, struck}; derived from class+family with a
//               tiny explicit override for genuinely multi-mode instruments.
//
// Hard gates to offer a MATERIAL on a target instrument (permissive policy):
//   1. both soundType are string-*  → excludes electronic (808), percussion, wind, …
//   2. electrification matches      → acoustic ⇎ electric windings never cross
//   3. tension                      → a nylon-tension instrument (built for low
//                                     tension) is never offered high-tension metal;
//                                     steel-tension stays permissive (gut/silk OK)
//   4. family-mode overlap          → a material used only on bowed instruments
//                                     (horsehair) stays off a pluck-only neck; mode-
//                                     agnostic materials (gut/steel/nylon) cross freely
// Plus: drop named instrument-specific SETS and exotic count-singletons (a material
// bound to a single instrument, e.g. loha iron). Register is NOT a material gate (it
// sizes the SET/gauge). The mode axis is applied per material FAMILY (union of its
// sources' modes), which is robust to individual variant under-tagging.

const STRING_FAMILIES = new Set([
  'acoustic_strings',
  'electric_strings',
  'bowed',
  'plucked_traditional',
]);

// Instruments whose true mode set the single `class` cannot express. Keep this
// list minimal — it is the entire "authoring" cost of the multi-axis fix.
const MULTIMODE_OVERRIDE = {
  upright_bass: ['plucked', 'bowed'], // class=bass hides that it is pizz + arco
};

function soundType(inst) {
  const f = inst.family || '';
  if (f === 'electric_strings') return 'string-electric';
  if (f === 'acoustic_strings' || f === 'bowed' || f === 'plucked_traditional')
    return 'string-acoustic';
  return 'nonstring';
}

function register(inst) {
  return inst.class === 'bass' ? 'bass' : 'standard';
}

// Multi-valued mode derivation. class first, family fallback (covers class='bass'),
// then explicit overrides, then a safe default.
function modes(inst) {
  const m = new Set();
  const c = inst.class || '';
  const f = inst.family || '';
  if (/^plucked/.test(c) || c === 'zither') m.add('plucked');
  if (/bow/.test(c)) {
    m.add('bowed');
    m.add('plucked');
  } // bowed instruments also pizzicato
  if (/struck/.test(c) || c === 'chordophone-struck') m.add('struck');
  if (m.size === 0) {
    if (f === 'bowed') {
      m.add('bowed');
      m.add('plucked');
    } else if (STRING_FAMILIES.has(f)) m.add('plucked');
  }
  for (const x of MULTIMODE_OVERRIDE[inst.id] || []) m.add(x);
  if (m.size === 0) m.add('plucked'); // safe default for any string instrument
  return m;
}

function profile(inst) {
  return { id: inst.id, soundType: soundType(inst), register: register(inst), modes: modes(inst) };
}

// ── material taxonomy ─────────────────────────────────────────────────────────
// Parts that describe string MATERIAL/TYPE (exclude gauge/count/tuning/etc.).
const NON_MATERIAL_PART = /count|tuning|configuration|sympathetic|courses|setup|copedent|gauge/i;
// A named instrument-specific SET (sized/branded to one instrument) — not a
// cross-instrument material. Offer the underlying material instead.
const NAMED_SET =
  /\b\d+[\s-]?string\b|concert grand|mandola|mandolin|\boud\b|dobro|national blues|\bharp\b|m-series|\be9\b|c6|jazz flat|rotosound/i;

function materialFamily(label) {
  const s = String(label).toLowerCase();
  // Winding type first — for wound metal strings (electric/bass especially) the
  // winding IS the choice, so it must not collapse into one "nickel/steel" bucket.
  if (/flatwound|flat-?wound|\bflats?\b/.test(s)) return 'flatwound';
  if (/half.?round/.test(s)) return 'half-round';
  if (/tape.?wound/.test(s)) return 'tape-wound';
  if (/ground.?wound/.test(s)) return 'ground-wound';
  if (/roundwound|round-?wound/.test(s)) return 'roundwound';
  if (/coated|nanoweb|polyweb|lifespan|elixir/.test(s)) return 'coated';
  // Non-metal / acoustic materials (winding is almost always roundwound, so these
  // are distinguished by their material, not their winding).
  if (/horsehair/.test(s)) return 'horsehair';
  if (/gut|catlin|pistoy|pistoia/.test(s)) return 'gut';
  if (/silk/.test(s)) return 'silk';
  if (/phosphor/.test(s)) return 'phosphor bronze';
  if (/80\/20|eighty.?twenty/.test(s)) return '80/20 bronze';
  if (/nickel bronze/.test(s)) return 'nickel bronze';
  if (/nylgut|nylon|fluorocarbon|carbon|tetron|synthetic|monofilament|braided|gimped/.test(s))
    return 'nylon/synthetic';
  if (/brass|wire-?strung/.test(s)) return 'brass/wire';
  if (/bronze/.test(s)) return 'bronze';
  if (/loha|iron/.test(s)) return 'iron';
  // Alloy fallback — wound metal whose winding wasn't named (round assumed).
  if (/pure nickel/.test(s)) return 'pure nickel';
  if (/stainless/.test(s)) return 'stainless steel';
  if (/monel/.test(s)) return 'monel';
  if (/tungsten/.test(s)) return 'tungsten-wound';
  if (/nickel-?plated|nickel-?wound|\bnickel\b/.test(s)) return 'nickel-plated';
  if (/steel/.test(s)) return 'steel';
  return null; // unclassifiable (in practice: a named set)
}

// Collect every string-material variant in the catalog, tagged with its source profile.
function harvest(INSTRUMENTS) {
  const out = [];
  for (const inst of INSTRUMENTS) {
    const st = soundType(inst);
    if (!st.startsWith('string')) continue;
    const prof = profile(inst);
    for (const p of inst.parts || []) {
      const lab = p.name || p.label || '';
      if (!/string/i.test(lab) || NON_MATERIAL_PART.test(lab + ' ' + p.id)) continue;
      for (const v of p.variants || []) {
        out.push({
          src: inst.id,
          soundType: st,
          modes: prof.modes,
          vid: v.id,
          label: v.name || v.id,
        });
      }
    }
  }
  return out;
}

// Tension class per material family. A nylon-tension instrument (classical guitar,
// ukulele, lute…) physically cannot take HIGH-tension strings; a steel-tension one
// can take both, so we permissively allow low-tension crossovers (gut / silk on a
// steel-string is real and historical).
const HIGH_TENSION = new Set([
  'steel',
  'phosphor bronze',
  '80/20 bronze',
  'bronze',
  'nickel bronze',
  'nickel-plated',
  'pure nickel',
  'stainless steel',
  'monel',
  'coated',
  'brass/wire',
  'iron',
  'tungsten-wound',
  'flatwound',
  'half-round',
  'tape-wound',
  'ground-wound',
  'roundwound',
]);
function materialTension(family) {
  return HIGH_TENSION.has(family) ? 'high' : 'low';
}

// Materials that survive every principled gate but are tradition-bound, not general
// cross-instrument options. Horsehair is the lone case: it is used on one *plucked*
// archaic zither (kantele) — so mode/tension/electrification all pass it — yet it is
// really a bowed-folk + archaic specialty (morin khuur, gusle, igil…), not something
// you'd offer on a modern steel-string. It stays on its native instruments'
// canonical lists; it is simply not cross-pollinated.
const NON_CROSS_MATERIAL = new Set(['horsehair']);

// A target is "nylon-tension" iff every material on its OWN curated string part is
// low-tension (e.g. a classical guitar ships nylon / gut / carbon only). Such
// instruments get only low-tension expanded options; high-tension metal is excluded.
function isNylonTension(inst) {
  let any = false;
  for (const p of inst.parts || []) {
    const lab = p.name || p.label || '';
    if (!/string/i.test(lab) || NON_MATERIAL_PART.test(lab + ' ' + p.id)) continue;
    for (const v of p.variants || []) {
      const f = materialFamily(v.name || v.id);
      if (!f) continue;
      any = true;
      if (materialTension(f) === 'high') return false;
    }
  }
  return any;
}

// Distinct source-instrument count per material family — used to drop exotic
// singletons (a material bound to one instrument, e.g. horsehair / loha iron).
function familySourceCounts(INSTRUMENTS) {
  const m = new Map();
  for (const e of harvest(INSTRUMENTS)) {
    if (NAMED_SET.test(e.label)) continue;
    const f = materialFamily(e.label);
    if (!f) continue;
    if (!m.has(f)) m.set(f, new Set());
    m.get(f).add(e.src);
  }
  return m;
}

// Union of source-instrument modes per material family. A material that only ever
// comes from bowed instruments (e.g. horsehair) thus stays out of a pluck-only
// neck's pool, while a mode-agnostic material (gut/steel/nylon — used plucked AND
// bowed) crosses freely. This is the principled form of the mode axis for MATERIALS:
// per-family (union of its sources' modes), robust to individual variant under-tagging.
function familyModes(INSTRUMENTS) {
  const m = new Map();
  for (const e of harvest(INSTRUMENTS)) {
    if (NAMED_SET.test(e.label)) continue;
    const f = materialFamily(e.label);
    if (!f) continue;
    if (!m.has(f)) m.set(f, new Set());
    for (const mode of e.modes) m.get(f).add(mode);
  }
  return m;
}

// The expanded material pool for a target instrument: { family -> Set(labels) }.
// Permissive policy gates: string-ness, electrification, tension (nylon block),
// family-mode overlap; plus drop named instrument-specific sets and exotic
// count-singletons (< minSources source instruments).
function expandedPool(targetInst, INSTRUMENTS, opts) {
  const minSources = (opts && opts.minSources) || 2;
  const tElectric = soundType(targetInst) === 'string-electric';
  const tNylon = isNylonTension(targetInst);
  const tModes = modes(targetInst);
  const counts = familySourceCounts(INSTRUMENTS);
  const fModes = familyModes(INSTRUMENTS);
  const byFam = new Map();
  for (const e of harvest(INSTRUMENTS)) {
    if (e.src === targetInst.id) continue;
    if (NAMED_SET.test(e.label)) continue; // instrument-specific set, not a material
    if (!e.soundType.startsWith('string')) continue; // gate 1: string-ness (no 808/electronic)
    if ((e.soundType === 'string-electric') !== tElectric) continue; // gate 2: electrification
    const fam = materialFamily(e.label);
    if (!fam) continue;
    if (NON_CROSS_MATERIAL.has(fam)) continue; // tradition-bound, not cross-applicable
    if ((counts.get(fam) || new Set()).size < minSources) continue; // drop exotic singletons
    if (tNylon && materialTension(fam) === 'high') continue; // gate 3: tension (physical block)
    const fm = fModes.get(fam);
    let modeOverlap = false;
    if (fm)
      for (const mo of tModes)
        if (fm.has(mo)) {
          modeOverlap = true;
          break;
        }
    if (!modeOverlap) continue; // gate 4: family-mode overlap (bowed-only stays off pluck-only)
    if (!byFam.has(fam)) byFam.set(fam, new Set());
    byFam.get(fam).add(e.label.replace(/\(.*?\)/g, '').trim());
  }
  return byFam;
}

module.exports = {
  soundType,
  register,
  modes,
  profile,
  materialFamily,
  materialTension,
  isNylonTension,
  familySourceCounts,
  familyModes,
  expandedPool,
  harvest,
  STRING_FAMILIES,
  MULTIMODE_OVERRIDE,
};

// ── self-test / demo ───────────────────────────────────────────────────────────
if (require.main === module) {
  const path = require('path');
  const C = require(path.join(__dirname, '_loader.js'));
  const show = (id) => {
    const inst = C.INSTRUMENTS.find((i) => i.id === id);
    if (!inst) {
      console.log('(no ' + id + ')');
      return;
    }
    const p = profile(inst);
    const pool = expandedPool(inst, C.INSTRUMENTS);
    const total = [...pool.values()].reduce((a, b) => a + b.size, 0);
    console.log(`\n${inst.name}  (${id})`);
    console.log(
      `  profile: soundType=${p.soundType} register=${p.register} modes={${[...p.modes].join(',')}}`
    );
    console.log(
      `  expanded pool: ${total} materials across ${pool.size} families -> ${[...pool.keys()].join(', ')}`
    );
  };
  ['acoustic_guitar_12_string', 'upright_bass', 'electric_bass', 'double_bass', 'cello'].forEach(
    show
  );
  // invariant: no electronic/nonstring source ever contributes
  const leak = harvest(C.INSTRUMENTS).filter((e) => !e.soundType.startsWith('string'));
  console.log(`\nINVARIANT — nonstring sources in pool: ${leak.length} (must be 0)`);
}
