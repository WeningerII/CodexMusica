import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';

// Stable stringify: object keys sorted recursively, so two schemas that differ
// only in key order compare equal and a real difference is a real difference.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function surfaceOf(tools) {
  const map = new Map();
  for (const t of tools)
    map.set(t.name, {
      description: t.description || '',
      inputSchema: canonical(t.inputSchema ?? null),
      annotations: canonical(t.annotations ?? null),
      outputSchema: canonical(t.outputSchema ?? null),
      title: canonical(t.title ?? null),
    });
  return map;
}

// The pure comparator, exported so mcp/test.mjs can prove it fails in every
// direction without a network. Returns a list of drift records; [] is MATCH.
export function surfaceDrift(expectedTools, liveTools) {
  const exp = surfaceOf(expectedTools);
  const live = surfaceOf(liveTools);
  const drift = [];
  for (const [label, list] of [
    ['tree', expectedTools],
    ['live', liveTools],
  ]) {
    const seen = new Set();
    for (const tool of list) {
      if (seen.has(tool.name))
        drift.push({ tool: tool.name, what: `duplicate name in ${label} surface` });
      seen.add(tool.name);
    }
  }
  for (const name of exp.keys())
    if (!live.has(name)) drift.push({ tool: name, what: 'missing from the live server' });
  for (const name of live.keys())
    if (!exp.has(name)) drift.push({ tool: name, what: 'advertised live but not in the tree' });
  for (const [name, e] of exp) {
    const l = live.get(name);
    if (!l) continue;
    if (e.description !== l.description) drift.push({ tool: name, what: 'description differs' });
    if (e.inputSchema !== l.inputSchema) drift.push({ tool: name, what: 'inputSchema differs' });
    for (const field of ['annotations', 'outputSchema', 'title'])
      if (e[field] !== l[field]) drift.push({ tool: name, what: `${field} differs` });
  }
  return drift;
}

export function initializationDrift(expected, live) {
  return ['instructions', 'serverInfo', 'capabilities'].flatMap((field) =>
    canonical(expected?.[field] ?? null) === canonical(live?.[field] ?? null)
      ? []
      : [{ tool: 'initialize', what: `${field} differs or is missing` }]
  );
}

export function initialization(client) {
  return {
    instructions: client.getInstructions(),
    serverInfo: client.getServerVersion(),
    capabilities: client.getServerCapabilities(),
  };
}

export async function listAll(client) {
  const tools = [],
    seen = new Set();
  const deadline = performance.now() + 30_000;
  let cursor;
  for (let pageNo = 0; pageNo < 100; pageNo++) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error('Connector discovery exceeded its 30-second budget.');
    const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: remaining });
    tools.push(...page.tools);
    cursor = page.nextCursor;
    if (!cursor) return tools;
    if (seen.has(cursor)) throw new Error('Connector discovery repeated a pagination cursor.');
    seen.add(cursor);
  }
  throw new Error('Connector discovery exceeded its bounded page count.');
}

export async function expectedSurface(task = null) {
  const server = buildServer({ task });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'check-live-expected', version: '0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const tools = await listAll(client);
  const init = initialization(client);
  await client.close();
  return { tools, init };
}
