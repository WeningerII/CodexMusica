#!/usr/bin/env node
// check_live.mjs — does the RUNNING connector advertise the surface this tree
// declares? (MISSING.md M-127.)
//
// THE LOOP THIS CLOSES. Every check in this repository runs against the CODE:
// mcp/test.mjs builds the server in-process and proves its shape, CI proves the
// tree, and NOTHING ever asked the deployed process what it is actually
// serving. So the deployment could drift from the tree silently — and did: on
// 2026-08-26 a live server was found advertising lyric_sweep with a 12-want
// ceiling and no story_lineups predicate, one commit (0e1ef17) behind the tree
// it was deployed from, discovered by a person reading a schema rather than by
// anything that gates. A staleness that only a person can notice is the
// private-instrument defect wearing a deployment hat.
//
// WHAT IT COMPARES: the tool surface a CLIENT sees — (name, description,
// inputSchema) for every advertised tool — read through the SAME SDK listTools
// path on both sides, so whatever the SDK rewrites on the way out is rewritten
// identically on both and the comparison is apples to apples. The EXPECTED
// side is buildServer() from this tree over an in-memory transport; the LIVE
// side is the URL. Order is not part of the surface (tools compare as a map
// keyed on name).
//
// THREE ANSWERS, NEVER COLLAPSED (doctrine 20/79):
//   exit 0  MATCH   — the live surface is byte-identical to the tree's
//   exit 3  DRIFT   — the live server ANSWERED and does not match; every
//                     drifted tool is named with the coordinate that moved
//   exit 2  REFUSED — the live server could not be asked (unreachable, bad
//                     URL, handshake failure). A server that cannot be asked
//                     is not a server that matches.
//
// Usage: node check_live.mjs [URL]     (or MCP_LIVE_URL in the environment)
// The default is the deployed endpoint render.yaml declares (service name
// `codex-musica-mcp`, path /mcp) — render.yaml is the one definition of the
// deployment and this literal is a quotation of it, overridable per call.
//
// WHERE IT GATES: the nightly CI job, and deliberately NOT the per-push jobs —
// render.yaml deploys from main, so a feature branch that edits the connector
// LEGITIMATELY differs from the deployment until it merges, and a per-push
// gate would charge every honest connector change with the drift it is about
// to fix. The nightly runs on main, where tree != deployment is always a
// defect: either autoDeploy failed or it has not caught up.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { buildServer } from './tools.js';

const DEFAULT_URL = 'https://codex-musica-mcp.onrender.com/mcp';

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
    });
  return map;
}

// The pure comparator, exported so mcp/test.mjs can prove it fails in every
// direction without a network. Returns a list of drift records; [] is MATCH.
export function surfaceDrift(expectedTools, liveTools) {
  const exp = surfaceOf(expectedTools);
  const live = surfaceOf(liveTools);
  const drift = [];
  for (const name of exp.keys())
    if (!live.has(name)) drift.push({ tool: name, what: 'missing from the live server' });
  for (const name of live.keys())
    if (!exp.has(name)) drift.push({ tool: name, what: 'advertised live but not in the tree' });
  for (const [name, e] of exp) {
    const l = live.get(name);
    if (!l) continue;
    if (e.description !== l.description) drift.push({ tool: name, what: 'description differs' });
    if (e.inputSchema !== l.inputSchema) drift.push({ tool: name, what: 'inputSchema differs' });
  }
  return drift;
}

// M-230: the surface is not the build. A change that touches no tool leaves
// the surface identical between two deployments, so a caller that needs THIS
// commit serving (the battery's wait-for-live) also asks /health for the sha
// Render built and compares it here. Prefix-tolerant so a short sha works;
// a server that does not say its commit (null — a build older than this
// instrument, or a runtime without RENDER_GIT_COMMIT) is NOT a match: unknown
// is not equal (deploy-connector.yml's own rule).
export function commitDrift(expected, live) {
  const exp = String(expected ?? '')
    .trim()
    .toLowerCase();
  if (!exp) return null;
  const got = live == null ? '' : String(live).trim().toLowerCase();
  if (!got) return `the live server does not report a commit (expected ${exp.slice(0, 12)})`;
  if (exp.length < 7 || got.length < 7)
    return `a sha shorter than 7 characters cannot be matched (${exp} vs ${got})`;
  if (exp.startsWith(got) || got.startsWith(exp)) return null;
  return `the live server is serving ${got.slice(0, 12)}, not ${exp.slice(0, 12)}`;
}

async function liveCommit(url) {
  const health = new URL('/health', url);
  const res = await fetch(health, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${health} -> ${res.status}`);
  const body = await res.json();
  return body && typeof body === 'object' ? (body.commit ?? null) : null;
}

async function listAll(client) {
  const tools = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

async function expectedSurface() {
  const server = buildServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'check-live-expected', version: '0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const tools = await listAll(client);
  await client.close();
  return tools;
}

async function liveSurface(url) {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: 'check-live', version: '0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    return await listAll(client);
  } finally {
    await client.close();
  }
}

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flag = process.argv.slice(2).find((a) => a.startsWith('--commit='));
  const url = positional[0] || process.env.MCP_LIVE_URL || DEFAULT_URL;
  const expectCommit = flag ? flag.slice('--commit='.length) : process.env.EXPECT_COMMIT || '';
  const expected = await expectedSurface();

  let live;
  try {
    // One clock, declared: an endpoint that cannot answer listTools in 30s is
    // refused rather than waited on — the nightly needs an answer, not a hang.
    live = await Promise.race([
      liveSurface(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 30s')), 30_000)),
    ]);
  } catch (err) {
    console.log(`REFUSED — could not ask the live server at ${url}: ${err.message}`);
    console.log('a server that cannot be asked is not a server that matches (doctrine 20)');
    process.exit(2);
  }

  const drift = surfaceDrift(expected, live);
  if (drift.length === 0) {
    // M-230: with a commit to expect, the surface matching is necessary, not
    // sufficient — the build has to say it is this one.
    if (expectCommit) {
      let got;
      try {
        got = await Promise.race([
          liveCommit(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 30s')), 30_000)),
        ]);
      } catch (err) {
        console.log(`REFUSED — could not read /health at ${url}: ${err.message}`);
        process.exit(2);
      }
      const why = commitDrift(expectCommit, got);
      if (why) {
        console.log(`DRIFT — the surface matches but the build does not: ${why}`);
        console.log(
          'the surface is not the build — a change that touches no tool leaves it identical'
        );
        process.exit(3);
      }
    }
    console.log(
      `MATCH — the live server at ${url} advertises the tree's own surface: ` +
        `${expected.length} tool(s), descriptions and schemas byte-identical under canonical ordering` +
        (expectCommit ? `; /health reports commit ${String(expectCommit).slice(0, 12)}` : '')
    );
    process.exit(0);
  }
  console.log(`DRIFT — ${drift.length} difference(s) between the tree and ${url}:`);
  for (const d of drift) console.log(`  ${d.tool}: ${d.what}`);
  console.log(
    'the deployment is serving a different connector than this tree declares — redeploy, or explain'
  );
  process.exit(3);
}

// Import-safe: running is the side effect of being the entry, never of being
// imported (test.mjs imports the comparator).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.log(`REFUSED — the instrument itself failed: ${err.message}`);
    process.exit(2);
  });
}
