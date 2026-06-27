#!/usr/bin/env node
// build_html.js — assemble codex.html from src/ + references/*.js.
//
// codex.html is the shipped browser app. The DEFAULT build (since the lazy-load
// migration) is the LAZY SHELL: an HTML shell (src/index.template.html) with the
// non-tradition catalog data embedded as JS const declarations and the
// application code appended, while the two tradition tables (~66% of the
// embedded bytes) stay OUT of the page — the app's Catalog layer boots them from
// api/browse.json (one fetch) and pulls each tradition's import payload from
// api/traditions/{id}.json on demand. The shell therefore deploys NEXT TO the
// committed api/ directory (GitHub Pages serves both from the repo root).
// `--embedded` builds the historical fully-self-contained single-file variant
// (every table in the page; works from file:// with no api/). check_lazy_app.js
// gates the two variants to behave identically. This script:
//
//   1. Reads the HTML shell src/index.template.html, which contains a single
//      <!--@CODEX_BODY--> marker where everything dynamic is injected.
//   2. Reads references/*.js (the catalog data) and chunks each into its own
//      <script> tag (so the browser frees each AST during parse).
//   3. Inlines the family-parts merge from scripts/_merge.js.
//   4. Reads the application code src/app.js.
//   5. Replaces the marker with data + merge + app → codex.html.
//
// src/index.template.html and src/app.js are first-class source files; the data
// block is regenerated from references/*.js on every build.
//
// USAGE
//   node scripts/build_html.js                    # lazy shell (default) into OUTPUT_DIR (see _paths.js; CODEX_OUT_DIR overrides)
//   node scripts/build_html.js --out=path.html    # custom output path
//   node scripts/build_html.js --embedded         # fully-embedded single-file variant (all tables in the page; no api/ needed)
//   node scripts/build_html.js --lazy             # explicit lazy shell (same as the default; kept for back-compat)
//   node scripts/build_html.js --validate         # run validate.js first; abort on failure
//   node scripts/build_html.js --check            # post-build: eval data block + assert <script> byte ceiling
//   node scripts/build_html.js --strict           # --validate + --check, both run
//   node scripts/build_html.js --quiet            # suppress per-source-file size summary
//
// EXIT CODES
//   0  success
//   2  missing required source (src/index.template.html or src/app.js)
//   4  embedded data block failed to parse (--check)
//   5  template is missing the <!--@CODEX_BODY--> marker
//   6  an emitted <script> exceeds the hard byte ceiling (--check)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');

const SKILL_ROOT = path.join(__dirname, '..');
const REFS = path.join(SKILL_ROOT, 'references');
const SRC = path.join(SKILL_ROOT, 'src');
const TEMPLATE = path.join(SRC, 'index.template.html');
const APP = path.join(SRC, 'app.js');
const CODEX_BODY_MARKER = '<!--@CODEX_BODY-->';
const { HTML_OUT: DEFAULT_OUTPUT } = require('./_paths.js');

// Source files in their declaration order — the embedded const declarations
// must appear in the same order they did in the original HTML to keep any
// downstream lookup-by-position assumptions intact.
const SOURCE_FILES = [
  '01_family_parts.js',
  '02_instruments.js',
  '03_rooms_chains_tunings.js',
  '04_tree.js',
  '05_traditions.js',
  '06_extras.js',
  '07_preface_lexicon.js',
  '08_asset_manifest.js',
];

// ──────────────────────────── argv ────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    }
  }
}

const outputPath = flags.out || DEFAULT_OUTPUT;

// Mode switch — the lazy shell is the DEFAULT. The two tradition tables —
// 65%+ of the embedded data — stay OUT of the page; the app's Catalog layer
// boots them from api/browse.json (one fetch) and pulls each tradition's
// import payload from api/traditions/{id}.json on demand. The injected
// CODEX_LAZY_API const is the switch src/app.js keys off. `--embedded` opts
// into the fully-embedded single-file build (all tables in the page; the
// node/jsdom parity harnesses build it, and it still works from file://).
// `--lazy` stays accepted as an explicit opt-in for pre-flip invocations.
if (flags.embedded && flags.lazy) {
  console.error('build_html: --embedded and --lazy are mutually exclusive');
  process.exit(2);
}
const LAZY = !flags.embedded;
const LAZY_OMIT = new Set(['05_traditions.js', '06_extras.js']);

// ─────────────────────── templates are required source ───────────────────────
// The HTML template and the app are first-class source files under src/. They
// must exist; this script never reconstructs them from a build output.

if (!fs.existsSync(TEMPLATE) || !fs.existsSync(APP)) {
  console.error('Missing source:');
  if (!fs.existsSync(TEMPLATE)) console.error(`  ${TEMPLATE}`);
  if (!fs.existsSync(APP)) console.error(`  ${APP}`);
  process.exit(2);
}

// ──────────────────────────── pre-build: --validate ────────────────────────────
// When --validate or --strict is set, run validate.js synchronously and abort the
// build on any failure. Without this gate, a broken catalog can silently produce
// a broken HTML — and the failure mode (open the file in a browser, see a JS
// syntax error in devtools) is far worse than a fast pre-build abort.

const runValidate = flags.validate || flags.strict;
if (runValidate) {
  try {
    const out = execSync('node ' + path.join(__dirname, 'validate.js'), { encoding: 'utf8' });
    if (!flags.quiet) console.error('validate: PASS — ' + out.trim().split('\n').pop());
  } catch (e) {
    console.error('validate: FAIL — aborting build');
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(3);
  }
}

// ──────────────────────────── build ────────────────────────────

const template = fs.readFileSync(TEMPLATE, 'utf8');
const appJs = fs.readFileSync(APP, 'utf8');
if (!template.includes(CODEX_BODY_MARKER)) {
  console.error(`build_html: template is missing the ${CODEX_BODY_MARKER} marker — ${TEMPLATE}`);
  process.exit(5);
}

// Read each source file. Each gets wrapped in its own <script> tag so the
// browser parses, evaluates, and frees the AST per file — instead of holding
// the entire 5+ MB AST in memory for one monolithic parse. This is what
// unblocks the Claude app's renderer (which was getting OOM-killed during
// the single giant parse). Variables declared with `const` at the top level
// of one classic <script> tag are reachable from later <script> tags in the
// same page since they all share the document's global script scope.
//
// Files that exceed MAX_SCRIPT_BYTES are split further at element boundaries
// via _split_data.js: array declarations split into `const X = []; X.push(...)`
// segments; object declarations split into `const X = {}; Object.assign(X, ...)`.
const { splitFileIntoChunks } = require('./_split_data.js');
const MAX_SCRIPT_CHARS = 600 * 1024; // per-<script> chunk budget (UTF-16 chars; a fast proxy)
const MAX_SCRIPT_BYTES = 1024 * 1024; // hard ceiling on actual emitted UTF-8 bytes, enforced by --check

const dataParts = [];
const sourceSizes = [];
for (const f of SOURCE_FILES) {
  if (LAZY && LAZY_OMIT.has(f)) continue;
  const p = path.join(REFS, f);
  const content = fs.readFileSync(p, 'utf8');
  sourceSizes.push({ name: f, bytes: content.length });

  const chunks = splitFileIntoChunks(content, MAX_SCRIPT_CHARS);
  for (let i = 0; i < chunks.length; i++) {
    if (!chunks[i].trim()) continue; // skip empty splits
    const label = chunks.length === 1 ? f : `${f} [${i + 1}/${chunks.length}]`;
    dataParts.push(`</script>`);
    dataParts.push(`<script>// ─── ${label} ───`);
    dataParts.push(chunks[i].trimEnd());
  }
}
// Open a final script tag — the family-parts merge + the app (src/app.js) write
// into this one. The template tail (after the marker) closes it with </script>.
dataParts.push(`</script>`);
dataParts.push(`<script>// ─── runtime ───`);
if (LAZY) {
  // The lazy-shell switch. src/app.js sees this const, skips the (absent)
  // embedded tables, and resolves its CATALOG_READY boot promise by fetching
  // `${CODEX_LAZY_API}browse.json` before any UI init runs.
  dataParts.push(`const CODEX_LAZY_API = 'api/';`);
}
const dataBlock = dataParts.join('\n');

// In-page family-parts merge — inlined from the single source scripts/_merge.js
// so the browser app computes exactly the same inst.parts as the loader. The
// region between the @inline markers in _merge.js is the only copy of this
// algorithm; this build extracts and inlines it verbatim.
const mergeSource = fs.readFileSync(path.join(__dirname, '_merge.js'), 'utf8');
const mergeMatch = mergeSource.match(
  /\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//
);
if (!mergeMatch) {
  console.error(
    'build_html: could not find @inline-start/@inline-end markers in scripts/_merge.js'
  );
  process.exit(5);
}
const FAMILY_PARTS_MERGE_SNIPPET = `
// ─────────── In-page family-parts merge — single source: scripts/_merge.js ───────────
${mergeMatch[1]}
if (typeof INSTRUMENT_FAMILY_PARTS !== 'undefined') mergeFamilyParts(INSTRUMENTS, INSTRUMENT_FAMILY_PARTS);
`;

// In-page card-descriptor harvester — inlined from the single source
// scripts/_card_descriptors.js so the browser's _cardDescriptorSet computes
// exactly the same descriptor set the Node preface pipeline does. The region
// between the @inline markers is the only copy of this algorithm.
const cdSource = fs.readFileSync(path.join(__dirname, '_card_descriptors.js'), 'utf8');
const cdMatch = cdSource.match(/\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//);
if (!cdMatch) {
  console.error(
    'build_html: could not find @inline-start/@inline-end markers in scripts/_card_descriptors.js'
  );
  process.exit(5);
}
const CARD_DESCRIPTORS_SNIPPET = `
// ─────────── In-page card-descriptor harvester — single source: scripts/_card_descriptors.js ───────────
${cdMatch[1]}
// Browser adapter: feed harvestDescriptors the app's index-map lookups so the
// inlined core needs no knowledge of how the app stores the catalog.
function _cardDescriptorSet(card) {
  return harvestDescriptors(card, {
    inst: (id) => Inst(id),
    tuning: (id) => Tuning(id),
    room: (id) => Room(id),
    chainItem: (stageId, id) => ChainItem(stageId, id),
    signature: (tradId) => _traditionSignatureFor(tradId),
  });
}
`;

// Function replacement: the injected data/app contains `$` sequences
// (template literals, regex) that String.replace would special-case — a
// function replacement returns the string verbatim.
const html = template.replace(
  CODEX_BODY_MARKER,
  () => dataBlock + FAMILY_PARTS_MERGE_SNIPPET + CARD_DESCRIPTORS_SNIPPET + appJs
);

// Write
const outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, html);

console.error(`Built ${outputPath} (${html.length.toLocaleString()} bytes)`);

// The committed artifact lives at the repo root (that's what Pages serves and the
// freshness gate checks). _paths.js defaults the output to a sandbox/temp dir, so a
// bare `build:html` does NOT update ./codex.html. Warn the interactive dev; CI runs
// the bare build only as a syntax/leak check, so stay quiet there.
{
  const repoHtml = path.join(SKILL_ROOT, 'codex.html');
  if (!process.env.CI && path.resolve(outputPath) !== path.resolve(repoHtml)) {
    console.error(
      'note: that is the resolved output dir, not the committed ./codex.html — that file is unchanged.\n' +
        '      to update it: CODEX_OUT_DIR="$(pwd)" node scripts/build_html.js   (or --out=codex.html)'
    );
  }
}

// ──────────────────────────── build summary ────────────────────────────
// Per-source byte counts. Helpful for noticing when a source file shrank or grew
// unexpectedly between builds. Skipped under --quiet.

if (!flags.quiet) {
  const totalData = sourceSizes.reduce((s, x) => s + x.bytes, 0);
  console.error('  data block:');
  for (const s of sourceSizes) {
    const pct = ((s.bytes / totalData) * 100).toFixed(1);
    console.error(
      '    ' +
        s.name.padEnd(28) +
        s.bytes.toLocaleString().padStart(10) +
        '  ' +
        pct.padStart(4) +
        '%'
    );
  }
  console.error('    ' + '(data total)'.padEnd(28) + totalData.toLocaleString().padStart(10));
}

// ──────────────────────────── post-build: --check ────────────────────────────
// Eval the embedded data block in a sandbox to confirm syntactic integrity.
// Catches: missing brackets/braces, malformed object literals, accidental
// duplicate-declaration via `const` collision, unreachable code paths inside
// the data files. Reports concrete catalog sizes (traditions, instruments,
// preface lexicon entries) so the operator can eyeball expected vs actual.

const runCheck = flags.check || flags.strict;
if (runCheck) {
  // The assembled dataBlock interleaves literal </script>/<script> markers (the
  // per-file tag splitting that fixes the renderer OOM). Those are HTML, not JS,
  // so eval-ing dataBlock verbatim always throws "Unexpected token '<'". Strip the
  // marker lines to recover a pure-JS concatenation. Additionally, the data files
  // declare tables with top-level `const`, which in a vm context do NOT attach to
  // the sandbox global — promote `const X =` to `globalThis.X =` (mirrors
  // _loader.js) so the post-eval size assertions can actually read the tables.
  const checkJs = dataBlock
    .split('\n')
    .filter((line) => line !== '</script>' && !line.startsWith('<script>'))
    .join('\n')
    .replace(/^const (\w+) =/gm, 'globalThis.$1 =');
  const sandbox = {};
  const ctx = vm.createContext(sandbox);
  try {
    vm.runInContext(checkJs, ctx, { filename: 'data-block.js', timeout: 5000 });
  } catch (e) {
    console.error('check: FAIL — data block did not parse');
    console.error('  ' + e.message);
    process.exit(4);
  }
  // In a lazy build the tradition tables must NOT be in the page — that
  // absence IS the property the build exists for. Leaking them (e.g. a
  // future edit to LAZY_OMIT) would silently re-ship the 3.7 MB embed.
  if (LAZY && (sandbox.TRADITIONS !== undefined || sandbox.TRADITION_EXTRAS !== undefined)) {
    console.error('check: FAIL — lazy build leaked embedded tradition tables into the page');
    process.exit(4);
  }
  const checks = [];
  if (LAZY) checks.push(`mode:              lazy shell (traditions/extras via api/)`);
  if (Array.isArray(sandbox.TRADITIONS))
    checks.push(`TRADITIONS:        ${sandbox.TRADITIONS.length}`);
  if (Array.isArray(sandbox.INSTRUMENTS))
    checks.push(`INSTRUMENTS:       ${sandbox.INSTRUMENTS.length}`);
  if (Array.isArray(sandbox.ROOMS)) checks.push(`ROOMS:             ${sandbox.ROOMS.length}`);
  if (Array.isArray(sandbox.TUNINGS)) checks.push(`TUNINGS:           ${sandbox.TUNINGS.length}`);
  if (Array.isArray(sandbox.CHAIN_ARCHETYPES))
    checks.push(`CHAIN_ARCHETYPES:  ${sandbox.CHAIN_ARCHETYPES.length}`);
  if (Array.isArray(sandbox.CHAIN_SECTIONS))
    checks.push(`CHAIN_SECTIONS:    ${sandbox.CHAIN_SECTIONS.length}`);
  if (Array.isArray(sandbox.PRODUCTION_AESTHETICS))
    checks.push(`PROD_AESTHETICS:   ${sandbox.PRODUCTION_AESTHETICS.length}`);
  if (Array.isArray(sandbox.PREFACE_LEXICON))
    checks.push(`PREFACE_LEXICON:   ${sandbox.PREFACE_LEXICON.length}`);
  if (sandbox.TRADITION_EXTRAS && typeof sandbox.TRADITION_EXTRAS === 'object') {
    checks.push(`TRADITION_EXTRAS:  ${Object.keys(sandbox.TRADITION_EXTRAS).length}`);
  }
  console.error('check: PASS — data block parses cleanly');
  for (const c of checks) console.error('    ' + c);

  // Hard byte-ceiling assertion. The chunker budgets in CHARS (a fast proxy);
  // this asserts the real contract on actual UTF-8 bytes, so multibyte-dense
  // data that inflates a chunk past the renderer's safe parse-memory limit
  // fails the build instead of shipping silently.
  const scriptBlocks = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  let maxScriptBytes = 0;
  let overCeiling = 0;
  for (const block of scriptBlocks) {
    const bytes = Buffer.byteLength(block, 'utf8');
    if (bytes > maxScriptBytes) maxScriptBytes = bytes;
    if (bytes > MAX_SCRIPT_BYTES) overCeiling++;
  }
  console.error(
    `check: ${overCeiling === 0 ? 'PASS' : 'FAIL'} — largest <script> ${(maxScriptBytes / 1024).toFixed(0)} KiB ` +
      `of ${scriptBlocks.length} blocks (ceiling ${(MAX_SCRIPT_BYTES / 1024).toFixed(0)} KiB)`
  );
  if (overCeiling > 0) {
    console.error(
      `  ${overCeiling} <script> block(s) exceed the byte ceiling — lower MAX_SCRIPT_CHARS in build_html.js`
    );
    process.exit(6);
  }
}
