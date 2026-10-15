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
test('real check report binds exact submitted declarations through HTTP and refuses changed declarations', async () => {
  const f = frontend('[SETUP — rhyme groups — 1,2]\ncat\nhat');
  const args = { lines: ['cat', 'hat'], groups: '1,2' };
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
    const evidence = payload.tools.find((t) => t.name === 'lyric_check')?.schema_instance_evidence;
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
      assert.equal(bindEvidenceContext(evidence, changed).request_binding, undefined);
      assert.equal(
        f.api.lyRelationBindReport(evidence, { ...basis, submittedContext: changed }),
        null
      );
    }
    const changedModel = f.api.lyParse('[SETUP — rhyme groups — 1,2.head]\ncat\nhat');
    assert.equal(f.api.lyRelationBindReport(evidence, { ...basis, model: changedModel }), null);
    assert.equal(
      f.api.lyRelationBindReport(evidence, { ...basis, submittedContext: undefined }),
      null
    );
    for (const document of ['[VERSE]\ncat\nhat', 'cat\nbat'])
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
