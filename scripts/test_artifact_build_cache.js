#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { fingerprint, record, admit } = require('./artifact_build_cache.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-cache-test-'));
function put(rel, value) {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, value);
}
try {
  execFileSync('git', ['init', '-q', tmp]);
  put('.gitignore', 'build/\n');
  put('references/input.js', 'original');
  put('README.md', 'first');
  put('package-lock.json', 'lock');
  put('scripts/_build_closure.js', 'closure');
  put('scripts/artifact_build_cache.js', 'admission');
  put('.github/workflows/ci.yml', 'builder invocation');
  execFileSync('git', ['-C', tmp, 'add', '.']);
  const original = fingerprint(tmp);
  put('README.md', 'documentation only');
  assert.equal(fingerprint(tmp), original, 'inert changes can reuse the build');
  for (const p of [
    'references/input.js',
    'package-lock.json',
    'scripts/_build_closure.js',
    'scripts/artifact_build_cache.js',
    '.github/workflows/ci.yml',
  ]) {
    const prior = fs.readFileSync(path.join(tmp, p));
    put(p, 'changed');
    assert.notEqual(fingerprint(tmp), original, `${p} invalidates reuse`);
    fs.writeFileSync(path.join(tmp, p), prior);
  }
  put('src/new.js', 'new untracked input');
  assert.notEqual(fingerprint(tmp), original, 'new inputs are not invisible');
  fs.unlinkSync(path.join(tmp, 'src/new.js'));
  fs.unlinkSync(path.join(tmp, 'references/input.js'));
  assert.notEqual(fingerprint(tmp), original, 'a removed input invalidates reuse');
  put('references/input.js', 'original');
  assert.notEqual(
    fingerprint(tmp, { ...process.versions, node: 'other' }),
    original,
    'runtime identity invalidates reuse'
  );
  fs.symlinkSync('input.js', path.join(tmp, 'references/link.js'));
  assert.throws(() => fingerprint(tmp), /non-file cache input/);
  fs.unlinkSync(path.join(tmp, 'references/link.js'));

  const dir = path.join(tmp, 'build');
  put('build/api/index.json', '{"test":true}');
  put('build/api/item.json', '{"recipe":"original"}');
  put('build/codex.html', '<html>original</html>');
  assert.equal(admit(dir, original), false, 'a bare artifact is not a receipt');
  put('references/input.js', 'moved during build');
  assert.throws(() => record(dir, original, tmp), /build inputs moved/);
  put('references/input.js', 'original');
  record(dir, original, tmp);
  assert.equal(admit(dir, original), true, 'the complete unchanged build is admitted');
  assert.equal(admit(dir, 'different'), false, 'no fallback across source fingerprints');
  put('build/api/item.json', '{"recipe":"corrupt"}');
  assert.equal(admit(dir, original), false, 'corrupt artifact bytes refuse');
  put('build/api/item.json', '{"recipe":"original"}');
  put('build/api/extra.json', '{}');
  assert.equal(admit(dir, original), false, 'extra artifact files refuse');
  fs.unlinkSync(path.join(dir, 'api/extra.json'));
  fs.unlinkSync(path.join(dir, 'api/item.json'));
  assert.equal(admit(dir, original), false, 'missing artifact files refuse');
  put('build/api/item.json', '{"recipe":"original"}');
  fs.unlinkSync(path.join(dir, 'codex.html'));
  fs.symlinkSync('../README.md', path.join(dir, 'codex.html'));
  assert.equal(admit(dir, original), false, 'symlink artifacts refuse');
  fs.unlinkSync(path.join(dir, 'codex.html'));
  put('build/codex.html', '<html>original</html>');
  put('build/artifact-build.json', '{broken');
  assert.equal(admit(dir, original), false, 'truncated receipt refuses');
  console.log('artifact build cache: source/runtime invalidation and damaged-cache controls pass');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
