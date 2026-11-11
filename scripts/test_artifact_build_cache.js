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
  put('scripts/build_html.js', 'builder');
  put('src/pages/library.js', 'Library loader');
  put('src/library/core.js', 'Library chunk source');
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
    'scripts/build_html.js',
    'src/pages/library.js',
    'src/library/core.js',
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

  // The default lazy page names generated Library chunks beside codex.html.
  // A pair-only archive used to pass admission while the fault budget baseline
  // failed on these missing files. Every named chunk is required at record
  // time; neither a missing chunk nor an unreferenced extra can be recorded.
  const page =
    '<script>const chunks={core:["library/code/core.test.js"],reader:["library/code/reader.test.js"]};</script>';
  put('build/codex.html', page);
  assert.throws(() => record(dir, original, tmp), /library\/code directory/);
  put('build/library/code/core.test.js', 'core bytes');
  assert.throws(() => record(dir, original, tmp), /required Library chunk/);
  put('build/library/code/reader.test.js', 'reader bytes');
  put('build/library/code/extra.test.js', 'extra generated chunk');
  assert.throws(() => record(dir, original, tmp), /unreferenced Library chunk/);
  fs.unlinkSync(path.join(dir, 'library/code/extra.test.js'));
  const receipt = record(dir, original, tmp);
  assert.equal(receipt.version, 2, 'incomplete version-1 receipts cannot be reused');
  assert.deepEqual(
    receipt.files.filter(([p]) => p.startsWith('library/code/')).map(([p]) => p),
    ['library/code/core.test.js', 'library/code/reader.test.js']
  );
  assert.equal(admit(dir, original), true, 'the complete Library build is admitted');
  put('build/library/code/core.test.js', 'tampered core');
  assert.equal(admit(dir, original), false, 'tampered Library bytes refuse');
  put('build/library/code/core.test.js', 'core bytes');
  fs.unlinkSync(path.join(dir, 'library/code/reader.test.js'));
  assert.equal(admit(dir, original), false, 'a missing Library chunk refuses');
  put('build/library/code/reader.test.js', 'reader bytes');
  put('build/library/code/unexpected.js', 'unrecorded');
  assert.equal(admit(dir, original), false, 'an extra Library chunk refuses');
  fs.unlinkSync(path.join(dir, 'library/code/unexpected.js'));
  fs.unlinkSync(path.join(dir, 'library/code/core.test.js'));
  fs.symlinkSync('../../../../README.md', path.join(dir, 'library/code/core.test.js'));
  assert.equal(admit(dir, original), false, 'linked Library chunks refuse');
  fs.unlinkSync(path.join(dir, 'library/code/core.test.js'));
  put('build/library/code/core.test.js', 'core bytes');
  fs.renameSync(path.join(dir, 'library'), path.join(tmp, 'generated-library'));
  assert.equal(admit(dir, original), false, 'a pair-only handoff refuses');
  fs.symlinkSync('../generated-library', path.join(dir, 'library'));
  assert.equal(admit(dir, original), false, 'a linked Library directory refuses');
  fs.unlinkSync(path.join(dir, 'library'));
  fs.renameSync(path.join(tmp, 'generated-library'), path.join(dir, 'library'));
  assert.equal(admit(dir, original), true, 'restored complete Library bytes are admitted');
  put('build/artifact-build.json', JSON.stringify({ ...receipt, version: 1 }));
  assert.equal(admit(dir, original), false, 'old receipts fail closed even with the same key');
  put('build/artifact-build.json', '{broken');
  assert.equal(admit(dir, original), false, 'truncated receipt refuses');
  console.log(
    'artifact build cache: source/runtime, complete Library inventory and damaged-cache controls pass'
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
