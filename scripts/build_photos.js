#!/usr/bin/env node
// Read commons fetch results, download each picked image, crop+resize to
// 320×320 WebP, base64-encode, emit PHOTO_REGISTRY entries.
//
// Output: writes references/_assets/photos/<id>.webp for each entity, and
// extends references/08_asset_manifest.js with PHOTO_REGISTRY.

const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const args = process.argv.slice(2);
const opts = {
  fetch_results: '/tmp/commons_full.json',
  photos_dir: path.join(__dirname, '..', 'references', '_assets', 'photos'),
  manifest: path.join(__dirname, '..', 'references', '08_asset_manifest.js'),
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--in') opts.fetch_results = args[++i];
}

function fetchBuffer(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'codex-music-tool/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location, attempt).then(resolve).catch(reject);
      }
      if (res.statusCode === 429) {
        if (attempt >= 3) return reject(new Error('http_429_persistent'));
        const wait = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
        return setTimeout(
          () =>
            fetchBuffer(url, attempt + 1)
              .then(resolve)
              .catch(reject),
          wait
        );
      }
      if (res.statusCode !== 200) return reject(new Error('http_' + res.statusCode));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOne(entry) {
  // Resume: skip if .webp already on disk. Read it back into base64 for manifest.
  const diskPath = path.join(opts.photos_dir, entry.id + '.webp');
  if (fs.existsSync(diskPath)) {
    const webp = fs.readFileSync(diskPath);
    return {
      id: entry.id,
      bytes: webp.length,
      base64: webp.toString('base64'),
      license: entry.pick.license_short || entry.pick.license_long || '',
      author: entry.pick.author || '',
      source: entry.pick.page_url || '',
      filename: entry.pick.filename || '',
      resumed: true,
    };
  }

  // Download. Prefer thumburl (already scaled by Commons), fallback to full url.
  const sourceUrl = entry.pick.thumburl || entry.pick.url;
  if (!sourceUrl) return { id: entry.id, error: 'no_url' };

  let buf;
  try {
    buf = await fetchBuffer(sourceUrl);
  } catch (e) {
    return { id: entry.id, error: 'download_failed', detail: e.message };
  }

  // Sharp pipeline: cover-crop to 320×320, encode WebP q=80
  let webp;
  try {
    webp = await sharp(buf, { failOnError: false })
      .resize(320, 320, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (e) {
    return { id: entry.id, error: 'sharp_failed', detail: e.message };
  }

  // Write to disk for reproducibility / debugging
  fs.writeFileSync(diskPath, webp);

  return {
    id: entry.id,
    bytes: webp.length,
    base64: webp.toString('base64'),
    license: entry.pick.license_short || entry.pick.license_long || '',
    author: entry.pick.author || '',
    source: entry.pick.page_url || '',
    filename: entry.pick.filename || '',
  };
}

function writeManifest(ok) {
  const existing = fs.readFileSync(opts.manifest, 'utf8');
  const cleaned = existing.replace(/\n\/\/ ─{3,} PHOTO_REGISTRY ─{3,}[\s\S]*$/m, '');
  const lines = [];
  lines.push('');
  lines.push('// ─────────────── PHOTO_REGISTRY ─────────────── (auto-generated)');
  lines.push('// Source: Wikimedia Commons photos, fetched via scripts/fetch_commons.js');
  lines.push('// Encoded: 320×320 WebP q=80 via scripts/build_photos.js (sharp)');
  lines.push('// Total entries: ' + ok.length);
  lines.push('// To regenerate: node scripts/fetch_commons.js && node scripts/build_photos.js');
  lines.push('const PHOTO_REGISTRY = {');
  for (const r of ok) {
    lines.push('  ' + JSON.stringify(r.id) + ': {');
    lines.push('    dataUrl: "data:image/webp;base64," + ' + JSON.stringify(r.base64) + ',');
    lines.push('    license: ' + JSON.stringify(r.license) + ',');
    lines.push('    author: ' + JSON.stringify(r.author) + ',');
    lines.push('    source: ' + JSON.stringify(r.source) + ',');
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  fs.writeFileSync(opts.manifest, cleaned + lines.join('\n'));
}

async function main() {
  if (!fs.existsSync(opts.fetch_results)) {
    console.error('Missing fetch results: ' + opts.fetch_results);
    process.exit(1);
  }
  fs.mkdirSync(opts.photos_dir, { recursive: true });

  const fetchResults = JSON.parse(fs.readFileSync(opts.fetch_results, 'utf8'));
  const picked = fetchResults.filter((r) => r.pick);
  console.error('Processing ' + picked.length + ' picked images out of ' + fetchResults.length);

  const ok = [],
    fail = [];
  for (let i = 0; i < picked.length; i++) {
    process.stderr.write(
      '[' + (i + 1) + '/' + picked.length + '] ' + picked[i].id.padEnd(28) + ' '
    );
    const t0 = Date.now();
    const r = await processOne(picked[i]);
    if (r.base64) {
      ok.push(r);
      console.error(
        (r.resumed ? '◯' : '✓') +
          ' ' +
          (r.bytes / 1024).toFixed(1) +
          ' KB [' +
          (Date.now() - t0) +
          'ms]'
      );
    } else {
      fail.push(r);
      console.error('✗ ' + r.error);
    }
    // Incremental manifest write every 10 entries so session interruption keeps progress
    if ((i + 1) % 10 === 0) writeManifest(ok);
    // Resumed entries don't need throttle (read from disk)
    if (!r.resumed) await sleep(1200);
  }

  writeManifest(ok);
  console.error('\nSucceeded: ' + ok.length + ' · Failed: ' + fail.length);
  if (fail.length) {
    console.error('\nFailures:');
    for (const f of fail)
      console.error('  ' + f.id + ': ' + f.error + (f.detail ? ' — ' + f.detail : ''));
  }
  console.error('\nManifest: ' + opts.manifest);
  const totalBytes = ok.reduce((sum, r) => sum + r.bytes, 0);
  console.error('Total photo bytes: ' + (totalBytes / 1024 / 1024).toFixed(1) + ' MB');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
