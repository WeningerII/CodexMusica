/* Actual shipped app fixture. Provider requests stay local. The envelope
   arrives through the shell's in-page handoff (uiOpenInLyrics), as the
   Library tab's 'Open in Lyrics' sends it; there is no window handoff (#659). */
/* global window, document, UI, LY, LY_ACTIONS, $ui, app, chatState, _chatReset, uiSaveLyrics, pushHistory, lyRefresh, lyLibraryStore, lyMeta, uiOpenInLyrics */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { webcrypto } = require('node:crypto');
const { chromium } = require('playwright');
const api = require('../src/library-import.js');

(async () => {
  const root = path.join(__dirname, '..');
  const temporary = process.env.LIBRARY_TEST_HTML
    ? null
    : fs.mkdtempSync(path.join(os.tmpdir(), 'codex-musica-library-shipped-'));
  const htmlPath = process.env.LIBRARY_TEST_HTML
    ? path.resolve(root, process.env.LIBRARY_TEST_HTML)
    : path.join(temporary, 'codex.html');
  // The embedded build includes the exact shipped runtime modules while
  // avoiding a dependency on the generated lazy-shell api/ deployment tree.
  // Its temporary artifact never becomes a tracked repository file.
  if (temporary) {
    try {
      execFileSync(
        process.execPath,
        [
          path.join(root, 'scripts/build_html.js'),
          '--embedded',
          '--out=' + htmlPath,
          '--check',
          '--quiet',
        ],
        { cwd: root, stdio: 'pipe' }
      );
    } catch (error) {
      fs.rmSync(temporary, { recursive: true, force: true });
      throw error;
    }
  }
  const html = fs.readFileSync(htmlPath);
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/codex.html')) {
      response.setHeader('Content-Type', 'text/html;charset=utf-8');
      response.end(html);
    } else {
      response.writeHead(404);
      response.end('No fixture asset');
    }
  });
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let providerPosts = 0;
    await context.route(/mcp\.codexmusica\.com/, async (route) => {
      if (route.request().method() === 'POST') providerPosts++;
      await route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + '/codex.html#lyrics');
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
      timeout: 60000,
    });
    const before = await page.evaluate(() => {
      $ui('lyrics-draft').value = 'My existing private song\nKeep every older line';
      app.lyricMeta = {
        version: 1,
        brief: 'Existing private brief',
        notes: { Verse: 'Existing note' },
        drafts: {},
        ui: {},
        draftId: 'draft:existing-shipped',
      };
      uiSaveLyrics();
      pushHistory();
      Object.assign(chatState, {
        generation: 40,
        busy: true,
        task: { domain: 'lyrics', phase: 'edit' },
        continuationId: 'private-existing-continuation',
        pending: { request_id: 'private-existing-request', domain: 'lyrics' },
        lyric: { certified: true },
        controller: new AbortController(),
      });
      window.aborts = 0;
      chatState.controller.signal.addEventListener('abort', () => window.aborts++);
      window.resets = 0;
      const reset = _chatReset;
      window._chatReset = (...args) => {
        window.resets++;
        return reset(...args);
      };
      $ui('chat-input').value = 'An unsent lyric-writing instruction';
      LY.run = {
        at: Date.now(),
        final: ['My existing private song', 'Keep every older line'],
        lyric: { certified: true },
      };
      lyRefresh(true);
      return { text: app.lyrics, cards: JSON.stringify(app.cards) };
    });
    const envelope = {
      protocol: api.PROTOCOL,
      version: 1,
      handoffId: 'handoff:shipped',
      draftId: 'draft:shipped',
      createdAt: new Date().toISOString(),
      payload: {
        text: 'The evening wind\nReturns the song',
        title: 'Shipped reading',
        language: 'eng',
        scope: 'whole',
        provenance: {
          snapshotId: 'snapshot:shipped',
          unitId: 'unit:shipped',
          workId: 'work:shipped',
          editionId: 'edition:shipped',
          revisionId: 'revision:shipped',
          rights: { notices: ['Mandatory attribution retained verbatim'] },
        },
        lineage: [
          {
            id: 'line:one',
            physical_line: 10,
            normalized_utf16_range: [0, 16],
            source_ranges: [{ utf16_range: [100, 116], precision: 'exact' }],
          },
        ],
        declarations: [],
      },
    };
    envelope.digest = await api.envelopeDigest(envelope, webcrypto);
    const opened = await page.evaluate(
      async (envelope) => (await uiOpenInLyrics(envelope)).duplicate,
      envelope
    );
    assert.equal(opened, false);
    const imported = await page.evaluate(async () => ({
      text: app.lyrics,
      meta: lyMeta(),
      run: LY.run,
      continuationId: chatState.continuationId,
      cards: JSON.stringify(app.cards),
      aborts: window.aborts,
      resets: window.resets,
      drafts: await lyLibraryStore.listDrafts(),
      source: $ui('ly-library-source').innerText,
      downloadLabel: document.querySelector('[data-ui="ly-download"]').innerText,
    }));
    assert.equal(imported.text, envelope.payload.text);
    assert.equal(imported.continuationId, null);
    assert.equal(imported.run, null);
    assert.equal(imported.aborts, 0);
    assert.equal(imported.resets, 0);
    assert.equal(imported.cards, before.cards);
    const preserved = imported.drafts.find((draft) => draft.draftId === 'draft:existing-shipped');
    assert.equal(preserved.text, before.text);
    assert.equal(preserved.writer.continuationId, 'private-existing-continuation');
    assert.equal(preserved.writer.pending.request_id, 'private-existing-request');
    assert.equal(preserved.writerInput, 'An unsent lyric-writing instruction');
    assert.equal(preserved.meta.notes.Verse, 'Existing note');
    assert.match(imported.downloadLabel, /text and sources/);
    assert.deepEqual(
      imported.meta.libraryOrigin.provenance.rights.notices,
      envelope.payload.provenance.rights.notices
    );

    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(() => LY_ACTIONS['ly-download']());
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.library-working-copy\.json$/);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    await api.validateEnvelope(exported, webcrypto);
    assert.equal(exported.payload.text, envelope.payload.text);
    assert.deepEqual(
      exported.payload.provenance.rights.notices,
      envelope.payload.provenance.rights.notices
    );

    // Browser reload followed by a repeat of the same handoff must find the
    // existing copy without reactivating it or cloning another draft.
    await page.reload();
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, {
      timeout: 60000,
    });
    const repeated = await page.evaluate(
      async (envelope) => (await uiOpenInLyrics(envelope)).duplicate,
      envelope
    );
    assert.equal(repeated, true);
    assert.equal(await page.evaluate(() => app.lyrics), envelope.payload.text);
    assert.equal(await page.evaluate(async () => (await lyLibraryStore.listDrafts()).length), 2);
    assert.equal(providerPosts, 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      'SHIPPED LIBRARY IMPORT: PASS — in-page handoff, actual app activation, saved old continuation, no abort/reset/certification inheritance, mandatory export, reload replay and zero provider POSTs.'
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
