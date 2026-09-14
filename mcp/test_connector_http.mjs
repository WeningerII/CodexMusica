// Public HTTP entry point, real MCP transport and no provider credentials/calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { renderRecipe } from './engine.js';

async function freePort() {
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

test(
  'public HTTP rejects untrusted Origin before dispatch and reports disabled lyrics honestly',
  { timeout: 30_000 },
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
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        try {
          health = await fetch(`${base}/health`);
          if (health.ok) break;
        } catch {}
        if (child.exitCode != null) assert.fail(`HTTP server exited: ${output}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert(health?.ok, output);
      assert.equal((await health.json()).commit, 'a'.repeat(40));
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
      // place. `tools/list` is the largest response every client fetches and
      // the reason the middleware is mounted at all: 76,378 bytes here, 16,194
      // on the wire gzipped. undici reports `content-encoding` as the server
      // sent it and decompresses underneath, so the same response proves both
      // that the bytes were compressed and that what arrives is still the
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
      for (const endpoint of ['/mcp/recipe', '/mcp/chatgpt/recipe', '/mcp/chatgpt/lyrics']) {
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
      const connectChatGPT = async (domain) => {
        const connection = new Client(
          { name: 'chatgpt-http-contract', version: '1' },
          { capabilities: {} }
        );
        await connection.connect(
          new StreamableHTTPClientTransport(new URL(`${base}/mcp/chatgpt/${domain}`))
        );
        return connection;
      };
      let chatgpt = await connectChatGPT('recipe');
      let session_id;
      try {
        assert.equal((await chatgpt.listTools()).tools.length, 11);
        const initial = await chatgpt.callTool({
          name: 'start_recipe',
          arguments: { traditions: ['delta_blues'] },
        });
        session_id = initial.structuredContent.session_id;
        assert(!JSON.parse(initial.content[0].text).workspace);
      } finally {
        await chatgpt.close();
      }
      chatgpt = await connectChatGPT('recipe');
      try {
        const rendered = await chatgpt.callTool({
          name: 'render_recipe',
          arguments: { session_id, format: 'prose' },
        });
        assert(!rendered.isError, JSON.stringify(rendered));
        assert.equal(rendered.structuredContent.status, 'completed');
        assert.notEqual(rendered.structuredContent.session_id, session_id);
      } finally {
        await chatgpt.close();
      }
      chatgpt = await connectChatGPT('lyrics');
      let operation_id;
      try {
        const initial = await chatgpt.callTool({
          name: 'begin_lyrics',
          arguments: { writer: 'interview' },
        });
        const queued = await chatgpt.callTool({
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
        await chatgpt.close();
      }
      chatgpt = await connectChatGPT('lyrics');
      try {
        let operation;
        const deadline = Date.now() + 10_000;
        do {
          const read = await chatgpt.callTool({
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
        await chatgpt.close();
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
      child.kill('SIGTERM');
      await exited;
      rmSync(root, { recursive: true, force: true });
    }
  }
);
