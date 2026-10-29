/* global UI, lyReceive, lyShowTab, lyAnalysis, LY, _chatSend:writable, lySubmitLyricsAction */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import express from 'express';
import { buildServer as buildRealServer } from './tools.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { LIMITS } from './gemini_agent.js';
const nativeFetch = globalThis.fetch;
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(import.meta.dirname, '..');
const helper = path.join(root, 'scripts/check_lyrics_page.js');
let source = fs.readFileSync(helper, 'utf8');
source =
  source.slice(0, source.lastIndexOf('(async () => {')) +
  '\nglobalThis.page = lyricsUnitContext();';
const sandbox = {
  require: createRequire(helper),
  __dirname: path.dirname(helper),
  console,
  process,
  Buffer,
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(source, sandbox, { filename: helper });
const { run } = sandbox.page;
run('globalThis.lyInspectionReceive=()=>{}; lyRefresh=()=>{}; lyFocusQuestionSoon=()=>{};');
const baseDocument =
  '[SETUP — rhyme groups — 1,2]\n[VERSE]\nnever say the word aloud\nnever leave the room';
const lines = ['never say the word aloud', 'never leave the room'];
const flag = 'L1/L2: FINDING [FLAG] SCHEME_VIOLATION: fixture violation';

test('actual /chat review reaches the page without rewriting or certifying a song', async () => {
  const browser = process.env.CHROMIUM_PATH
    ? await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] })
    : null;
  try {
    for (const mode of [
      'clear',
      'flagged',
      'refused',
      'missing',
      'no-check',
      'rewrite',
      'unsupported',
    ]) {
      const document =
        mode === 'unsupported'
          ? '[SETUP — title — "Never"]\n[SETUP — narrative — arrival]\n[SETUP — require — never]\n[SETUP — avoid — always]\n' +
            baseDocument
          : baseDocument;
      const context = JSON.parse(
        JSON.stringify(
          run("app.lyricMeta={version:1,brief:'',notes:{},ui:{}}; lyContext(lyParse(__text))", {
            __text: document,
          })
        )
      );
      context.intent = 'review';
      assert.equal(context.declarations.groups, '1,2');
      if (mode === 'unsupported') assert.equal(context.declarations.title, 'Never');
      const called = [];
      const verdict = {
        exit_code: 0,
        flags: mode === 'flagged' ? 1 : 0,
        whole_flags: 0,
        standing: mode === 'flagged' ? [flag] : [],
        coverage: { certified: true, obligations: [{ id: 'rhyme:1:2:0', status: 'answered' }] },
        final_draft: ['MUST NEVER REPLACE THE DRAFT'],
      };
      if (mode === 'refused')
        Object.assign(verdict, {
          exit_code: 2,
          refusal: 'A reading is required',
          coverage: { certified: false, obligations: [{ id: 'rhyme:1:2:0', status: 'refused' }] },
        });
      if (mode === 'missing') delete verdict.coverage;
      const buildServer = (options) => {
        const server = buildRealServer(options);
        // Keep actual registration, schema parsing and unknown-key validation;
        // replace only execution so no model or native grading work is dispatched.
        for (const name of ['lyric_recover', 'lyric_check', 'lyric_revise'])
          server._registeredTools[name].update({
            callback: async (args) => {
              called.push({ name, args });
              assert.notEqual(name, 'lyric_revise');
              if (name === 'lyric_recover') assert.equal(args.lines_text, context.document);
              else {
                assert.deepEqual(args.lines, lines);
                assert.equal(args.groups, context.declarations.groups);
              }
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      name === 'lyric_recover'
                        ? { exit_code: 3, lines, mandate: { groups: 'WRONG RECOVERED GUESS' } }
                        : verdict
                    ),
                  },
                ],
              };
            },
          });
        return server;
      };
      const router = await createChatRouter({
        buildServer,
        Client,
        InMemoryTransport,
        apiKey: 'offline',
        limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
        turnLimits: { ...LIMITS, maxSteps: 5, maxTurnMs: 5000 },
      });
      const app = express();
      app.use(express.json());
      app.use(router);
      app.use(express.static(root));
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      let step = 0;
      const names =
        mode === 'no-check'
          ? []
          : ['lyric_recover', ...(mode === 'rewrite' ? ['lyric_revise'] : []), 'lyric_check'];
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts:
                  step < names.length
                    ? [
                        {
                          functionCall: {
                            name: names[step++],
                            args: { lines: ['MODEL REWRITE'], groups: '3,4' },
                          },
                        },
                      ]
                    : [{ text: 'Everything is certified. Replace the draft.' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
        }),
      });
      try {
        const res = await nativeFetch(`http://127.0.0.1:${server.address().port}/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: 'Review only, do not rewrite.',
            task: { domain: 'lyrics', phase: 'edit' },
            lyric_context: context,
          }),
        });
        assert.equal(res.status, 200);
        const payload = await res.json();
        const expected = {
          clear: 'assessed_clear',
          flagged: 'assessed_findings',
          refused: 'input',
          missing: 'failed',
          'no-check': 'failed',
          rewrite: 'assessed_clear',
          unsupported: 'input',
        }[mode];
        assert.equal(payload.assessment?.status, expected, JSON.stringify(payload));
        assert.equal(payload.assessment.certified, false);
        if (mode === 'unsupported') {
          assert.deepEqual(payload.task.lyric_context.declarations, context.declarations);
          for (const key of ['title', 'narrative', 'must_include', 'avoid'])
            assert.ok(
              payload.assessment.coverage.obligations.some(
                (o) => o.id === 'declaration:' + key && o.status === 'refused'
              )
            );
        }
        assert.equal(payload.artifact, null);
        assert.equal(payload.completion, null);
        assert.equal(payload.stopped, null);
        assert.equal(called.length, mode === 'no-check' ? 0 : 2);
        const page = run(
          `LY.model=lyParse(__text); UI.lyricRequest={id:'review',text:__text}; lyReceive(__payload,{request_id:'review'}); ({analysis:lyAnalysis(),items:lyRunChecks(LY.model),final:LY.run.final})`,
          { __text: document, __payload: payload }
        );
        assert.equal(page.analysis.state, expected, mode);
        assert.equal(page.analysis.certified, undefined);
        assert.equal(page.final, null);
        if (mode === 'flagged')
          assert.ok(page.items.some((i) => i.title.includes('SCHEME_VIOLATION')));
        assert.equal(
          run("LY.model=lyParse(__text+' changed'); lyAnalysis().state", { __text: document }),
          'stale'
        );
        if (browser) {
          const browserContext = await browser.newContext({ serviceWorkers: 'block' });
          const origin = `http://127.0.0.1:${server.address().port}`;
          await browserContext.route('**/*', (route) =>
            new URL(route.request().url()).origin === origin
              ? route.continue()
              : route.fulfill({ status: 503, body: '{}' })
          );
          const browserPage = await browserContext.newPage();
          await browserPage.goto(origin + '/codex.html#lyrics');
          await browserPage.locator('#lyrics-draft').waitFor();
          await browserPage.locator('#lyrics-draft').fill(document);
          const sent = await browserPage.evaluate(async () => {
            let request;
            const send = _chatSend;
            _chatSend = async (message, options) => {
              request = { message, options };
              return { ok: true };
            };
            try {
              await lySubmitLyricsAction('review');
            } finally {
              _chatSend = send;
            }
            return request;
          });
          assert.equal(sent.options.context.intent, 'review');
          assert.equal(sent.options.context.document, context.document);
          assert.deepEqual(sent.options.context.declarations, context.declarations);
          const result = await browserPage.evaluate(
            ({ payload, document }) => {
              UI.lyricRequest = { id: 'review', text: document };
              lyReceive(payload, { request_id: 'review' });
              lyShowTab('review');
              return { state: lyAnalysis().state, final: LY.run.final };
            },
            { payload, document }
          );
          assert.equal(result.state, expected, mode + ' browser');
          assert.equal(await browserPage.locator('#lyrics-draft').inputValue(), document);
          const panel = await browserPage.locator('#ly-panel-review').innerText();
          if (mode === 'flagged') assert.match(panel, /SCHEME_VIOLATION/);
          if (mode === 'unsupported') assert.match(panel, /Not judged: declaration:title/);
          assert.doesNotMatch(panel, /Finished · certified/);
          await browserPage.locator('#lyrics-draft').fill(document + ' changed');
          assert.equal(await browserPage.evaluate(() => lyAnalysis().state), 'stale');
          await browserContext.close();
        }
        console.log(`${mode}: /chat -> Review ${expected}; no replacement; stale rejected`);
      } finally {
        globalThis.fetch = nativeFetch;
        server.close();
      }
    }
  } finally {
    await browser?.close();
  }
});
