#!/usr/bin/env node
'use strict';
// Ship only a complete, tracked pyramid. Check encoded sizes and hashes without
// decoding gigapixels in CI; the full source download is a deliberate build step.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const base = 'assets/earth-tiles/200407-v1';
const dir = path.join(root, base);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
const inventory = JSON.parse(fs.readFileSync(path.join(dir, 'inventory.json')));
// Only the pyramid's own paths are asked for: the whole tree's `ls-files`
// passed 1 MiB once the tiles were added, and `execFileSync`'s default
// `maxBuffer` is exactly 1 MiB, so the check died with ENOBUFS before it
// read a single tile (Build atlas imagery run 35649441001). The larger
// buffer is belt and braces for a pyramid that outgrows even its own listing.
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z', '--', base], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).split('\0')
);
assert.equal(manifest.projection, 'Equal Earth');
assert.equal(manifest.levels.length, 7);
assert.deepEqual(manifest.extent, [-2.70663, -1.317363, 2.70663, 1.317363]);
assert.equal(manifest.tileSize, 512);
assert.equal(manifest.gutter, 1);
assert.equal(manifest.levels[6].width, 86400);
assert.equal(inventory.sources.length, 8);
assert.deepEqual(
  inventory.sources,
  JSON.parse(fs.readFileSync(path.join(root, 'assets/earth-sources.json')))
);
const expected = new Set();
let bytes = 0;
for (const [z, level] of manifest.levels.entries()) {
  assert.equal(level.width, 1350 * 2 ** z);
  assert.equal(level.height, 657 * 2 ** z);
  assert.equal(level.rows.length, Math.ceil(level.height / 512));
  for (const [y, row] of level.rows.entries()) {
    if (!row) continue;
    assert(row[0] >= 0 && row[1] < Math.ceil(level.width / 512));
    for (let x = row[0]; x <= row[1]; x++) {
      const name = `${z}/${x}/${y}.webp`;
      expected.add(name);
      assert(tracked.has(`${base}/${name}`), `Untracked tile: ${name}`);
      const data = fs.readFileSync(path.join(dir, name));
      const receipt = inventory.tiles[name];
      assert(receipt, `Missing receipt: ${name}`);
      assert.equal(data.length, receipt[0], name);
      assert.equal(crypto.createHash('sha256').update(data).digest('hex'), receipt[1], name);
      assert(data.length < 250000, `Tile exceeds 250 KB budget: ${name}`);
      bytes += data.length;
    }
  }
}
assert.deepEqual(new Set(Object.keys(inventory.tiles)), expected);
for (const name of ['overview.webp', 'manifest.json', 'inventory.json']) {
  assert(tracked.has(`${base}/${name}`), `Untracked ${name}`);
}
assert(fs.statSync(path.join(dir, 'overview.webp')).size < 206000);
assert(fs.statSync(path.join(dir, 'manifest.json')).size < 16000);
const html = fs.readFileSync(path.join(root, 'atlas.html'), 'utf8');
assert(html.indexOf('src/atlas-tiles.js') < html.indexOf('src/atlas.js'));
console.log(
  `Earth tiles: ${expected.size} tracked, hashed tiles; ${(bytes / 1e6).toFixed(2)} MB total; overview and manifest within budgets.`
);
