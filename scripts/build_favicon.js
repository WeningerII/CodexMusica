#!/usr/bin/env node
// build_favicon.js — regenerate every icon raster from the ONE source SVG.
//
// WHY THIS EXISTS. Before it, `favicon.svg` was source and the six PNGs beside
// it were not derived from anything in the repo — they had been rendered once,
// somewhere else, and committed. Nothing regenerated them and no gate compared
// them, so the only thing keeping the set consistent was that nobody had
// touched the SVG since. Editing the mark meant either hand-exporting six files
// or, far more likely, shipping a new favicon.svg beside five stale PNGs that
// still showed the old one.
//
// So: favicon.svg is the single source, and everything else is a build product.
//
// Usage:
//   node scripts/build_favicon.js            # regenerate
//   node scripts/build_favicon.js --check    # fail if anything is stale (CI-safe)

'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'favicon.svg');
const CHECK = process.argv.includes('--check');

// A high density before downscaling: rasterizing straight to 16px lets the
// renderer hint the curves away, and the flag on the eighth note is the first
// thing to go. Render large, then area-average down.
const DENSITY = 2400;

// Transparent everywhere EXCEPT the Apple touch icon: iOS composites a
// transparent touch icon onto BLACK, which would put the mark on a black square
// nobody chose. White is what the mark is drawn against.
const RASTERS = [
  ['assets/favicon-16.png', 16, null],
  ['assets/favicon-32.png', 32, null],
  ['assets/icon-192.png', 192, null],
  ['assets/icon-512.png', 512, null],
  ['assets/icon-1024.png', 1024, null],
  ['assets/apple-touch-icon.png', 180, '#ffffff'],
];

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

async function renderRaster(size, background) {
  let img = sharp(SRC, { density: DENSITY }).resize(size, size);
  if (background) img = img.flatten({ background });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

async function renderOgPatch() {
  const inner = OG.size - OG.inset * 2;
  const pad = OG.inset + OG.bleed;
  return sharp(SRC, { density: DENSITY })
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

  console.log(CHECK ? '=== Icon rasters vs favicon.svg ===' : 'Rendering icons from favicon.svg…');
  for (const [rel, size, bg] of RASTERS) report(rel, await renderRaster(size, bg));

  // The card is patched rather than rebuilt, so "fresh" means "the mark in it
  // matches the SVG" — which is checked by re-applying the patch to the card and
  // seeing whether anything moved.
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

  if (CHECK && stale.length) {
    console.error(
      `\nFAVICON: FAIL — ${stale.length} raster(s) do not match favicon.svg:\n` +
        stale.map((s) => `  ${s}`).join('\n') +
        '\n\nRun: npm run assets:favicon'
    );
    process.exit(1);
  }
  console.log(CHECK ? '\nFAVICON: PASS — every raster matches favicon.svg.' : '\nDone.');
})().catch((e) => {
  console.error('build_favicon failed:', e && e.stack ? e.stack : e);
  process.exit(1);
});
