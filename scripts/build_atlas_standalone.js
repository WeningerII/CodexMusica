#!/usr/bin/env node
// build_atlas_standalone.js — the Traditions Atlas as one self-contained file.
//
// WHY
// atlas.html loads nine sidecars over the network. A published Artifact runs
// under a CSP that blocks fetch entirely, so the page would render a blank map
// there. This build inlines every sidecar — plus the lineage prose and recipe
// for all 2503 traditions, which the live page fetches per pin — onto
// window.__ATLAS_DATA__, and src/atlas.js reads from that when it is present.
//
// The point is that it is the SAME src/atlas.js. The standalone build is a
// packaging step, not a second implementation that can drift from the real one.
//
// Reads:  atlas.html, src/atlas.js, data/*.json, api/all.json,
//         api/traditions/*.json (lineage), references/_tradition_signatures.json
// Writes: the path given by --out (required)
//
// Usage:
//   node scripts/build_atlas_standalone.js --out=/tmp/atlas.html
//   node scripts/build_atlas_standalone.js --out=x.html --artifact
//
// --artifact emits Artifact-shaped output: no doctype/html/head/body wrapper
// (the host supplies those), and absolute links back to the live site, since a
// published page has no codex.html or api/ next to it.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIVE = 'https://weningerii.github.io/CodexMusica/';

const flags = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
if (!flags.out) {
  console.error('build_atlas_standalone: --out=<path> is required');
  process.exit(2);
}

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// ── the payload ──
const all = readJson('api/all.json');

// Only what src/atlas.js actually reads: id and name for the pins, lineage and
// recipe for the detail card. Shipping api/all.json whole would carry per-item
// fields the atlas never touches.
const index = { items: all.items.map((t) => ({ id: t.id, name: t.name })) };
const detail = {};
for (const t of all.items) {
  let lineage = '';
  try {
    lineage =
      JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'traditions', t.id + '.json'), 'utf8'))
        .lineage || '';
  } catch {
    /* a tradition with no per-file entry simply has no prose */
  }
  detail[t.id] = [lineage, t.recipe || ''];
}

// The footer reads only two lengths off geo-meta.json, and the reviewed list is
// 2,503 ids — 42KB of every published artifact spent on a number. Send the
// counts; src/atlas.js takes either shape.
function metaCounts() {
  const meta = readJson('data/geo-meta.json');
  const out = {};
  for (const k of Object.keys(meta)) out[k] = Array.isArray(meta[k]) ? meta[k].length : meta[k];
  return out;
}

const payload = {
  index,
  geo: readJson('data/atlas-geo.json'),
  sigs: readJson('references/_tradition_signatures.json'),
  world: readJson('data/countries.geo.json'),
  treeMap: readJson('data/tree-map.json'),
  nodes: readJson('data/tree-nodes.json'),
  routes: readJson('data/routes.json'),
  threads: readJson('data/threads.json'),
  meta: metaCounts(),
  detail,
  codexUrl: flags.artifact ? LIVE + 'codex.html' : 'codex.html',
};

// ── the page ──
const html = fs.readFileSync(path.join(ROOT, 'atlas.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'src', 'atlas.js'), 'utf8');

// `</script>` inside a JSON string would close the tag early; the JSON-escaped
// form parses identically. U+2028/9 are literal line terminators in JS source.
const safeJson = JSON.stringify(payload)
  .replace(/<\//g, '<\\/')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const between = (open, close) => {
  const i = html.indexOf(open);
  const j = html.indexOf(close, i);
  if (i < 0 || j < 0) throw new Error('atlas.html: could not find ' + open);
  return html.slice(i, j + close.length);
};

const styleBlock = between('<style>', '</style>');
const fontLink = html.match(/<link\s+href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
let bodyInner = html
  .slice(html.indexOf('<div class="shell">'), html.indexOf('<script src="src/atlas.js">'))
  .replace(/\s*$/, '');
// A published page has no codex.html or api/ beside it, so in-page links to the
// app and the raw catalog have to point back at the live site.
if (flags.artifact) {
  bodyInner = bodyInner
    .replace(
      /href="\.\/codex\.html"/g,
      'href="' + LIVE + 'codex.html" target="_blank" rel="noopener"'
    )
    .replace(
      /href="\.?\/?api\/all\.json"/g,
      'href="' + LIVE + 'api/all.json" target="_blank" rel="noopener"'
    );
}

let out;
if (flags.artifact) {
  // The host wraps this in doctype/head/body, so emit content only. The atlas
  // fills the frame; the shell is already height:100vh.
  out =
    '<title>Traditions Atlas</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    fontLink +
    '\n' +
    styleBlock +
    '\n' +
    bodyInner +
    '\n<script>window.__ATLAS_DATA__=' +
    safeJson +
    ';</script>\n<script>\n' +
    appJs +
    '\n</script>\n';
} else {
  out = html
    .replace(
      '<script src="src/atlas.js"></script>',
      '<script>window.__ATLAS_DATA__=' +
        safeJson +
        ';</script>\n    <script>\n' +
        appJs +
        '\n    </script>'
    )
    .replace(/href="\.\/codex\.html"/g, 'href="' + LIVE + 'codex.html"');
}

fs.writeFileSync(flags.out, out);
console.log(
  'build_atlas_standalone: wrote ' +
    flags.out +
    ' — ' +
    (Buffer.byteLength(out) / 1048576).toFixed(2) +
    ' MB, ' +
    all.items.length +
    ' traditions inlined' +
    (flags.artifact ? ' (artifact-shaped)' : '')
);
