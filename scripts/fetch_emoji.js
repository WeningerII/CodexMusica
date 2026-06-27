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
// Adding new codepoints: append to WANTED below, rerun.

const fs = require('fs');
const path = require('path');
const https = require('https');

const TWEMOJI_VERSION = '15.1.0';
const BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/`;
const OUT_DIR = path.join(__dirname, '..', 'references', '_assets', 'emoji');

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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, '_TWEMOJI_VERSION.txt'),
    `jdecked/twemoji@${TWEMOJI_VERSION}\nCC-BY 4.0 graphics — see _LICENSE.txt\nAttribution required in any UI using these assets.\n`
  );

  // Pull LICENSE-GRAPHICS
  try {
    const license = await fetchUrl(
      `https://raw.githubusercontent.com/jdecked/twemoji/${TWEMOJI_VERSION}/LICENSE-GRAPHICS`
    );
    fs.writeFileSync(path.join(OUT_DIR, '_LICENSE.txt'), license);
  } catch (e) {
    console.warn('Could not fetch LICENSE-GRAPHICS:', e.message);
  }

  let ok = 0,
    fail = 0;
  for (const codepoint of WANTED) {
    try {
      const svg = await fetchUrl(BASE + codepoint + '.svg');
      fs.writeFileSync(path.join(OUT_DIR, codepoint + '.svg'), svg);
      ok++;
    } catch (e) {
      console.error('  ✗', codepoint, '—', e.message);
      fail++;
    }
  }
  console.log(`Fetched ${ok}/${WANTED.length} emoji SVGs` + (fail ? ` (${fail} failed)` : ''));
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
