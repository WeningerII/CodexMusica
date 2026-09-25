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
//   node scripts/build_html.js --check            # post-build: eval data block, assert no block is all-comment, assert <script> byte ceiling
//   node scripts/build_html.js --strict           # --validate + --check, both run
//   node scripts/build_html.js --quiet            # suppress per-source-file size summary
//   node scripts/build_html.js --no-minify        # skip minification (reading the artifact by hand; never used by CI or publish)
//
// EXIT CODES
//   0  success
//   2  missing required source (src/index.template.html or src/app.js)
//   4  embedded data block failed to parse, or a table did not read back (--check)
//   5  template is missing the <!--@CODEX_BODY--> or <!--@THEME_BOOT--> marker
//   6  an emitted <script> is all comment, or exceeds the hard byte ceiling (--check)

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
  '09_nav_glyphs.js',
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
const workbenchJs = fs.readFileSync(path.join(SRC, 'workbench.js'), 'utf8');
const workbenchCss = fs.readFileSync(path.join(SRC, 'workbench.css'), 'utf8');
// The four pages, in navigation order. Each registers itself with the shell
// (src/workbench.js) and owns only its own surface; docs/ui-foundation.md
// names the owner of every file. Page styles load after the shell's.
const PAGES = ['genre', 'instrument', 'map', 'lyrics'];
const pageFile = (name, ext) => fs.readFileSync(path.join(SRC, 'pages', name + ext), 'utf8');
const pagesJs = PAGES.map((p) => pageFile(p, '.js')).join('\n');
const pagesCss = PAGES.map((p) => pageFile(p, '.css')).join('\n');
const layoutJs = fs.readFileSync(path.join(SRC, 'layout.js'), 'utf8');
// The shared theme: tokens + components (loaded first, so everything after it
// may use them) and the preference boot, which runs in <head> before the
// first paint so the page never flashes in the wrong theme.
const themeCss = fs.readFileSync(path.join(SRC, 'theme.css'), 'utf8');
const themeJs = fs.readFileSync(path.join(SRC, 'theme.js'), 'utf8');
const THEME_BOOT_MARKER = '<!--@THEME_BOOT-->';
const layoutCss = fs.readFileSync(path.join(SRC, 'layout.css'), 'utf8');
if (!template.includes(THEME_BOOT_MARKER)) {
  console.error(`build_html: template is missing the ${THEME_BOOT_MARKER} marker — ${TEMPLATE}`);
  process.exit(5);
}
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

// Every piece of JavaScript this build emits goes through here. Options and the
// measurements behind them live in _minify.js; this file only decides WHAT is
// squeezed, never HOW.
//
// It is applied to the SOURCES, before they are wrapped in <script> tags, rather
// than to the finished HTML: a regex over the assembled page would have to trust
// that no string literal in a megabyte of catalog data contains `</script>`, and
// a parse failure there could only report an offset into the whole document
// instead of naming the file that broke.
//
// NOTE ON CHUNK SIZES. MAX_SCRIPT_CHARS budgets the split on the source, so
// after minification each emitted block lands ~14% under its budget rather than
// on it. That is left alone on purpose: the budget exists to stay below a
// renderer's parse-memory limit, and this only adds headroom. Retuning it would
// move every chunk boundary, which is a separate change with its own risk.
const { minifyJs } = require('./_minify.js');
// Escape hatch for reading the shipped artifact by hand. NOT used by CI and not
// used by sync-pages.yml, and it cannot leak into the committed page: that file
// is byte-compared against a default build by check_artifact_fresh.js, so an
// unminified codex.html fails the freshness gate on the next run.
const MINIFY = !flags['no-minify'];
const squeeze = (code, label) => (MINIFY ? minifyJs(code, label) : code);

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
    // The label comment is emitted OUTSIDE the minified body, so it survives:
    // the shipped page still says which source each block came from.
    dataParts.push(`<script>// ─── ${label} ───`);
    dataParts.push(squeeze(chunks[i].trimEnd(), label));
  }
}
// Instrument photographs: references/_image_manifest.json (openly licensed
// image links, produced by scripts/fetch_image_manifest.js) reduced to what the
// Instrument page shows — per instrument id the thumbnail, licence, credit and
// source page, as [thumb, licence, credit, sourcePage]. Low-confidence matches
// are left out: a photo of the wrong instrument under its name is worse than
// the glyph. No manifest yet: the constant is null and the page shows glyphs.
const IMAGE_MANIFEST = path.join(REFS, '_image_manifest.json');
function compactImageManifest() {
  if (!fs.existsSync(IMAGE_MANIFEST)) return null;
  const m = JSON.parse(fs.readFileSync(IMAGE_MANIFEST, 'utf8'));
  const out = {};
  for (const e of Array.isArray(m.images) ? m.images : []) {
    if (!e || e.kind !== 'instrument' || e.match_confidence === 'low') continue;
    const thumb = e.thumb_url || e.image_url;
    if (typeof e.id !== 'string' || typeof thumb !== 'string' || !/^https:\/\//.test(thumb))
      continue;
    out[e.id] = [thumb, e.license_raw || e.license || '', e.credit || '', e.source_page || ''];
  }
  const ids = Object.keys(out).sort();
  return {
    source: 'references/_image_manifest.json',
    instruments: Object.fromEntries(ids.map((id) => [id, out[id]])),
  };
}
const imageManifest = compactImageManifest();
dataParts.push(`</script>`);
dataParts.push(`<script>// ─── instrument images (references/_image_manifest.json) ───`);
dataParts.push(
  `const CODEX_IMAGE_MANIFEST = ${JSON.stringify(imageManifest).replace(/</g, '\\u003c')};`
);

// Open a final script tag — the family-parts merge + the app (src/app.js) write
// into this one. The template tail (after the marker) closes it with </script>.
dataParts.push(`</script>`);
dataParts.push(`<script>// ─── runtime ───`);
if (LAZY) {
  // The lazy-shell switch. src/app.js sees this const, skips the (absent)
  // embedded tables, and resolves its CATALOG_READY boot promise by fetching
  // `${CODEX_LAZY_API}browse.json` before any UI init runs.
  // Emitted verbatim, NOT through squeeze(). It is already one short line, so
  // there is nothing to save, and ui_reachability_check.js tells the lazy shell
  // from the embedded build by looking for this exact substring — keeping the
  // builder the only thing that spells it means no minifier setting can rewrite
  // the detector out from under that gate.
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
const html = template
  .replace(THEME_BOOT_MARKER, () => '<script>' + squeeze(themeJs, 'theme boot') + '</script>')
  .replace(
    '<!--@WORKBENCH_STYLE-->',
    () => themeCss + '\n' + workbenchCss + '\n' + pagesCss + '\n' + layoutCss
  )
  .replace(
    CODEX_BODY_MARKER,
    () =>
      // THE '\n' IS LOAD-BEARING, and it cost an afternoon to learn why.
      // dataBlock ends with the line `<script>// ─── runtime ───`, a label
      // comment with no terminator but the newline that used to follow it —
      // FAMILY_PARTS_MERGE_SNIPPET began with one. Minifying strips leading
      // whitespace, so the runtime arrived glued to the end of that `//` line
      // and the ENTIRE application was commented out. It failed silently in the
      // worst way available: the page still parsed, every <script> tag was
      // well-formed, the catalog tables still loaded, and only the app was gone.
      // Emit the separator here instead of inheriting it from whatever the first
      // snippet happens to start with.
      dataBlock +
      '\n' +
      squeeze(
        FAMILY_PARTS_MERGE_SNIPPET +
          CARD_DESCRIPTORS_SNIPPET +
          layoutJs +
          '\n' +
          appJs +
          '\n' +
          workbenchJs +
          '\n' +
          pagesJs,
        'runtime (merge + descriptors + app.js + workbench.js + pages)'
      )
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
  // marker lines to recover a pure-JS concatenation. What runs below is otherwise
  // the emitted bytes EXACTLY — minified, if this build minified — because the
  // point of this gate is to parse what ships, not a tidier cousin of it.
  const checkJs = dataBlock
    .split('\n')
    .filter((line) => line !== '</script>' && !line.startsWith('<script>'))
    .join('\n');
  const ctx = vm.createContext({});
  try {
    vm.runInContext(checkJs, ctx, { filename: 'data-block.js', timeout: 5000 });
  } catch (e) {
    console.error('check: FAIL — data block did not parse');
    console.error('  ' + e.message);
    process.exit(4);
  }
  // READING THE TABLES BACK. The data files declare with top-level `const`, which
  // in a vm context binds in the global LEXICAL environment and never becomes a
  // property of the sandbox object — so the values have to be fetched by
  // evaluating in the same context. A second script in one context sees the first
  // script's lexical bindings, which is what makes this work.
  //
  // It used to be done by rewriting `^const (\w+) =` to `globalThis.$1 =` before
  // running the block. That was a dependency on how the SOURCE happened to be
  // formatted — it needed every declaration to begin a line AND to put a space
  // before its `=` — and minified output has neither, so on 2026-09-14 the
  // rewrite began matching nothing. The failure was silent in the worst
  // direction: the block still parsed, so this gate still printed PASS, while
  // every count below vanished and the leak guard compared undefined against
  // undefined and waved through whatever it was handed. Evaluating in the context
  // has nothing to match and cannot come loose that way.
  const probe = (expr) => vm.runInContext(expr, ctx, { timeout: 5000 });
  const declared = (name) => probe(`typeof ${name} !== 'undefined'`);
  const countOf = (name) =>
    probe(`typeof ${name} === 'undefined' ? -1 : Array.isArray(${name}) ? ${name}.length : -1`);
  // In a lazy build the tradition tables must NOT be in the page — that
  // absence IS the property the build exists for. Leaking them (e.g. a
  // future edit to LAZY_OMIT) would silently re-ship the 3.7 MB embed.
  if (LAZY && (declared('TRADITIONS') || declared('TRADITION_EXTRAS'))) {
    console.error('check: FAIL — lazy build leaked embedded tradition tables into the page');
    process.exit(4);
  }
  // The reverse of the leak guard, and the assertion that would have caught the
  // silent rewrite above: an EMBEDDED build must be able to read its tables back,
  // and every build must be able to read the ones it always carries. A table that
  // reads as absent here is either missing from the page or unreadable by this
  // gate, and both are build failures.
  const REQUIRED = LAZY
    ? ['INSTRUMENTS', 'ROOMS', 'TUNINGS', 'CHAIN_ARCHETYPES', 'PREFACE_LEXICON']
    : ['TRADITIONS', 'INSTRUMENTS', 'ROOMS', 'TUNINGS', 'CHAIN_ARCHETYPES', 'PREFACE_LEXICON'];
  const unreadable = REQUIRED.filter((name) => countOf(name) <= 0);
  if (unreadable.length) {
    console.error(
      `check: FAIL — ${unreadable.join(', ')} did not read back from the emitted data block`
    );
    process.exit(4);
  }
  const checks = [];
  if (LAZY) checks.push(`mode:              lazy shell (traditions/extras via api/)`);
  const report = (label, name) => {
    const n = countOf(name);
    if (n >= 0) checks.push(`${(label + ':').padEnd(18)} ${n}`);
  };
  report('TRADITIONS', 'TRADITIONS');
  report('INSTRUMENTS', 'INSTRUMENTS');
  report('ROOMS', 'ROOMS');
  report('TUNINGS', 'TUNINGS');
  report('CHAIN_ARCHETYPES', 'CHAIN_ARCHETYPES');
  report('CHAIN_SECTIONS', 'CHAIN_SECTIONS');
  report('PROD_AESTHETICS', 'PRODUCTION_AESTHETICS');
  report('PREFACE_LEXICON', 'PREFACE_LEXICON');
  if (probe(`typeof TRADITION_EXTRAS === 'object' && TRADITION_EXTRAS !== null`)) {
    checks.push(`TRADITION_EXTRAS:  ${probe('Object.keys(TRADITION_EXTRAS).length')}`);
  }
  console.error('check: PASS — data block parses cleanly');
  for (const c of checks) console.error('    ' + c);

  // Hard byte-ceiling assertion. The chunker budgets in CHARS (a fast proxy);
  // this asserts the real contract on actual UTF-8 bytes, so multibyte-dense
  // data that inflates a chunk past the renderer's safe parse-memory limit
  // fails the build instead of shipping silently.
  const scriptBlocks = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];

  // NO EMITTED BLOCK MAY BE ALL COMMENT. This exists because on 2026-09-14 the
  // whole application shipped commented out: every block is introduced by a
  // `// ─── label ───` line, the minified runtime lost the newline that used to
  // separate it from that label, and `//` ate 766 KB of app in one bite. Nothing
  // upstream noticed — the page was well-formed, all 32 <script> tags parsed, the
  // catalog still loaded, and only the app was missing. Byte ceilings and parse
  // checks are both blind to it: commented-out code is perfectly valid and
  // perfectly sized.
  //
  // Minifying a block that is nothing but comments yields the empty string, so
  // that is the test — asked of the ASSEMBLED page, after every transformation,
  // rather than of any intermediate the builder still holds in a variable.
  //
  // SCOPED TO THE BLOCKS THIS BUILDER LABELS, which is exactly the set at risk:
  // a `// ─── … ───` line is the only comment here that ever sits directly above
  // injected source, so it is the only one that can swallow any. The template's
  // own <script> opens with a hand-written banner and carries the CODEX_BODY
  // marker, but the first thing substituted at that marker is a `</script>` —
  // the banner block is closed before a byte of source reaches it, and flagging
  // it would be flagging the template for containing a comment.
  const LABEL = /^\s*\/\/ ─── /;
  const hollow = [];
  for (const block of scriptBlocks) {
    const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    if (!LABEL.test(body)) continue;
    if (!minifyJs(body, 'emitted <script>').trim())
      hollow.push(body.trim().split('\n')[0].slice(0, 60));
  }
  if (hollow.length) {
    console.error(
      `check: FAIL — ${hollow.length} <script> block(s) contain no executable code:\n` +
        hollow.map((h) => `  ${h}`).join('\n') +
        '\n  A label comment with no newline after it swallows the block that follows.'
    );
    process.exit(6);
  }

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
