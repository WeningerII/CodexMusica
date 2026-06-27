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
  'save-all',
  'folder',
  'folder-open',
  'file',
  'file-plus',
  'search',
  'funnel',
  'arrow-up-down',
  'refresh-cw',
  'pencil',
  'plus',
  'minus',
  'maximize-2',
  'minimize-2',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'house',
  'menu',
  'ellipsis-vertical',
  'ellipsis',
  'layout-grid',
  'list',
  'gallery-thumbnails',
  'grip-vertical',
  'move-diagonal',
  'bookmark',
  'star',
  'heart',
  'share-2',
  'download',
  'upload',
  'clipboard-paste',
  'scissors',
  'undo-2',
  'redo-2',
  'clipboard',
  'link',
  'external-link',
  'paperclip',
  'eye-off',
  'lock',
  'lock-open',
  'key',
  'triangle-alert',
  'info',
  'circle-question-mark',
  'lightbulb',
  'wand-sparkles',
  'zap',
  'loader-circle',
  'loader',
  'panel-left',
  'columns-2',
  'zoom-in',
  'zoom-out',
  'scan',
  'sliders-horizontal',
  'toggle-right',
  'toggle-left',
  'circle-dot',
  'square-check',
  'play',
  'pause',
  'square',
  'circle',
  'rewind',
  'fast-forward',
  'skip-back',
  'skip-forward',
  'repeat',
  'repeat-1',
  'volume-2',
  'volume-1',
  'volume-x',

  // --- Family-level music glyphs (kept from existing ICONS for continuity) ---
  'mic',
  'headphones',
  'disc',
  'guitar',
  'piano',
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
