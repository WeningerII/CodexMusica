import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createRuntimeAssetReader } from './runtime_assets.js';

const assetInventory = {
  status: 0,
  stdout: JSON.stringify({ ok: true, errors: [], assets: [], python: '3.11', nltk: '3.10.3' }),
};

test('required readiness rejects a missing proof and invokes current-runtime validation for stale proofs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-proof-'));
  const receipt = join(directory, 'proof.json');
  const calls = [];
  const env = {
    LYRIC_RELEASE_ASSETS_REQUIRED: '1',
    LYRIC_CAPACITY_ATTESTATION: receipt,
    LYRIC_PYTHON: '/exact/worker-python',
  };
  const reader = createRuntimeAssetReader({
    env,
    source: () => 'fixed',
    run: (python, args) => {
      calls.push({ python, args });
      return args[0].endsWith('release_assets.py')
        ? assetInventory
        : { status: 2, stderr: 'CAPACITY_UNVERIFIED: source/table/python mismatch' };
    },
  });
  try {
    const missing = reader();
    assert.equal(missing.ok, false);
    assert.equal(missing.capacity.ok, false);
    assert.match(missing.errors.join(' '), /missing/);
    writeFileSync(
      receipt,
      JSON.stringify({ version: 1, status: 'verified', source_identity: 'old' })
    );
    const stale = reader();
    assert.equal(stale.ok, false);
    assert.match(stale.errors.join(' '), /source\/table\/python mismatch/);
    assert(calls.every((c) => c.python === '/exact/worker-python'));
    assert(
      calls.some(
        (c) =>
          c.args[0].endsWith('verify_capacity.py') &&
          c.args.includes('--check') &&
          c.args.includes(receipt)
      )
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('previous ready result is invalidated when proof bytes or source change', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-proof-cache-'));
  const receipt = join(directory, 'proof.json');
  let current = 'a',
    valid = true,
    checks = 0;
  writeFileSync(receipt, JSON.stringify({ version: 1, status: 'verified' }));
  const reader = createRuntimeAssetReader({
    env: { LYRIC_RELEASE_ASSETS_REQUIRED: '1', LYRIC_CAPACITY_ATTESTATION: receipt },
    source: () => current,
    run: (_python, args) => {
      if (args[0].endsWith('release_assets.py')) return assetInventory;
      checks++;
      return { status: valid ? 0 : 2, stderr: 'stale proof' };
    },
  });
  try {
    assert.equal(reader().ok, true);
    assert.equal(reader().ok, true);
    assert.equal(checks, 1);
    valid = false;
    writeFileSync(receipt, JSON.stringify({ version: 2, status: 'verified' }));
    assert.equal(reader().ok, false);
    assert.equal(checks, 2);
    valid = true;
    assert.equal(reader().ok, false); // failed epoch cannot magically become ready
    current = 'b';
    assert.equal(reader().ok, true);
    assert.equal(checks, 3);
    valid = false;
    current = 'c';
    assert.equal(reader().ok, false);
    assert.equal(checks, 4);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cached readiness notices an undeclared file in an existing unlisted nested directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-extra-'));
  const staged = join(directory, 'staged'),
    nested = join(staged, 'unlisted', 'existing'),
    proof = join(directory, 'proof.json');
  mkdirSync(nested, { recursive: true });
  writeFileSync(proof, '{"version":1}');
  const extra = join(nested, 'extra.txt');
  let checks = 0;
  const reader = createRuntimeAssetReader({
    env: {
      LYRIC_RELEASE_ASSETS_REQUIRED: '1',
      LYRIC_STAGED_DATA: staged,
      LYRIC_CAPACITY_ATTESTATION: proof,
    },
    source: () => 'fixed',
    run: (_python, args) => {
      if (!args[0].endsWith('release_assets.py')) return { status: 0 };
      checks++;
      return existsSync(extra)
        ? { status: 2, stdout: JSON.stringify({ ok: false, errors: ['undeclared file'] }) }
        : assetInventory;
    },
  });
  try {
    assert.equal(reader().ok, true);
    writeFileSync(extra, 'unapproved');
    assert.equal(reader().ok, false);
    assert.equal(checks, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cached reader readiness rechecks a held body inserted beneath an existing snapshot directory', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-reader-extra-'));
  const fixtureRoot = join(directory, 'harness');
  const sourceRoot = fileURLToPath(new URL('../lyric-harness/', import.meta.url)).replace(
    /\/$/,
    ''
  );
  const retainedSnapshot = 'a'.repeat(64);
  const currentDirectory = 'library/snapshot';
  const retainedDirectory = `${currentDirectory}/${retainedSnapshot}`;
  const readings = join(fixtureRoot, retainedDirectory, 'readings');
  const heldBody = join(readings, 'undeclared-held-reading.json');
  const proof = join(directory, 'proof.json');
  mkdirSync(readings, { recursive: true });
  mkdirSync(join(fixtureRoot, 'data'), { recursive: true });
  writeFileSync(proof, '{"version":1}');
  for (const relative of [
    `${currentDirectory}/manifest.json`,
    `${retainedDirectory}/manifest.json`,
  ]) {
    writeFileSync(join(fixtureRoot, relative), '{"approved":"fixture"}');
  }
  writeFileSync(
    join(fixtureRoot, 'data/runtime_assets.json'),
    JSON.stringify({
      version: 1,
      assets: [
        { id: 'library_catalog', directory: currentDirectory },
        { id: `library_catalog_${retainedSnapshot}`, directory: retainedDirectory },
      ].map((asset) => ({
        ...asset,
        base: 'root',
        runtime: true,
        decision: 'approved',
        files: [{ path: `${asset.directory}/manifest.json` }],
      })),
    })
  );
  // The runtime reader has a fixed installed root. Redirect its filesystem
  // reads to actual fixture files so no repository manifest is overwritten.
  const fixturePath = (file) => {
    if (typeof file !== 'string') return file;
    if (file === sourceRoot) return fixtureRoot;
    return file.startsWith(`${sourceRoot}/`)
      ? join(fixtureRoot, file.slice(sourceRoot.length + 1))
      : file;
  };
  for (const name of ['readFileSync', 'statSync', 'realpathSync', 'readdirSync']) {
    const original = fs[name];
    t.mock.method(fs, name, (file, ...args) => original(fixturePath(file), ...args));
  }
  let checks = 0;
  const reader = createRuntimeAssetReader({
    env: {
      LYRIC_RELEASE_ASSETS_REQUIRED: '1',
      LYRIC_STAGED_DATA: join(fixtureRoot, 'data'),
      LYRIC_CAPACITY_ATTESTATION: proof,
    },
    source: () => 'fixed',
    run: (_python, args) => {
      if (!args[0].endsWith('release_assets.py')) return { status: 0 };
      checks++;
      return existsSync(heldBody)
        ? {
            status: 2,
            stdout: JSON.stringify({ ok: false, errors: ['undeclared held reader body'] }),
          }
        : assetInventory;
    },
  });
  try {
    assert.equal(reader().ok, true);
    assert.equal(reader().ok, true);
    assert.equal(checks, 1, 'unchanged snapshot readiness should stay cached');
    writeFileSync(heldBody, '{"availability":"held","body":"withheld words"}');
    const refused = reader();
    assert.equal(refused.ok, false);
    assert.match(refused.errors.join(' '), /undeclared held reader body/);
    assert.equal(checks, 2, 'a nested insertion must execute inventory again');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a root asset beside Python modules does not tie readiness to its directory', () => {
  // quality/canon_index.tsv is a root asset in a source directory. Python
  // writing bytecode under it moved that directory's ctime (an overlay
  // copy-up in the image), which re-ran both blocking checks on the event
  // loop mid-grade: /health timed out in every capacity shard of
  // qualification run 36869223383. The file's own identity is still watched.
  const directory = mkdtempSync(join(tmpdir(), 'runtime-root-asset-'));
  const proof = join(directory, 'proof.json');
  writeFileSync(proof, '{"version":1}');
  const quality = fileURLToPath(new URL('../lyric-harness/quality/', import.meta.url));
  let checks = 0;
  const reader = createRuntimeAssetReader({
    env: { LYRIC_RELEASE_ASSETS_REQUIRED: '1', LYRIC_CAPACITY_ATTESTATION: proof },
    source: () => 'fixed',
    run: (_python, args) => {
      if (!args[0].endsWith('release_assets.py')) return { status: 0 };
      checks++;
      return assetInventory;
    },
  });
  let churn;
  try {
    assert.equal(reader().ok, true);
    churn = mkdtempSync(join(quality, '.runtime-assets-test-'));
    assert.equal(reader().ok, true);
    assert.equal(checks, 1);
  } finally {
    if (churn) rmSync(churn, { recursive: true, force: true });
    rmSync(directory, { recursive: true, force: true });
  }
});

test('production cannot execute an NLTK override outside the model tree whose bytes were approved', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-tagger-'));
  const staged = join(directory, 'staged'),
    receipt = join(directory, 'proof.json');
  mkdirSync(join(staged, 'nltk'), { recursive: true });
  writeFileSync(receipt, '{"version":1}');
  const env = {
    LYRIC_RELEASE_ASSETS_REQUIRED: '1',
    LYRIC_STAGED_DATA: staged,
    NLTK_DATA: join(directory, 'external'),
    LYRIC_CAPACITY_ATTESTATION: receipt,
  };
  const reader = createRuntimeAssetReader({
    env,
    source: () => 'fixed',
    run: (_python, args) =>
      args[0].endsWith('release_assets.py') ? assetInventory : { status: 0 },
  });
  try {
    assert.equal(reader().ok, false);
    assert.match(reader().errors.join(' '), /production NLTK_DATA/);
    env.NLTK_DATA = join(staged, 'nltk');
    assert.equal(reader().ok, true);
    env.NLTK_DATA = join(directory, 'external');
    env.LYRIC_RELEASE_ASSETS_REQUIRED = '0';
    assert.equal(reader().ok, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('required production mode exports exact recovery without Python or assets while retaining all task/input guards', () => {
  const source = `
    import assert from 'node:assert/strict';
    import {Client} from '@modelcontextprotocol/sdk/client/index.js';
    import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
    import {buildServer} from './tools.js';
    import {_workerInternals} from './lyric_tools.js';
    import {withExecutionContext} from './execution_context.js';
    const server=buildServer();
    const client=new Client({name:'required-recovery',version:'1'},{capabilities:{}});
    const [a,b]=InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a),client.connect(b)]);
    const journal={version:1,input_draft:['Original line'],accepted_lines:['Exact recovered love line'],answered:{propose:[],propose_group:[]}};
    const checkpoint=JSON.stringify(journal);
    try {
      const result=await client.callTool({name:'lyric_revise',arguments:{recover_only:true,checkpoint}});
      assert.notEqual(result.isError,true,JSON.stringify(result));
      const recovered=JSON.parse(result.content[0].text);
      assert.equal(recovered.status,'recovered_artifact');
      assert.deepEqual(recovered.final_draft,journal.accepted_lines);
      assert.deepEqual(recovered.journal,journal);
      assert.equal(recovered.certified,false); assert.equal(recovered.resumable,false);
      assert.equal(_workerInternals.pid(),null);
      const ordinary=await client.callTool({name:'lyric_sweep',arguments:{seed_from:1,count:1}});
      assert.equal(ordinary.isError,true); assert.match(ordinary.content[0].text,/LYRIC_ASSETS_UNAVAILABLE/);
      for(const patch of [{answer:'change'},{state:checkpoint}]) {
        const bad=await client.callTool({name:'lyric_revise',arguments:{recover_only:true,checkpoint,...patch}});
        assert.equal(bad.isError,true);assert.match(bad.content[0].text,/Recovery requires/);
      }
      const broken=await client.callTool({name:'lyric_revise',arguments:{recover_only:true,checkpoint:'bad-json'}});
      assert.equal(broken.isError,true);
      const scoped=await withExecutionContext({task:{domain:'recipe'}},()=>client.callTool({name:'lyric_revise',arguments:{recover_only:true,checkpoint}}));
      assert.equal(scoped.isError,true);assert.match(scoped.content[0].text,/TASK_SCOPE/);
      const oversized=await client.callTool({name:'lyric_revise',arguments:{recover_only:true,checkpoint:'x'.repeat(2*1024*1024)}});
      assert.equal(oversized.isError,true);
      assert.equal(_workerInternals.pid(),null);
      console.log('required-mode recovery + ordinary refusal + task/payload guards passed');
    } finally {await client.close();await server.close();}
  `;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      GEMINI_API_KEY: '',
      LYRIC_RELEASE_ASSETS_REQUIRED: '1',
      LYRIC_PYTHON: '/nonexistent/production-proof-python',
      LYRIC_CAPACITY_ATTESTATION: '/nonexistent/production-proof.json',
    },
  });
  assert.match(result, /required-mode recovery/);
});
