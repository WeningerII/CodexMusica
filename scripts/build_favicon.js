#!/usr/bin/env node
// build_favicon.js — the icon set: one declared source, one gate, no drift.
//
// WHY THIS EXISTS. Before it, `favicon.svg` was source and the six PNGs beside
// it were not derived from anything in the repo — they had been rendered once,
// somewhere else, and committed. Nothing regenerated them and no gate compared
// them, so the only thing keeping the set consistent was that nobody had
// touched the SVG since. Editing the mark meant either hand-exporting six files
// or, far more likely, shipping a new source beside five stale PNGs that still
// showed the old one.
//
// WHAT CHANGED 2026-09-14. The mark is now the green note-and-slash on black,
// delivered as a raster package (a 1254px master plus per-platform sizes cut
// from it by the generator that produced them). `favicon.svg` is retired: there
// is no vector of this artwork, and hand-tracing one would ship an icon that
// only approximates the art the owner approved.
//
// So the set splits in two, and the gate covers both halves:
//
//   SUPPLIED  The owner's own files, shipped byte-for-byte. Nothing re-renders
//             them — a re-render is a different image, however close, and the
//             point of this half is that it is exactly what was delivered. They
//             are pinned by SHA-256 below, so a silent edit still fails here.
//
//   DERIVED   What the package does not contain: the 1024 listing icon and the
//             mark inside the social card. Rendered from the master by sharp,
//             and byte-compared the way every raster used to be.
//
// `assets/icon-master.png` is the source of record for the artwork. Recutting a
// supplied size from it is a deliberate act — replace the file, repin its hash.
//
// Usage:
//   node scripts/build_favicon.js            # regenerate the derived half
//   node scripts/build_favicon.js --check    # fail if anything is stale (CI-safe)

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/icon-master.png');
const CHECK = process.argv.includes('--check');

// The owner's package, verbatim. `size` is asserted too: a hash catches an edit
// to the file, and the dimension catches the likelier mistake of copying the
// right artwork into the wrong slot.
const SUPPLIED = [
  [
    'assets/icon-master.png',
    1254,
    'e53d282013d283869346ddbb6fb420295dd8b5c69e768cdef927354f81ed9a3f',
  ],
  ['assets/favicon-16.png', 16, '15ba335672141fdeadd238a7358827193a306228136d7b547629b61abe0dbef9'],
  ['assets/favicon-32.png', 32, 'b69ce37703400b266b16704a301a961c96defc5fb2d76b80b19e684a15aeb8c0'],
  [
    'assets/apple-touch-icon.png',
    180,
    'c73f13f0ead96b1802ebc6f21ad61d3354edacb329909c788beea273b21077e7',
  ],
  ['assets/icon-192.png', 192, 'cfb35de45d0ad080697560defc0d3ae293a58ed3e776a58969846a0362263ec2'],
  ['assets/icon-512.png', 512, 'b2e518cccabe5ddcfed672d8649623c7a87276c43af7fe7735bc17945d899b06'],
  [
    'assets/mstile-150x150.png',
    150,
    'e6ec8ba6490fbdea3e8fbb05bf87695d1d0be4b19f706dca49cc37a39814cb00',
  ],
  ['favicon.ico', null, '2208e85c4a4b874d7c8a6cc35a0ad865bc1835cd007a0a67bc6138d33bdfac98'],
];

// A high density before downscaling mattered when the source was a vector. The
// master is a raster, so this only governs how sharp reads it; the area-average
// downscale below is what preserves the flag on the eighth note at small sizes.
const RASTERS = [['assets/icon-1024.png', 1024, null]];

// The social card is 1200x630 and carries the wordmark as PIXELS — there is no
// text source for it, and re-rendering type here would make this script depend
// on a font being installed, which is exactly the kind of environment coupling
// that produces a different artifact on someone else's machine. So only the
// mark is repainted, in place, and every glyph of "Codex Musica / Perfect Music
// Prompts" survives byte-identical.
//
// The box was MEASURED off the original card (the solid dark pixels of the old
// rounded tile), not guessed: 206x206 at (127,212). BLEED covers that tile's
// anti-aliased corners, which fell outside the solid box and otherwise left a
// faint grey ring around the swap. The wordmark starts at x=404, so the bled
// patch cannot clip type. Re-running is idempotent: the patch repaints its own
// footprint white before drawing.
const OG = { file: 'assets/og-image.png', left: 127, top: 212, size: 206, bleed: 6, inset: 8 };

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function renderRaster(size, background) {
  let img = sharp(SRC).resize(size, size);
  if (background) img = img.flatten({ background });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

async function renderOgPatch() {
  const inner = OG.size - OG.inset * 2;
  const pad = OG.inset + OG.bleed;
  return sharp(SRC)
    .resize(inner, inner)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error(`build_favicon: missing ${path.relative(ROOT, SRC)}`);
    process.exit(2);
  }

  const stale = [];

  // ── SUPPLIED: pinned, never re-rendered ───────────────────────────────────
  console.log('=== Supplied icons vs their pinned hashes ===');
  for (const [rel, size, want] of SUPPLIED) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      stale.push(`${rel} (missing)`);
      console.log(`  ✗ ${rel} — missing`);
      continue;
    }
    const buf = fs.readFileSync(abs);
    const got = sha256(buf);
    let ok = got === want;
    let note = ok ? '' : `  hash ${got.slice(0, 12)}… != ${want.slice(0, 12)}…`;
    if (ok && size !== null) {
      const meta = await sharp(buf).metadata();
      if (meta.width !== size || meta.height !== size) {
        ok = false;
        note = `  ${meta.width}x${meta.height}, expected ${size}x${size}`;
      }
    }
    if (!ok) stale.push(rel);
    console.log(`  ${ok ? '✓' : '✗'} ${rel}${note}`);
  }

  // ── DERIVED: rendered from the master, byte-compared ──────────────────────
  const report = (rel, buf) => {
    const abs = path.join(ROOT, rel);
    const prev = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
    const same = prev && prev.equals(buf);
    if (CHECK) {
      if (!same) stale.push(rel);
      console.log(`  ${same ? '✓' : '✗'} ${rel}`);
      return;
    }
    fs.writeFileSync(abs, buf);
    console.log(
      `  ${rel.padEnd(30)} ${String(buf.length).padStart(6)} bytes${same ? '' : '  (updated)'}`
    );
  };

  console.log(
    CHECK
      ? '\n=== Derived rasters vs assets/icon-master.png ==='
      : '\nRendering the derived icons from assets/icon-master.png…'
  );
  for (const [rel, size, bg] of RASTERS) report(rel, await renderRaster(size, bg));

  // The card is patched rather than rebuilt, so "fresh" means "the mark in it
  // matches the master" — which is checked by re-applying the patch to the card
  // and seeing whether anything moved.
  const card = path.join(ROOT, OG.file);
  if (fs.existsSync(card)) {
    const patched = await sharp(card)
      .composite([
        { input: await renderOgPatch(), left: OG.left - OG.bleed, top: OG.top - OG.bleed },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();
    report(OG.file, patched);
  }

  if (stale.length) {
    console.error(
      `\nFAVICON: FAIL — ${stale.length} icon(s) are not what this script declares:\n` +
        stale.map((s) => `  ${s}`).join('\n') +
        '\n\nA DERIVED raster is stale: run `npm run assets:favicon`.' +
        '\nA SUPPLIED icon changed: that is a new delivery — replace the file and repin' +
        '\nits SHA-256 in SUPPLIED above, in the same commit.'
    );
    process.exit(1);
  }
  console.log(
    CHECK ? '\nFAVICON: PASS — every icon matches what this script declares.' : '\nDone.'
  );
})().catch((e) => {
  console.error('build_favicon failed:', e && e.stack ? e.stack : e);
  process.exit(1);
});
