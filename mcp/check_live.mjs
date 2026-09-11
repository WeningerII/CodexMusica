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
// WHAT IT COMPARES: complete initialization and tool metadata, including
// descriptions, input/output schemas and annotations — read through SDK listTools
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
// The default URL is the existing public connector; migration preserves it.
// Desired settings come from production-config.json. --config=render retains
// its public CLI spelling but never reads the legacy deployment Blueprint.
// Check deployed-image identity after promotion; a feature checkout is not
// expected to match production before promotion.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFile } from 'node:fs/promises';
import { expectedProductionConfig, configDrift } from './runtime_config.js';
import {
  surfaceDrift,
  initializationDrift,
  initialization,
  listAll,
  expectedSurface,
} from './surface_contract.js';
export { canonical, surfaceDrift, initializationDrift } from './surface_contract.js';
import { validateImageManifest, imageBuildDrift } from '../scripts/image_release.mjs';

const DEFAULT_URL = 'https://mcp.codexmusica.com/mcp';

export function parseLiveArguments(argv) {
  const flags = {},
    positional = [];
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const match = /^--(commit|config|image-manifest)=(.+)$/.exec(arg);
    const key = arg === '--ready' ? 'ready' : match?.[1];
    if (!key || key in flags)
      throw new Error(`Unknown, empty or duplicate live-check option: ${arg}`);
    flags[key] = key === 'ready' ? true : match[2];
  }
  if (positional.length > 1) throw new Error('Supply at most one live endpoint URL.');
  if (flags.config && flags.config !== 'render') throw new Error('Unknown configuration profile');
  return { url: positional[0], ...flags };
}

async function endpointJson(url, endpoint, { allowFailure = false } = {}) {
  const res = await fetch(new URL(endpoint, url), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!allowFailure && !res.ok) throw new Error(`GET ${endpoint} -> ${res.status}`);
  const body = await res.json();
  return allowFailure ? { ...body, _http_status: res.status } : body;
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
  const res = await fetch(health, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GET ${health} -> ${res.status}`);
  const body = await res.json();
  return body && typeof body === 'object' ? (body.commit ?? null) : null;
}

async function liveSurface(url) {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: 'check-live', version: '0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    return { tools: await listAll(client), init: initialization(client) };
  } finally {
    await client.close();
  }
}

export function readinessDrift(ready, { expected = null, status = null } = {}) {
  const drift = [];
  if (
    (ready?._http_status != null && ready._http_status !== 200) ||
    ready?.ready !== true ||
    ready.capabilities?.lyrics !== true ||
    ready.recovery?.healthy !== true
  )
    drift.push({ tool: '/ready', what: 'lyrics capability is unavailable' });
  if (expected) {
    drift.push(...configDrift(expected, ready?.configuration));
    if (ready?.recovery?.durable !== true)
      drift.push({ tool: '/ready', what: 'production recovery is not durable' });
    if (
      (status?._http_status != null && status._http_status !== 200) ||
      status?.enabled !== true ||
      status.capDurable !== true ||
      status.accountingBlocked
    )
      drift.push({ tool: '/chat/status', what: 'paid accounting is unavailable or not durable' });
  }
  return drift;
}

async function main() {
  const args = parseLiveArguments(process.argv.slice(2));
  const url = args.url || process.env.MCP_LIVE_URL || DEFAULT_URL;
  const expectCommit = args.commit || process.env.EXPECT_COMMIT || '';
  const requireReady = args.ready;
  const configFlag = args.config;
  const imageFlag = args['image-manifest'];
  if (imageFlag && !expectCommit) throw new Error('An image manifest requires an expected commit.');
  const task = /\/(recipe|lyrics)\/?$/.exec(new URL(url).pathname)?.[1] || null;
  const expected = await expectedSurface(task);

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

  const drift = [
    ...surfaceDrift(expected.tools, live.tools),
    ...initializationDrift(expected.init, live.init),
  ];
  if (imageFlag) {
    const manifest = JSON.parse(await readFile(imageFlag, 'utf8'));
    validateImageManifest(manifest, { sha: expectCommit, repository: manifest.repository });
    const health = await endpointJson(url, '/health');
    drift.push(
      ...imageBuildDrift(manifest, health.build).map((key) => ({
        tool: '/health',
        what: `tested image build.${key} differs`,
      }))
    );
  }
  if (requireReady || configFlag) {
    const ready = await endpointJson(url, '/ready', { allowFailure: true });
    const status = configFlag
      ? await endpointJson(url, '/chat/status', { allowFailure: true })
      : null;
    drift.push(
      ...readinessDrift(ready, { expected: configFlag ? expectedProductionConfig() : null, status })
    );
  }
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
        `${expected.tools.length} tool(s), full tool metadata and initialization match` +
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
