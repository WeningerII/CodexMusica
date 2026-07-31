#!/usr/bin/env node
// check_artifact_fresh.js — Goal 3: the published artifact is provably a
// function of the source.
//
// @covers: artifact-reproducible
//
// Rebuilds api/ + codex.html + the discovery files (sitemap.xml, llms.txt,
// robots.txt) from references/ and byte-diffs the result against the committed
// copies. 0 diff ⇒ the artifact is exactly what the source produces; any diff ⇒
// the committed artifact has drifted (the class that let a stale codex.html /
// api/ ship). Build-timestamp fields (`generated` in api JSON) are not a function
// of source, so they are normalized out before comparing; codex.html and the
// discovery files are deterministic and compared byte-for-byte.
//
// The discovery files were generated but never verified until now — sitemap.xml
// could describe a catalog that no longer existed and nothing would say so.
//
// Usage:
//   node scripts/check_artifact_fresh.js                  # build fresh, diff vs committed
//   node scripts/check_artifact_fresh.js --prebuilt-api=DIR --prebuilt-html=FILE
//   node scripts/check_artifact_fresh.js --committed-api=DIR --committed-html=FILE  # for fault-injection
// Exit 0 if committed == fresh (modulo build timestamps), 1 otherwise.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}

const committedApi = path.resolve(ROOT, flags['committed-api'] || 'api');
const committedHtml = path.resolve(ROOT, flags['committed-html'] || 'codex.html');

// Normalize build-timestamp fields that are NOT a function of source.
function normalizeJson(text) {
  return text.replace(/"generated":\s*"\d{4}-\d{2}-\d{2}"/g, '"generated":"<ts>"');
}
function listFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d)) {
      const p = path.join(d, e);
      if (fs.statSync(p).isDirectory()) walk(p);
      else out.push(path.relative(dir, p));
    }
  })(dir);
  return out.sort();
}
function readMaybe(p) {
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

// The discovery artifacts are committed and served, but until now nothing
// rebuilt them and nothing compared them — sitemap.xml could silently describe a
// catalog that no longer existed. They are cheap (they read the already-built
// api/ indexes), so they are always regenerated here from the fresh api/.
const DISCOVERY = ['sitemap.xml', 'llms.txt', 'robots.txt'];

function buildDiscovery(apiDir) {
  // --api AND --out both matter here. build_discovery.js defaults --api to the
  // COMMITTED api/, so passing only --out would derive the "fresh" sitemap from
  // the committed catalog — a gate that agrees with itself no matter what the
  // source says. Point both at the fresh tree.
  const outDir = path.dirname(apiDir);
  execFileSync(
    'node',
    [path.join('scripts', 'build_discovery.js'), `--api=${apiDir}`, `--out=${outDir}`],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] }
  );
  return outDir;
}

function buildFresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fresh-'));
  const apiDir = path.join(dir, 'api');
  const htmlFile = path.join(dir, 'codex.html');
  process.stderr.write('Building fresh api/ (this is the ~6-min full compile)…\n');
  execFileSync('node', [path.join('scripts', 'build_static_api.js'), `--out=${apiDir}`], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  process.stderr.write('Building fresh codex.html…\n');
  execFileSync('node', [path.join('scripts', 'build_html.js'), `--out=${htmlFile}`, '--quiet'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  return { apiDir, htmlFile };
}

const freshApi = flags['prebuilt-api'] ? path.resolve(ROOT, flags['prebuilt-api']) : null;
const freshHtml = flags['prebuilt-html'] ? path.resolve(ROOT, flags['prebuilt-html']) : null;
let fresh;
if (freshApi && freshHtml) fresh = { apiDir: freshApi, htmlFile: freshHtml };
else fresh = buildFresh();

const diffs = [];

// ---- api/ : compare the file SET and the (date-normalized) contents ----
const committedFiles = fs.existsSync(committedApi) ? listFiles(committedApi) : [];
const freshFiles = fs.existsSync(fresh.apiDir) ? listFiles(fresh.apiDir) : [];
const cSet = new Set(committedFiles),
  fSet = new Set(freshFiles);
for (const f of committedFiles)
  if (!fSet.has(f)) diffs.push(`api/${f}: in committed, NOT in fresh build (stale extra file)`);
for (const f of freshFiles)
  if (!cSet.has(f)) diffs.push(`api/${f}: in fresh build, MISSING from committed`);
for (const f of committedFiles) {
  if (!fSet.has(f)) continue;
  let a = readMaybe(path.join(committedApi, f));
  let b = readMaybe(path.join(fresh.apiDir, f));
  if (f.endsWith('.json')) {
    a = Buffer.from(normalizeJson(a.toString('utf8')));
    b = Buffer.from(normalizeJson(b.toString('utf8')));
  }
  if (!a.equals(b)) diffs.push(`api/${f}: committed != fresh build (content drift)`);
}

// ---- codex.html : deterministic, byte-for-byte ----
const ch = readMaybe(committedHtml);
const fh = readMaybe(fresh.htmlFile);
if (!ch) diffs.push('codex.html: committed copy missing');
else if (!fh) diffs.push('codex.html: fresh build missing');
else if (!ch.equals(fh))
  diffs.push(`codex.html: committed (${ch.length}B) != fresh build (${fh.length}B) — stale`);

// ---- sitemap.xml / llms.txt / robots.txt : deterministic, byte-for-byte ----
// These are derived from the api/ indexes, so they are regenerated from whichever
// api/ we just proved fresh. sitemap.xml carries no build timestamp any more, so
// nothing needs normalizing out — a diff here is a real drift.
const discoveryDir = buildDiscovery(fresh.apiDir);
for (const f of DISCOVERY) {
  const a = readMaybe(path.join(ROOT, f));
  const b = readMaybe(path.join(discoveryDir, f));
  if (!a) diffs.push(`${f}: committed copy missing`);
  else if (!b) diffs.push(`${f}: fresh build missing`);
  else if (!a.equals(b))
    diffs.push(`${f}: committed (${a.length}B) != fresh build (${b.length}B) — stale`);
}

// ---- report ----
console.log('=== Artifact reproducibility (committed == fresh build from source?) ===');
if (diffs.length === 0) {
  console.log(
    `PASS — committed api/ (${committedFiles.length} files) + codex.html + ${DISCOVERY.join(' / ')} ` +
      `are byte-identical to a fresh build (modulo build timestamps).`
  );
  console.log('       The published artifact is provably a function of the source.');
  process.exit(0);
}
console.error(`FAIL — ${diffs.length} file(s) drifted from a fresh build:`);
for (const d of diffs.slice(0, 40)) console.error(`  ✗ ${d}`);
if (diffs.length > 40) console.error(`  … and ${diffs.length - 40} more.`);
console.error(
  '\nRebuild and commit: `npm run build:api` (which also regenerates ' +
    DISCOVERY.join(' / ') +
    ') + `npm run build:html`, then commit the regenerated files.'
);
process.exit(1);
