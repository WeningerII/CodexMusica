// usage: node pump_job.mjs <TREE> <storeDir> <catalogDir> <fingerprint> <commit|ENV|NULL> <stub|real> [outRecords.json]
// Plays the POST-release server: opens the durable store the earlier server
// wrote, builds the resolver/scheduler exactly as server_http.js wires them,
// and pumps once. Reports whether the lease ran and what it was handed.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, storeDir, catalogDir, fingerprint, commitArg, mode, out] = process.argv.slice(2);
const imp = (f) => import(pathToFileURL(path.join(tree, 'mcp', f)));
const { ReaderJobStore } = await imp('reader_job_store.js');
const { createCatalogResolver, ReaderScheduler } = await imp('reader_scheduler.js');
const { releaseIdentity } = await imp('build_identity.js');
const engineCommit =
  commitArg === 'ENV' ? releaseIdentity(process.env).commit : commitArg === 'NULL' ? null : commitArg;
const store = new ReaderJobStore({ directory: storeDir });
const resolver = createCatalogResolver({
  directory: catalogDir,
  engineCommit,
  resourceFingerprint: fingerprint,
});
const queued = store.listQueued();
const id = queued[0]?.id ?? queued[0];
const before = structuredClone(store.inspect(typeof id === 'string' ? id : queued[0].id));
const leases = [];
const records = [];
let bridge;
if (mode === 'stub') {
  bridge = {
    capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
    runReaderLease: async (payload) => {
      leases.push({ declarations: payload.declarations, identity: payload.identity });
      return { code: 1, error_code: 'BB8_STUB_RAN', stderr: 'bb8 stub bridge ran the lease' };
    },
  };
} else {
  const { createPythonBridge } = await imp('python_bridge.js');
  const real = createPythonBridge({
    python: process.env.LYRIC_PYTHON || 'python3',
    harnessDir: path.join(tree, 'lyric-harness'),
    workerPath: path.join(tree, 'mcp', 'worker.py'),
    harnessEnv: () => ({ ...process.env, PYTHONDONTWRITEBYTECODE: '1' }),
    timeoutMs: 600000,
    maxOutputBytes: 4 * 1024 * 1024,
  });
  bridge = {
    capacity: () => real.capacity(),
    internals: real.internals,
    runReaderLease: async (payload, options) => {
      leases.push({ declarations: payload.declarations, identity: payload.identity });
      return real.runReaderLease(payload, {
        ...options,
        onReaderCheckpoint: async (step) => {
          records.push(...(step.records || []));
          return options.onReaderCheckpoint(step);
        },
      });
    },
  };
}
const scheduler = new ReaderScheduler({ store, bridge, ...resolver });
await scheduler.pump();
scheduler.stop();
const after = store.inspect(before.id);
const result = {
  tree,
  engineCommit,
  fingerprint,
  mode,
  leases: leases.length,
  handed_declarations: leases[0]?.declarations ?? null,
  state: after.state,
  reason: after.reason ?? null,
  request_unchanged: JSON.stringify(after.request) === JSON.stringify(before.request),
  identity_unchanged: JSON.stringify(after.identity) === JSON.stringify(before.identity),
  stored_identity_engine_commit: after.identity.engine_commit,
  stored_identity_fingerprint: after.identity.resource_fingerprint,
  records: records.length,
};
if (out) writeFileSync(out, JSON.stringify(records));
console.log(JSON.stringify(result));
try {
  await bridge.internals?.kill?.();
} catch {}
process.exit(0);
