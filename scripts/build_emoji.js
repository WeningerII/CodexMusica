#!/usr/bin/env node
// Build EMOJI_REGISTRY in references/08_asset_manifest.js.
//
// Reads:
//   - references/_assets/emoji/*.svg (Twemoji vendored SVGs)
//   - scripts/_instrument_emoji_map.json (curated codex_id → codepoint mapping)
//
// Writes:
//   - Extends references/08_asset_manifest.js with EMOJI_REGISTRY block:
//       const EMOJI_REGISTRY = {
//         'electric_guitar_humbucker': '<inner svg markup>',
//         'djembe': '<inner svg markup>',
//         ...
//       };
//
// The template's image() helper resolves codex_id → EMOJI_REGISTRY → wraps in
// proper <svg> with viewBox 0 0 36 36 (Twemoji's coordinate system).

const fs = require('fs');
const path = require('path');

const EMOJI_DIR = path.join(__dirname, '..', 'references', '_assets', 'emoji');
const MAP_FILE = path.join(__dirname, '_instrument_emoji_map.json');
const MANIFEST = path.join(__dirname, '..', 'references', '08_asset_manifest.js');

function extractInner(svgText) {
  const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error('No <svg>...</svg> found');
  return m[1].trim().replace(/\s+/g, ' ').replace(/>\s+</g, '><');
}

function main() {
  const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

  // Read all vendored emoji SVGs once, keyed by codepoint. This is the
  // single source of truth for inner-SVG content; everything else stores
  // codepoint string references that resolve through this table.
  const svgs = {}; // codepoint hex string → inner SVG markup
  let missingFiles = [];

  // Collect every codepoint referenced by either per-instrument or family
  // fallback entries so we read each vendored SVG exactly once.
  const referencedCodepoints = new Set();
  for (const group of Object.keys(map)) {
    if (group.startsWith('_')) continue;
    referencedCodepoints.add(group.split('_').pop());
  }
  for (const family of Object.keys(map._family_fallback || {})) {
    if (family.startsWith('_')) continue;
    referencedCodepoints.add(map._family_fallback[family]);
  }
  for (const family of Object.keys(map._family_header || {})) {
    if (family.startsWith('_')) continue;
    referencedCodepoints.add(map._family_header[family]);
  }

  for (const codepoint of referencedCodepoints) {
    const svgPath = path.join(EMOJI_DIR, codepoint + '.svg');
    if (!fs.existsSync(svgPath)) {
      missingFiles.push(codepoint);
      continue;
    }
    svgs[codepoint] = extractInner(fs.readFileSync(svgPath, 'utf8'));
  }

  // Per-instrument mappings now store just the codepoint string (~5 bytes)
  // instead of the full 2-3 KB SVG content. ~530 KB saved.
  const registry = {}; // instrument_id → codepoint string
  for (const group of Object.keys(map)) {
    if (group.startsWith('_')) continue;
    const codepoint = group.split('_').pop();
    if (!svgs[codepoint]) continue;
    for (const id of map[group].ids) {
      if (registry[id]) console.warn('  ! duplicate mapping for ' + id);
      registry[id] = codepoint;
    }
  }

  // Per-family fallbacks also store just the codepoint string.
  const familyFallback = {};
  const fallbackSpec = map._family_fallback || {};
  for (const family of Object.keys(fallbackSpec)) {
    if (family.startsWith('_')) continue;
    const codepoint = fallbackSpec[family];
    if (!svgs[codepoint]) {
      console.warn('  ! family fallback ' + family + ' missing ' + codepoint);
      continue;
    }
    familyFallback[family] = codepoint;
  }

  // Per-family HEADING glyphs. Separate from the fallbacks because a heading
  // only earns its glyph if it differs from its neighbours': three families
  // legitimately fall back to the guitar for card art, which would put the same
  // picture on three adjacent headings.
  const familyHeader = {};
  const headerSpec = map._family_header || {};
  for (const family of Object.keys(headerSpec)) {
    if (family.startsWith('_')) continue;
    const codepoint = headerSpec[family];
    if (!svgs[codepoint]) {
      console.warn('  ! family header ' + family + ' missing ' + codepoint);
      continue;
    }
    familyHeader[family] = codepoint;
  }
  const headerCps = Object.values(familyHeader);
  if (new Set(headerCps).size !== headerCps.length) {
    console.error('build_emoji: FAIL — family heading glyphs must be mutually distinct');
    process.exit(1);
  }

  if (missingFiles.length) {
    console.error('Missing SVG files for codepoints: ' + missingFiles.join(', '));
    process.exit(1);
  }

  // Verify mapped instruments actually exist in catalog (sanity check)
  let validIds;
  try {
    const C = require('./_loader.js');
    validIds = new Set(C.INSTRUMENTS.map((i) => i.id));
    const orphans = Object.keys(registry).filter((id) => !validIds.has(id));
    if (orphans.length) {
      console.warn('  ! ' + orphans.length + ' mappings reference non-existent IDs:');
      for (const o of orphans.slice(0, 10)) console.warn('      ' + o);
      if (orphans.length > 10) console.warn('      ... and ' + (orphans.length - 10) + ' more');
    }
  } catch (e) {
    console.warn('Could not validate IDs against catalog: ' + e.message);
  }

  // Emit registry block
  const existing = fs.readFileSync(MANIFEST, 'utf8');
  // Strip a previously emitted block before re-emitting. This must match the
  // heading this script actually writes below — when the two drift apart the
  // strip silently no-ops and the block is APPENDED instead of replaced, which
  // redeclares `const EMOJI_SVGS` and is a hard syntax error in the browser
  // build. Matches both the current heading and the historical one.
  const cleaned = existing.replace(
    /\n\/\/ ─{3,} EMOJI (?:registries|REGISTRY) ─{3,}[\s\S]*$/m,
    '\n'
  );
  if (/const EMOJI_SVGS/.test(cleaned)) {
    console.error('build_emoji: FAIL — could not strip the previous emoji block;');
    console.error('  the heading in this script and the one in the manifest have drifted.');
    process.exit(1);
  }

  const lines = [];
  lines.push('');
  lines.push('// ─────────────── EMOJI registries ─────────────── (auto-generated)');
  lines.push('// Source: Twemoji v15.1.0 SVGs in references/_assets/emoji/ (CC-BY 4.0)');
  lines.push('// Built from scripts/_instrument_emoji_map.json via scripts/build_emoji.js');
  lines.push('//');
  lines.push('// Storage layout: SVG content is stored ONCE per codepoint in EMOJI_SVGS.');
  lines.push('// EMOJI_REGISTRY and FAMILY_FALLBACK_EMOJI store codepoint strings (~5 bytes)');
  lines.push('// rather than full inline SVG markup. The image() helper resolves through');
  lines.push('// EMOJI_SVGS at render time. Saves ~530 KB vs storing SVG content per entry.');
  lines.push('//');
  lines.push('// Unique SVG blobs: ' + Object.keys(svgs).length);
  lines.push('// Instrument mappings: ' + Object.keys(registry).length);
  lines.push('// Family fallbacks: ' + Object.keys(familyFallback).length);
  lines.push('// To regenerate: node scripts/fetch_emoji.js && node scripts/build_emoji.js');
  lines.push('');
  lines.push('const EMOJI_SVGS = {');
  for (const cp of Object.keys(svgs).sort()) {
    const safe = svgs[cp].replace(/'/g, "\\'");
    lines.push('  ' + JSON.stringify(cp) + ": '" + safe + "',");
  }
  lines.push('};');
  lines.push('');
  lines.push('const EMOJI_REGISTRY = {');
  for (const id of Object.keys(registry).sort()) {
    lines.push('  ' + JSON.stringify(id) + ': ' + JSON.stringify(registry[id]) + ',');
  }
  lines.push('};');
  lines.push('');
  lines.push('const FAMILY_FALLBACK_EMOJI = {');
  for (const f of Object.keys(familyFallback).sort()) {
    lines.push('  ' + JSON.stringify(f) + ': ' + JSON.stringify(familyFallback[f]) + ',');
  }
  lines.push('};');
  lines.push('');
  lines.push('const FAMILY_HEADER_EMOJI = {');
  for (const f of Object.keys(familyHeader).sort()) {
    lines.push('  ' + JSON.stringify(f) + ': ' + JSON.stringify(familyHeader[f]) + ',');
  }
  lines.push('};');
  lines.push('');

  fs.writeFileSync(MANIFEST, cleaned + lines.join('\n'));
  console.log('Wrote EMOJI_SVGS: ' + Object.keys(svgs).length + ' unique SVG blobs');
  console.log(
    'Wrote EMOJI_REGISTRY: ' + Object.keys(registry).length + ' instrument → codepoint mappings'
  );
  console.log(
    'Wrote FAMILY_FALLBACK_EMOJI: ' + Object.keys(familyFallback).length + ' family fallbacks'
  );
  console.log('  Manifest: ' + MANIFEST);
}

main();
