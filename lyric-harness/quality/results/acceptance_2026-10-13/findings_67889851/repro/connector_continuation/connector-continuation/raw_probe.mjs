// BB8 connector-continuation probe: the RAW engine (no session_id), in-process.
// usage: node --import ./nm_register.mjs raw_probe.mjs <tree> start <out.json> [variant]
//        node --import ./nm_register.mjs raw_probe.mjs <tree> continue <in.json> <out.json>
// <tree> is a checkout root; everything is imported from <tree>/mcp.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, mode, file, out, variantArg] = process.argv.slice(2);
const mcp = (f) => pathToFileURL(path.join(tree, 'mcp', f)).href;
const { buildServer } = await import(mcp('tools.js'));
const { RUNS } = await import(mcp('lyric_tools.js'));
const codec = await import(mcp('state_codec.js'));
const { runtimeSourceFingerprint } = await import(mcp('build_identity.js'));
const { runtimeAssets } = await import(mcp('runtime_assets.js'));
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'bb8-raw', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
  return r;
};
const textOf = (r) => (r.content || []).map((c) => c.text).join('\n');
const verdictOf = (r) => {
  for (const block of r.content || []) {
    try {
      const v = JSON.parse(block.text);
      if (typeof v.exit_code === 'number') return v;
    } catch {}
  }
  return null;
};
const assets = runtimeAssets();
const identity = {
  tree,
  connector_semantic_identity: codec.continuationSemanticIdentity(),
  parts: {
    source_sha256: runtimeSourceFingerprint(),
    assets_sha256: assets.assets_sha256,
    manifest_sha256: assets.manifest_sha256,
    python: assets.python,
    nltk: assets.nltk,
    node: process.version,
    reader: assets.reader ?? null,
  },
};
console.log('IDENTITY', JSON.stringify(identity, null, 1));

const VARIANTS = {
  // the test suite's own suspension shape (test_run_continuation.mjs)
  simple: {
    scheme: 'AA',
    relation: 'type:rime riche',
    draft: ['Copper cat', 'Azure dog'],
    writer: 'interview',
    max_rounds: 1,
    backtrack: 0,
  },
  // a line whose v1 and v2 cuts differ ("Oh--oh"), a count member 1.T4
  dash: {
    relation: 'type:rime riche',
    groups: '1.T4,2',
    draft: ['Oh--oh, oh my love', 'Azure dog'],
    writer: 'interview',
    max_rounds: 1,
    backtrack: 0,
  },
};

try {
  if (mode === 'start') {
    const variant = out || 'simple'; // start: 4th arg is the variant
    const args = VARIANTS[variant];
    const r = await call('lyric_revise', args);
    const v = verdictOf(r);
    if (!v) {
      console.log('NO VERDICT', textOf(r).slice(0, 3000));
      process.exit(2);
    }
    // what the state carries (decoded under the SAME tree that wrote it)
    const env = JSON.parse(v.state);
    const decoded = codec.decodeState(v.state);
    const saved = {
      variant,
      args,
      exit_code: v.exit_code,
      status: v.status,
      run_id: v.run_id,
      run_revision: v.run_revision,
      state: v.state,
      envelope_semantic_identity: env.semantic_identity,
      envelope_connector_contract: env.connector_contract,
      state_connector_semantic_identity: decoded.connector_semantic_identity,
      state_reader_scheme: decoded.reader_scheme ?? '(absent)',
      state_answered_reader_scheme: decoded.answered?.reader_scheme ?? '(absent)',
      state_keys: Object.keys(decoded).sort(),
      pending_kind: decoded.pending ? Object.keys(decoded.pending) : null,
      writer_identity: identity,
    };
    fs.writeFileSync(file, JSON.stringify(saved, null, 1));
    console.log(
      'STARTED',
      JSON.stringify({ ...saved, state: `<${saved.state.length} chars>` }, null, 1)
    );
  } else if (mode === 'continue') {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const results = {
      reader: identity,
      writer: saved.writer_identity,
      same_identity:
        saved.writer_identity.connector_semantic_identity === identity.connector_semantic_identity,
    };
    const answer = 'I left the basket underneath the oak';
    const record = (label, r) => {
      const v = verdictOf(r);
      results[label] = {
        isError: !!r.isError,
        text: textOf(r).slice(0, 1600),
        verdict: v
          ? {
              exit_code: v.exit_code,
              status: v.status,
              code: v.code,
              run_id: v.run_id ? '<run>' : null,
              run_revision: v.run_revision,
              run_carried: v.run_carried,
              has_state: typeof v.state === 'string',
            }
          : null,
      };
      console.log(`\n=== ${label}\n`, JSON.stringify(results[label], null, 1));
      return v;
    };
    // (a) decodeState directly
    try {
      codec.decodeState(saved.state);
      results.decodeState = { threw: false };
    } catch (e) {
      results.decodeState = { threw: true, code: e.code, message: e.message };
    }
    console.log('\n=== decodeState\n', JSON.stringify(results.decodeState, null, 1));
    // (b) state + answer, no run_id (the documented "state passed back verbatim")
    record('state_answer', await call('lyric_revise', { state: saved.state, answer }));
    // (c) run_id + run_revision + answer (fresh process: no run record)
    record(
      'runid_answer',
      await call('lyric_revise', {
        run_id: saved.run_id,
        run_revision: saved.run_revision,
        answer,
      })
    );
    // (d) run_id + run_revision + state + answer
    record(
      'runid_state_answer',
      await call('lyric_revise', {
        run_id: saved.run_id,
        run_revision: saved.run_revision,
        state: saved.state,
        answer,
      })
    );
    // (e) state + full declarations resent + answer
    record(
      'state_decl_answer',
      await call('lyric_revise', { ...saved.args, draft: undefined, state: saved.state, answer })
    );
    // (f) recover_only
    const rec = await call('lyric_revise', { recover_only: true, state: saved.state });
    results.recover_only = { isError: !!rec.isError, text: textOf(rec).slice(0, 2400) };
    try {
      const j = JSON.parse(textOf(rec));
      results.recover_only.parsed_keys = Object.keys(j).sort();
      results.recover_only.summary = Object.fromEntries(
        Object.entries(j).filter(([k]) => typeof j[k] !== 'object' || Array.isArray(j[k]))
      );
    } catch {}
    console.log('\n=== recover_only\n', JSON.stringify(results.recover_only, null, 1));
    console.log('\nRUNS size in this process:', RUNS.size ?? '(n/a)');
    fs.writeFileSync(out, JSON.stringify(results, null, 1));
  }
} finally {
  await client.close();
  await server.close();
  // the warm python worker keeps the loop alive
  setTimeout(() => process.exit(0), 200).unref();
  process.exit(0);
}
