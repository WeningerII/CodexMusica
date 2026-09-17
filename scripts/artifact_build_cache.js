#!/usr/bin/env node
'use strict';
// M-244: reuse a build, never a freshness verdict. The existing closure gate
// still traces the builders, and check_artifact_fresh still compares every
// committed output on every affected run. No prefix/fallback cache is admitted.
//
// node scripts/artifact_build_cache.js key
// node scripts/artifact_build_cache.js record DIR EXPECTED_KEY
// node scripts/artifact_build_cache.js admit DIR
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ROOT, classify } = require('./_build_closure.js');

const MANIFEST = 'artifact-build.json';
const VERSION = 1;
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function fingerprint(root = ROOT, runtime = process.versions) {
  // Include untracked non-ignored inputs for local use as well. Missing tracked
  // files remain in the inventory: deleting an input must invalidate the key.
  const paths = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
    }
  )
    .split('\0')
    .filter(Boolean);
  // The workflow supplies the builder arguments; changing that invocation is
  // an input even though the artifact closure correctly calls CI config inert.
  const own = new Set([
    'scripts/_build_closure.js',
    'scripts/artifact_build_cache.js',
    '.github/workflows/ci.yml',
  ]);
  const inputs = [...new Set(paths)]
    .filter((p) => own.has(p) || classify(p).kind === 'closure')
    .sort();
  const h = crypto.createHash('sha256');
  h.update(
    JSON.stringify({ version: VERSION, runtime, platform: process.platform, arch: process.arch })
  );
  for (const rel of inputs) {
    h.update('\0' + rel + '\0');
    const file = path.join(root, rel);
    try {
      const st = fs.lstatSync(file);
      // A symlink's target can live outside the declared tree. Refuse reuse,
      // rather than hashing only its name and overlooking its referent.
      if (!st.isFile()) throw new Error(`non-file cache input: ${rel}`);
      h.update(digest(fs.readFileSync(file)));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      h.update('ABSENT');
    }
  }
  return h.digest('hex');
}

function inventory(dir) {
  const rows = [];
  function read(rel) {
    const file = path.join(dir, rel);
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink()) throw new Error(`symlink in cached build: ${rel}`);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) read(path.join(rel, name));
    } else if (st.isFile()) {
      rows.push([rel.split(path.sep).join('/'), digest(fs.readFileSync(file))]);
    } else throw new Error(`non-file in cached build: ${rel}`);
  }
  read('api');
  read('codex.html');
  if (!rows.some(([p]) => p === 'api/index.json')) throw new Error('cached build has no API index');
  return rows;
}

function record(dir, key, root = ROOT) {
  if (!key || key !== fingerprint(root))
    throw new Error('build inputs moved; cache receipt refused');
  const receipt = { version: VERSION, fingerprint: key, files: inventory(dir) };
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

function admit(dir, key = fingerprint()) {
  try {
    const receipt = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8'));
    if (receipt.version !== VERSION || receipt.fingerprint !== key) return false;
    return JSON.stringify(receipt.files) === JSON.stringify(inventory(dir));
  } catch {
    // Absent, truncated, corrupt, stale and partial caches all mean rebuild.
    return false;
  }
}

if (require.main === module) {
  try {
    const [verb, dir, expectedKey] = process.argv.slice(2);
    if (verb === 'key' && !dir) console.log(fingerprint());
    else if (verb === 'record' && dir && expectedKey) {
      const receipt = record(dir, expectedKey);
      console.log(`BUILD CACHE RECORDED ${receipt.fingerprint} (${receipt.files.length} files)`);
    } else if (verb === 'admit' && dir) {
      const valid = admit(dir);
      console.log(
        valid
          ? 'BUILD CACHE ADMITTED; freshness comparison still required'
          : 'BUILD CACHE MISS; rebuild required'
      );
      process.exitCode = valid ? 0 : 1;
    } else
      throw new Error('usage: artifact_build_cache.js key | record DIR EXPECTED_KEY | admit DIR');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { fingerprint, inventory, record, admit };
