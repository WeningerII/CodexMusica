#!/usr/bin/env node
// build_library_art.js — the native Library tab's card artwork renditions.
//
// The old Library Site served its eight artwork originals as-is (1,734,318 B,
// one 695 KB PNG among them). The native tab shows them as shelf-card art at
// most 285 CSS px tall (the old .art-frame; the portraits are shown whole), so
// it gets small renditions instead: each artwork fitted inside 240 and 480 px
// squares (1x and 2x of the frame's longer side), in AVIF and WebP, every file
// at most 25,600 B (docs/library-native-design.md, "Layout", art renditions).
//
//   source   sites/library/public<image> for each entry of
//            sites/library/lib/artwork.json (the old Site's own table; the
//            originals stay there until the old Site is retired)
//   output   assets/library/art/<id>-<width>.<avif|webp>
//
// Quality starts high and steps down only until a file fits the ceiling, and
// the chosen setting is a pure function of the source, so a rebuild with the
// pinned sharp is byte-identical; --check rebuilds in memory and compares.
//
// Usage:
//   node scripts/build_library_art.js            # regenerate
//   node scripts/build_library_art.js --check    # fail if any rendition is stale

'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ARTWORK = path.join(ROOT, 'sites/library/lib/artwork.json');
const PUBLIC = path.join(ROOT, 'sites/library/public');
const OUT = path.join(ROOT, 'assets/library/art');
const WIDTHS = [240, 480];
const CEILING = 25600;
const FORMATS = {
  // libvips' encoders are deterministic for fixed options; effort is pinned.
  webp: (img, quality) => img.webp({ quality, effort: 6, smartSubsample: true }),
  avif: (img, quality) => img.avif({ quality, effort: 4, chromaSubsampling: '4:2:0' }),
};
const START = { webp: 80, avif: 60 };
const STEP = 4;
const FLOOR = 30;
const BOX_STEP = 20;
const CHECK = process.argv.includes('--check');

async function encode(source, box, format, quality) {
  const img = sharp(source, { failOn: 'error' })
    .rotate()
    .resize({
      width: box,
      height: box,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    })
    .removeAlpha();
  return FORMATS[format](img, quality).toBuffer();
}

// The highest quality at or above FLOOR that fits the ceiling in a `width`
// square; failing that (a painting whose texture costs more than the ceiling
// even at FLOOR), the largest smaller square, in BOX_STEP decrements, that
// fits at FLOOR. Either way the result depends only on the source.
async function render(source, width, format) {
  for (let quality = START[format]; quality >= FLOOR; quality -= STEP) {
    const bytes = await encode(source, width, format, quality);
    if (bytes.length <= CEILING) return { bytes, quality, box: width };
  }
  for (let box = width - BOX_STEP; box >= WIDTHS[0]; box -= BOX_STEP) {
    const bytes = await encode(source, box, format, FLOOR);
    if (bytes.length <= CEILING) return { bytes, quality: FLOOR, box };
  }
  throw new Error(`no ${format} rendition fits ${CEILING} B for a ${width}px square`);
}

async function main() {
  const artwork = JSON.parse(fs.readFileSync(ARTWORK, 'utf8'));
  const wanted = new Set();
  const problems = [];
  if (!CHECK) fs.mkdirSync(OUT, { recursive: true });
  for (const item of artwork) {
    if (!/^[a-z0-9-]+$/.test(item.id)) throw new Error(`unsafe artwork id: ${item.id}`);
    const source = fs.readFileSync(path.join(PUBLIC, item.image));
    for (const width of WIDTHS) {
      for (const format of Object.keys(FORMATS)) {
        const name = `${item.id}-${width}.${format}`;
        wanted.add(name);
        const { bytes, quality, box } = await render(source, width, format);
        const target = path.join(OUT, name);
        if (CHECK) {
          const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
          if (!current || !current.equals(bytes)) problems.push(`stale or missing: ${name}`);
        } else {
          fs.writeFileSync(target, bytes);
          console.log(
            `${name}  ${bytes.length} B  q${quality}${box === width ? '' : `  fitted in ${box}px`}`
          );
        }
      }
    }
  }
  const present = fs.existsSync(OUT) ? fs.readdirSync(OUT) : [];
  for (const name of present) if (!wanted.has(name)) problems.push(`unexpected file: ${name}`);
  if (CHECK) {
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p}`);
      console.error('Run: node scripts/build_library_art.js');
      process.exit(1);
    }
    console.log(`library art: ${wanted.size} renditions current, each <= ${CEILING} B`);
  } else if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
