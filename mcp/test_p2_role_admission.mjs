// A blueprint line's `role` at the connector (#676). The schemas pass it through
// untouched and the harness is the one place that judges it, so every value
// here, a role or not, is admitted and reaches the worker with the caller's
// own bytes. Real schemas and MCP dispatch; the worker boundary is
// intercepted, so nothing here grades a line (lyric-harness/quality/
// test_p2_line_roles.py does that).
// Synthetic encoded continuations are NOT historical journals or signed-cursor roundtrips.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  ['refrain', 'refrain'],
  ['burden', 'burden'],
  ['another spelling', 'Refrain'],
  ['empty', ''],
  ['null', null],
  ['object', { kind: 'refrain' }],
  ['number', 17],
];
function inputs(name, role, index = 0) {
  const bp = structuredClone(base);
  while (bp.lines.length <= index) bp.lines.push(structuredClone(base.lines[0]));
  if (name !== 'absent') bp.lines[index].role = role;
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
      assert.equal(result.success, true);
      assert.equal(result.data.blueprint, args.blueprint);
    });
  }
  test(`restored declaration schema: ${name}`, () => {
    const decl = declarationsOf(calls.lyric_revise);
    const before = structuredClone(decl);
    const read = () => declarationsOf(z.object(KITCHEN_REVISE_SCHEMA).parse(decl));
    assert.equal(read().blueprint, decl.blueprint);
    assert.deepEqual(movedDeclarations(read(), { blueprint: decl.blueprint }), []);
    assert.equal(
      movedDeclarations(read(), { blueprint: decl.blueprint.replace('We hold', 'We guard') })[0]
        .field,
      'blueprint'
    );
    // The mark is part of what was declared: changing it alone, with every
    // word and placement kept, is a changed blueprint.
    const other = inputs('present', role === 'burden' ? 'refrain' : 'burden').lyric_revise;
    assert.equal(movedDeclarations(read(), { blueprint: other.blueprint })[0].field, 'blueprint');
    assert.deepEqual(decl, before);
  });
}

test('real MCP admission: the worker is handed the blueprint as it was sent', async (t) => {
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
    operations = 0,
    handed = null;
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
    handed = null;
    const result = await client.callTool({ name: tool, arguments: args });
    assert.deepEqual(args, before, 'raw caller blueprint/envelope untouched');
    assert.equal(result.isError, true);
    assert.match(result.content.map((x) => x.text || '').join('\n'), expected);
    assert.equal(admissions - a, admitted);
    assert.equal(operations - w, worked);
    idle();
    return handed;
  }
  try {
    delete process.env.GEMINI_API_KEY;
    bridge.admit = (...args) => {
      admissions++;
      return originalAdmit(...args);
    };
    // Only the external worker boundary is intercepted; never fake a passing
    // result. The blueprint file the worker was pointed at is read here,
    // before the call's temporary directory is removed.
    bridge.runVerb = async (argv) => {
      operations++;
      const flag = argv.find((x) => typeof x === 'string' && x.startsWith('--blueprint='));
      handed = flag ? readFileSync(flag.slice('--blueprint='.length), 'utf8') : null;
      throw new Error('P2_EXTERNAL_WORKER_BOUNDARY');
    };
    await Promise.all([client.connect(c), server.connect(s)]);
    idle();
    for (const [name, role] of cases) {
      const calls = inputs(name, role);
      for (const [tool, args] of Object.entries(calls)) {
        await t.test(`handler ${tool}: ${name}`, async () => {
          assert.equal(await call(tool, args, boundary, 1, 1), args.blueprint);
        });
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
          // A continuation restores the blueprint it was declared with, mark
          // and all. The website writer's checkpoint stops before the worker
          // for want of its key, as it does with no mark.
          const kitchen = field === 'checkpoint';
          const got = await call(
            'lyric_revise',
            { [field]: wire },
            kitchen
              ? /writer 'kitchen' needs the service's GEMINI_API_KEY and it is unset here/
              : boundary,
            1,
            kitchen ? 0 : 1
          );
          if (!kitchen) assert.equal(got, calls.lyric_revise.blueprint);
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
    for (const index of [1, 2]) {
      for (const [tool, args] of Object.entries(inputs('present', 'burden', index))) {
        await t.test(`later-line handler ${tool}: line ${index + 1}`, async () => {
          const got = await call(tool, args, boundary, 1, 1);
          assert.equal(got, args.blueprint);
          assert.deepEqual(
            JSON.parse(got).lines.map((line) => line.role),
            [...Array(index).fill(undefined), 'burden']
          );
        });
      }
    }
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
