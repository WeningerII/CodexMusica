// BB8 scratch: Route 2 with the REAL createCatalogResolver (not a mocked
// resolveIdentity). A job created by a pre-batch server (engine commit A) and
// leased by the candidate server (engine commit B) must be refused
// STALE_READING without running. Controls: same commit runs; null commit on
// both sides runs (identity carries no reader scheme of its own).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TREE = process.env.TREE;
const { ReaderJobStore } = await import(`${TREE}/mcp/reader_job_store.js`);
const { ReaderScheduler, canonicalJSON, createCatalogResolver } = await import(
  `${TREE}/mcp/reader_scheduler.js`
);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const LINE = 'Oh--oh, oh my love';

async function catalog() {
  const directory = await mkdtemp(path.join(tmpdir(), 'bb8-r2-'));
  await mkdir(path.join(directory, 'readings'));
  const source = {
    reading_unit_id: 'unit_oh',
    language: 'eng',
    availability: 'readable',
    source_path: 'corpus/library/oh.txt',
    source_sha256: sha('orig'),
    normalized_sha256: sha(LINE),
    work_id: 'work_oh',
    edition_id: 'ed_oh',
    normalized_text: LINE,
    lines: [{ kind: 'lyric', text: LINE, row: 0, ranges: [0, LINE.length] }],
  };
  source.reading_revision = sha(canonicalJSON(source));
  const p = 'readings/unit_oh.json';
  const sourceBytes = JSON.stringify(source);
  const indexBytes = JSON.stringify({ readings: [] });
  await writeFile(path.join(directory, p), sourceBytes);
  await writeFile(path.join(directory, 'index.json'), indexBytes);
  const manifest = {
    parser_version: 'fx',
    normalizer_version: 'fx',
    artifacts: { 'index.json': sha(indexBytes), [p]: sha(sourceBytes) },
  };
  manifest.snapshot_id = sha(canonicalJSON(manifest));
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  const request = {
    contract_version: 1,
    snapshot_id: manifest.snapshot_id,
    reading_unit_id: 'unit_oh',
    reading_revision: source.reading_revision,
    // a legacy (v1-numbered) choice: token 2 = second "oh" under v1
    declaration_set: {
      pronunciations: [{ line: LINE, token: 2, word: 'oh', phones: ['AA1'], basis: 'declared', source: 'the singer' }],
    },
    requested_layers: ['sound'],
  };
  return { directory, request };
}

async function scenario(commitBefore, commitAfter, fpBefore = 'fp', fpAfter = 'fp') {
  const { directory, request } = await catalog();
  const storeDir = await mkdtemp(path.join(tmpdir(), 'bb8-r2-store-'));
  try {
    const before = createCatalogResolver({ directory, engineCommit: commitBefore, resourceFingerprint: fpBefore });
    const after = createCatalogResolver({ directory, engineCommit: commitAfter, resourceFingerprint: fpAfter });
    const identityBefore = await before.resolveIdentity(request);
    const store = new ReaderJobStore({ directory: storeDir });
    const created = store.create({ viewer: 'v', idempotency_key: 'k', identity: identityBefore, request });
    const snapshot = structuredClone(store.inspect(created.record.id));
    let leases = 0;
    let seenDeclarations = null;
    const scheduler = new ReaderScheduler({
      store,
      bridge: {
        capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
        runReaderLease: async (input) => {
          leases++;
          seenDeclarations = input.declarations;
          return { code: 1, error_code: 'BB8_STOP', stderr: 'bb8 stub bridge ran' };
        },
      },
      resolveIdentity: after.resolveIdentity,
      resolveSource: after.resolveSource,
    });
    await scheduler.pump();
    scheduler.stop();
    const rec = store.inspect(created.record.id);
    return { identityBefore, leases, seenDeclarations, rec, snapshot };
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storeDir, { recursive: true, force: true });
  }
}

test('identity keys (does reader scheme participate?)', async () => {
  const { identityBefore } = await scenario('a'.repeat(40), 'a'.repeat(40));
  const keys = Object.keys(identityBefore).sort();
  console.log('IDENTITY_KEYS', JSON.stringify(keys));
  assert.ok(!keys.some((k) => /scheme|cut/i.test(k)), 'no scheme/cut key in identity');
});

test('pre-batch commit job leased by candidate commit -> STALE_READING, never run, not rewritten', async () => {
  const r = await scenario('8b1d2ad2'.padEnd(40, '0'), '67889851'.padEnd(40, '0'));
  console.log('DIFF_COMMIT', JSON.stringify({ leases: r.leases, state: r.rec.state, reason: r.rec.reason }));
  assert.equal(r.leases, 0);
  assert.equal(r.rec.state, 'paused');
  assert.equal(r.rec.reason.code, 'STALE_READING');
  assert.deepEqual(r.rec.request, r.snapshot.request);
  assert.deepEqual(r.rec.identity, r.snapshot.identity);
});

test('control: same commit -> lease runs with the stored (legacy) declarations', async () => {
  const r = await scenario('c'.repeat(40), 'c'.repeat(40));
  console.log('SAME_COMMIT', JSON.stringify({ leases: r.leases, state: r.rec.state, reason: r.rec.reason, decl: r.seenDeclarations }));
  assert.equal(r.leases, 1);
});

test('gap probe: null commit both sides, same resource fingerprint -> lease runs', async () => {
  const r = await scenario(null, null);
  console.log('NULL_COMMIT', JSON.stringify({ leases: r.leases, state: r.rec.state, reason: r.rec.reason }));
  assert.equal(r.leases, 1);
});

test('null commit both sides but resource fingerprint changed -> STALE_READING', async () => {
  const r = await scenario(null, null, 'fpA', 'fpB');
  console.log('NULL_COMMIT_FP_CHANGED', JSON.stringify({ leases: r.leases, state: r.rec.state, reason: r.rec.reason }));
  assert.equal(r.leases, 0);
  assert.equal(r.rec.reason.code, 'STALE_READING');
});
