#!/usr/bin/env node
// check_payload_budget.js — what the lazy page costs to download, held to four
// gzip budgets.
//
// Step 9 took the instrument engine out of the lazy codex.html: the page went
// from 1,155,985 B gzipped to 497,816, and the engine tables became one
// internal file, api/engine.json, asked for at the first paint (from <head>
// when a saved session needs it to draw). Nothing else holds the page to that
// size. build_html --check caps each <script> block at the renderer's 1 MiB
// parse ceiling and proves the engine slots are empty, and check_lazy_app
// proves the first view makes no engine accessor read; all of it passes on a
// page that has regrown by hundreds of kilobytes of something else: the glyph
// artwork or the photo table back inline, a new runtime module, a comment.
// This gate measures the bytes themselves.
//
// THE FOUR BUDGETS, in bytes after Node zlib level 6 (gzip -6: zlib's default
// level, and the one the step-9 measurements were taken at). What a host sends
// depends on its own compressor, so these are a fixed yardstick, not a
// transfer size.
//
//   page         codex.html                                  <= 573,440 (560 KiB)
//   critical     codex.html + api/browse_boot.json            <= 778,240 (760 KiB)
//                — the two transfers the first view waits for, each gzipped
//                on its own, as each is served
//   inline-data  every labelled data <script> block of the    <= 143,360 (140 KiB)
//                page, concatenated: each block whose
//                `// ─── label ───` does not start with `runtime: ` (the
//                references tables the page still carries, and the engine
//                block's slots and INSTRUMENT_INDEX). The template's own
//                unlabelled blocks and the runtime modules are not data.
//   engine       api/engine.json                              <= 778,240 (760 KiB)
//                — not on the first view's path, but a restored session's
//                first draw and every action that creates a card wait for it
//                (Engine in src/app.js)
//
// WHERE THE NUMBERS CAME FROM. Each limit is the step-9 prototype's figure
// (2026-10-06: page 496,286, critical 731,824, inline-data 106,721, engine
// 713,289) plus headroom, rounded up to a multiple of 20 KiB. Step 9 as built
// measures page 497,816, critical 733,354, inline-data 106,770, engine 653,116.
// The page's 75,624 B of headroom is less than either table the lazy page
// fetches instead of carrying would add back (api/instrument_images.json is
// 93,173 B gzipped, api/nav_glyphs.json 264,619). The step-8 page, with the
// engine inline, measures 1,155,985 / 1,391,523 / 769,171 and has no engine
// file; it fails here, and must.
//
// RAISING A BUDGET NEEDS A CITED LIGHTHOUSE RUN. A limit here moves up only in
// a commit that cites, beside the new number, a Lighthouse mobile run of the
// page at its new size, taken as the step-9 prototype's were: the Lighthouse
// version, n >= 5 interleaved runs reported as medians, and the step-8 head
// and a never-boots control in the same session. Step 9's reference point:
// Lighthouse 13.5 mobile, simulated throttling, against a local gzip-6 server,
// medians of 5, the 497,816 B page above: FCP 3.11 s, LCP 4.73 s, TBT 1.28 s,
// TTI 5.62 s, score 0.53. A bigger number with no run behind it is how a
// budget stops being one. Lowering a limit needs nothing.
//
// THE SHAPE COMES FIRST. The budgets describe the lazy shell with its engine
// block, so they are refused, with exit 2, for any other page: one without the
// builder's `const CODEX_LAZY_API = '…'` switch (an embedded build), one whose
// labelled data blocks declare no `function CODEX_ENGINE_COMMIT` (the engine
// tables are inline again, or the page predates step 9), or a pair missing
// api/browse_boot.json or api/engine.json. The measurements still print, so a
// refusal says how far off the page is.
//
// OVER BUDGET, each budget over is listed with the five largest pieces behind
// it, each gzipped on its own: <script> blocks by label for the page (and the
// markup outside them, template and comments, as one piece), plus the boot
// index for critical; data blocks for inline-data; lines of api/engine.json,
// one engine element each, for engine.
//
// No promise is registered for this budget, so this gate carries no coverage
// tag (check_promises.js holds those to a bijection). It runs in test:serial
// after test:lazy, on the committed pair, and in CI's freshness job on the
// fresh build.
//
// Usage:
//   node scripts/check_payload_budget.js                     # codex.html + api/ of this tree
//   node scripts/check_payload_budget.js --html=FILE         # api/ beside FILE, as the page fetches it
//   node scripts/check_payload_budget.js --html=FILE --api=DIR
// Relative paths resolve against the repository root.
// Exit 0 within every budget; 1 if any budget is over; 2 if the page is not the
// lazy shell carrying the engine block, or a file the budgets read is missing;
// 3 on a flag this script does not take.

'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

// Raising one of these needs a cited Lighthouse run: see the header.
const BUDGETS = {
  page: 573440,
  critical: 778240,
  'inline-data': 143360,
  engine: 778240,
};
const TOP = 5;

// ──────────────────────────── argv ────────────────────────────
const KNOWN_FLAGS = new Set(['html', 'api']);
const flags = {};
const refused = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)=(.+)$/);
  if (m && KNOWN_FLAGS.has(m[1])) flags[m[1]] = m[2];
  else refused.push(a);
}
if (refused.length) {
  for (const a of refused)
    console.error(`check_payload_budget: "${a}" is not a flag of this script`);
  console.error('  flags: --html=FILE --api=DIR (see the header)');
  process.exit(3);
}

const gz = (bytes) => zlib.gzipSync(bytes, { level: 6 }).length;
const n = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const shown = (p) => {
  const rel = path.relative(ROOT, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : p;
};

const htmlPath = path.resolve(ROOT, flags.html || 'codex.html');
if (!fs.existsSync(htmlPath)) {
  console.error(`check_payload_budget: FAIL — no page at ${shown(htmlPath)}`);
  process.exit(2);
}
const pageBuf = fs.readFileSync(htmlPath);
const html = pageBuf.toString('utf8');

// ──────────────────────────── the page's blocks ────────────────────────────
// Read as build_html --check reads them: every <script>…</script>, its label
// the `// ─── label ───` line the builder opens each block with.
const LABEL = /^\s*\/\/ ─── (.*?) ───/;
const blocks = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((m) => {
  const block = m[0];
  const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
  const label = body.match(LABEL);
  return {
    block,
    at: m.index,
    body,
    labeled: !!label,
    name: label ? label[1] : '(unlabelled) ' + body.trim().split('\n')[0].slice(0, 50),
  };
});
const isRuntime = (b) => b.labeled && b.name.startsWith('runtime: ');
const dataBlocks = blocks.filter((b) => b.labeled && !isRuntime(b));
// The lazy switch is spelled by the builder alone and emitted verbatim, never
// minified (build_html.js), which is why ui_reachability_check.js and tandem.js
// key off the same substring. Its value is where the page fetches api/ from.
const lazySwitch = blocks
  .filter(isRuntime)
  .map((b) => b.body.match(/\bconst CODEX_LAZY_API = '([^']*)';/))
  .find(Boolean);
// The engine block declares CODEX_ENGINE_COMMIT. src/app.js only CALLS it, so
// the declaration is looked for in the data blocks, where only the builder's
// engine block can put it.
const engineBlock = dataBlocks.find((b) => /\bfunction\s+CODEX_ENGINE_COMMIT\s*\(/.test(b.body));

const apiDir = flags.api
  ? path.resolve(ROOT, flags.api)
  : path.resolve(path.dirname(htmlPath), lazySwitch ? lazySwitch[1] : 'api');
const bootPath = path.join(apiDir, 'browse_boot.json');
const enginePath = path.join(apiDir, 'engine.json');
const bootBuf = fs.existsSync(bootPath) ? fs.readFileSync(bootPath) : null;
const engineBuf = fs.existsSync(enginePath) ? fs.readFileSync(enginePath) : null;

// ──────────────────────────── the pieces behind each budget ────────────────────────────
const piece = (name, text) => {
  const bytes = Buffer.from(text, 'utf8');
  return { name, raw: bytes.length, gzip: gz(bytes) };
};
// Everything between the <script> blocks: the template's markup and styles,
// and any HTML comment, as one piece.
let outside = '';
let from = 0;
for (const b of blocks) {
  outside += html.slice(from, b.at);
  from = b.at + b.block.length;
}
outside += html.slice(from);
const pagePieces = () => [
  ...blocks.map((b) => piece(b.name, b.block)),
  piece('(markup outside <script>: template, styles, comments)', outside),
];
// One engine element per line: `["TABLE", value]`, INSTRUMENTS in runs of
// several lines (scripts/_page_tables.js, engineText).
const enginePieces = () => {
  const lines = engineBuf.toString('utf8').split('\n');
  const tableOf = (line) => (line.match(/^\["([A-Z_][A-Z0-9_]*)"/) || [])[1];
  const total = {};
  for (const line of lines)
    if (tableOf(line)) total[tableOf(line)] = (total[tableOf(line)] || 0) + 1;
  const seen = {};
  return lines.map((line, i) => {
    const table = tableOf(line);
    if (!table) return piece(`api/engine.json line ${i + 1}`, line);
    seen[table] = (seen[table] || 0) + 1;
    const run = total[table] > 1 ? ` [${seen[table]}/${total[table]}]` : '';
    return piece(`api/engine.json line ${i + 1}: ${table}${run}`, line);
  });
};

const dataText = dataBlocks.map((b) => b.body + '\n').join('');
const pageGzip = gz(pageBuf);
const measured = [
  { id: 'page', gzip: pageGzip, what: shown(htmlPath), pieces: pagePieces },
  {
    id: 'critical',
    gzip: bootBuf ? pageGzip + gz(bootBuf) : null,
    what: `${shown(htmlPath)} + ${shown(bootPath)}`,
    pieces: () => [...pagePieces(), piece(shown(bootPath), bootBuf.toString('utf8'))],
  },
  {
    id: 'inline-data',
    gzip: gz(Buffer.from(dataText, 'utf8')),
    what: `${dataBlocks.length} labelled data <script> blocks, concatenated`,
    pieces: () => dataBlocks.map((b) => piece(b.name, b.body)),
  },
  {
    id: 'engine',
    gzip: engineBuf ? gz(engineBuf) : null,
    what: shown(enginePath),
    pieces: enginePieces,
  },
];

// ──────────────────────────── report ────────────────────────────
console.log(`check_payload_budget — bytes after gzip -6 (Node zlib level 6)`);
console.log(`  ${'budget'.padEnd(12)} ${'gzip'.padStart(11)}  ${'limit'.padStart(9)}`);
for (const m of measured) {
  const limit = BUDGETS[m.id];
  const verdict =
    m.gzip === null
      ? 'absent'
      : m.gzip > limit
        ? `OVER by ${n(m.gzip - limit)}`
        : `${Math.round((m.gzip / limit) * 100)}%`;
  console.log(
    `  ${m.id.padEnd(12)} ${(m.gzip === null ? '—' : n(m.gzip)).padStart(11)}  ${n(limit).padStart(9)}  ${verdict.padEnd(18)} ${m.what}`
  );
}

const shape = [];
if (!lazySwitch)
  shape.push(
    "no `const CODEX_LAZY_API = '…'` in a runtime block: this is not the lazy shell (an embedded build?)"
  );
if (!engineBlock)
  shape.push(
    'no labelled data block declares `function CODEX_ENGINE_COMMIT`: the engine tables are inline, or the page predates the engine block'
  );
if (!bootBuf) shape.push(`${shown(bootPath)} is absent`);
if (!engineBuf) shape.push(`${shown(enginePath)} is absent`);
if (shape.length) {
  console.error(
    `check_payload_budget: FAIL — ${shown(htmlPath)} with ${shown(apiDir)} is not the lazy shell carrying the instrument-engine block, so these budgets do not apply to it:`
  );
  for (const s of shape) console.error(`  ✗ ${s}`);
  process.exit(2);
}

const over = measured.filter((m) => m.gzip > BUDGETS[m.id]);
if (over.length) {
  console.error(
    `check_payload_budget: FAIL — ${over.length} budget(s) over. Raising one needs a cited Lighthouse run (see the header).`
  );
  for (const m of over) {
    console.error(
      `  ✗ ${m.id}: ${n(m.gzip)} B gzip, over its ${n(BUDGETS[m.id])} B by ${n(m.gzip - BUDGETS[m.id])} B (${m.what}). Its ${TOP} largest pieces, each gzipped alone:`
    );
    for (const p of m
      .pieces()
      .sort((a, b) => b.gzip - a.gzip)
      .slice(0, TOP))
      console.error(
        `      ${n(p.gzip).padStart(9)} B gzip  ${n(p.raw).padStart(11)} B raw  ${p.name.slice(0, 90)}`
      );
  }
  process.exit(1);
}
console.log(`check_payload_budget: PASS — all ${measured.length} budgets hold`);
