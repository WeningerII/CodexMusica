// Real local Python grading and authenticated MCP -> agent -> HTTP -> frontend.
// Only the model's choice of tool is stubbed; no report metadata is edited.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { once } from 'node:events';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { LIMITS } from './gemini_agent.js';
import { bindEvidenceContext } from './lyrics_evidence_binding.js';
import { projectDraftText, draftFromText } from './lyric_text.js';
const nativeFetch = globalThis.fetch;
function frontend(text) {
  const api = vm.createContext({ uiRegisterPage() {}, TextEncoder });
  for (const path of ['src/lyric-tokens.js', 'src/pages/lyrics.js', 'src/pages/lyrics-evidence.js'])
    vm.runInContext(fs.readFileSync(path, 'utf8'), api);
  api.model = api.lyParse(text);
  const semanticId = vm.runInContext('lyIdentity(model)', api);
  const context = {
    version: 1,
    document: api.lyWriterText(text),
    declarations: api.lyDeclarationsOf(api.model),
    brief: '',
    notes: [],
    binding: { document_sha256: semanticId },
  };
  return { api, context, semanticId };
}
for (const [label, text] of [
  ['plain', '[SETUP — rhyme groups — 1,2]\ncat\nhat'],
  [
    'sectioned Unicode repeated words',
    '[SETUP — rhyme groups — 1,2]\n[VERSE]\n  😀 cat cat  \n\n[CHORUS]\nhat cat\n',
  ],
])
  test(`real ${label} page binds through HTTP with exact declaration proof`, async () => {
    const f = frontend(text);
    const args = { lines: draftFromText(f.context.document), groups: '1,2' };
    const router = await createChatRouter({
      buildServer,
      Client,
      InMemoryTransport,
      apiKey: 'offline',
      limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
      turnLimits: { ...LIMITS, maxSteps: 1, maxTurnMs: 120000 },
    });
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ functionCall: { name: 'lyric_check', args } }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    });
    try {
      const response = await nativeFetch(`http://127.0.0.1:${server.address().port}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'Review these lyrics',
          task: { domain: 'lyrics', phase: 'edit' },
          lyric_context: f.context,
        }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      const evidence = payload.tools.find(
        (t) => t.name === 'lyric_check'
      )?.schema_instance_evidence;
      assert(evidence?.request_binding, JSON.stringify(payload).slice(0, 5000));
      assert(evidence.records.length > 0);
      const basis = {
        model: f.api.model,
        requestId: 'http-result-request',
        semanticId: f.semanticId,
        readerScheme: 'v2',
        voices: false,
        submittedContext: f.context,
      };
      const binding = f.api.lyRelationBindReport(evidence, basis);
      assert(binding);
      const view = f.api.lyRelationEvidenceView(evidence, {
        requestId: basis.requestId,
        binding,
        document: {
          semanticId: f.semanticId,
          text: f.api.model.text,
          readerScheme: 'v2',
          voices: false,
        },
      });
      assert.equal(view.freshness, 'current');
      assert(view.pairs.some((p) => p.canGo));
      assert.deepEqual(evidence.request_binding.context, JSON.parse(JSON.stringify(f.context)));
      assert.equal(evidence.request_binding.source_projection.source_text, args.lines.join('\n'));
      for (const mutate of [
        (p) => p.rows.pop(),
        (p) => {
          p.rows.find((r) => r.kind === 'sung').text_start += 1;
        },
        (p) => {
          p.rows.find((r) => r.kind === 'sung').kind = 'section';
        },
        (p) => {
          p.document_sha256 = '0'.repeat(64);
        },
      ]) {
        const bad = structuredClone(evidence);
        mutate(bad.request_binding.source_projection);
        assert.equal(f.api.lyRelationBindReport(bad, basis), null);
      }
      if (label.startsWith('sectioned')) {
        const rows = evidence.request_binding.source_projection.rows;
        assert.equal(rows.filter((r) => r.kind === 'section').length, 2);
        assert.equal(rows.filter((r) => r.kind === 'blank').length, 2);
        const catStarts = Object.values(view.occurrences)
          .flatMap((o) => o.parts)
          .filter((p) => p.text === 'cat')
          .map((p) => p.start);
        const first = text.indexOf('😀') + 3;
        assert(catStarts.includes(first), JSON.stringify(catStarts));
        assert(catStarts.includes(first + 4), JSON.stringify(catStarts));
        for (const o of Object.values(view.occurrences))
          for (const part of o.parts) assert.equal(text.slice(part.start, part.end), part.text);
      }

      for (const declarations of [
        { groups: '1,2.head' },
        {
          groups: '1,2',
          pronunciations: [
            {
              line: 1,
              token: 1,
              word: 'cat',
              phones: ['K', 'AE1', 'T'],
              basis: 'declared',
              source: 'different reading',
            },
          ],
        },
      ]) {
        const changed = { ...f.context, declarations };
        if (label.startsWith('sectioned')) {
          const negativeResponse = await nativeFetch(
            `http://127.0.0.1:${server.address().port}/chat`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                message: 'Review these lyrics',
                task: { domain: 'lyrics', phase: 'edit' },
                lyric_context: changed,
              }),
            }
          );
          assert.equal(negativeResponse.status, 200);
          const negative = await negativeResponse.json();
          const report = negative.tools.find(
            (t) => t.name === 'lyric_check'
          )?.schema_instance_evidence;
          assert(report?.invocation, 'negative still ran the actual authenticated grading tool');
          assert.equal(report.request_binding, undefined);
          assert.equal(
            f.api.lyRelationBindReport(report, { ...basis, submittedContext: changed }),
            null
          );
        }

        assert.equal(bindEvidenceContext(evidence, changed).request_binding, undefined);
        assert.equal(
          f.api.lyRelationBindReport(evidence, { ...basis, submittedContext: changed }),
          null
        );
      }
      const changedModel = f.api.lyParse(text.replace('groups — 1,2', 'groups — 1,2.head'));
      assert.equal(f.api.lyRelationBindReport(evidence, { ...basis, model: changedModel }), null);
      assert.equal(
        f.api.lyRelationBindReport(evidence, { ...basis, submittedContext: undefined }),
        null
      );
      for (const document of [
        f.context.document + '\nextra sung lyric',
        '[BROKEN\n' + f.context.document,
        f.context.document.replace('cat', 'bat'),
      ])
        assert.equal(
          bindEvidenceContext(evidence, { ...f.context, document }).request_binding,
          undefined
        );
      const noInvocation = structuredClone(evidence);
      delete noInvocation.invocation;
      assert.equal(bindEvidenceContext(noInvocation, f.context).request_binding, undefined);
      const finalReport = structuredClone(evidence);
      finalReport.invocation.tool = 'lyric_revise';
      assert.equal(bindEvidenceContext(finalReport, f.context).request_binding, undefined);
    } finally {
      globalThis.fetch = nativeFetch;
      await new Promise((resolve) => server.close(resolve));
    }
  });

test('projection accounts for every row using the existing sung-row convention', () => {
  for (const text of [
    '[VERSE]\n\n cat cat \n[CHORUS]\nhat',
    '😀 cat\r\n  \r\n[SECTION]\r\nhat',
    '[BROKEN\ncat [inline]\nnot a header',
  ]) {
    const projection = projectDraftText(text);
    assert.equal(projection.source_text, draftFromText(text).join('\n'));
    assert.equal(projection.rows.length, text.split('\n').length);
    for (const row of projection.rows) {
      const raw = text.slice(row.start, row.end);
      if (row.kind === 'sung') assert.equal(text.slice(row.text_start, row.text_end), raw.trim());
      else assert(row.kind === 'blank' ? !raw.trim() : /^\[[^\]]*\]$/.test(raw.trim()));
    }
  }
});
