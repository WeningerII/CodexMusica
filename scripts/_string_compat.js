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
// Hard gates to offer a MATERIAL from source S on target T:
//   1. both soundType are string-*            → excludes electronic (808), percussion, wind, …
//   2. electrification matches                → acoustic ⇎ electric windings never cross
//   3. modes overlap (S.modes ∩ T.modes ≠ ∅)  → a bow-only string never lands on a pluck-only neck
// Register is deliberately NOT a hard gate: gut/steel/nylon are register-agnostic
// materials; register decides the gauge/SET, which we handle by offering material
// families and dropping named instrument-specific sets.

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
  if (/horsehair/.test(s)) return 'horsehair';
  if (/gut|catlin|pistoy|pistoia/.test(s)) return 'gut';
  if (/silk/.test(s)) return 'silk';
  if (/phosphor/.test(s)) return 'phosphor bronze';
  if (/80\/20|eighty.?twenty/.test(s)) return '80/20 bronze';
  if (/nickel bronze/.test(s)) return 'nickel bronze';
  if (
    /flatwound|roundwound|half.?round|tape.?wound|ground.?wound|tungsten|monel|stainless|chrome|slinky|pure nickel|nickel-?plated|nickel-?wound|\bnickel\b/.test(
      s
    )
  )
    return 'nickel/steel-wound';
  if (/coated|nanoweb|polyweb|lifespan|elixir/.test(s)) return 'coated';
  if (/brass|wire-?strung/.test(s)) return 'brass/wire';
  if (/bronze/.test(s)) return 'bronze';
  if (/loha|iron/.test(s)) return 'iron';
  if (/nylgut|nylon|fluorocarbon|carbon|tetron|synthetic|monofilament|braided|gimped/.test(s))
    return 'nylon/synthetic';
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

function materialCompatible(srcEntry, targetProfile) {
  if (!srcEntry.soundType.startsWith('string')) return false; // gate 1: string-ness
  if (
    (srcEntry.soundType === 'string-electric') !==
    (targetProfile.soundType === 'string-electric')
  )
    return false; // gate 2: electrification
  for (const m of srcEntry.modes) if (targetProfile.modes.has(m)) return true; // gate 3: mode overlap
  return false;
}

// The expanded material pool for a target instrument: { family -> Set(labels) }.
function expandedPool(targetInst, INSTRUMENTS) {
  const tp = profile(targetInst);
  const pool = harvest(INSTRUMENTS);
  const byFam = new Map();
  for (const e of pool) {
    if (e.src === targetInst.id) continue;
    if (NAMED_SET.test(e.label)) continue; // drop instrument-specific sets
    if (!materialCompatible(e, tp)) continue;
    const fam = materialFamily(e.label);
    if (!fam) continue;
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
  expandedPool,
  harvest,
  materialCompatible,
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
