#!/usr/bin/env node
'use strict';
// library_chunk_generations.js — the Library's code chunks stay published for
// 30 days after the build that named them stops being current
// (docs/library-native-design.md, "Code loading", chunk generations).
//
// A chunk's file name carries its content hash (library/code/<name>.<sha10>.js)
// and codex.html loads it by that name with an sha384 integrity. A tab opened
// before a publish keeps the old codex.html, so it still asks for the old
// names; Pages serves a deleted file as 404 and the tab could only say "the
// site was updated". So sync-pages never replaces library/code/: it merges the
// new build's chunks in beside the old ones, and this script keeps the record.
//
// library/code/generations.json:
//   { "version": 1, "retain_days": 30,
//     "generations": [ { "id", "files": [...], "first_published", "retired" } ] }
// A generation is one build's set of chunk files (id: sha256 of the sorted
// names, first 16 hex). The current one has retired null. Publishing a
// different set retires the current one on that day; a retired generation is
// dropped more than 30 days after it retired, and a file no kept generation
// names is deleted. A build with no chunks (any build before the Library
// ships) retires the current generation and adds none.
//
// Usage:
//   node scripts/library_chunk_generations.js --repo=library/code --dist=_dist/library/code --today=YYYY-MM-DD
//   node scripts/library_chunk_generations.js --check --repo=library/code --dist=<fresh build>/library/code
// --check refuses: a fresh chunk missing or different in the repo, a current
// generation that is not exactly the fresh build's files, a file no generation
// names, a named file that is missing.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MANIFEST = 'generations.json';
const RETAIN_DAYS = 30;
const CHUNK = /^[a-z][a-z0-9_-]*\.[0-9a-f]{10}\.js$/;

const listChunks = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => CHUNK.test(f))
        .sort()
    : [];
const generationId = (files) =>
  crypto.createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 16);
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

function readManifest(dir) {
  const p = path.join(dir, MANIFEST);
  if (!fs.existsSync(p)) return { version: 1, retain_days: RETAIN_DAYS, generations: [] };
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (m.version !== 1 || !Array.isArray(m.generations))
    throw new Error(`${p}: not a version 1 generation manifest`);
  return m;
}

// Merges dist's chunks into repo and updates the record. Returns a summary.
function apply({ repo, dist, today }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || '')) throw new Error('--today=YYYY-MM-DD is required');
  const files = listChunks(dist);
  const manifest = readManifest(repo);
  const id = files.length ? generationId(files) : null;
  for (const f of files) {
    const target = path.join(repo, f);
    const bytes = fs.readFileSync(path.join(dist, f));
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes))
      throw new Error(`${target}: a published chunk with this content-hashed name has other bytes`);
  }
  for (const g of manifest.generations) if (g.retired === null && g.id !== id) g.retired = today;
  if (id && !manifest.generations.some((g) => g.id === id))
    manifest.generations.push({ id, files, first_published: today, retired: null });
  else if (id) manifest.generations.find((g) => g.id === id).retired = null;
  const dropped = manifest.generations.filter(
    (g) => g.retired !== null && days(g.retired, today) > RETAIN_DAYS
  );
  manifest.generations = manifest.generations.filter((g) => !dropped.includes(g));
  const keep = new Set(manifest.generations.flatMap((g) => g.files));
  if (files.length || manifest.generations.length) fs.mkdirSync(repo, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(dist, f), path.join(repo, f));
  const deleted = listChunks(repo).filter((f) => !keep.has(f));
  for (const f of deleted) fs.unlinkSync(path.join(repo, f));
  const manifestPath = path.join(repo, MANIFEST);
  if (manifest.generations.length)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  else if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  if (!manifest.generations.length && fs.existsSync(repo) && !fs.readdirSync(repo).length)
    fs.rmdirSync(repo);
  return { current: id, kept: manifest.generations.length, dropped: dropped.length, deleted };
}

// The committed record against a fresh build. Returns a list of problems.
function check({ repo, dist }) {
  const problems = [];
  const files = listChunks(dist);
  const manifest = readManifest(repo);
  for (const f of files) {
    const target = path.join(repo, f);
    if (!fs.existsSync(target)) problems.push(`${f}: in the fresh build, not published`);
    else if (!fs.readFileSync(target).equals(fs.readFileSync(path.join(dist, f))))
      problems.push(`${f}: published bytes differ from the fresh build`);
  }
  const current = manifest.generations.filter((g) => g.retired === null);
  if (files.length) {
    if (current.length !== 1 || current[0].id !== generationId(files))
      problems.push(`${MANIFEST}: the current generation is not this build's chunks`);
  } else if (current.length)
    problems.push(`${MANIFEST}: a current generation, but the build has no chunks`);
  const named = new Set(manifest.generations.flatMap((g) => g.files));
  for (const f of named)
    if (!fs.existsSync(path.join(repo, f))) problems.push(`${f}: named by a generation, missing`);
  for (const f of listChunks(repo))
    if (!named.has(f)) problems.push(`${f}: published, named by no generation`);
  return problems;
}

module.exports = { apply, check, generationId, RETAIN_DAYS };

if (require.main === module) {
  const flags = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
      if (!m) throw new Error('unknown argument ' + a);
      return [m[1], m[2] ?? true];
    })
  );
  const repo = path.resolve(flags.repo || 'library/code');
  const dist = path.resolve(flags.dist || '_dist/library/code');
  if (flags.check) {
    const problems = check({ repo, dist });
    if (problems.length) {
      console.error('LIBRARY CHUNK GENERATIONS: FAIL\n  ' + problems.join('\n  '));
      process.exit(1);
    }
    console.log('LIBRARY CHUNK GENERATIONS: PASS');
  } else {
    const r = apply({ repo, dist, today: flags.today });
    console.log(
      `library chunk generations: current ${r.current || 'none'}, ${r.kept} kept, ${r.dropped} dropped, ${r.deleted.length} file(s) deleted`
    );
  }
}
