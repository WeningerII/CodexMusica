// BB8 verify: the real server path minus HTTP -- validateRequest (the viewer
// route's create validation), createCatalogResolver, ReaderJobStore,
// ReaderScheduler, createPythonBridge and mcp/worker.py -- on the exact body a
// pre-batch Library page sends (captured in stale_page_wt-main.json).
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TREE = process.env.TREE;
const BODY_FILE = process.env.BODY_FILE;
const { ReaderJobStore } = await import(`${TREE}/mcp/reader_job_store.js`);
const { ReaderScheduler, canonicalJSON, createCatalogResolver } = await import(`${TREE}/mcp/reader_scheduler.js`);
const { createPythonBridge } = await import(`${TREE}/mcp/python_bridge.js`);
const { validateRequest } = await import(`${TREE}/mcp/reader_routes.js`);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const LINE = process.env.LINE || 'Oh--oh, oh my love';
const TEXT_LINES = [LINE, 'the road is long'];

const page = JSON.parse(await readFile(BODY_FILE, 'utf8'));
const sent = page.post_bodies[0];
const directory = await mkdtemp(path.join(tmpdir(), 'bb8-v2-cat-'));
const storeDir = await mkdtemp(path.join(tmpdir(), 'bb8-v2-store-'));
const out = { tree: TREE, harness: process.env.HARNESS || TREE };
try {
  await mkdir(path.join(directory, 'readings'));
  const text = TEXT_LINES.join('\n');
  let at = 0;
  const lines = TEXT_LINES.map((t, row) => { const r = { id: `line:${row}`, kind: 'lyric', text: t, row, normalized_cp_range: [at, at + t.length], source_ranges: [{ codepoint_range: [at, at + t.length], utf16_range: [at, at + t.length], precision: 'exact' }] }; at += t.length + 1; return r; });
  const source = { reading_unit_id: 'unit_oh', language: 'eng', availability: 'readable', source_path: 'corpus/library/oh.txt',
    source_sha256: sha('orig'), normalized_sha256: sha(text), work_id: 'work_oh', edition_id: 'ed_oh', normalized_text: text, lines };
  source.reading_revision = sha(canonicalJSON(source));
  const p = 'readings/unit_oh.json';
  const sourceBytes = JSON.stringify(source);
  const indexBytes = JSON.stringify({ readings: [] });
  await writeFile(path.join(directory, p), sourceBytes);
  await writeFile(path.join(directory, 'index.json'), indexBytes);
  const manifest = { parser_version: 'fx', normalizer_version: 'fx', artifacts: { 'index.json': sha(indexBytes), [p]: sha(sourceBytes) } };
  manifest.snapshot_id = sha(canonicalJSON(manifest));
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));

  // The page's own body, retargeted at this fixture reading (only the binding
  // fields change; declaration_set is the page's bytes).
  const body = { ...sent, reading_unit_id: 'unit_oh', reading_revision: source.reading_revision, requested_layers: ['sound'] };
  delete body.keys;
  const full = { contract_version: 1, reading_unit_id: body.reading_unit_id, reading_revision: body.reading_revision,
    declaration_set: sent.declaration_set, requested_layers: ['sound'], idempotency_key: 'k1' };
  const request = validateRequest({ ...full, snapshot_id: manifest.snapshot_id });
  out.validate = 'accepted';
  try { validateRequest({ ...full, snapshot_id: manifest.snapshot_id, token_cut: 'v1' }); out.validate_with_marker = 'accepted'; }
  catch (e) { out.validate_with_marker = `refused ${e.code || ''}: ${e.message}`; }

  const resolver = createCatalogResolver({ directory, engineCommit: 'bb8-same', resourceFingerprint: 'fp' });
  const identity = await resolver.resolveIdentity(request);
  out.identity_keys = Object.keys(identity).sort();
  const store = new ReaderJobStore({ directory: storeDir });
  const created = store.create({ viewer: 'v', idempotency_key: 'k1', identity, request });
  const real = createPythonBridge({ python: 'python3', harnessDir: path.join(process.env.HARNESS || TREE, 'lyric-harness'), workerPath: path.join(process.env.HARNESS || TREE, 'mcp/worker.py'),
    harnessEnv: () => ({ ...process.env, PYTHONDONTWRITEBYTECODE: '1' }), timeoutMs: 300000, maxOutputBytes: 4 * 1024 * 1024 });
  const records = [];
  let seenDecl = null;
  const bridge = { ...real, capacity: () => real.capacity(),
    runReaderLease: (payload, supplied) => { seenDecl = payload.declarations;
      return real.runReaderLease(payload, { ...supplied, onReaderCheckpoint: (step) => { records.push(...(step.records || [])); return supplied.onReaderCheckpoint(step); } }); } };
  const scheduler = new ReaderScheduler({ store, bridge, resolveIdentity: resolver.resolveIdentity, resolveSource: resolver.resolveSource });
  for (let i = 0; i < 40; i++) {
    await scheduler.pump();
    const st = store.inspect(created.record.id).state;
    if (!['queued', 'running', 'leased'].includes(st)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  scheduler.stop();
  const rec = store.inspect(created.record.id);
  out.job_state = rec.state;
  out.job_reason = rec.reason || null;
  out.worker_declarations = seenDecl;
  const toks = records.filter((r) => r.kind === 'token');
  const syl = records.filter((r) => r.kind === 'syllable');
  const line0 = toks.length ? toks[0].line_id : null;
  out.line0_tokens = toks.filter((t) => t.line_id === line0).map((t) => ({ token: t.token + 1, text: t.text,
    codepoints: t.source_ranges.map((x) => x.codepoint_range), nuclei: syl.filter((s) => s.token_id === t.token_id).map((s) => s.syllable.nucleus) }));
  const blob = JSON.stringify(records);
  out.records = records.length;
  out.sample_token = toks.find((t) => t.line_id === line0 && t.token === 1) || null;
  out.scheme_contexts = [...blob.matchAll(/.{0,60}scheme.{0,60}/gi)].slice(0, 4).map((m) => m[0]);
  out.refused_kinds = [...new Set(records.filter((r) => r.coverage === 'refused' || r.status === 'refused').map((r) => r.kind + ':' + (r.reason || '').slice(0, 90)))].slice(0, 6);
  out.mentions = { 'word cut': /word[- ]cut/i.test(blob), scheme: /scheme/i.test(blob), v1: /\bv1\b/.test(blob) };
  if (typeof real.close === 'function') await real.close();
  else if (typeof real.shutdown === 'function') await real.shutdown();
} catch (e) {
  out.error = `${e.code || ''} ${e.message}`;
} finally {
  await rm(directory, { recursive: true, force: true });
  await rm(storeDir, { recursive: true, force: true });
}
console.log(JSON.stringify(out, null, 1));
process.exit(0);
