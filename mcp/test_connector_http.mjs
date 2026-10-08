// Public HTTP entry point, real MCP transport and no provider credentials/calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { renderRecipe } from './engine.js';
import { canonicalJSON } from './reader_scheduler.js';
import { ReaderJobStore } from './reader_job_store.js';
import { signReaderRequest } from './reader_routes.js';

async function freePort() {
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function stopHTTP(child, exited, output, repeatSignals = false) {
  const started = Date.now();
  let timer;
  child.kill('SIGTERM');
  const repeat = repeatSignals
    ? setTimeout(() => {
        child.kill('SIGTERM');
        child.kill('SIGINT');
      }, 50)
    : null;
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), 10_000);
    }),
  ]);
  clearTimeout(timer);
  clearTimeout(repeat);
  if (!stopped) {
    child.kill('SIGKILL');
    await exited;
  }
  assert.equal(
    stopped,
    true,
    `HTTP shutdown did not exit within 10 seconds after SIGTERM. Last server output:\n${output().slice(-3000)}`
  );
  return Date.now() - started;
}

async function waitForHealth(base, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
    } catch {}
    if (child.exitCode != null) assert.fail(`HTTP server exited: ${output()}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`HTTP health did not answer within 15 seconds: ${output()}`);
}

test(
  'public HTTP rejects untrusted Origin before dispatch and reports disabled lyrics honestly',
  { timeout: 60_000 },
  async () => {
    const port = await freePort(),
      root = mkdtempSync(join(tmpdir(), 'connector-http-'));
    const base = `http://127.0.0.1:${port}`,
      origin = 'https://allowed.example';
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./server_http.js', import.meta.url))],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: {
          ...process.env,
          PORT: String(port),
          GEMINI_API_KEY: '',
          LYRIC_RUNTIME_DIR: root,
          MCP_ALLOWED_ORIGINS: origin,
          RENDER_GIT_COMMIT: 'a'.repeat(40),
        },
      }
    );
    let output = '';
    child.stdout.on('data', (c) => {
      output += c;
    });
    child.stderr.on('data', (c) => {
      output += c;
    });
    const exited = new Promise((resolve) => child.once('exit', resolve));
    try {
      let health;
      // This test is one leaf in the four-way parallel CI runner.  Starting
      // the full lyric runtime can take longer than 15 seconds while the three
      // neighbouring leaves are doing their own CPU-heavy catalog work.  Wait
      // for the observable health contract rather than turning runner
      // contention into a startup failure; the enclosing test timeout still
      // provides a firm bound if the server never becomes healthy.
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        try {
          health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
          if (health.ok) break;
        } catch {}
        if (child.exitCode != null) assert.fail(`HTTP server exited: ${output}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert(health?.ok, output);
      const healthBody = await health.json();
      assert.equal(healthBody.commit, 'a'.repeat(40));
      // Connector sessions have their own store, sized apart from /chat's.
      assert.equal(healthBody.recovery.sessions.durable, true);
      assert.equal(healthBody.recovery.sessions.healthy, true);
      assert(
        healthBody.recovery.sessions.max_payload_records > healthBody.recovery.max_payload_records
      );
      const card = await (await fetch(`${base}/.well-known/mcp.json`)).json();
      const manifest = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
      assert.equal(
        card.version,
        manifest.version,
        'published registry version matches the real HTTP card'
      );
      assert.equal(
        card.description,
        manifest.description,
        'published registry describes actual stateful revision'
      );
      const readyResponse = await fetch(`${base}/ready`),
        ready = await readyResponse.json();
      assert.equal(readyResponse.status, 503);
      assert.equal(ready.ready, false);
      assert.equal(ready.capabilities.recipe, true);
      assert.equal(ready.capabilities.lyrics, false);
      assert.equal(ready.recovery.durable, true);
      assert.equal(ready.configuration.maxTurns, 50);
      const status = await (await fetch(`${base}/chat/status`)).json();
      assert.equal(status.enabled, false);

      // Compression, and the precondition that makes it safe, asserted in one
      // place. `tools/list` is the response every client fetches first and the
      // reason the middleware is mounted at all: on this surface 13,148 bytes
      // plain and 3,784 gzipped, and 100,470 -> 16,626 on /mcp/chatgpt, the
      // largest the service serves. undici reports `content-encoding` as the
      // server sent it and decompresses underneath, so the same response proves
      // both that the bytes were compressed and that what arrives is still the
      // exact JSON-RPC frame an uncompressed client would have read.
      const handshake = await fetch(`${base}/mcp/recipe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'accept-encoding': 'gzip',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(handshake.headers.get('content-encoding'), 'gzip');
      // The SDK marks this response no-transform, which compression would obey;
      // the server drops only that token (keepCompressible), never no-cache.
      assert.equal(handshake.headers.get('cache-control'), 'no-cache');
      const framed = await handshake.text();
      assert(framed.startsWith('event: message\n'), framed.slice(0, 80));
      assert.equal(
        JSON.parse(framed.slice(framed.indexOf('data: ') + 6)).result.tools.length,
        9,
        'the decompressed frame is the same tool list an uncompressed client reads'
      );
      // A client that does not offer gzip must still be served, uncompressed.
      const plain = await fetch(`${base}/mcp/recipe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'accept-encoding': 'identity',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(plain.headers.get('content-encoding'), null);
      assert.equal(await plain.text(), framed, 'both encodings deliver the same frame');
      // THE PRECONDITION. `compression` buffers, so it is safe here only
      // because no response is a long-lived stream. Enabling the Streamable
      // HTTP GET channel would introduce one and turn delivered events into
      // events held until the stream ended; this is the assertion that would
      // fail first if someone did.
      for (const method of ['GET', 'DELETE']) {
        const refused = await fetch(`${base}/mcp/recipe`, { method });
        assert.equal(refused.status, 405, `${method} must stay refused: compression buffers`);
      }
      for (const endpoint of [
        '/mcp',
        '/mcp/recipe',
        '/mcp/chatgpt',
        '/mcp/chatgpt/recipe',
        '/mcp/chatgpt/lyrics',
      ]) {
        for (const method of ['GET', 'OPTIONS', 'POST']) {
          const rejected = await fetch(`${base}${endpoint}`, {
            method,
            headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
            ...(method === 'POST'
              ? {
                  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
                }
              : {}),
          });
          assert.equal(rejected.status, 403, method);
          assert.equal(rejected.headers.get('access-control-allow-origin'), null);
        }
      }
      const allowed = await fetch(`${base}/mcp/recipe`, { method: 'OPTIONS', headers: { origin } });
      assert.equal(allowed.status, 204);
      assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
      const client = new Client({ name: 'http-contract', version: '1' }, { capabilities: {} });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/recipe`)));
      try {
        const tools = (await client.listTools()).tools;
        assert.equal(tools.length, 9);
        assert(tools.every((tool) => !tool.name.startsWith('lyric_')));
        assert(client.getInstructions().includes('1000'));
        const refused = await client.callTool({
          name: 'lyric_sweep',
          arguments: { seed_from: 1, count: 1 },
        });
        assert.equal(refused.isError, true);
        const initial = await client.callTool({
          name: 'start_recipe',
          arguments: { traditions: ['delta_blues'] },
        });
        const { workspace } = JSON.parse(initial.content[0].text);
        for (const format of ['rich', 'tags', 'prose', 'compact']) {
          const rendered = await client.callTool({
            name: 'render_recipe',
            arguments: { workspace, format },
          });
          assert(!rendered.isError, JSON.stringify(rendered));
          assert.equal(
            JSON.parse(rendered.content[0].text).recipe,
            renderRecipe({ workspace, format }).recipe
          );
        }
      } finally {
        await client.close();
      }
      const connectWorkflow = async (domain) => {
        const connection = new Client(
          { name: 'shared-http-contract', version: '1' },
          { capabilities: {} }
        );
        await connection.connect(
          new StreamableHTTPClientTransport(
            new URL(`${base}/mcp${domain ? `/chatgpt/${domain}` : ''}`)
          )
        );
        return connection;
      };
      let shared = await connectWorkflow();
      let session_id;
      try {
        assert.equal((await shared.listTools()).tools.length, 21);
        const initial = await shared.callTool({
          name: 'start_recipe',
          arguments: { traditions: ['delta_blues'] },
        });
        session_id = initial.structuredContent.session_id;
        assert(JSON.parse(initial.content[0].text).workspace);
      } finally {
        await shared.close();
      }
      shared = await connectWorkflow();
      try {
        const rendered = await shared.callTool({
          name: 'render_recipe',
          arguments: { session_id, format: 'prose' },
        });
        assert(!rendered.isError, JSON.stringify(rendered));
        assert.equal(rendered.structuredContent.status, 'completed');
        assert.notEqual(rendered.structuredContent.session_id, session_id);
      } finally {
        await shared.close();
      }
      shared = await connectWorkflow();
      let operation_id;
      try {
        const initial = await shared.callTool({
          name: 'begin_lyrics',
          arguments: {},
        });
        const queued = await shared.callTool({
          name: 'lyric_sweep',
          arguments: {
            session_id: initial.structuredContent.session_id,
            seed_from: 31,
            count: 1,
            lines: 12,
          },
        });
        assert.equal(queued.structuredContent.status, 'pending');
        operation_id = queued.structuredContent.operation_id;
      } finally {
        await shared.close();
      }
      shared = await connectWorkflow();
      try {
        let operation;
        const deadline = Date.now() + 10_000;
        do {
          const read = await shared.callTool({
            name: 'get_operation',
            arguments: { operation_id },
          });
          operation = read.structuredContent;
          if (operation.status !== 'pending') break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } while (Date.now() < deadline);
        assert.equal(operation.status, 'completed', JSON.stringify(operation));
        assert(!operation.tool_result.isError);
        assert.equal(JSON.parse(operation.tool_result.content[0].text).exit_code, 0);
      } finally {
        await shared.close();
      }
      // Alias capabilities and canonical capabilities belong to the same store.
      const alias = await connectWorkflow('recipe');
      try {
        const read = await alias.callTool({
          name: 'get_operation',
          arguments: { operation_id: session_id },
        });
        assert.equal(read.structuredContent.status, 'completed');
      } finally {
        await alias.close();
      }
      const { expectedSharedSurface } = await import('./workflow_tools.js');
      const { surfaceDrift, initializationDrift, initialization } =
        await import('./surface_contract.js');
      const canonical = await connectWorkflow();
      try {
        const expected = await expectedSharedSurface();
        assert.deepEqual(surfaceDrift(expected.tools, (await canonical.listTools()).tools), []);
        assert.deepEqual(initializationDrift(expected.init, initialization(canonical)), []);
      } finally {
        await canonical.close();
      }
      const checker = spawn(
        process.execPath,
        [
          fileURLToPath(new URL('./check_live.mjs', import.meta.url)),
          `${base}/mcp/recipe`,
          '--ready',
        ],
        { env: { ...process.env, GEMINI_API_KEY: '' } }
      );
      let checkOutput = '';
      checker.stdout.on('data', (c) => {
        checkOutput += c;
      });
      checker.stderr.on('data', (c) => {
        checkOutput += c;
      });
      const code = await new Promise((resolve) => checker.once('exit', resolve));
      assert.equal(code, 3, checkOutput);
      assert.match(checkOutput, /lyrics capability is unavailable/);
    } finally {
      try {
        await stopHTTP(child, exited, () => output);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  }
);

for (const blocked of [false, true])
  test(
    `SIGTERM ${blocked ? 'interrupts a blocked reader at its last acknowledged checkpoint' : 'lets an active reader acknowledge its final durable checkpoint'} and reaps its worker`,
    { timeout: 30_000 },
    async (t) => {
      const port = await freePort(),
        root = mkdtempSync(join(tmpdir(), 'connector-reader-shutdown-')),
        catalog = join(root, 'catalog'),
        secret = 'http-shutdown-private-reader-secret-32bytes',
        site = 'http-shutdown-fixture',
        viewer = 'shutdown-reader-viewer',
        base = `http://127.0.0.1:${port}`;
      const sha = (value) => createHash('sha256').update(value).digest('hex');
      mkdirSync(join(catalog, 'readings'), { recursive: true });
      const source = {
        reading_unit_id: 'unit_shutdown',
        language: 'fin',
        availability: 'readable',
        source_sha256: sha('Vaka vanha'),
        normalized_sha256: sha('Vaka vanha'),
        normalized_text: 'Vaka vanha',
        work_id: 'work_shutdown',
        edition_id: 'edition_shutdown',
        lines: [],
      };
      source.reading_revision = sha(canonicalJSON(source));
      const sourceBytes = JSON.stringify(source),
        indexBytes = JSON.stringify({ readings: [source] }),
        manifest = {
          parser_version: 'shutdown-fixture1',
          normalizer_version: 'shutdown-fixture1',
          counts: { reading_units: 1 },
          artifacts: {
            'index.json': sha(indexBytes),
            'readings/unit_shutdown.json': sha(sourceBytes),
          },
        };
      manifest.snapshot_id = sha(canonicalJSON(manifest));
      writeFileSync(join(catalog, 'readings/unit_shutdown.json'), sourceBytes);
      writeFileSync(join(catalog, 'index.json'), indexBytes);
      writeFileSync(join(catalog, 'manifest.json'), JSON.stringify(manifest));
      const worker = join(root, 'fixture-python.mjs'),
        pidFile = join(root, 'worker-pid'),
        ackFile = join(root, 'worker-acks.jsonl');
      // An actual subprocess and reader protocol, without loading native assets
      // or making provider calls. An asset probe is honestly unavailable here.
      writeFileSync(
        worker,
        `#!${process.execPath}
import fs from 'node:fs';
import readline from 'node:readline';
if (!process.argv.some(a => a.endsWith('/worker.py'))) {
  console.log(JSON.stringify({ok:false,errors:['Shutdown fixture has no native asset inventory.']}));
  process.exit(0);
}
fs.writeFileSync(process.env.HTTP_SHUTDOWN_PID_FILE,String(process.pid));
let request,at=0;
const send = value => process.stdout.write(JSON.stringify(value)+'\\n');
const step = () => {
  at++;
  const coverage={certified:false,partial:true,requested_methods:1,answered_methods:0,refused_methods:0,pending_methods:1,not_requested_methods:0,refused_obligations:[]};
  send({id:request.id,event:'reader_checkpoint',data:{checkpoint:{at,done:false},records:[{id:'shutdown-evidence-'+at,kind:'line',line_id:'line:0'}],done:false,provider_calls:0,summary:{coverage,counters:{evidence_records:at}}}});
};
readline.createInterface({input:process.stdin}).on('line',line=>{
  const frame=JSON.parse(line);
  if (frame.family==='reader') {request=frame;step();}
  else if(frame.event==='reader_ack') {
    fs.appendFileSync(process.env.HTTP_SHUTDOWN_ACK_FILE,JSON.stringify(frame)+'\\n');
    if(!frame.continue) send({id:request.id,code:0,stdout:'',stderr:'',reader_result:{status:'paused',reason:frame.reason,provider_calls:0}});
    else if(process.env.HTTP_SHUTDOWN_BLOCKED!=='1') setTimeout(step,250);
  }
});
`,
        { mode: 0o700 }
      );
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL('./server_http.js', import.meta.url))],
        {
          cwd: fileURLToPath(new URL('..', import.meta.url)),
          env: {
            ...process.env,
            PORT: String(port),
            GEMINI_API_KEY: '',
            LYRIC_RUNTIME_DIR: root,
            LYRIC_PYTHON: worker,
            READER_BRIDGE_SECRET: secret,
            READER_SITE_ID: site,
            READER_CATALOG_DIR: catalog,
            READER_RESOURCE_FINGERPRINT: 'shutdown-fixture',
            HTTP_SHUTDOWN_PID_FILE: pidFile,
            HTTP_SHUTDOWN_ACK_FILE: ackFile,
            HTTP_SHUTDOWN_BLOCKED: blocked ? '1' : '0',
          },
        }
      );
      let output = '',
        stopped = false;
      child.stdout.on('data', (c) => (output += c));
      child.stderr.on('data', (c) => (output += c));
      const exited = new Promise((resolve) => child.once('exit', resolve));
      try {
        const health = await waitForHealth(base, child, () => output);
        assert.equal(health.reader.ready, true);
        assert.equal(health.reader.provider_calls, 0);
        const route = '/internal/reader/jobs',
          body = JSON.stringify({
            contract_version: 1,
            snapshot_id: manifest.snapshot_id,
            reading_unit_id: source.reading_unit_id,
            reading_revision: source.reading_revision,
            declaration_set: {},
            requested_layers: ['sound'],
          });
        const response = await fetch(base + route, {
          method: 'POST',
          headers: {
            ...signReaderRequest({
              secret,
              method: 'POST',
              path: route,
              body,
              site,
              viewer,
              idempotency: 'shutdown-once',
            }),
            'content-type': 'application/json',
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        const created = await response.json();
        assert.equal(response.status, 202, JSON.stringify(created));
        const deadline = Date.now() + 5000;
        while (
          (!existsSync(ackFile) || !readFileSync(ackFile, 'utf8').trim()) &&
          Date.now() < deadline
        )
          await new Promise((resolve) => setTimeout(resolve, 25));
        assert(existsSync(ackFile), `Reader never acknowledged a durable checkpoint: ${output}`);
        const workerPid = Number(readFileSync(pidFile, 'utf8')),
          firstAck = JSON.parse(readFileSync(ackFile, 'utf8').trim().split('\n')[0]);
        assert.equal(firstAck.continue, true);
        assert.equal(firstAck.added_page_paths.length, 1);
        const firstPage = readFileSync(firstAck.added_page_paths[0], 'utf8');
        const elapsed = await stopHTTP(child, exited, () => output, blocked);
        stopped = true;
        assert.equal(child.exitCode, 0);
        assert.throws(() => process.kill(workerPid, 0), { code: 'ESRCH' });
        const store = new ReaderJobStore({ directory: join(root, 'reader-jobs') }),
          persisted = store.inspect(created.job.id),
          pinned = store.readManifest(created.job.id, created.capability, viewer);
        assert.equal(persisted.state, 'paused');
        assert.equal(persisted.reason.code, 'INTERRUPTED');
        assert.equal(pinned.partial, true);
        assert.equal(readFileSync(firstAck.added_page_paths[0], 'utf8'), firstPage);
        assert.ok(persisted.checkpoint_hash);
        const refs = store.readManifestPage(
          created.job.id,
          created.capability,
          viewer,
          persisted.manifest_hash,
          { offset: 0, limit: 250 }
        ).page_refs;
        const records = refs.flatMap(
          (ref) =>
            store.readPage(
              created.job.id,
              ref.sha256,
              created.capability,
              viewer,
              persisted.manifest_hash
            ).instances
        );
        assert.deepEqual(
          records.map((record) => record.id),
          Array.from({ length: persisted.cursor.at }, (_, i) => `shutdown-evidence-${i + 1}`)
        );
        if (blocked) assert.equal(persisted.cursor.at, 1);
        else {
          const lastAck = JSON.parse(readFileSync(ackFile, 'utf8').trim().split('\n').at(-1));
          assert.equal(lastAck.reason, 'INTERRUPTED');
          assert.equal(lastAck.continue, false);
          assert(persisted.cursor.at >= 2);
        }
        t.diagnostic(
          `SIGTERM exited in ${elapsed}ms with ${records.length} persisted evidence record(s).`
        );
      } finally {
        try {
          if (!stopped) await stopHTTP(child, exited, () => output);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      }
    }
  );

test(
  'an unusable session store stops no recipe, refuses lyric sessions, and says both at startup',
  { timeout: 60_000 },
  async () => {
    const port = await freePort(),
      root = mkdtempSync(join(tmpdir(), 'connector-http-'));
    // A file where the session store's directory should be.
    writeFileSync(join(root, 'sessions'), 'not a directory');
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./server_http.js', import.meta.url))],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '', LYRIC_RUNTIME_DIR: root },
      }
    );
    let output = '';
    child.stdout.on('data', (c) => {
      output += c;
    });
    child.stderr.on('data', (c) => {
      output += c;
    });
    const exited = new Promise((resolve) => child.once('exit', resolve));
    try {
      let health;
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        try {
          health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
          if (health.ok) break;
        } catch {}
        if (child.exitCode != null) assert.fail(`HTTP server exited: ${output}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert(health?.ok, output);
      assert.match(
        output,
        /session persistence is unusable; recipe calls answer without saving a session and lyric sessions are refused/
      );
      assert.doesNotMatch(output, /\/chat is disabled/);
      const recovery = (await health.json()).recovery;
      assert.equal(recovery.healthy, true);
      assert.equal(recovery.sessions.healthy, false);
      const client = new Client({ name: 'broken-store', version: '1' }, { capabilities: {} });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
      try {
        const started = await client.callTool({
          name: 'start_recipe',
          arguments: { traditions: ['delta_blues'] },
        });
        assert(!started.isError, JSON.stringify(started));
        const payload = JSON.parse(started.content[0].text);
        assert(payload.workspace);
        assert.match(JSON.parse(started.content.at(-1).text).note, /^NOT SAVED/);
        const begun = await client.callTool({ name: 'begin_lyrics', arguments: {} });
        assert.equal(begun.isError, true);
      } finally {
        await client.close();
      }
    } finally {
      try {
        await stopHTTP(child, exited, () => output);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  }
);
