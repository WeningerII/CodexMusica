// scripts/_merge.js — the family-parts merge, authored ONCE.
//
// Each instrument inherits its family's parts. Per-instrument parts with the
// same id as a family part REPLACE the family version (full override). Family
// variants that declare `applies_to: [...]` are filtered to the listed
// instrument ids, letting a family part hold instrument-specific vocabulary
// without per-instrument authoring.
//
// Two own-part modes:
//   1. FULL OVERRIDE — own-part has a `variants` array; the family-part is
//      skipped and the own-part is used as authored.
//   2. ANNOTATION — own-part has no `variants`, only metadata such as
//      `default_variant: 'variant_id'`; the family-part is inherited and the
//      named variant is marked default for this instrument's view.
//
// The merge is non-destructive — original parts are preserved under
// inst._ownParts; the merged list replaces inst.parts so consumers see it.
//
// This function is used in two contexts, and is the single source of truth for
// both so the CLI engine and the shipped browser app compute identical parts:
//   - Node    : scripts/_loader.js calls mergeFamilyParts(INSTRUMENTS, INSTRUMENT_FAMILY_PARTS)
//   - Browser : scripts/build_html.js inlines the marked function into codex.html
'use strict';

/* @inline-start — the region between the markers is inlined verbatim into codex.html */
function mergeFamilyParts(instruments, familyParts) {
  familyParts = familyParts || {};
  for (const inst of instruments || []) {
    const ownParts = Array.isArray(inst.parts) ? inst.parts : [];
    inst._ownParts = ownParts;
    const fParts = familyParts[inst.family] || [];
    if (fParts.length === 0) {
      inst.parts = ownParts;
      continue;
    }
    const fullOverrideIds = new Set();
    const annotations = {};
    for (const op of ownParts) {
      if (Array.isArray(op.variants)) fullOverrideIds.add(op.id);
      else if (op.default_variant) annotations[op.id] = op.default_variant;
    }
    const merged = [];
    for (const fp of fParts) {
      if (fullOverrideIds.has(fp.id)) continue;
      let filteredVariants = (fp.variants || []).filter((v) => {
        if (!v.applies_to) return true;
        return Array.isArray(v.applies_to) && v.applies_to.includes(inst.id);
      });
      if (filteredVariants.length === 0) continue;
      if (annotations[fp.id]) {
        const defId = annotations[fp.id];
        filteredVariants = filteredVariants.map((v) =>
          v.id === defId ? { ...v, default: true } : v
        );
      }
      merged.push({ id: fp.id, name: fp.name, variants: filteredVariants, _fromFamily: true });
    }
    for (const op of ownParts) {
      if (Array.isArray(op.variants)) merged.push(op);
    }
    inst.parts = merged;
  }

  // ── universal string materials (sound-generator freedom) ─────────────────────
  // CodexMusica synthesizes audio, so it is NOT bound by physical buildability:
  // any stringed instrument may use any string material (beef gut on an electric
  // bass, nickel-plated harp strings, a resonator strung like a sitar). Collect the
  // union of every string-MATERIAL variant across the catalog and offer it on every
  // instrument that has a string-material part. Appended copies are auto:false
  // (never auto-seeded → default recipes stay byte-identical) and expanded:true (the
  // UI groups them under collapsible headers). An instrument's own variants are left
  // exactly as authored, in their original order, on top.
  const isStringMaterialPart = function (p) {
    return (
      /string/i.test(p.name || p.label || '') &&
      !/count|tuning|configuration|sympathetic|courses|setup|copedent|gauge/i.test(
        (p.name || p.label || '') + ' ' + p.id
      )
    );
  };
  const stringMaterialUnion = [];
  const unionSeen = {};
  for (const inst of instruments || []) {
    for (const p of inst.parts || []) {
      if (!isStringMaterialPart(p)) continue;
      for (const v of p.variants || []) {
        if (!unionSeen[v.id]) {
          unionSeen[v.id] = true;
          stringMaterialUnion.push(v);
        }
      }
    }
  }
  for (const inst of instruments || []) {
    if (!Array.isArray(inst.parts)) continue;
    // Build NEW part objects for the augmented parts. Do NOT mutate the existing
    // part object: for a full-override own-part it is the SAME reference held in
    // inst._ownParts, and mutating it would pollute _ownParts (which other code and
    // the published API serialize) with the expanded variants.
    inst.parts = inst.parts.map((p) => {
      if (!isStringMaterialPart(p)) return p;
      const have = {};
      for (const v of p.variants || []) have[v.id] = true;
      const additions = [];
      for (const v of stringMaterialUnion) {
        if (have[v.id]) continue;
        // default:false is critical — a copied variant must never become an
        // instrument's default (its own curated default stays), or a part with no
        // own default could pick up a borrowed one and change its recipe.
        additions.push(Object.assign({}, v, { auto: false, expanded: true, default: false }));
      }
      return additions.length
        ? Object.assign({}, p, { variants: (p.variants || []).concat(additions) })
        : p;
    });
  }

  return instruments;
}
/* @inline-end */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeFamilyParts };
}
