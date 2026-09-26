#!/usr/bin/env node
// Vendor Lucide icons from unpkg into references/_assets/icons/.
// Pinned to lucide-static v1.16.0 (ISC License) — written into _LUCIDE_VERSION.txt.
// Run once after editing WANTED; commits the SVGs into the repo for reproducibility.
// build_assets.js consumes references/_assets/icons/*.svg, not the network.

const fs = require('fs');
const path = require('path');
const https = require('https');

const LUCIDE_VERSION = '1.16.0';
const BASE = `https://unpkg.com/lucide-static@${LUCIDE_VERSION}/icons/`;
const OUT_DIR = path.join(__dirname, '..', 'references', '_assets', 'icons');

// All slugs the codex needs — Lucide-canonical names (current v1.16.0 spellings).
// Only icons some runtime string names are listed: an entry nothing requests
// ships in every page for nothing (40 were dropped on 2026-09-26).
// The codex's src/app.js may use older alias names; the alias
// mapping lives in build_assets.js so callers don't have to change.
const WANTED = [
  // --- Section 1: existing 12 icons in the codex ---
  'circle-alert',
  'check',
  'chevron-down',
  'chevron-right',
  'copy',
  'eye',
  'network',
  'pin',
  'shuffle',
  'sparkles',
  'trash-2',
  'x',

  // --- Section 2: UI chrome (the 85 in the research report) ---
  'settings',
  'save',
  'folder',
  'folder-open',
  'file',
  'file-plus',
  'search',
  'funnel',
  'refresh-cw',
  'pencil',
  'plus',
  'maximize-2',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'house',
  'menu',
  'ellipsis',
  'layout-grid',
  'list',
  'grip-vertical',
  'bookmark',
  'download',
  'upload',
  'undo-2',
  'redo-2',
  'clipboard',
  'link',
  'triangle-alert',
  'info',
  'circle-question-mark',
  'lightbulb',
  'loader',
  'panel-left',
  'sliders-horizontal',
  'square-check',
  'play',
  'circle',
  'repeat',
  'volume-2',

  // --- Family-level music glyphs (kept from existing ICONS for continuity) ---
  'mic',
  'disc',
  'guitar',
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Follow one redirect (unpkg → cdn.jsdelivr-ish)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, '_LUCIDE_VERSION.txt'),
    `lucide-static@${LUCIDE_VERSION}\nISC License — see _LICENSE.txt\n`
  );

  // Vendor LICENSE from the lucide repo
  try {
    const license = await fetchUrl(
      'https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE'
    );
    fs.writeFileSync(path.join(OUT_DIR, '_LICENSE.txt'), license);
  } catch {
    console.warn('  (could not fetch LICENSE — copy manually from lucide repo)');
  }

  let ok = 0,
    fail = 0;
  for (const slug of WANTED) {
    const url = BASE + slug + '.svg';
    try {
      const svg = await fetchUrl(url);
      fs.writeFileSync(path.join(OUT_DIR, slug + '.svg'), svg);
      ok++;
    } catch (e) {
      console.error('  ✗', slug, '—', e.message);
      fail++;
    }
  }
  console.log(`Fetched ${ok}/${WANTED.length} icons` + (fail ? ` (${fail} failed)` : ''));
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
