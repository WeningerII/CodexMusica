#!/usr/bin/env node
// audit_cites.js — CITES-restriction availability audit.
//
// For every part in every instrument, checks: if ANY variant carries a CITES
// canonical_tag (cites-app-i, cites-app-ii, cites-pre-1992-antique), is there
// at least one non-CITES alternative on the same part? A part with all-CITES
// variants would leave the catalog unable to spec a non-restricted version of
// that role — useful information for downstream specifiers who need legal
// alternatives.
//
// Warnings only. Exit code is always 0 (non-blocking). Run separately or as
// the last step in the standard gate sequence.

const C = require('./_loader.js');

const CITES_TAGS = new Set(['cites-app-i', 'cites-app-ii', 'cites-pre-1992-antique']);

const warnings = [];
let citesVariantCount = 0;
let partsScanned = 0;

for (const inst of C.INSTRUMENTS) {
  for (const part of (inst.parts || [])) {
    partsScanned++;
    const variants = part.variants || [];
    const citesVariants = variants.filter(v =>
      (v.canonical_tags || []).some(t => CITES_TAGS.has(t))
    );
    const nonCitesVariants = variants.filter(v =>
      !(v.canonical_tags || []).some(t => CITES_TAGS.has(t))
    );

    citesVariantCount += citesVariants.length;

    if (citesVariants.length > 0 && nonCitesVariants.length === 0) {
      warnings.push(
        `[${inst.id}::${part.id}] all ${variants.length} variants are CITES-restricted — no non-CITES alternative available`
      );
    }
  }
}

console.log(`CITES AUDIT: scanned ${partsScanned} parts, ${citesVariantCount} CITES-tagged variant(s).`);

if (warnings.length > 0) {
  console.log(`WARNINGS (${warnings.length}):`);
  warnings.forEach(w => console.log('  ' + w));
} else {
  console.log('CITES AUDIT: CLEAN — every part with CITES variants has a non-CITES alternative.');
}

// Always exit 0 — informational only
process.exit(0);
