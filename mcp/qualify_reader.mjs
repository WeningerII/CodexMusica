// Run against the assembled immutable image. This is deterministic and spends
// no provider budget. It measures the existing Node + shared worker + lookup.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ReaderJobStore } from './reader_job_store.js';
import { createCatalogResolver, packReaderPages } from './reader_scheduler.js';
import { readerPythonBridge, registerLyricTools } from './lyric_tools.js';
import { buildServer } from './tools.js';
import { runtimeBuildIdentity } from './job_store.js';
import { runtimeAssets } from './runtime_assets.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const directory =
  option('--catalog') ||
  process.env.READER_CATALOG_DIR ||
  path.join(root, 'lyric-harness/library/snapshot');
const maximum = Number(option('--memory-max-bytes') || 1638 * 1024 * 1024);
if (!Number.isSafeInteger(maximum) || maximum < 1)
  throw new Error('A positive memory qualification bound is required.');
const cases = [
  [
    'eng',
    'reading_17250bdd-17d0-5cc0-a6b9-65d7b08bf7ca',
    'c87834414a515cb18750e03225287ea78b179c196e5d6d6dbf62a34fed9e8882',
  ],
  [
    'cym',
    'reading_356bc8dc-aed8-5f73-9064-f6238108034a',
    'ab5d0d37c28af07f114418739ff7dbce4c14b147da14706c3edc939be7d0177e',
  ],
  [
    'non',
    'reading_aefeb59b-301c-55fd-b7e0-1c6be1ba5caa',
    'fbd133f7b1523777c750af84d2b713bf6cc0cbc8b78027cb13efc91ed48eda19',
  ],
  [
    'fin',
    'reading_5e1e40b5-1b71-52b8-8254-355fa5211beb',
    '1a4182b8de92c02676e9b8e58aa79d3eabec310b45be78ce3ce2581b975b6ab3',
  ],
  [
    'fas',
    'reading_0ffd290d-27b2-51f6-ab0f-1887495a9db2',
    '7fcdf673da07e4356db3bfd151bbb2630ef4c662d074136c380771239617c28a',
  ],
  [
    'ltc',
    'reading_bbc00296-38f8-515e-9a47-4457713c7d78',
    'e498f9605fb8a3868cbe30358abc84be6200f3c273c3d460369d08dc54a97362',
  ],
];
const build = runtimeBuildIdentity();
const assets = runtimeAssets();
assert.equal(assets.ok, true, JSON.stringify(assets.errors));
const resolver = createCatalogResolver({
  directory,
  engineCommit: build.commit,
  resourceFingerprint: assets.assets_sha256,
});
const catalog = await resolver.probe();
const pinnedSnapshot = '24dcd946f2f713ddd0cb8c4582c1f9e6d449889fd49362cdd2e5b319cbb8e528';
const retainedSnapshot = '5226b4fbe427848759a626560b18b361990ef8c80debece031d770e363febc9e';
const retainedImage =
  'ghcr.io/weningerii/codexmusica/lyrics@sha256:3a9ad3711a338653cb1dc97e81badae2ab9a330eb624ae154e0c8b33e805e7f7';
const retainedCatalog = assets.reader?.retained_snapshots?.find(
  (item) => item.snapshot_id === retainedSnapshot
);
assert.equal(
  catalog.snapshot_id,
  pinnedSnapshot,
  'Qualification requires the pinned reader snapshot.'
);
if (assets.releaseRequired) {
  assert.equal(
    assets.reader?.snapshot_id,
    pinnedSnapshot,
    'The image must contain admitted reader assets.'
  );
  assert.equal(assets.reader?.counts?.readable_reading_units, 24860);
  assert.ok(retainedCatalog, 'The approved Library Site snapshot must remain installed.');
  assert.equal(retainedCatalog.source_image, retainedImage);
  assert.equal(retainedCatalog.counts.reading_units, 32220);
  assert.equal(retainedCatalog.counts.readable_reading_units, 20865);
  assert.match(build.commit || '', /^[a-f0-9]{40}$/);
  assert.ok(build.release_id, 'The image must carry its baked release identity.');
}
const workspace = await mkdtemp(path.join(tmpdir(), 'reader-runtime-qualification-'));
const store = new ReaderJobStore({ directory: workspace, maxBytes: 512 * 1024 * 1024 });
const handlers = {};
registerLyricTools({}, (_server, name, _config, fn) => {
  handlers[name] = fn;
});
const server = buildServer(); // Include the actual music engine/catalog footprint.
// A CI sandbox can expose the host /proc while assigning namespace-local PIDs.
const procPid = Number(path.basename(await realpath('/proc/self')));
let sampling = false;
const memory = {
  samples: 0,
  peak_total_bytes: 0,
  peak_node_bytes: 0,
  peak_children_bytes: 0,
  max_children: 0,
};
async function childMemory(pid, seen = new Set()) {
  // PPid uses the PID namespace of the mounted /proc. Unlike child.pid or
  // task/*/children, it therefore remains usable when a sandbox exposes host
  // /proc while assigning namespace-local PIDs or hides the children files.
  const processes = await Promise.all(
    (await readdir('/proc'))
      .filter((name) => /^\d+$/.test(name))
      .map(async (name) => {
        try {
          const status = await readFile(`/proc/${name}/status`, 'utf8');
          return {
            pid: Number(name),
            parent: Number(status.match(/^PPid:\s+(\d+)$/m)?.[1]),
            bytes: Number(status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1] || 0) * 1024,
          };
        } catch {
          return null; // A completed lookup is no longer resident.
        }
      })
  );
  const descendants = (parent) => {
    if (seen.has(parent)) return { bytes: 0, count: 0 };
    seen.add(parent);
    let bytes = 0,
      count = 0;
    for (const child of processes.filter((item) => item?.parent === parent)) {
      const nested = descendants(child.pid);
      bytes += child.bytes + nested.bytes;
      count += 1 + nested.count;
    }
    return { bytes, count };
  };
  return descendants(pid);
}
async function sample() {
  if (sampling) return;
  sampling = true;
  try {
    const child = await childMemory(procPid);
    const node = process.memoryUsage().rss;
    memory.samples++;
    memory.peak_total_bytes = Math.max(memory.peak_total_bytes, node + child.bytes);
    memory.peak_node_bytes = Math.max(memory.peak_node_bytes, node);
    memory.peak_children_bytes = Math.max(memory.peak_children_bytes, child.bytes);
    memory.max_children = Math.max(memory.max_children, child.count);
  } finally {
    sampling = false;
  }
}
const timer = setInterval(() => {
  void sample();
}, 100);
const results = [];
try {
  // Warm the same existing writing engine before native reader resources load.
  const writing = await handlers.lyric_check({
    lines: ['The cat sat down.', 'Upon the hat.'],
    scheme: 'AA',
  });
  assert.notEqual(writing.isError, true, JSON.stringify(writing));
  const requestedCases = cases.map((item) => [...item, catalog.snapshot_id]);
  // Exercise the same resolver, durable job store and native worker for a
  // request from the approved Site after the connector's catalog advances.
  if (assets.releaseRequired || retainedCatalog)
    requestedCases.push([...cases[0], retainedSnapshot]);
  for (const [language, reading_unit_id, reading_revision, snapshot_id] of requestedCases) {
    const request = {
      contract_version: 1,
      snapshot_id,
      reading_unit_id,
      reading_revision,
      declaration_set: {},
      requested_layers: ['sound', 'form', 'rhythm', 'language'],
    };
    const identity = await resolver.resolveIdentity(request);
    assert.equal(identity.snapshot_id, snapshot_id);
    assert.equal(identity.reading_unit_id, reading_unit_id);
    assert.equal(identity.reading_revision, reading_revision);
    const { source } = await resolver.resolveSource(request);
    const created = store.create({
      viewer: 'qualification',
      idempotency_key: `${language}:${snapshot_id}`,
      identity,
      request,
    });
    const lease = store.lease(created.record.id);
    let summary, lookup;
    const started = performance.now();
    const result = await readerPythonBridge.runReaderLease(
      {
        source,
        identity,
        declarations: {},
        requested: request.requested_layers,
        checkpoint: null,
        committed_pages: [],
        lease_ms: 600000,
      },
      {
        onReaderCheckpoint: async (step) => {
          assert.equal(step.provider_calls, 0);
          summary = step.summary;
          if (!lookup) lookup = handlers.lyric_types({ word_a: 'cat', word_b: 'hat' });
          const committed = store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
            cursor: step.checkpoint,
            pages: packReaderPages(step.records),
            progress: summary.counters,
            coverage: summary.coverage,
          });
          await sample();
          assert.equal(committed.state, 'running', JSON.stringify(committed.reason));
          return { added_page_paths: committed.added_page_paths };
        },
      }
    );
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.reader_result.status, 'complete', JSON.stringify(result.reader_result));
    const completed = store.complete(lease.id, lease.attempt, lease.fence, {
      summary,
      coverage: summary.coverage,
      exhausted: true,
      census_reconciled: true,
      provider_calls: 0,
    });
    assert.ok(
      ['completed', 'completed_with_refusals'].includes(completed.state),
      JSON.stringify(completed.reason)
    );
    assert.equal(summary.coverage.partial, false, 'The complete reading must be covered.');
    assert.equal(summary.coverage.pending_methods, 0);
    assert.equal(
      summary.coverage.requested_methods,
      summary.coverage.answered_methods + summary.coverage.refused_methods
    );
    assert.notEqual((await lookup).isError, true);
    results.push({
      language,
      reading_unit_id,
      reading_revision,
      snapshot_id,
      state: completed.state,
      coverage: summary.coverage,
      counters: summary.counters,
      elapsed_ms: Math.round(performance.now() - started),
    });
    console.error(JSON.stringify({ reader_qualified_case: language, state: completed.state }));
  }
  await sample();
  assert.ok(
    memory.max_children >= 2,
    `The independent lookup must overlap the shared resident worker: ${JSON.stringify(memory)}`
  );
  assert.ok(
    memory.peak_total_bytes < maximum,
    `Combined peak ${memory.peak_total_bytes} exceeds ${maximum}.`
  );
  const fingerprint = createHash('sha256')
    .update(await readFile(path.join(root, 'lyric-harness/library/methods.json')))
    .digest('hex');
  const receipt = {
    version: 1,
    scope: assets.releaseRequired ? 'assembled-production-image' : 'local-runtime',
    profile: 'Render 1c-2g',
    memory_max_bytes: maximum,
    memory,
    node_version: process.version,
    build,
    assets_sha256: assets.assets_sha256,
    snapshot_id: catalog.snapshot_id,
    registry_sha256: fingerprint,
    provider_calls: 0,
    cases: results,
    held_languages: ['san', 'msa'],
    ok: true,
  };
  if (option('--output')) await writeFile(option('--output'), JSON.stringify(receipt) + '\n');
  console.log(JSON.stringify(receipt));
} finally {
  clearInterval(timer);
  await readerPythonBridge.internals.kill();
  await server.close();
  await rm(workspace, { recursive: true, force: true });
}
