#!/usr/bin/env node
// check_atlas_publish.js — every file the atlas fetches is one GitHub Pages
// will actually serve.
//
// WHY
// Pages serves `main` verbatim only when a `.nojekyll` marker sits at the root.
// Without it the site goes through Jekyll first, and Jekyll drops every path
// that has a segment starting with `_`, `.` or `#`, or ending in `~`. The atlas
// fetches references/_tradition_signatures.json, so the live page booted to
// "load error" on 2026-09-10 while every gate in this repo was green: the
// sidecars were tracked, fresh, byte-checked — and one of them was a 404 the
// moment it left the checkout. Nothing compared what src/atlas.js fetches
// against what Pages publishes. This does (M-271).
//
// WHAT IT CHECKS
//   1. Every relative URL atlas.html links or loads, and every path
//      src/atlas.js fetches, exists on disk and is git-tracked (Pages serves
//      the commit, not the working tree).
//   2. Every one of those paths is servable under the rules Pages applies to
//      THIS tree: with `.nojekyll` present, everything; without it, nothing
//      Jekyll excludes.
//   3. The fetch list was actually found — an atlas.js that stopped using
//      `get('…')` literals would otherwise pass with an empty list.
//
// Usage:
//   node scripts/check_atlas_publish.js              # the gate (exit 1 on any failure)
//   node scripts/check_atlas_publish.js --root=DIR   # run against another tree
//   node scripts/check_atlas_publish.js --self-test  # prove it fails without the marker

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const argv = process.argv.slice(2);
const rootArg = argv.find((a) => a.startsWith('--root='));
const ROOT = rootArg ? path.resolve(rootArg.slice('--root='.length)) : path.join(__dirname, '..');

// Jekyll's exclusion rules, as GitHub Pages applies them when no `.nojekyll`
// marker is present. Anything a rule matches is not published.
const JEKYLL_TOP_LEVEL = new Set(['node_modules', 'vendor', 'Gemfile', 'Gemfile.lock']);
function jekyllExcludes(rel) {
  const segs = rel.split('/');
  if (JEKYLL_TOP_LEVEL.has(segs[0])) return `Jekyll excludes top-level ${segs[0]}`;
  for (const s of segs) {
    if (s.startsWith('_')) return `Jekyll excludes a path segment starting with "_" (${s})`;
    if (s.startsWith('.')) return `Jekyll excludes a path segment starting with "." (${s})`;
    if (s.startsWith('#')) return `Jekyll excludes a path segment starting with "#" (${s})`;
    if (s.endsWith('~')) return `Jekyll excludes a path segment ending in "~" (${s})`;
  }
  return null;
}

// A relative URL as the page wrote it → a repo-relative path, or null when it
// is not something Pages serves from this tree (absolute, protocol, fragment).
function localPath(url) {
  if (!url || /^(?:[a-z]+:|\/\/|#|\/)/i.test(url)) return null;
  const clean = url.replace(/[?#].*$/, '');
  if (!clean) return null;
  return path.posix.normalize(clean).replace(/^\.\//, '');
}

function trackedSet(root) {
  try {
    return new Set(
      execFileSync('git', ['ls-files', '-z'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\0')
        .filter(Boolean)
    );
  } catch {
    return null; // no git here (a synthetic tree); existence is the whole test
  }
}

// The audit itself. Returns { refs, failures } so --self-test can drive it.
function audit(root) {
  const failures = [];
  const refs = new Map(); // repo path → where it was referenced from

  const html = fs.readFileSync(path.join(root, 'atlas.html'), 'utf8');
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const p = localPath(m[1]);
    if (p && !refs.has(p)) refs.set(p, 'atlas.html');
  }

  const js = fs.readFileSync(path.join(root, 'src', 'atlas.js'), 'utf8');
  let fetched = 0;
  // Only the network branch's sidecar list: `get(...)` is also the name of
  // URLSearchParams' accessor further down, and that one takes a query key.
  const list = js.match(/Promise\.all\(\[([\s\S]*?)\]\)/);
  for (const m of (list ? list[1] : '').matchAll(/\bget\('([^']+)'\)/g)) {
    fetched++;
    const p = localPath(m[1]);
    if (p && !refs.has(p)) refs.set(p, 'src/atlas.js');
  }
  // The per-pin lineage fetch is built from a prefix, not a literal: the
  // directory it reads from has to be there and servable too.
  for (const m of js.matchAll(/\bfetch\(\s*'([^']+\/)'\s*\+/g)) {
    fetched++;
    const p = localPath(m[1]);
    if (p && !refs.has(p)) refs.set(p, 'src/atlas.js (per-pin prefix)');
  }
  if (fetched === 0) {
    failures.push(
      "src/atlas.js: no get('…') inside Promise.all([…]) and no fetch('…/' + …) prefix found — the fetch list is empty, so nothing was checked"
    );
  }

  const tracked = trackedSet(root);
  const noJekyll = fs.existsSync(path.join(root, '.nojekyll'));

  for (const [p, from] of refs) {
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) {
      failures.push(`${p} (from ${from}): missing on disk`);
      continue;
    }
    if (tracked) {
      const isDir = fs.statSync(abs).isDirectory();
      const isTracked = isDir
        ? [...tracked].some((t) => t.startsWith(p.replace(/\/?$/, '/')))
        : tracked.has(p);
      if (!isTracked)
        failures.push(`${p} (from ${from}): not git-tracked, so Pages will never see it`);
    }
    if (!noJekyll) {
      const why = jekyllExcludes(p);
      if (why) {
        failures.push(
          `${p} (from ${from}): ${why} — add a root .nojekyll marker or rename the path`
        );
      }
    }
  }
  return { refs, failures, noJekyll };
}

function report(root, quiet) {
  const { refs, failures, noJekyll } = audit(root);
  if (!quiet) {
    console.log('=== Atlas sidecars are publishable ===\n');
    console.log(
      `  ${refs.size} referenced path(s); Pages ${noJekyll ? 'serves this tree verbatim (.nojekyll present)' : 'would run this tree through Jekyll (no .nojekyll)'}`
    );
    for (const f of failures) console.log(`  ✗ ${f}`);
    if (failures.length === 0) console.log('  ✓ every path exists, is tracked, and is servable');
  }
  return failures;
}

// ── --self-test: the gate is two-sided ──────────────────────────────────────
// A synthetic tree that fetches an underscore path fails without the marker
// and passes with it. The gate must be able to go red, or it is a memory.
function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-publish-'));
  const write = (p, s) => {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), s);
  };
  write('atlas.html', '<link rel="icon" href="favicon.svg" /><script src="src/atlas.js"></script>');
  write(
    'src/atlas.js',
    "Promise.all([get('api/traditions/index.json'), get('references/_sigs.json')]);\n" +
      "fetch('api/traditions/' + encodeURIComponent(id) + '.json');\n"
  );
  write('favicon.svg', '<svg/>');
  write('api/traditions/index.json', '[]');
  write('references/_sigs.json', '{}');

  const cases = [];
  const without = audit(dir).failures;
  cases.push({
    name: 'underscore sidecar, no .nojekyll → refused',
    ok: without.length === 1 && /references\/_sigs\.json.*starting with "_"/.test(without[0]),
    got: without,
  });
  write('.nojekyll', '');
  const withMarker = audit(dir).failures;
  cases.push({
    name: 'same tree, .nojekyll present → accepted',
    ok: withMarker.length === 0,
    got: withMarker,
  });
  fs.rmSync(path.join(dir, 'references', '_sigs.json'));
  const missing = audit(dir).failures;
  cases.push({
    name: 'sidecar deleted → refused as missing, marker or not',
    ok: missing.length === 1 && /missing on disk/.test(missing[0]),
    got: missing,
  });
  write('src/atlas.js', 'var sources = INLINE;\n');
  write('references/_sigs.json', '{}');
  const empty = audit(dir).failures;
  cases.push({
    name: 'no fetch literals → refused as an empty check',
    ok: empty.length === 1 && /fetch list is empty/.test(empty[0]),
    got: empty,
  });
  fs.rmSync(dir, { recursive: true, force: true });

  console.log('=== check_atlas_publish self-test ===\n');
  let bad = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (!c.ok) {
      bad++;
      for (const g of c.got) console.log(`      got: ${g}`);
    }
  }
  return bad;
}

if (require.main === module) {
  if (argv.includes('--self-test')) {
    process.exit(selfTest() === 0 ? 0 : 1);
  }
  const failures = report(ROOT, false);
  process.exit(failures.length === 0 ? 0 : 1);
}

module.exports = { audit, jekyllExcludes, localPath };
