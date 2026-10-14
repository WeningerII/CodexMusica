// usage: node create_job.mjs <TREE> <storeDir> <catalogDir> <fingerprint> <commit|ENV>
// Plays the PRE-release server: creates a Library reader job carrying a
// pronunciation choice numbered under the earlier cut (token 2 'oh' in
// 'Oh--oh, oh my love' meant the third 'oh', chars 8-10, under v1).
// commit ENV = what server_http.js would use: releaseIdentity(process.env).commit
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, storeDir, catalogDir, fingerprint, commitArg] = process.argv.slice(2);
const imp = (f) => import(pathToFileURL(path.join(tree, 'mcp', f)));
const { ReaderJobStore } = await imp('reader_job_store.js');
const { createCatalogResolver } = await imp('reader_scheduler.js');
const { releaseIdentity } = await imp('build_identity.js');
const engineCommit = commitArg === 'ENV' ? releaseIdentity(process.env).commit : commitArg;
const manifest = JSON.parse(readFileSync(path.join(catalogDir, 'manifest.json'), 'utf8'));
const src = JSON.parse(readFileSync(path.join(catalogDir, 'readings/unit_oh.json'), 'utf8'));
const resolver = createCatalogResolver({
  directory: catalogDir,
  engineCommit,
  resourceFingerprint: fingerprint,
});
const request = {
  contract_version: 1,
  snapshot_id: manifest.snapshot_id,
  reading_unit_id: src.reading_unit_id,
  reading_revision: src.reading_revision,
  declaration_set: {
    pronunciations: [
      {
        line: 'Oh--oh, oh my love',
        token: 2,
        word: 'oh',
        phones: ['AA1'],
        basis: 'declared',
        source: 'the singer',
      },
    ],
  },
  requested_layers: ['sound'],
};
const prepared = await resolver.prepareRequest(request);
const identity = await resolver.resolveIdentity(prepared);
const store = new ReaderJobStore({ directory: storeDir });
const created = store.create({
  viewer: 'bb8-viewer',
  idempotency_key: 'queued-before-release',
  identity,
  request: prepared,
});
console.log(
  JSON.stringify({
    tree,
    engineCommit,
    fingerprint,
    job: created.record.id,
    state: created.record.state,
    identity_keys: Object.keys(identity).sort(),
    identity,
  })
);
process.exit(0);
