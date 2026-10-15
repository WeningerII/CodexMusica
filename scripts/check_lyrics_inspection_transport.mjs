/* global app, UI, LY, lyDraft, uiSaveLyrics, pushHistory, lyRefresh, LY_ACTIONS, chatState, lyRelationEvidenceView, lyIdentity, LY_TOKEN_SCHEME */
// Ordinary page Run review -> local HTTP/chat -> authenticated MCP/Python -> lyReceive.
// Only model tool choice is stubbed. Positive replies are forwarded unchanged.
// One labelled negative corrupts an authenticated projection to verify rejection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createOfflineChat } from './lyrics_inspection_transport_fixture.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(process.env.TEST_ROOT || '.');
const html = process.env.TEST_HTML || path.join(root, 'codex.html');
const out = process.env.TEST_EVIDENCE || '/tmp/lyrics-inspection-transport';
fs.mkdirSync(out, { recursive: true });
const backend = await createOfflineChat();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const cases = [
  {
    name: 'headerless',
    text: '[SETUP — rhyme groups — 1,2]\ncat\nhat',
    args: { lines: ['cat', 'hat'], groups: '1,2' },
    current: true,
  },
  {
    name: 'ordinary-sections',
    text: '[SETUP — rhyme groups — 1,2]\n[VERSE]\ncat\n[CHORUS]\nhat',
    args: { lines: ['cat', 'hat'], groups: '1,2' },
    current: true,
  },
  {
    name: 'sections-whitespace-repeated-utf16',
    text: '[SETUP — rhyme groups — 1,2]\n[VERSE 😀]\n\n \tcat bat cat  \n\n[CHORUS]\n  hat\t ',
    args: { lines: ['cat bat cat', 'hat'], groups: '1,2' },
    current: false,
    rewrittenFinal: true,
  },
  {
    name: 'sections-blanks-repeated-utf16-go',
    text: '[SETUP — rhyme groups — 1,2]\n[VERSE 😀]\n\ncat bat cat\n\n[CHORUS]\nhat',
    args: { lines: ['cat bat cat', 'hat'], groups: '1,2' },
    current: true,
    exactGo: true,
  },
  {
    name: 'tampered-projection',
    text: '[SETUP — rhyme groups — 1,2]\n[VERSE]\ncat\n[CHORUS]\nhat',
    args: { lines: ['cat', 'hat'], groups: '1,2' },
    current: false,
    tamper: true,
  },
  {
    name: 'changed-groups',
    text: '[SETUP — rhyme groups — 1,2]\ncat\nhat',
    args: { lines: ['cat', 'hat'], groups: '1.head,2' },
    current: false,
  },
  {
    name: 'changed-readings',
    text: '[SETUP — rhyme groups — 1,2]\ncat\nhat',
    args: {
      lines: ['cat', 'hat'],
      groups: '1,2',
      pronunciations: [
        {
          line: 'cat',
          token: 1,
          word: 'cat',
          phones: ['K', 'AE1', 'T'],
          basis: 'declared',
          source: 'offline differing declaration',
        },
      ],
    },
    current: false,
  },
  {
    name: 'unsupported-text-transformation',
    text: '[SETUP — rhyme groups — 1,2]\ncat\nhat',
    args: { lines: ['bat', 'hat'], groups: '1,2' },
    current: false,
  },
];
const results = [];
try {
  for (const scenario of cases.filter(
    (c) => !process.env.TEST_CASE || c.name === process.env.TEST_CASE
  )) {
    backend.setArgs(scenario.args);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const posts = [],
      replies = [],
      pageErrors = [];
    await context.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.hostname === 'mcp.codexmusica.com') {
        if (url.pathname === '/chat' && request.method() === 'POST') {
          const body = request.postData();
          posts.push(JSON.parse(body));
          const response = await backend.fetch(backend.url + '/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
          });
          const responseText = await response.text();
          const payload = JSON.parse(responseText);
          replies.push(payload);
          let delivered = responseText;
          if (scenario.tamper) {
            const changed = structuredClone(payload);
            const evidence = changed.tools.find(
              (t) => t.schema_instance_evidence
            )?.schema_instance_evidence;
            assert(
              evidence?.request_binding?.source_projection,
              'tamper starts with authenticated projection'
            );
            evidence.request_binding.source_projection.rows.find((r) => r.kind === 'sung')
              .text_start++;
            delivered = JSON.stringify(changed);
          }
          return route.fulfill({
            status: response.status,
            contentType: 'application/json',
            body: delivered,
          });
        }
        return route.fulfill({ json: { ok: true, enabled: true } });
      }
      if (url.hostname === '127.0.0.1') {
        const file =
          url.pathname === '/codex.html'
            ? html
            : path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (
          (file === html || file.startsWith(root + path.sep)) &&
          fs.existsSync(file) &&
          fs.statSync(file).isFile()
        )
          return route.fulfill({ path: file });
        return route.fulfill({ status: 404 });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const record = { name: scenario.name };
    try {
      await page.goto('http://127.0.0.1/codex.html#lyrics');
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && LY.model);
      await page.evaluate((text) => {
        lyDraft().value = text;
        uiSaveLyrics();
        pushHistory();
        lyRefresh(true);
        LY_ACTIONS['ly-tab']('review');
      }, scenario.text);
      record.beforeClick = await page.evaluate(() => ({
        text: LY.model.text,
        draft: lyDraft().value,
        appLyrics: app.lyrics,
        semanticId: lyIdentity(LY.model),
      }));
      await page.locator('#ly-panel-review [data-ui="ly-run-review"]').click();
      await page.waitForFunction(() => !chatState.busy && !!LY.run, null, { timeout: 120000 });
      assert.equal(posts.length, 1, 'ordinary button makes exactly one page request');
      assert.equal(replies.length, 1, 'actual local HTTP response delivered');
      const state = await page.evaluate(() => {
        const saved = LY.run.relationEvidence;
        const view = lyRelationEvidenceView(saved?.evidence, {
          requestId: saved?.requestId,
          binding: saved?.binding,
          document: {
            semanticId: lyIdentity(LY.model),
            text: LY.model.text,
            readerScheme: LY_TOKEN_SCHEME,
            voices: LY.model.voices,
          },
        });
        return {
          evidence: !!saved?.evidence,
          requestBinding: !!saved?.evidence?.request_binding,
          binding: !!saved?.binding,
          freshness: view.freshness,
          canGo: view.pairs.some((p) => p.canGo),
          submittedContext: UI.lyricRequest?.submittedContext,
          run: LY.run.id,
          currentText: LY.model.text,
          currentId: lyIdentity(LY.model),
          requestText: UI.lyricRequest?.text,
          draftText: lyDraft().value,
          savedBinding: saved?.binding,
        };
      });
      Object.assign(record, state);
      assert.deepEqual(
        state.submittedContext,
        posts[0].lyric_context,
        'page preserved exact submitted context'
      );
      assert(state.evidence, 'authenticated real producer evidence reached lyReceive');
      if (scenario.current) {
        assert.equal(state.freshness, 'current');
        assert(state.binding);
        assert(state.canGo);
      } else if (scenario.rewrittenFinal) {
        // The real reply applies trimmed sung lines. Its source receipt remains
        // bound to the original bytes, so the rewritten document must be stale.
        assert.equal(state.binding, true);
        assert.equal(state.freshness, 'stale');
        assert.equal(state.canGo, false);
        assert.equal(state.savedBinding.text, record.beforeClick.text);
        assert.notEqual(state.currentText, record.beforeClick.text);
        assert.equal(
          state.currentText,
          record.beforeClick.text
            .split('\n')
            .map((row) => (row.trim() && !row.trim().startsWith('[') ? row.trim() : row))
            .join('\n')
        );
      } else {
        assert.equal(state.binding, false);
        assert.equal(state.canGo, false);
        assert.notEqual(state.freshness, 'current');
      }
      if (scenario.exactGo) {
        const target = await page.evaluate(() => {
          const saved = LY.run.relationEvidence;
          const view = lyRelationEvidenceView(saved.evidence, {
            requestId: saved.requestId,
            binding: saved.binding,
            document: {
              semanticId: lyIdentity(LY.model),
              text: LY.model.text,
              readerScheme: LY_TOKEN_SCHEME,
              voices: LY.model.voices,
            },
          });
          const start = LY.model.text.lastIndexOf('cat');
          for (const pair of view.pairs.filter((p) => p.canGo))
            for (const side of ['a', 'b']) {
              const part = view.occurrences[pair[side]].parts.findIndex(
                (p) => p.start === start && p.end === start + 3
              );
              if (part >= 0) return { pair: pair.id, side, part, start, end: start + 3 };
            }
          return null;
        });
        assert(
          target,
          'genuine report places the second cat at independently calculated UTF-16 offsets'
        );
        await page.evaluate((start) => {
          const draft = lyDraft();
          draft.focus();
          draft.setSelectionRange(start, start);
          draft.dispatchEvent(new Event('select', { bubbles: true }));
        }, target.start);
        await page.locator('[data-ui="ly-relations"]:visible').first().click();
        const all = page.locator('[data-ui="ly-relation-source"][data-id=""]:visible');
        if (await all.count()) await all.click();
        const expand = page.locator('[data-ui="ly-relation-expand"]:visible');
        if (await expand.count()) await expand.click();
        await page
          .locator(
            `[data-ui="ly-relation-go"][data-pair="${target.pair}"][data-side="${target.side}"][data-part="${target.part}"]:visible`
          )
          .click();
        const landed = await page.evaluate(() => {
          const d = lyDraft();
          return {
            start: d.selectionStart,
            end: d.selectionEnd,
            text: d.value.slice(d.selectionStart, d.selectionEnd),
          };
        });
        assert.deepEqual(landed, { start: target.start, end: target.end, text: 'cat' });
        record.exactGo = { target, landed };
      }
      assert.deepEqual(pageErrors, []);
      record.pass = true;
    } catch (error) {
      record.pass = false;
      record.error = error.stack;
    }
    fs.writeFileSync(
      path.join(out, scenario.name + '.json'),
      JSON.stringify({ record, posts, replies, pageErrors }, null, 2)
    );
    results.push(record);
    await context.close();
  }
} finally {
  await browser.close();
  await backend.close();
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(results, null, 2));
for (const result of results)
  console.log(
    `${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${result.freshness || result.error?.split('\n')[0]}`
  );
process.exitCode = results.every((r) => r.pass) ? 0 : 1;
