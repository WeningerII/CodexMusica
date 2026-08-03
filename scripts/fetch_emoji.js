#!/usr/bin/env node
// Vendor Twemoji SVGs for the codex.
//
// License: CC-BY 4.0 (https://github.com/twitter/twemoji/blob/master/LICENSE-GRAPHICS).
// Attribution required in the codex Attributions modal.
//
// Pinned to jdecked/twemoji@15.1.0 (the maintained fork after Twitter's release).
// Each emoji is keyed by its hex codepoint (e.g. "1f3b8" for guitar 🎸).
// Output: references/_assets/emoji/<codepoint>.svg
//
// Adding new codepoints: append to WANTED below, or add them to
// scripts/_nav_glyph_map.json (the room / preface navigation vocabulary, whose
// codepoints are picked up automatically), then rerun.
//
// SOURCES
//   --source=cdn  (default)  jsDelivr, pinned to jdecked/twemoji@15.1.0.
//   --source=npm             the @twemoji/svg package off the npm registry.
//
// The npm path exists because sandboxed environments routinely allow the npm
// registry and block the CDN. It is the same Twemoji artwork under the same
// CC-BY 4.0 licence, but the published package is 15.0.0 and has been through a
// different SVGO pass, so its markup is not byte-identical to the CDN's (same
// picture, shorter paths, reordered attributes). Because of that, neither
// source overwrites an already-vendored file unless you pass --force — that
// keeps a mixed-source asset directory stable instead of churning committed
// artwork every time somebody fetches from the other one.

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { execFileSync } = require('child_process');

const TWEMOJI_VERSION = '15.1.0';
const TWEMOJI_NPM_VERSION = '15.0.0';
const BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/`;
const OUT_DIR = path.join(__dirname, '..', 'references', '_assets', 'emoji');
const NAV_MAP = path.join(__dirname, '_nav_glyph_map.json');

// Codepoints used by the codex. Hex strings, lowercase. Comments name the
// emoji so the WANTED list is self-documenting.
const WANTED = [
  // --- Instruments (musical) ---
  '1f3b8', // 🎸  guitar
  '1f3b7', // 🎷  saxophone
  '1f3ba', // 🎺  trumpet
  '1f3bb', // 🎻  violin
  '1f941', // 🥁  drum
  '1f3b9', // 🎹  musical keyboard / piano
  '1fa95', // 🪕  banjo
  '1fa97', // 🪗  accordion
  '1fa98', // 🪘  long drum (djembe / conga / dhol)
  '1fa88', // 🪈  flute
  '1fa87', // 🪇  maracas
  '1f4ef', // 📯  postal horn (alphorn / bugle / conch class)
  '1f514', // 🔔  bell

  // --- Studio / voice / playback ---
  '1f3a4', // 🎤  microphone
  '1f3a7', // 🎧  headphones
  '1f3a9', // 🎙  studio microphone (separate from handheld mic)
  '1f399', // 🎙  studio microphone (legacy codepoint)
  '1f39a', // 🎚  level slider (mixing console)
  '1f39b', // 🎛  control knobs (synth / drum machine / mixer)
  '1f4fb', // 📻  radio
  '1f4bf', // 💿  optical disc (CD / turntable substitute)
  '1f4fc', // 📼  videocassette (tape medium)
  '1f50c', // 🔌  electric plug (electric-stringed family heading)

  // --- Voice / human ---
  '1f3a8', // 🎨  artist palette (creative output)
  '1f5e3', // 🗣  speaking head (voice)
  '1f465', // 👥  busts in silhouette (choir / ensemble)
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
  });
}

// Codepoints referenced by the navigation glyph map, so the room / preface
// vocabulary does not have to be restated by hand in WANTED.
function navMapCodepoints() {
  if (!fs.existsSync(NAV_MAP)) return [];
  const map = JSON.parse(fs.readFileSync(NAV_MAP, 'utf8'));
  const out = new Set();
  for (const group of ['roomClusters', 'rooms', 'prefaceCategories', 'prefaces']) {
    for (const id of Object.keys(map[group] || {})) {
      const cp = map[group][id] && map[group][id].cp;
      if (cp) out.add(String(cp).toLowerCase());
    }
  }
  return Array.from(out);
}

// Unpack @twemoji/svg from the npm registry and return its SVG directory.
function npmSvgDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'twemoji-'));
  const spec = `@twemoji/svg@${TWEMOJI_NPM_VERSION}`;
  const tgz = execFileSync('npm', ['pack', spec, '--silent'], { cwd: tmp, encoding: 'utf8' })
    .trim()
    .split('\n')
    .pop();
  execFileSync('tar', ['xzf', tgz], { cwd: tmp });
  const dir = path.join(tmp, 'package');
  if (!fs.existsSync(dir)) throw new Error(`unexpected tarball layout for ${spec}`);
  return dir;
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const sourceArg = (argv.find((a) => a.startsWith('--source')) || '').split('=')[1] || 'cdn';
  if (!['cdn', 'npm'].includes(sourceArg)) {
    console.error(`fetch_emoji: unknown --source=${sourceArg} (expected cdn or npm)`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const provenance =
    sourceArg === 'npm'
      ? `@twemoji/svg@${TWEMOJI_NPM_VERSION} (npm registry)`
      : `jdecked/twemoji@${TWEMOJI_VERSION}`;

  // The directory can legitimately hold art from both sources — existing files
  // are never overwritten, so a later npm fetch does not restate the origin of
  // what the CDN put there. Record each source once instead of clobbering.
  const versionFile = path.join(OUT_DIR, '_TWEMOJI_VERSION.txt');
  const previous = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8') : '';
  if (!previous.includes(provenance)) {
    const header = previous
      ? previous.trimEnd() + `\n${provenance}\n`
      : `${provenance}\nCC-BY 4.0 graphics — see _LICENSE.txt\nAttribution required in any UI using these assets.\n`;
    fs.writeFileSync(versionFile, header);
  }

  const wanted = Array.from(new Set([...WANTED, ...navMapCodepoints()]));

  // Unpack lazily: a run where everything is already vendored should not pull
  // a ~10 MB tarball to do nothing.
  let pkgDirCache = null;
  const pkgDir = () => (pkgDirCache = pkgDirCache || npmSvgDir());

  // Pull LICENSE-GRAPHICS — the CC-BY 4.0 text that governs the artwork.
  //
  // Do NOT substitute the npm package's own licence file here: @twemoji/svg
  // ships an MIT licence covering the packaging, while the graphics inside it
  // remain CC-BY 4.0. Writing MIT into _LICENSE.txt would misstate the terms of
  // every asset in this directory. An existing file is never overwritten, so a
  // vendored CC-BY text survives a later fetch from either source.
  const licenseFile = path.join(OUT_DIR, '_LICENSE.txt');
  if (!fs.existsSync(licenseFile)) {
    try {
      const license = await fetchUrl(
        `https://raw.githubusercontent.com/jdecked/twemoji/${TWEMOJI_VERSION}/LICENSE-GRAPHICS`
      );
      fs.writeFileSync(licenseFile, license);
    } catch (e) {
      console.warn(
        'Could not fetch LICENSE-GRAPHICS:',
        e.message,
        '\n  the artwork is CC-BY 4.0 regardless of which source it came from —',
        '\n  add the text by hand before shipping:',
        `https://github.com/jdecked/twemoji/blob/${TWEMOJI_VERSION}/LICENSE-GRAPHICS`
      );
    }
  }

  let ok = 0,
    fail = 0,
    skipped = 0;
  for (const codepoint of wanted) {
    const dest = path.join(OUT_DIR, codepoint + '.svg');
    if (fs.existsSync(dest) && !force) {
      skipped++;
      continue;
    }
    try {
      const svg =
        sourceArg === 'npm'
          ? fs.readFileSync(path.join(pkgDir(), codepoint + '.svg'), 'utf8')
          : await fetchUrl(BASE + codepoint + '.svg');
      fs.writeFileSync(dest, svg);
      ok++;
    } catch (e) {
      console.error('  ✗', codepoint, '—', e.message);
      fail++;
    }
  }
  console.log(
    `Fetched ${ok}/${wanted.length} emoji SVGs from ${provenance}` +
      (skipped ? ` (${skipped} already vendored, left alone — pass --force to refetch)` : '') +
      (fail ? ` (${fail} failed)` : '')
  );

  // Curation churn strands assets: a glyph that gets swapped out of the nav map
  // leaves its SVG behind, and these are committed files. Report the orphans,
  // and remove them on --prune.
  const referenced = new Set(wanted);
  const orphans = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.svg') && !referenced.has(f.slice(0, -4)));
  if (orphans.length) {
    if (argv.includes('--prune')) {
      orphans.forEach((f) => fs.unlinkSync(path.join(OUT_DIR, f)));
      console.log(`Pruned ${orphans.length} vendored SVG(s) no longer referenced.`);
    } else {
      console.log(
        `${orphans.length} vendored SVG(s) are no longer referenced by WANTED or the nav map ` +
          `(${orphans.slice(0, 6).join(', ')}${orphans.length > 6 ? ', …' : ''}) — pass --prune to remove.`
      );
    }
  }
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
