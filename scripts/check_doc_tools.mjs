#!/usr/bin/env node
// check_doc_tools.mjs — every document that lists the connector's tools lists
// the tools the connector actually serves.
//
// WHY. Each of these lists was typed by hand and each froze on a different day:
// AGENTS.md named 9 tools, docs/connector.md 16 (no lyric_revise), mcp/README.md
// 17, the directory submission "All 14", while /mcp served 21 — and every doc
// gate stayed green, because none of them read a tool list. This gate builds the
// shared /mcp surface from the tree (the same builder release verification uses)
// and checks, for each listing document:
//
//   missing   a served tool the document never names. The failure.
//   unknown   a `lyric_*` name, or a row in a tool table, naming no served
//             tool. The failure.
//   count     a "serves N tools" sentence whose N is not the served count.
//
// A document is checked only where it lists tools; prose elsewhere is free.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { expectedSharedSurface } = await import(
  pathToFileURL(path.join(ROOT, 'mcp', 'workflow_tools.js')).href
);

const { tools } = await expectedSharedSurface();
const served = new Set(tools.map((t) => t.name));

// Each listing document, and whether its tool names sit in table rows
// (`| \`name\` |`) or anywhere in backticks / plain text.
const DOCS = [
  { file: 'AGENTS.md', rows: false },
  { file: 'llms.txt', rows: false },
  { file: 'docs/connector.md', rows: true },
  { file: 'mcp/README.md', rows: true, only: (name) => !CONTROLS.has(name) },
  { file: 'docs/connector-directory-submission.md', rows: true },
];
// mcp/README.md documents the engine's tools; the session controls live in
// docs/connector.md and the directory submission.
const CONTROLS = new Set(['begin_lyrics', 'get_operation', 'resume_operation']);

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log('  FAIL ' + msg);
};

console.log(`=== Connector tool lists in docs (${served.size} tools served on /mcp) ===`);
for (const doc of DOCS) {
  const text = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');
  const named = new Set();
  if (doc.rows) {
    for (const m of text.matchAll(/^\|\s*`([a-z_]+)`(?:\s*\/\s*`([a-z_]+)`)?\s*\|/gm))
      for (const name of [m[1], m[2]].filter(Boolean)) {
        named.add(name);
        if (!served.has(name))
          fail(`${doc.file}: table row names \`${name}\`, which no surface serves`);
      }
  } else {
    for (const name of served) if (new RegExp(`\\b${name}\\b`).test(text)) named.add(name);
  }
  // A source file (`lyric_tools.js`) is not a tool name.
  for (const m of text.matchAll(/\blyric_[a-z]+\b(?!\.[a-z]+)/g))
    if (!served.has(m[0])) fail(`${doc.file}: names \`${m[0]}\`, which no surface serves`);
  const expected = [...served].filter((name) => (doc.only ? doc.only(name) : true));
  const missing = expected.filter((name) => !named.has(name));
  if (missing.length)
    fail(`${doc.file}: never lists ${missing.map((n) => '`' + n + '`').join(', ')}`);
  for (const m of text.matchAll(/serves (\d+) tools/g))
    if (Number(m[1]) !== served.size)
      fail(`${doc.file}: says it serves ${m[1]} tools; /mcp serves ${served.size}`);
  if (!missing.length) console.log(`  ok   ${doc.file}: lists all ${expected.length}`);
}

if (failures) {
  console.log(`FAIL — ${failures} tool-list problem(s) above.`);
  process.exit(1);
}
console.log('PASS — every tool-listing document names exactly the served tools.');
process.exit(0);
