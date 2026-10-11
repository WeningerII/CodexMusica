// Replays the approved Worker's selection-export goldens
// (tests/library/goldens/317c/exports.json) against the native export store
// and requires each ZIP to be byte-identical: same entries in the same order,
// same length, same sha256. Nine ZIPs: three selections in text, json and csv.
//
//   node mcp/test_library_exports_parity.mjs STORE_DIR [GOLDENS_DIR]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ExportStore, zipChunks } from './library_exports.js';

const [
  storeDir,
  goldens = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'tests/library/goldens/317c'
  ),
] = process.argv.slice(2);
if (!storeDir) {
  console.error('usage: node mcp/test_library_exports_parity.mjs STORE_DIR [GOLDENS_DIR]');
  process.exit(2);
}
const store = new ExportStore(storeDir);
const { exports } = JSON.parse(fs.readFileSync(path.join(goldens, 'exports.json'), 'utf8'));
const failures = [];
for (const want of exports) {
  const ids = [...new Set(want.ids)].sort();
  const layout = store.layout(ids, want.format);
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for (const chunk of zipChunks(storeDir, layout, want.format, store.snapshotId)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  const names = layout.entries.map((e) => e.name);
  if (hash.digest('hex') !== want.sha256 || bytes !== want.bytes || layout.bytes !== want.bytes)
    failures.push(`${want.label} ${want.format}: bytes ${bytes} vs ${want.bytes}`);
  else if (JSON.stringify(names) !== JSON.stringify(want.entries))
    failures.push(`${want.label} ${want.format}: entry order differs`);
}
console.log(`${exports.length} selection ZIPs replayed; ${failures.length} differ`);
for (const f of failures) console.log(`  DIFF ${f}`);
process.exit(failures.length ? 1 : 0);
