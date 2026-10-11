// Replays the approved Worker's goldens (tests/library/goldens/317c, captured
// by sites/library/scripts/capture-library-goldens.cjs) against the native
// search store and requires every response to be byte-identical: 363
// searches and 20 metadata reads, status and JSON body alike.
//
//   node mcp/test_library_search_parity.mjs STORE_DIR [GOLDENS_DIR]
//
// The store is built from the same pinned 317c export the goldens job
// rebuilds (library-site.yml). Search pages are replayed at the Worker's own
// cap of 250; /library/v1 caps them at 100, which is the only intended change.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LibrarySearch, errorBody } from './library_search.js';

const [
  storeDir,
  goldens = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'tests/library/goldens/317c'
  ),
] = process.argv.slice(2);
if (!storeDir) {
  console.error('usage: node mcp/test_library_search_parity.mjs STORE_DIR [GOLDENS_DIR]');
  process.exit(2);
}
const store = new LibrarySearch(storeDir);
const lines = (name) =>
  zlib
    .gunzipSync(fs.readFileSync(path.join(goldens, name)))
    .toString('utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
const answer = (fn) => {
  try {
    return { status: 200, body: fn() };
  } catch (error) {
    if (!error.status) throw error;
    return { status: error.status, body: errorBody(error) };
  }
};
const failures = [];
const check = (label, got, want) => {
  if (got.status !== want.status || JSON.stringify(got.body) !== JSON.stringify(want.body))
    failures.push(`${label}: status ${got.status} vs ${want.status}`);
};
const queries = JSON.parse(fs.readFileSync(path.join(goldens, 'queries.json'), 'utf8'));
if (store.snapshotId !== queries.snapshot_id)
  throw new Error(`store snapshot ${store.snapshotId} is not the goldens' ${queries.snapshot_id}`);
const search = lines('search.jsonl.gz');
const started = Date.now();
for (const want of search)
  check(
    `search ${want.label}`,
    answer(() => store.search(new URLSearchParams(want.params), { maxLimit: 250 })),
    want
  );
const metadata = lines('metadata.jsonl.gz');
for (const want of metadata)
  check(
    `metadata ${want.id}`,
    answer(() => store.metadataById(want.id)),
    want
  );
if (search.length !== queries.search.length)
  failures.push('the search golden count differs from queries.json');
console.log(
  `${search.length} searches and ${metadata.length} metadata reads replayed in ${Date.now() - started} ms; ${failures.length} differ`
);
for (const f of failures.slice(0, 20)) console.log(`  DIFF ${f}`);
process.exit(failures.length ? 1 : 0);
