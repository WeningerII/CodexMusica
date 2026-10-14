// BB8 verify-page-rules-2: independent repro of "typed-row-caret".
// Usage: node caret.js <tree-dir> <label>
// Serves <tree-dir>/codex.html on a local port, drives the Lyrics draft with
// real keyboard events, and records the draft text and caret around each step.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const { chromium } = require(path.join(S, 'wt-678/node_modules/playwright'));
const root = path.resolve(process.argv[2]);
const label = process.argv[3] || path.basename(root);
const OUT = path.join(S, 'h678/verify-page-rules-2');

const LYRICS = [
  '[VERSE]',
  'Oh--oh, oh my love',
  'I play the double bass--',
  'Run--run away to the sea',
  'You hold my heart.    10',
  '',
  '[CHORUS]',
  'I walk the line tonight',
  'Well-worn shoes upon the floor',
  'Oh, oh, I said oh',
  'Love above',
].join('\n');

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    const ext = path.extname(f);
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}

const state = (page) =>
  page.evaluate(() => {
    const d = document.getElementById('lyrics-draft');
    const v = d.value;
    const caret = d.selectionStart;
    const lineOfCaret = v.slice(0, caret).split('\n').length;
    return {
      setupRows: v.split('\n').filter((r) => /^\[SETUP/.test(r)),
      caret,
      selEnd: d.selectionEnd,
      len: v.length,
      lineOfCaret,
      lines: v.split('\n').length,
      focused: document.activeElement === d,
      toast: (document.getElementById('toast') || {}).innerText || '',
    };
  });

// Place the caret at (line, col) 1-based line, 0-based column, by keyboard.
async function caretTo(page, line, col) {
  await page.focus('#lyrics-draft');
  await page.keyboard.press('Control+Home');
  for (let i = 1; i < line; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  for (let i = 0; i < col; i++) await page.keyboard.press('ArrowRight');
}

async function fresh(browser, base, text) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof LY !== 'undefined' && !!LY.model && typeof UI !== 'undefined' && UI.ready, null, { timeout: 90000 });
  await page.waitForTimeout(300);
  // Put the starting document in as a paste would: fill fires an input event.
  await page.fill('#lyrics-draft', text);
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { label, root, scenarios: {} };
  const log = (k, v) => {
    out.scenarios[k] = v;
    console.log(`== ${label} ${k}\n${JSON.stringify(v, null, 1)}`);
  };
  try {
    // S9: an unmarked pronunciation-reading row typed key by key (30 ms/key).
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      await page.keyboard.type('[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]', { delay: 30 });
      await page.waitForTimeout(1500);
      const mid = await state(page);
      await page.keyboard.type('Z');
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => {
        const v = document.getElementById('lyrics-draft').value;
        const z = v.lastIndexOf('Z');
        return { line1: v.split('\n')[0], lineOfZ: v.slice(0, z).split('\n').length, lastLine: v.split('\n').pop() };
      });
      log('S9_reading_row', { mid, after, errors });
      await ctx.close();
    }
  } catch (e) {
    out.threw = String(e.stack || e);
    console.log('THREW', out.threw);
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, `caret_reading_${label}.json`), JSON.stringify(out, null, 2));
})();
