// Run offline inside each actual image with the FINAL common /app/scripts mount.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RUNS, LYRIC_TOOL_SCHEMAS } from '../mcp/lyric_tools.js';
import { encodeState, decodeState, assertContinuationCapacity, continuationSemanticIdentity,
  WORKER_STATE_BYTES, CONNECTOR_DECLARATION_BYTES, STATE_DECODED_BYTES } from '../mcp/state_codec.js';
import { STATE_WIRE_BYTES } from '../mcp/payload_limits.js';
import { readBakedBuildIdentity, runtimeSourceFingerprint } from '../mcp/build_identity.js';
import { runtimeAssets } from '../mcp/runtime_assets.js';
import { PROTOCOL, json, sha, generate, encode } from './paired_fixture_core.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scripts);
const d = { count: RUNS.cap, schema: LYRIC_TOOL_SCHEMAS.lyric_revise.draft,
  worker: WORKER_STATE_BYTES, declaration: CONNECTOR_DECLARATION_BYTES,
  decoded: STATE_DECODED_BYTES, wire: STATE_WIRE_BYTES, capacity: assertContinuationCapacity,
  encode: encodeState, decode: decodeState, identity: continuationSemanticIdentity };
const [mode, commonDirectory, output, imageId] = process.argv.slice(2);
const save = (name, value) => fs.writeFileSync(name, json(value), { flag: 'wx', mode: 0o600 });
function files(directory) {
  const found = {};
  function walk(relative) {
    for (const item of fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) walk(name);
      else if (item.isFile()) found[name] = sha(fs.readFileSync(path.join(directory, name)));
      else throw new Error('nonregular fixture member: ' + name);
    }
  }
  walk(''); return found;
}
if (!commonDirectory) throw new Error('Supply generate COMMON_DIR or encode COMMON_DIR OUTPUT_DIR IMAGE_ID');
if (mode === 'generate') {
  fs.mkdirSync(commonDirectory, { mode: 0o700 });
  save(path.join(commonDirectory, 'common.json'), generate(d));
  const result = spawnSync(process.execPath, [path.join(scripts, 'seed_lyrics_capacity_receipts.mjs'),
    path.join(commonDirectory, 'jobs'), path.join(commonDirectory, 'receipts.json')],
    { stdio: 'inherit', timeout: 600000 });
  if (result.status !== 0) throw new Error('shared JobStore preparation failed; no retry');
  save(path.join(commonDirectory, 'common-manifest.json'), { protocol: PROTOCOL, files: files(commonDirectory) });
} else if (mode === 'encode') {
  if (!output || !/^sha256:[a-f0-9]{64}$/.test(imageId || '')) throw new Error('immutable image ID required');
  const manifest = JSON.parse(fs.readFileSync(path.join(commonDirectory, 'common-manifest.json')));
  const actual = files(commonDirectory); delete actual['common-manifest.json'];
  if (manifest.protocol !== PROTOCOL || json(actual) !== json(manifest.files)) throw new Error('common fixture membership/bytes changed');
  const commonBytes = fs.readFileSync(path.join(commonDirectory, 'common.json'));
  const common = JSON.parse(commonBytes);
  if (sha(commonBytes) !== sha(json(common))) throw new Error('noncanonical common corpus');
  if (runtimeAssets().ok !== true) throw new Error('actual image assets not verified before encoding');
  const baked = readBakedBuildIdentity({ required: true });
  if (baked.commit !== process.env.BUILD_GIT_COMMIT) throw new Error('baked source mismatch');
  const result = encode(common, d);
  fs.mkdirSync(output, { mode: 0o700 });
  fs.cpSync(path.join(commonDirectory, 'jobs'), path.join(output, 'jobs'), { recursive: true, preserveTimestamps: true });
  fs.chmodSync(path.join(output, 'jobs'), 0o700);
  for (const name of fs.readdirSync(path.join(output, 'jobs'))) fs.chmodSync(path.join(output, 'jobs', name), 0o600);
  fs.copyFileSync(path.join(commonDirectory, 'receipts.json'), path.join(output, 'receipts.json'));
  const prepared = json(result.prepared);
  fs.writeFileSync(path.join(output, 'prepared-runs.json'), prepared, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(output, 'prepared-runs.json.sha256'), sha(prepared) + '\n', { flag: 'wx', mode: 0o600 });
  const scriptFiles = files(scripts);
  save(path.join(output, 'encoding-proof.json'), { ...result.proof, image_id: imageId,
    source_sha: baked.commit, release_id: baked.release_id, runtime_source_sha256: runtimeSourceFingerprint(),
    scripts: scriptFiles, prepared_sha256: sha(prepared), common_files: manifest.files });
  save(path.join(output, 'manifest.json'), { protocol: PROTOCOL, common_sha256: result.proof.common_sha256,
    image_id: imageId, source_sha: baked.commit, files: files(output) });
  console.log(json({ status: 'encoded-and-decoded', protocol: PROTOCOL, image_id: imageId,
    source_sha: baked.commit, common_sha256: result.proof.common_sha256,
    prepared_sha256: sha(prepared), prepared_bytes: Buffer.byteLength(prepared),
    semantic_identity: result.proof.semantic_identity, approval: 'unreviewed' }));
} else throw new Error('Unknown preparation mode');
