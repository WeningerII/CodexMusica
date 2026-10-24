'use strict';
/* global UI, app, pushHistory, window, WS_SCHEMA, Catalog, uiAddInstrument, loadWS, undo, redo */
/* global showToast: writable */
// Mounted source-built app, local intercepted resources, no service calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

test('mounted add stays in its requesting session; a normal configured add supports Undo/Redo', async () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'instrument-add-owner-'));
  let browser;
  try {
    const html = path.join(temp, 'codex.html');
    execFileSync(
      process.execPath,
      ['scripts/build_html.js', '--embedded', '--out=' + html, '--quiet'],
      { cwd: root, stdio: 'pipe' }
    );
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/codex.html')
        return route.fulfill({ path: html, contentType: 'text/html' });
      if (url.hostname === 'mcp.codexmusica.com')
        return route.fulfill({ json: { ok: true, enabled: false } });
      const file = path.resolve(root, '.' + url.pathname);
      if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile())
        return route.fulfill({ path: file });
      return route.abort();
    });
    await page.goto('http://127.0.0.1/codex.html');
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready);
    await page.evaluate(async () => {
      app.cards = [];
      app.workspaceName = 'Session X';
      app.history = [];
      app.historyIndex = -1;
      pushHistory();
      await window.storage.set(
        'codex:ws:ownership-y',
        JSON.stringify({ schema: WS_SCHEMA, name: 'Session Y', cards: [], lyrics: '' })
      );
      window.addToasts = [];
      const toast = showToast;
      showToast = (...args) => {
        window.addToasts.push(args);
        return toast(...args);
      };
      const full = Catalog.ensureFull;
      const hold = new Promise((resolve) => {
        window.releaseAdd = resolve;
      });
      Catalog.ensureFull = async (id) => {
        await hold;
        return full(id);
      };
      window.addConfigured = 0;
      window.pendingAdd = uiAddInstrument('aburukuwa', {
        destination: 'bluegrass',
        configure: (card) => {
          window.addConfigured++;
          card.customLabel = 'Configured';
        },
      });
      await loadWS('codex:ws:ownership-y');
      window.historyBeforeRelease = app.history.length;
      window.addToasts = [];
    });
    const stale = await page.evaluate(async () => {
      window.releaseAdd();
      const result = await window.pendingAdd;
      return {
        result,
        name: app.workspaceName,
        cards: app.cards.length,
        configured: window.addConfigured,
        history: app.history.length,
        before: window.historyBeforeRelease,
        toasts: window.addToasts,
        busy: UI.busy,
      };
    });
    assert.equal(stale.result, null);
    assert.equal(stale.name, 'Session Y');
    assert.equal(stale.cards, 0);
    assert.equal(stale.configured, 0);
    assert.equal(stale.history, stale.before);
    assert.deepEqual(stale.toasts, []);
    assert.equal(stale.busy, false);
    const normal = await page.evaluate(async () => {
      const before = app.history.length;
      const card = await uiAddInstrument('aburukuwa', {
        destination: 'bluegrass',
        configure: (card) => {
          card.customLabel = 'Configured';
        },
      });
      const result = {
        added: !!card,
        count: app.cards.length,
        label: card.customLabel,
        historyDelta: app.history.length - before,
      };
      undo();
      result.afterUndo = app.cards.length;
      redo();
      result.afterRedo = app.cards.length;
      result.redoLabel = app.cards[0].customLabel;
      return result;
    });
    assert.deepEqual(normal, {
      added: true,
      count: 1,
      label: 'Configured',
      historyDelta: 1,
      afterUndo: 0,
      afterRedo: 1,
      redoLabel: 'Configured',
    });
  } finally {
    await browser?.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
