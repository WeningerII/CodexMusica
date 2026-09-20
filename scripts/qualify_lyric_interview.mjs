#!/usr/bin/env node
// Interactive local qualification through the maintained public creation client.
// Each input is {tool,args}; no generated answers, private grader, or state edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { buildServer } from '../mcp/tools.js';
import { connectConnector } from '../mcp/client.js';
import { _workerInternals } from '../mcp/lyric_tools.js';
import { writePrivateOutput } from './connector_client.mjs';

const require = createRequire(new URL('../mcp/package.json', import.meta.url));
const { InMemoryTransport } = await import(
  require.resolve('@modelcontextprotocol/sdk/inMemory.js')
);

const arg = process.argv[2];
if (!arg?.startsWith('--out='))
  throw Error('Use --out=NEW_DIRECTORY; send {tool,args} as JSON lines.');
const directory = path.resolve(arg.slice(6));
await fs.mkdir(directory, { recursive: false, mode: 0o700 });
const server = buildServer({ task: { domain: 'lyrics' } });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
const client = await connectConnector({ task: 'lyrics', transport: b });
let index = 0;
let previousEnd = Date.now();
console.log(
  JSON.stringify({ ready: true, directory, transport: 'local MCP', writer: 'interview' })
);
try {
  for await (const line of readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    const request = JSON.parse(line);
    if (
      request.tool === 'lyric_revise' &&
      request.args?.writer &&
      request.args.writer !== 'interview'
    )
      throw Error('This qualification runner accepts interview writers only.');
    const start = Date.now();
    const prefix = String(++index).padStart(3, '0');
    await writePrivateOutput(
      path.join(directory, prefix + '-request.json'),
      JSON.stringify(request, null, 2)
    );
    let result;
    try {
      result = await client.call(request.tool, request.args || {});
    } catch (error) {
      result = {
        isError: true,
        error: error.message,
        beforeDispatch: error.beforeDispatch === true,
      };
    }
    const end = Date.now();
    await writePrivateOutput(
      path.join(directory, prefix + '-response.json'),
      JSON.stringify(result, null, 2)
    );
    await writePrivateOutput(
      path.join(directory, prefix + '-session.json'),
      JSON.stringify(client.snapshot())
    );
    let v;
    for (const block of result.content || []) {
      try {
        const parsed = JSON.parse(block.text);
        if (Number.isInteger(parsed.exit_code)) v = parsed;
      } catch {
        /* human prompt */
      }
    }
    const receipt = {
      index,
      tool: request.tool,
      started_at: new Date(start).toISOString(),
      call_wall_ms: end - start,
      operator_interval_ms: start - previousEnd,
      harness_ms: v?.ms ?? null,
      path: v?.path ?? null,
      exit_code: v?.exit_code ?? null,
      status: v?.status ?? v?.measurement_status ?? null,
      certified: v?.certified ?? false,
      asked: v?.asked ?? null,
      isError: result.isError === true,
      error: result.error ?? null,
    };
    await writePrivateOutput(
      path.join(directory, prefix + '-receipt.json'),
      JSON.stringify(receipt, null, 2)
    );
    console.log(JSON.stringify(receipt));
    previousEnd = end;
  }
} finally {
  await Promise.allSettled([client.close(), server.close()]);
  await _workerInternals.kill();
}
