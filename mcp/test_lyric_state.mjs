// Offline connector regressions. Real independent MCP clients and handlers;
// synthetic cached records avoid invoking a writer or needing a model key.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { RUNS, LYRIC_TOOL_SCHEMAS, _workerInternals } from './lyric_tools.js';
import { RunStore, newRunId } from './run_store.js';
import { withExecutionContext } from './execution_context.js';
import {
  encodeState,
  decodeState,
  WORKER_STATE_BYTES,
  STATE_DECODED_BYTES,
  RECOVERY_RESULT_BYTES,
} from './state_codec.js';

const peers = [];
async function connect(name) {
  const server = buildServer();
  const client = new Client({ name, version: '1' }, { capabilities: {} });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(s), client.connect(c)]);
  peers.push({ server, client });
  return client;
}
const message = (result) => result.content.map((c) => c.text || '').join('\n');
try {
  const idA = newRunId('seed:91357'),
    idB = newRunId('seed:91357');
  assert.match(idA, /^run_[0-9a-f]{64}$/);
  assert.notEqual(idA, idB);
  const store = new RunStore();
  store.put('seed:91357', { run_id: idA, draft: ['A'] });
  store.put('seed:91357', { run_id: idB, draft: ['B'] });
  assert.equal(store.size(), 2);
  assert.equal(store.get('seed:91357'), null);
  assert.deepEqual(store.byId(idA).draft, ['A']);
  assert.deepEqual(store.byId(idB).draft, ['B']);
  store.del(idB);
  assert.deepEqual(store.byId(idA).draft, ['A']);

  RUNS.put('seed:91357', {
    run_id: idA,
    seed: 91357,
    status: 'suspended',
    draft: ['Copper cat', 'Azure dog'],
    state: encodeState({}),
    decl: { seed: 91357, title: 'CLIENT_A_PRIVATE_TITLE' },
  });
  const a = await connect('client-A'),
    b = await connect('client-B');
  const guessed = await b.callTool({
    name: 'lyric_revise',
    arguments: { seed: 91357, title: 'CLIENT_B_TITLE' },
  });
  assert.equal(guessed.isError, true);
  assert.doesNotMatch(message(guessed), /CLIENT_A_PRIVATE_TITLE|run_[0-9a-f]{64}/);
  const invalidReset = await b.callTool({
    name: 'lyric_revise',
    arguments: { seed: 91357, new_run: true },
  });
  assert.equal(invalidReset.isError, true);
  assert.ok(RUNS.byId(idA), 'an invalid fresh call cannot erase another run');
  const invalidOwnedReset = await a.callTool({
    name: 'lyric_revise',
    arguments: { run_id: idA, new_run: true },
  });
  assert.equal(invalidOwnedReset.isError, true);
  assert.ok(
    RUNS.byId(idA),
    'even a capability holder retains the old run until choosing a valid new input'
  );
  const owned = await a.callTool({
    name: 'lyric_revise',
    arguments: { run_id: idA, run_revision: RUNS.byId(idA).revision, title: 'MOVED' },
  });
  assert.match(
    message(owned),
    /CLIENT_A_PRIVATE_TITLE/,
    'only possession of the run capability exposes its declarations'
  );

  const listed = await b.listTools();
  const revise = listed.tools.find((t) => t.name === 'lyric_revise');
  assert.deepEqual(revise.annotations, {
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.ok(revise.inputSchema.properties.checkpoint);
  const verify = listed.tools.find((t) => t.name === 'lyric_verify');
  assert.ok(verify.inputSchema.properties.blueprint && verify.inputSchema.properties.subdivision);
  assert.ok(
    LYRIC_TOOL_SCHEMAS.lyric_verify.blueprint && LYRIC_TOOL_SCHEMAS.lyric_verify.subdivision
  );
  const noGrid = await b.callTool({
    name: 'lyric_verify',
    arguments: {
      before: ['Copper cat', 'Azure dog'],
      after: ['Copper cat', 'Azure log'],
      scheme: 'AA',
      blueprint: '{}',
    },
  });
  assert.equal(noGrid.isError, true);
  assert.match(message(noGrid), /blueprint.*subdivision/);
  const malformedGrid = await b.callTool({
    name: 'lyric_verify',
    arguments: {
      before: ['Copper cat', 'Azure dog'],
      after: ['Copper cat', 'Azure log'],
      scheme: 'AA',
      blueprint: 'not JSON',
      subdivision: 4,
    },
  });
  assert.equal(malformedGrid.isError, true);
  assert.match(message(malformedGrid), /blueprint.*not JSON/);
  const uncertainId = newRunId();
  const uncertainCheckpoint = encodeState({
    version: 1,
    input_draft: ['Copper cat', 'Azure dog'],
    accepted_lines: ['Copper cat', 'Azure dog'],
    answered: { propose: [], propose_group: [] },
    uncertain_proposal: true,
  });
  RUNS.put('seed:91357', {
    run_id: uncertainId,
    status: 'uncertain_proposal',
    checkpoint: uncertainCheckpoint,
    decl: { seed: 91357, writer: 'kitchen' },
    draft: ['Copper cat', 'Azure dog'],
  });
  const unknownResume = await a.callTool({
    name: 'lyric_revise',
    arguments: { run_id: uncertainId, run_revision: RUNS.byId(uncertainId).revision },
  });
  assert.equal(unknownResume.isError, true);
  assert.match(message(unknownResume), /may have completed.*cannot safely resume/);
  const legacy = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      state: JSON.stringify({ version: 1, answered: {}, pending: null }),
    },
  });
  assert.match(message(legacy), /CONTINUATION_MIGRATION_REQUIRED/);
  const recoveryJournal = {
    version: 1,
    input_draft: ['Original line'],
    accepted_lines: ['Accepted love line'],
    answered: { propose: [{ answer: 'Accepted love line' }], propose_group: [] },
    pending: { kind: 'propose', line: 1 },
  };
  const recoveryWire = JSON.stringify({
    ...JSON.parse(encodeState(recoveryJournal)),
    semantic_identity: '0'.repeat(64),
    connector_contract: 1,
  });
  const beforeRecoveryRevision = RUNS.byId(idA).revision;
  const beforeRecoveryWorker = _workerInternals.pid();
  const recoveryReply = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      checkpoint: recoveryWire,
      recover_only: true,
    },
  });
  assert.notEqual(recoveryReply.isError, true, message(recoveryReply));
  const recovery = JSON.parse(recoveryReply.content.find((part) => part.type === 'text').text);
  assert.equal(recovery.status, 'recovered_artifact');
  assert.deepEqual(recovery.final_draft, recoveryJournal.accepted_lines);
  assert.deepEqual(recovery.replay_draft, recoveryJournal.input_draft);
  assert.deepEqual(recovery.journal, recoveryJournal);
  assert.equal(
    recovery.original_wire_sha256,
    createHash('sha256').update(recoveryWire).digest('hex')
  );
  assert.equal(recovery.resumable, false);
  assert.equal(recovery.certified, false);
  assert.equal(RUNS.byId(idA).revision, beforeRecoveryRevision);
  assert.equal(
    _workerInternals.pid(),
    beforeRecoveryWorker,
    'recovery never starts a Python worker'
  );
  for (const extra of [
    { writer: 'kitchen' },
    { answer: 'new text' },
    { run_id: idA },
    { state: recoveryWire },
  ]) {
    const refusedRecovery = await a.callTool({
      name: 'lyric_revise',
      arguments: {
        recover_only: true,
        checkpoint: recoveryWire,
        ...extra,
      },
    });
    assert.equal(refusedRecovery.isError, true);
    assert.match(message(refusedRecovery), /Recovery requires/);
  }
  const corruptedRecovery = { ...JSON.parse(recoveryWire), sha256: 'f'.repeat(64) };
  const corruption = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      recover_only: true,
      checkpoint: JSON.stringify(corruptedRecovery),
    },
  });
  assert.equal(corruption.isError, true);
  assert.match(message(corruption), /CONTINUATION_INVALID/);
  const maximumJournal = { version: 1, input_draft: [''], accepted_lines: [''], padding: '' };
  const count = Math.floor(
    (STATE_DECODED_BYTES - Buffer.byteLength(JSON.stringify(maximumJournal))) / 4
  );
  maximumJournal.input_draft[0] = '\\'.repeat(count);
  maximumJournal.accepted_lines[0] = '"'.repeat(count);
  maximumJournal.padding = 'x'.repeat(
    STATE_DECODED_BYTES - Buffer.byteLength(JSON.stringify(maximumJournal))
  );
  const maximumWire = JSON.stringify(maximumJournal);
  const maxReply = await a.callTool({
    name: 'lyric_revise',
    arguments: { recover_only: true, checkpoint: maximumWire },
  });
  assert.notEqual(
    maxReply.isError,
    true,
    'bounded export preserves drafts instead of returning an oversized-result error'
  );
  assert.ok(Buffer.byteLength(JSON.stringify(maxReply)) <= RECOVERY_RESULT_BYTES);
  const maxRecovery = JSON.parse(maxReply.content[0].text);
  assert.deepEqual(maxRecovery.final_draft, maximumJournal.accepted_lines);
  assert.deepEqual(maxRecovery.replay_draft, maximumJournal.input_draft);
  if (!maxRecovery.journal_included) {
    assert.equal(maxRecovery.next_recovery_part, 'journal');
    const journalReply = await a.callTool({
      name: 'lyric_revise',
      arguments: { recover_only: true, recovery_part: 'journal', checkpoint: maximumWire },
    });
    assert.notEqual(journalReply.isError, true);
    assert.ok(Buffer.byteLength(JSON.stringify(journalReply)) <= RECOVERY_RESULT_BYTES);
    const journalRecovery = JSON.parse(journalReply.content[0].text);
    assert.deepEqual(journalRecovery.journal, maximumJournal);
    assert.equal(journalRecovery.original_wire_sha256, maxRecovery.original_wire_sha256);
  } else assert.deepEqual(maxRecovery.journal, maximumJournal);
  const exhausted = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      checkpoint: encodeState({
        version: 1,
        status: 'journal_capacity',
        new_run_required: true,
        accepted_lines: ['I love you'],
      }),
    },
  });
  assert.match(message(exhausted), /JOURNAL_CAPACITY.*cannot resume/);
  const hugeDeclaration = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      scheme: 'AA',
      draft: ['I hold your hand', 'I love you'],
      subdivision: 4,
      blueprint: JSON.stringify({ notes: 'x'.repeat(33 * 1024) }),
    },
  });
  assert.match(message(hugeDeclaration), /DECLARATION_CAPACITY.*no writer was started/);
  const independentState = encodeState({
    version: 1,
    input_draft: ['I hold your hand', 'I love you'],
    connector_declarations: {
      scheme: 'AA',
      writer: 'interview',
      form: 'verse-chorus',
      voices: false,
    },
    answered: { propose: [], propose_group: [] },
    pending: null,
  });
  const movedState = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      state: independentState,
      relation: 'class:ASSONANCE',
    },
  });
  assert.match(message(movedState), /state declarations moved: relation/);
  const movedReplay = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      state: independentState,
      draft: ['I hold your hand', 'Changed original input'],
    },
  });
  assert.match(message(movedReplay), /state resume requires its original replay_draft/);
  const narrow = decodeState(independentState);
  narrow.pending = { kind: 'propose', record: { line: 1 }, prompt: '', answer: null };
  narrow.retained_metadata = '';
  const { connector_declarations: _declarations, ...workerState } = narrow;
  narrow.retained_metadata = 'x'.repeat(
    WORKER_STATE_BYTES - 100 - Buffer.byteLength(JSON.stringify(workerState), 'utf8')
  );
  const overflowAnswer = await a.callTool({
    name: 'lyric_revise',
    arguments: {
      state: encodeState(narrow),
      answer: 'x'.repeat(1000),
    },
  });
  assert.match(
    message(overflowAnswer),
    /CONTINUATION_CAPACITY/,
    'answer growth is refused before the worker consumes any of the supplied journal'
  );
  assert.ok(RUNS.byId(uncertainId));
  RUNS.del(uncertainId);
  RUNS.del(idA);
  console.log(
    'lyric state: capability isolation, same-seed coexistence, validation safety, annotations and verify grid contract passed'
  );

  // Opt-in staged-data integration: real CLI, worker, proposer adapter and
  // registered MCP tool, with only the external model replaced by localhost.
  if (process.argv.includes('--harness')) {
    const input = ['Copper cat', 'Azure dog'];
    const proposals = [
      'I left the basket underneath the oak',
      'The copper kettle cooled beside the door',
    ];
    let calls = 0,
      abortOnRequest;
    const writer = createServer(async (req, res) => {
      for await (const _chunk of req) {
        /* consume bounded fixture request */
      }
      if (abortOnRequest) {
        calls++;
        abortOnRequest();
        return;
      }
      const text = proposals[calls++];
      assert.ok(text, 'the fixture has only two authorized model requests');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 8,
            thoughtsTokenCount: 3,
            totalTokenCount: 21,
          },
        })
      );
    });
    writer.listen(0, '127.0.0.1');
    await once(writer, 'listening');
    const env = {
      GEMINI_API_KEY: 'offline-state-fixture',
      LYRIC_PROPOSER_MODEL: 'gemini-3.5-flash-lite',
      LYRIC_PROPOSER_API_BASE: `http://127.0.0.1:${writer.address().port}`,
    };
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    const verdict = (result) => {
      for (const part of result.content) {
        try {
          const value = JSON.parse(part.text);
          if (typeof value.exit_code === 'number') return value;
        } catch {
          /* render block */
        }
      }
      assert.fail(message(result));
    };
    try {
      const oversized = verdict(
        await a.callTool(
          {
            name: 'lyric_revise',
            arguments: {
              scheme: 'A'.repeat(32),
              draft: Array(32).fill('I hold your hand'),
              writer: 'kitchen',
              attempts: 1,
              backtrack: 0,
              max_rounds: 1,
            },
          },
          undefined,
          { timeout: 120000 }
        )
      );
      assert.equal(oversized.exit_code, 2);
      assert.match(oversized.refusal, /RESOURCE_LIMIT.*writer execution/);
      assert.equal(calls, 0, 'oversize pasted writer request refuses before provider dispatch');
      const first = verdict(
        await a.callTool(
          {
            name: 'lyric_revise',
            arguments: {
              scheme: 'AA',
              relation: 'type:rime riche',
              draft: input,
              writer: 'kitchen',
              attempts: 1,
              backtrack: 0,
              max_rounds: 1,
            },
          },
          undefined,
          { timeout: 120000 }
        )
      );
      assert.equal(calls, 2, JSON.stringify(first));
      assert.deepEqual(
        first.final_draft,
        proposals,
        'accepted edits, not input, are the returned draft'
      );
      assert.deepEqual(first.replay_draft, input);
      const changedSemantics = JSON.parse(first.checkpoint);
      changedSemantics.semantic_identity = '0'.repeat(64);
      const incompatible = await a.callTool({
        name: 'lyric_revise',
        arguments: {
          checkpoint: JSON.stringify(changedSemantics),
        },
      });
      assert.equal(incompatible.isError, true);
      assert.match(message(incompatible), /CONTINUATION_MIGRATION_REQUIRED/);
      assert.equal(calls, 2, 'semantic mismatch refuses before another provider request');
      const recoveredReply = await a.callTool({
        name: 'lyric_revise',
        arguments: {
          checkpoint: JSON.stringify(changedSemantics),
          recover_only: true,
        },
      });
      const recoveredCheckpoint = JSON.parse(
        recoveredReply.content.find((part) => part.type === 'text').text
      );
      assert.deepEqual(recoveredCheckpoint.final_draft, proposals);
      assert.equal(recoveredCheckpoint.resumable, false);
      assert.equal(recoveredCheckpoint.certified, false);
      assert.equal(calls, 2, 'recovery-only export never makes a provider request');
      assert.equal(first.song_at_stop, proposals.join('\n'));
      assert.equal(first.proposer_tokens_thoughts, 6);
      assert.equal(first.coverage.pairs_mandated, 1);
      assert.deepEqual(
        RUNS.byId(first.run_id).draft,
        proposals,
        'parked carry uses exact accepted lines'
      );
      const same = await a.callTool({
        name: 'lyric_revise',
        arguments: { run_id: first.run_id, run_revision: first.run_revision, draft: proposals },
      });
      assert.equal(same.isError, true);
      assert.match(message(same), /SAME draft/);
      const resumed = verdict(
        await a.callTool(
          { name: 'lyric_revise', arguments: { checkpoint: first.checkpoint } },
          undefined,
          { timeout: 120000 }
        )
      );
      assert.deepEqual(resumed.final_draft, first.final_draft);
      assert.deepEqual(resumed.replay_draft, input);
      assert.equal(
        calls,
        2,
        'checkpoint replay verifies completed answers without another model request'
      );
      assert.equal(resumed.proposer_calls, 0, 'replayed answers are not new paid calls');
      const moved = await a.callTool({
        name: 'lyric_revise',
        arguments: { checkpoint: first.checkpoint, relation: 'class:ASSONANCE' },
      });
      assert.equal(moved.isError, true);
      assert.match(message(moved), /checkpoint declarations moved/);
      assert.equal(calls, 2);
      console.log(
        'lyric state: real kitchen accepted draft, parked carry, thinking usage and checkpoint replay passed (localhost model only)'
      );

      calls = 0;
      const controller = new AbortController();
      let durableCheckpoint;
      const interrupted = verdict(
        await withExecutionContext(
          {
            signal: controller.signal,
            onCheckpoint(record) {
              durableCheckpoint = record;
              if (record.status === 'accepted' && !controller.signal.aborted) controller.abort();
            },
          },
          () =>
            a.callTool(
              {
                name: 'lyric_revise',
                arguments: {
                  scheme: 'AA',
                  relation: 'type:rime riche',
                  draft: input,
                  writer: 'kitchen',
                  attempts: 1,
                  backtrack: 0,
                  max_rounds: 1,
                },
              },
              undefined,
              { timeout: 120000 }
            )
        )
      );
      assert.equal(interrupted.status, 'interrupted');
      assert.equal(interrupted.exit_code, -1);
      assert.equal(calls, 1, 'abort after accepted edit prevents the next model call');
      assert.deepEqual(interrupted.final_draft, [proposals[0], input[1]]);
      assert.deepEqual(interrupted.replay_draft, input);
      assert.equal(durableCheckpoint.connector_declarations.writer, 'kitchen');
      assert.equal(durableCheckpoint.connector_declarations.scheme, 'AA');
      const recovered = verdict(
        await a.callTool(
          {
            name: 'lyric_revise',
            arguments: { run_id: interrupted.run_id, run_revision: interrupted.run_revision },
          },
          undefined,
          { timeout: 120000 }
        )
      );
      assert.equal(
        calls,
        2,
        'resume consumes the completed answer once and asks only the remaining line'
      );
      assert.deepEqual(recovered.final_draft, proposals);
      assert.deepEqual(recovered.replay_draft, input);
      console.log(
        'lyric state: actual worker cancellation preserved accepted lines, declarations and resume journal'
      );

      calls = 0;
      const uncertainController = new AbortController();
      abortOnRequest = () => uncertainController.abort();
      const uncertain = verdict(
        await withExecutionContext({ signal: uncertainController.signal }, () =>
          a.callTool(
            {
              name: 'lyric_revise',
              arguments: {
                scheme: 'AA',
                relation: 'type:rime riche',
                draft: input,
                writer: 'kitchen',
                attempts: 1,
                backtrack: 0,
                max_rounds: 1,
              },
            },
            undefined,
            { timeout: 120000 }
          )
        )
      );
      assert.equal(uncertain.status, 'uncertain_proposal');
      assert.equal(uncertain.proposer_usage_unknown, true);
      assert.equal(decodeState(uncertain.checkpoint).uncertain_proposal, true);
      assert.equal(calls, 1);
      const uncertainResume = await a.callTool({
        name: 'lyric_revise',
        arguments: { run_id: uncertain.run_id, run_revision: uncertain.run_revision },
      });
      assert.equal(uncertainResume.isError, true);
      assert.match(message(uncertainResume), /cannot safely resume/);
      assert.equal(calls, 1, 'an unknown provider outcome is never silently retried');
      console.log(
        'lyric state: unknown provider completion stops automatic replay and preserves the recovery draft'
      );
    } finally {
      _workerInternals.kill();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      writer.closeAllConnections();
      await new Promise((resolve) => writer.close(resolve));
    }
  }
} finally {
  await Promise.all(
    peers.map(async ({ server, client }) => {
      await client.close();
      await server.close();
    })
  );
}
