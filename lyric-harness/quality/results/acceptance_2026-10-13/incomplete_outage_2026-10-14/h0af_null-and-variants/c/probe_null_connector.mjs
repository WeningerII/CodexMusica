// null-and-variants (a, connector): the raw engine's lyric_revise (no session) with a caller-held
// `state` whose `reader_scheme` is edited: null / '' / 'V2' / 'v9' / absent / v2 (control).
// Copied into <conn_dir>/mcp/ and run from there. Writes a JSON summary to argv[2].
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { encodeState, decodeState } from './state_codec.js';
const server = buildServer();
const client = new Client({ name: 'bb8-null-probe', version: '1' }, { capabilities: {} });
const [ct, st] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(st), client.connect(ct)]);
const call = (args) => client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 600000 });
const parse = (result) => {
  for (const part of result.content) { try { const v = JSON.parse(part.text); if (v && typeof v === 'object') return v; } catch {} }
  return null;
};
const text = (r) => r.content.map((c) => c.text || '').join('\n');
const out = {};
try {
  const input = ['Cat', 'Dog', 'Sun'];
  const first = await call({ scheme: 'AAA', relation: 'class:RHYME', draft: input, writer: 'interview', attempts: 1, backtrack: 0, max_rounds: 1 });
  const v0 = parse(first);
  out.first = { isError: !!first.isError, exit_code: v0?.exit_code, status: v0?.status };
  const s0 = decodeState(v0.state);
  out.first.state_reader_scheme = 'reader_scheme' in s0 ? s0.reader_scheme : '<absent>';
  out.first.answered_reader_scheme = s0.answered && 'reader_scheme' in s0.answered ? s0.answered.reader_scheme : '<absent>';
  const variants = { null: null, empty: '', upper: 'V2', v9: 'v9', absent: undefined, v2: 'v2' };
  for (const [name, val] of Object.entries(variants)) {
    const s = structuredClone(s0);
    if (val === undefined) { delete s.reader_scheme; if (s.answered) delete s.answered.reader_scheme; }
    else s.reader_scheme = val;
    const r = await call({ state: encodeState(s), answer: 'I watched the window like a diplomat' });
    const v = parse(r);
    const t = text(r);
    out[name] = { isError: !!r.isError, exit_code: v?.exit_code, status: v?.status,
                  refusal: v?.refusal ?? null,
                  malformed_msg: /recorded reader scheme .* is malformed/.test(t),
                  text_head: t.slice(0, 900) };
  }
} finally {
  writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  await client.close();
}
