import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createRuntimeAssetReader, spawnAsync } from './runtime_assets.js';

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
      assert.equal(ordinary.isError,true); assert.match(ordinary.content[0].text,/LYRIC_ASSETS_UNAVAILABLE/); assert.match(ordinary.content[0].text,/Retry this same call later/);
      // A lyrics session is refused too: opened now it would record an
      // identity without the assets and be refused once they are read.
      const {buildWorkflowServer}=await import('./workflow_tools.js');
      const {WorkflowSessions}=await import('./workflow_sessions.js');
      const {JobStore}=await import('./job_store.js');
      const sessions=new WorkflowSessions({store:new JobStore(null)});
      const shared=await buildWorkflowServer({sessions});
      const user=new Client({name:'required-session',version:'1'},{capabilities:{}});
      const [c,d]=InMemoryTransport.createLinkedPair();
      await Promise.all([shared.connect(c),user.connect(d)]);
      const begun=await user.callTool({name:'begin_lyrics',arguments:{}});
      assert.equal(begun.isError,true); assert.match(begun.content[0].text,/LYRIC_ASSETS_UNAVAILABLE/); assert.match(begun.content[0].text,/Retry this same call later/);
      const recipe=await user.callTool({name:'start_recipe',arguments:{traditions:['bluegrass']}});
      assert.notEqual(recipe.isError,true,JSON.stringify(recipe).slice(0,400));
      await user.close(); await shared.close();
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

const timedOut = () => ({
  status: null,
  signal: 'SIGTERM',
  error: Object.assign(new Error('spawnSync python3 ETIMEDOUT'), { code: 'ETIMEDOUT' }),
});

test('an asset check that did not complete is retried off-thread after a backoff, never cached', async () => {
  let clock = 0,
    slow = true,
    sync = 0,
    async_ = 0;
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => 'fixed',
    now: () => clock,
    retryMs: 1000,
    maxRetryMs: 4000,
    schedule: () => {},
    run: () => (sync++, timedOut()),
    runAsync: async () => (async_++, slow ? timedOut() : assetInventory),
  });
  const first = reader();
  assert.equal(first.ok, false);
  assert.equal(first.incomplete, true);
  assert.deepEqual(first.errors, ['spawnSync python3 ETIMEDOUT']);
  assert.equal(first.retry_at, new Date(1000).toISOString());
  assert.equal(reader(), first); // inside the backoff: nothing runs
  assert.equal(sync + async_, 1);
  clock = 1000;
  // Due: the read answers at once with the standing result and starts one
  // asynchronous check; reads while it runs start nothing more.
  assert.equal(reader(), first);
  assert.equal(reader(), first);
  await reader.settled();
  assert.equal(async_, 1);
  const second = reader();
  assert.equal(second.retry_at, new Date(3000).toISOString()); // the backoff doubles
  clock = 3000;
  reader();
  await reader.settled();
  clock = 7000;
  reader();
  await reader.settled();
  assert.equal(reader().retry_at, new Date(11000).toISOString()); // capped at maxRetryMs
  assert.equal(async_, 3);
  slow = false;
  clock = 11000;
  reader();
  await reader.settled();
  const recovered = reader();
  assert.equal(recovered.ok, true);
  assert.equal(recovered.incomplete, undefined);
  assert.equal(recovered.retry_at, undefined);
  assert.equal(recovered.python, '3.11');
  clock = 1e9;
  assert.equal(reader(), recovered); // a completed check is cached as before
  assert.equal(sync, 1);
  assert.equal(async_, 4);
});

test('a check that completed and failed stays cached; only an unfinished one is retried', () => {
  let checks = 0;
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => 'fixed',
    now: () => 1e12,
    run: () => {
      checks++;
      return { status: 2, stdout: JSON.stringify({ ok: false, errors: ['digest mismatch'] }) };
    },
    runAsync: () => assert.fail('a completed failure is not retried'),
  });
  const failed = reader();
  assert.equal(failed.ok, false);
  assert.equal(failed.incomplete, undefined);
  assert.equal(reader(), failed);
  assert.equal(checks, 1);
});

test('an unfinished capacity verification is retried like an unfinished inventory', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-proof-retry-'));
  const receipt = join(directory, 'proof.json');
  writeFileSync(receipt, JSON.stringify({ version: 1, status: 'verified' }));
  let clock = 0;
  const answer = (stalled) => (_python, args) =>
    args[0].endsWith('release_assets.py') ? assetInventory : stalled ? timedOut() : { status: 0 };
  const reader = createRuntimeAssetReader({
    env: { LYRIC_RELEASE_ASSETS_REQUIRED: '1', LYRIC_CAPACITY_ATTESTATION: receipt },
    source: () => 'fixed',
    now: () => clock,
    retryMs: 1000,
    schedule: () => {},
    run: answer(true),
    runAsync: async (...args) => answer(false)(...args),
  });
  try {
    const first = reader();
    assert.equal(first.ok, false);
    assert.equal(first.incomplete, true);
    assert.equal(reader().ok, false); // still inside the backoff
    clock = 1000;
    reader();
    await reader.settled();
    assert.equal(reader().ok, true);
    // Each child is recorded with its own outcome against its own limit.
    assert.deepEqual(
      reader
        .attempts()
        .map((attempt) => attempt.children.map((c) => [c.step, c.outcome, c.limit_ms])),
      [
        [
          ['inventory', 'exit_0', 30_000],
          ['capacity', 'timed_out', 30_000],
        ],
        [
          ['inventory', 'exit_0', 120_000],
          ['capacity', 'exit_0', 120_000],
        ],
      ]
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the asynchronous runner reports a timeout as spawnSync does, and does not block', async () => {
  const started = Date.now();
  let ticks = 0;
  const timer = setInterval(() => ticks++, 10);
  const result = await spawnAsync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], {
    timeout: 300,
  });
  clearInterval(timer);
  assert.equal(result.status, null);
  assert.equal(result.error.code, 'ETIMEDOUT');
  assert(Date.now() - started < 4000);
  assert(ticks > 5, 'the event loop kept running while the child ran');
  const ok = await spawnAsync(process.execPath, ['-e', 'process.stdout.write("{}")'], {
    timeout: 10_000,
  });
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, '{}');
  const missing = await spawnAsync('/nonexistent/python', [], { timeout: 1000 });
  assert.equal(missing.status, null);
  assert.equal(missing.error.code, 'ENOENT');
});

test('many reads during one check start one check, and the race refusals still refuse', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-proof-race-'));
  const receipt = join(directory, 'proof.json');
  writeFileSync(receipt, JSON.stringify({ version: 1, status: 'verified' }));
  let checks = 0,
    swap = 'none',
    source = 'a';
  const reader = createRuntimeAssetReader({
    env: { LYRIC_RELEASE_ASSETS_REQUIRED: '1', LYRIC_CAPACITY_ATTESTATION: receipt },
    source: () => source,
    run: (_python, args) => {
      if (args[0].endsWith('release_assets.py')) {
        checks++;
        return assetInventory;
      }
      if (swap === 'receipt') writeFileSync(receipt, JSON.stringify({ version: 2 }));
      if (swap === 'source') source += '+';
      return { status: 0 };
    },
  });
  try {
    // The check is synchronous, so reads that arrive while it runs wait for it
    // and then share its cached result: one check, not one per request.
    const results = Array.from({ length: 8 }, () => reader());
    assert.equal(checks, 1);
    assert(results.every((r) => r === results[0] && r.ok));
    swap = 'receipt';
    writeFileSync(receipt, JSON.stringify({ version: 1, status: 'verified', n: 1 }));
    const moved = reader();
    assert.equal(moved.ok, false);
    assert.equal(moved.incomplete, undefined);
    assert.match(moved.errors.join(' '), /receipt changed during validation/);
    swap = 'source';
    writeFileSync(receipt, JSON.stringify({ version: 1, status: 'verified', n: 2 }));
    const changed = reader();
    assert.equal(changed.ok, false);
    assert.equal(changed.incomplete, undefined);
    assert.match(changed.errors.join(' '), /source or assets changed during validation/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a due retry starts once however many reads arrive, by timer or by read, and readers never spawn', async () => {
  let clock = 0,
    sync = 0,
    started = 0,
    release;
  const timers = [];
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => 'fixed',
    now: () => clock,
    retryMs: 1000,
    schedule: (start, ms) => timers.push({ start, ms }),
    run: () => (sync++, timedOut()),
    runAsync: () => {
      started++;
      return new Promise((resolve) => (release = resolve));
    },
  });
  const first = reader();
  assert.equal(first.incomplete, true);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 1000);
  clock = 1000;
  timers[0].start(); // the timer falls due with no traffic
  for (let i = 0; i < 10; i++) assert.equal(reader(), first); // reads during the check
  assert.equal(started, 1);
  assert.equal(sync, 1);
  release(assetInventory);
  await reader.settled();
  assert.equal(reader().ok, true);
  assert.equal(started, 1);
});

test('only a verdict is kept: a crash, unparseable output or an unexpected exit is retried', () => {
  for (const [label, result, kept] of [
    ['JSON ok:false, exit 2', { status: 2, stdout: '{"ok":false,"errors":["bad"]}' }, true],
    ['JSON ok:true, exit 0', assetInventory, true],
    ['JSON ok:true, exit 1', { status: 1, stdout: '{"ok":true}' }, false],
    ['traceback, exit 1', { status: 1, stdout: '', stderr: 'Traceback' }, false],
    ['killed', { status: null, signal: 'SIGKILL', stdout: '' }, false],
    ['no interpreter', { status: null, error: new Error('spawnSync python3 ENOENT') }, false],
  ]) {
    const reader = createRuntimeAssetReader({
      env: {},
      source: () => 'fixed',
      now: () => 0,
      schedule: () => {},
      run: () => result,
    });
    assert.equal(reader().incomplete === undefined, kept, label);
  }
  const directory = mkdtempSync(join(tmpdir(), 'runtime-proof-verdict-'));
  const receipt = join(directory, 'proof.json');
  writeFileSync(receipt, JSON.stringify({ version: 1, status: 'verified' }));
  try {
    for (const [status, kept] of [
      [0, true],
      [2, true],
      [1, false],
    ]) {
      const reader = createRuntimeAssetReader({
        env: { LYRIC_RELEASE_ASSETS_REQUIRED: '1', LYRIC_CAPACITY_ATTESTATION: receipt },
        source: () => 'fixed',
        now: () => 0,
        schedule: () => {},
        run: (_python, args) =>
          args[0].endsWith('release_assets.py') ? assetInventory : { status, stderr: 'refused' },
      });
      assert.equal(reader().incomplete === undefined, kept, `verify_capacity exit ${status}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a retry whose epoch moved while it ran is not kept', async () => {
  let clock = 0,
    source = 'a';
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => source,
    now: () => clock,
    retryMs: 1000,
    schedule: () => {},
    run: () => timedOut(),
    runAsync: async () => {
      source = 'b'; // the source changes while the check runs
      return assetInventory;
    },
  });
  reader();
  clock = 1000;
  reader();
  await reader.settled();
  source = 'a';
  assert.equal(reader().incomplete, true); // the moved result was discarded
});

test('every check is recorded with its mode, elapsed time, limit and outcome', async () => {
  let clock = 0,
    slow = true;
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => 'fixed',
    now: () => clock,
    retryMs: 1000,
    schedule: () => {},
    run: () => ((clock += 30_000), timedOut()),
    runAsync: async () => {
      clock += slow ? 120_000 : 27_000;
      return slow ? timedOut() : assetInventory;
    },
  });
  reader();
  clock += 1000;
  reader();
  await reader.settled();
  slow = false;
  clock += 2000;
  reader();
  await reader.settled();
  assert.equal(reader().ok, true);
  const child = (elapsed_ms, limit_ms, outcome) => [
    { step: 'inventory', elapsed_ms, limit_ms, outcome },
  ];
  assert.deepEqual(reader.attempts(), [
    {
      mode: 'sync',
      started_at: new Date(0).toISOString(),
      elapsed_ms: 30_000,
      per_child_limit_ms: 30_000,
      outcome: 'timed_out',
      children: child(30_000, 30_000, 'timed_out'),
    },
    {
      mode: 'background',
      started_at: new Date(31_000).toISOString(),
      elapsed_ms: 120_000,
      per_child_limit_ms: 120_000,
      outcome: 'timed_out',
      children: child(120_000, 120_000, 'timed_out'),
    },
    {
      mode: 'background',
      started_at: new Date(153_000).toISOString(),
      elapsed_ms: 27_000,
      per_child_limit_ms: 120_000,
      outcome: 'passed',
      children: child(27_000, 120_000, 'exit_0'),
    },
  ]);
  reader.attempts().push('x'); // a copy
  assert.equal(reader.attempts().length, 3);
});

test('a read with a changed epoch while a check is in flight starts nothing beside it', async () => {
  let clock = 0,
    source = 'a',
    running = 0,
    most = 0,
    sync = 0,
    release;
  const timers = [];
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => source,
    now: () => clock,
    retryMs: 1000,
    schedule: (start, ms) => timers.push([start, ms]),
    run: () => (sync++, timedOut()),
    runAsync: async () => {
      most = Math.max(most, ++running);
      await new Promise((done) => (release = done));
      running--;
      return assetInventory;
    },
  });
  reader(); // the boot check times out
  clock = 1000;
  reader(); // the background check starts and hangs
  source = 'b'; // the source moves while it runs
  const during = reader();
  assert.equal(during.incomplete, true);
  assert.equal(during.ok, false);
  assert.equal(sync, 1, 'no synchronous check beside the one in flight');
  assert.equal(most, 1);
  release();
  await reader.settled();
  assert.deepEqual(
    reader.attempts().map((a) => a.outcome),
    ['timed_out', 'discarded']
  );
  // The changed epoch is checked in the background as soon as the slot frees.
  timers.at(-1)[0]();
  release();
  await reader.settled();
  assert.equal(reader().ok, true);
  assert.equal(sync, 1);
  assert.equal(most, 1);
});

test('a check whose child has not exited holds the slot, visibly, and nothing else is spawned', async () => {
  let clock = 0,
    spawned = 0,
    exit;
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => 'fixed',
    now: () => clock,
    retryMs: 1000,
    schedule: () => {},
    run: () => timedOut(),
    runAsync: async () => {
      spawned++;
      // Its result arrives on time, but the child survived SIGKILL.
      return { ...timedOut(), unconfirmed: true, exited: new Promise((done) => (exit = done)) };
    },
  });
  reader();
  clock = 1000;
  reader();
  await new Promise((done) => setImmediate(done));
  const stuck = reader();
  assert.equal(stuck.incomplete, true);
  assert.equal(reader.inFlight().awaiting_exit, true);
  clock = 1e9; // long past the next retry time
  reader();
  reader();
  assert.equal(spawned, 1, 'no second check while the first child may be alive');
  exit();
  await reader.settled();
  assert.equal(reader.inFlight(), undefined);
  reader();
  assert.equal(spawned, 2);
});

test('a timer that fires early waits out the remainder', () => {
  let clock = 0,
    spawned = 0;
  const timers = [];
  const reader = createRuntimeAssetReader({
    env: {},
    source: () => 'fixed',
    now: () => clock,
    retryMs: 1000,
    schedule: (start, ms) => timers.push([start, ms]),
    run: () => timedOut(),
    runAsync: async () => (spawned++, timedOut()),
  });
  reader();
  clock = 999; // a timer may fire a millisecond before Date.now reaches it
  timers.at(-1)[0]();
  assert.equal(spawned, 0);
  assert.equal(timers.at(-1)[1], 1);
  clock = 1000;
  timers.at(-1)[0]();
  assert.equal(spawned, 1);
});

test('a child that ignores SIGTERM is killed with its group, and its exit is confirmed', async () => {
  const started = Date.now();
  // The shell ignores SIGTERM (inherited by its children) and leaves a
  // grandchild holding the output pipes.
  const result = await spawnAsync('sh', ['-c', 'trap "" TERM; sleep 30 & sleep 30'], {
    timeout: 200,
    killGraceMs: 300,
  });
  assert.equal(result.status, null);
  assert.equal(result.error.code, 'ETIMEDOUT');
  await result.exited; // the group, grandchild included, is gone
  assert(Date.now() - started < 5000, 'SIGKILL ended it inside the grace');
});
