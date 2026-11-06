// Reconstructed P2 guards: real schemas and MCP dispatch; no lexical grading.
// Synthetic encoded continuations are NOT historical journals or signed-cursor roundtrips.
import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import {
  LYRIC_TOOL_SCHEMAS,
  KITCHEN_REVISE_SCHEMA,
  readerPythonBridge as bridge,
  lyricWorkerState,
} from './lyric_tools.js';
import { encodeState } from './state_codec.js';
import { declarationsOf, movedDeclarations } from './run_store.js';

const base = {
  sections: [{ name: 'verse', bars: 1, meter: { beats: 4, unit: 4 } }],
  lines: [{ text: 'We hold the light', bar: 1, beat: 1, duration: 4 }],
};
const cases = [
  ['absent', undefined],
  ['string', 'refrain'],
  ['empty', ''],
  ['null', null],
  ['object', { kind: 'refrain' }],
];
const refusal = /line 1: line roles are not checked yet; remove `role` or wait for P2/;
function inputs(name, role) {
  const bp = structuredClone(base);
  if (name !== 'absent') bp.lines[0].role = role;
  const common = {
    scheme: 'A',
    blueprint: ' ' + JSON.stringify(bp, null, 2) + '\n',
    subdivision: 2,
  };
  return {
    lyric_check: { ...common, lines: ['We hold the light'] },
    lyric_verify: { ...common, before: ['We hold the light'], after: ['We hold the light'] },
    lyric_revise: { ...common, draft: ['We hold the light'], writer: 'interview' },
  };
}
for (const [name, role] of cases) {
  const calls = inputs(name, role);
  for (const [tool, args] of Object.entries(calls)) {
    test(`schema ${tool}: ${name}`, () => {
      const before = structuredClone(args);
      const result = z.object(LYRIC_TOOL_SCHEMAS[tool]).safeParse(args);
      assert.deepEqual(args, before);
      if (name === 'absent') {
        assert.equal(result.success, true);
        assert.equal(result.data.blueprint, args.blueprint);
      } else {
        assert.equal(result.success, false);
        assert.match(result.error.message, refusal);
      }
    });
  }
  test(`restored declaration schema: ${name}`, () => {
    const decl = declarationsOf(calls.lyric_revise);
    const before = structuredClone(decl);
    const read = () => declarationsOf(z.object(KITCHEN_REVISE_SCHEMA).parse(decl));
    if (name === 'absent') {
      assert.equal(read().blueprint, decl.blueprint);
      assert.deepEqual(movedDeclarations(read(), { blueprint: decl.blueprint }), []);
      assert.equal(
        movedDeclarations(read(), { blueprint: decl.blueprint.replace('We hold', 'We guard') })[0]
          .field,
        'blueprint'
      );
    } else assert.throws(read, refusal);
    assert.deepEqual(decl, before);
  });
}

test('real MCP admission and synthetic continuation rejection', async (t) => {
  const server = buildServer({ kitchen: true });
  const client = new Client(
    { name: 'reconstructed-p2-admission', version: '1' },
    { capabilities: {} }
  );
  const [c, s] = InMemoryTransport.createLinkedPair();
  const originalAdmit = bridge.admit,
    originalRun = bridge.runVerb;
  const key = process.env.GEMINI_API_KEY;
  let admissions = 0,
    operations = 0;
  const boundary = /P2_EXTERNAL_WORKER_BOUNDARY/;
  function idle() {
    const capacity = bridge.capacity();
    assert.equal(capacity.admitted, 0);
    assert.equal(capacity.admittedBytes, 0);
    assert.equal(capacity.queued, 0);
    assert.equal(capacity.active, false);
    assert.equal(lyricWorkerState().spawned, false);
  }
  async function call(tool, args, expected, admitted, worked) {
    const before = structuredClone(args),
      a = admissions,
      w = operations;
    const result = await client.callTool({ name: tool, arguments: args });
    assert.deepEqual(args, before, 'raw caller blueprint/envelope untouched');
    assert.equal(result.isError, true);
    assert.match(result.content.map((x) => x.text || '').join('\n'), expected);
    assert.equal(admissions - a, admitted);
    assert.equal(operations - w, worked);
    idle();
  }
  try {
    delete process.env.GEMINI_API_KEY;
    bridge.admit = (...args) => {
      admissions++;
      return originalAdmit(...args);
    };
    // Only the external worker boundary is intercepted; never fake a passing result.
    bridge.runVerb = async () => {
      operations++;
      throw new Error('P2_EXTERNAL_WORKER_BOUNDARY');
    };
    await Promise.all([client.connect(c), server.connect(s)]);
    idle();
    for (const [name, role] of [...cases, ['malformed number', 17]]) {
      const calls = inputs(name, role),
        absent = name === 'absent';
      for (const [tool, args] of Object.entries(calls)) {
        await t.test(`handler ${tool}: ${name}`, () =>
          call(tool, args, absent ? boundary : refusal, absent ? 1 : 0, absent ? 1 : 0)
        );
      }
      for (const field of ['state', 'checkpoint']) {
        await t.test(`${field}: ${name}`, async () => {
          const decoded = {
            version: 1,
            input_draft: ['We hold the light'],
            accepted_lines: ['We hold the light'],
            answered: {},
            connector_declarations: {
              ...declarationsOf(calls.lyric_revise),
              writer: field === 'checkpoint' ? 'kitchen' : 'interview',
              lexicon_supplement: 'none',
            },
          };
          const before = structuredClone(decoded),
            wire = encodeState(decoded);
          assert.deepEqual(decoded, before);
          const expected = !absent
            ? refusal
            : field === 'checkpoint'
              ? /writer 'kitchen' needs the service's GEMINI_API_KEY and it is unset here/
              : boundary;
          // Restore reparse happens inside withTempDir: a reservation precedes refusal.
          await call(
            'lyric_revise',
            { [field]: wire },
            expected,
            1,
            absent && field === 'state' ? 1 : 0
          );
        });
      }
    }
    for (const field of ['state', 'checkpoint']) {
      await t.test(`${field}: tampered checksum`, async () => {
        const envelope = JSON.parse(
          encodeState({
            input_draft: ['We hold the light'],
            connector_declarations: { scheme: 'A' },
          })
        );
        envelope.sha256 = '0'.repeat(64);
        await call(
          'lyric_revise',
          { [field]: JSON.stringify(envelope) },
          /CONTINUATION_INVALID: Decoded length or checksum differs/,
          1,
          0
        );
      });
    }
    assert.equal(admissions, 17);
    assert.equal(operations, 4);
  } finally {
    bridge.admit = originalAdmit;
    bridge.runVerb = originalRun;
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
    const closed = await Promise.allSettled([client.close(), server.close()]);
    idle();
    for (const result of closed) assert.equal(result.status, 'fulfilled');
  }
});
