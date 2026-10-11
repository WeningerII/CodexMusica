#!/usr/bin/env node
'use strict';
// test_library_chunk_generations.js — scripts/library_chunk_generations.js:
// a publish merges, never replaces; a generation outlives its replacement by
// exactly 30 days; shared files survive; --check refuses drift.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const G = require('./library_chunk_generations.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-gen-'));
function build(files) {
  const dir = tmp();
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}
const listing = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
const manifest = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'generations.json'), 'utf8'));

const V1 = { 'core.aaaaaaaaaa.js': 'core 1', 'reader.bbbbbbbbbb.js': 'reader 1' };
const V2 = { 'core.cccccccccc.js': 'core 2', 'reader.bbbbbbbbbb.js': 'reader 1' };

test('a publish merges beside the previous generation and keeps it 30 days', () => {
  const repo = path.join(tmp(), 'code');
  G.apply({ repo, dist: build(V1), today: '2026-11-01' });
  assert.deepEqual(listing(repo), [
    'core.aaaaaaaaaa.js',
    'generations.json',
    'reader.bbbbbbbbbb.js',
  ]);
  G.apply({ repo, dist: build(V2), today: '2026-11-10' });
  assert.deepEqual(listing(repo), [
    'core.aaaaaaaaaa.js',
    'core.cccccccccc.js',
    'generations.json',
    'reader.bbbbbbbbbb.js',
  ]);
  const m = manifest(repo);
  assert.equal(m.generations.length, 2);
  assert.equal(m.generations[0].retired, '2026-11-10');
  assert.equal(m.generations[1].retired, null);
  // 30 days after it retired, the old generation is still kept…
  G.apply({ repo, dist: build(V2), today: '2026-12-10' });
  assert.ok(listing(repo).includes('core.aaaaaaaaaa.js'));
  // …and on day 31 it is dropped, with only the file no one else names.
  const r = G.apply({ repo, dist: build(V2), today: '2026-12-11' });
  assert.deepEqual(r.deleted, ['core.aaaaaaaaaa.js']);
  assert.deepEqual(listing(repo), [
    'core.cccccccccc.js',
    'generations.json',
    'reader.bbbbbbbbbb.js',
  ]);
  assert.deepEqual(G.check({ repo, dist: build(V2) }), []);
});

test('re-publishing the same build changes nothing; returning to an old one revives it', () => {
  const repo = path.join(tmp(), 'code');
  G.apply({ repo, dist: build(V1), today: '2026-11-01' });
  const once = fs.readFileSync(path.join(repo, 'generations.json'), 'utf8');
  G.apply({ repo, dist: build(V1), today: '2026-11-05' });
  assert.equal(fs.readFileSync(path.join(repo, 'generations.json'), 'utf8'), once);
  G.apply({ repo, dist: build(V2), today: '2026-11-06' });
  G.apply({ repo, dist: build(V1), today: '2026-11-07' });
  const m = manifest(repo);
  assert.deepEqual(
    m.generations.map((g) => g.retired),
    [null, '2026-11-07']
  );
});

test('a build with no chunks retires the current generation and, after 30 days, empties the record', () => {
  const repo = path.join(tmp(), 'code');
  G.apply({ repo, dist: build(V1), today: '2026-11-01' });
  G.apply({ repo, dist: build({}), today: '2026-11-02' });
  assert.equal(manifest(repo).generations[0].retired, '2026-11-02');
  assert.deepEqual(G.check({ repo, dist: build({}) }), []);
  G.apply({ repo, dist: build({}), today: '2026-12-03' });
  assert.deepEqual(listing(repo), []);
  // A repo that never had chunks: nothing to write, nothing to refuse.
  const none = path.join(tmp(), 'code');
  G.apply({ repo: none, dist: build({}), today: '2026-11-01' });
  assert.equal(fs.existsSync(none), false);
  assert.deepEqual(G.check({ repo: none, dist: build({}) }), []);
});

test('a content-hashed name published with other bytes is refused', () => {
  const repo = path.join(tmp(), 'code');
  G.apply({ repo, dist: build(V1), today: '2026-11-01' });
  assert.throws(
    () => G.apply({ repo, dist: build({ 'core.aaaaaaaaaa.js': 'other' }), today: '2026-11-02' }),
    /other bytes/
  );
});

test('--check refuses drift', () => {
  const repo = path.join(tmp(), 'code');
  G.apply({ repo, dist: build(V1), today: '2026-11-01' });
  assert.match(
    G.check({ repo, dist: build(V2) }).join('\n'),
    /core\.cccccccccc\.js: in the fresh build, not published/
  );
  fs.writeFileSync(path.join(repo, 'stray.0123456789.js'), 'x');
  assert.match(
    G.check({ repo, dist: build(V1) }).join('\n'),
    /stray\.0123456789\.js: published, named by no generation/
  );
  fs.unlinkSync(path.join(repo, 'stray.0123456789.js'));
  fs.unlinkSync(path.join(repo, 'reader.bbbbbbbbbb.js'));
  assert.match(
    G.check({ repo, dist: build(V1) }).join('\n'),
    /reader\.bbbbbbbbbb\.js: (in the fresh build, not published|named by a generation, missing)/
  );
  assert.throws(() => G.apply({ repo, dist: build(V1), today: '' }), /--today/);
});
