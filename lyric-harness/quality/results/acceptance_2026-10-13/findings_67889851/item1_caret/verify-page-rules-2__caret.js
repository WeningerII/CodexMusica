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
    // S1: the reported repro. Row typed at the top (empty line 1), 30 ms/key.
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      const before = await state(page);
      await page.keyboard.type('[SETUP — rhyme groups — 1.T4,8]', { delay: 30 });
      await page.waitForTimeout(1500);
      const mid = await state(page);
      await page.keyboard.type('Z');
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => {
        const v = document.getElementById('lyrics-draft').value;
        const z = v.indexOf('Z');
        return { line1: v.split('\n')[0], zAt: z, lineOfZ: v.slice(0, z).split('\n').length, lastLine: v.split('\n').pop() };
      });
      log('S1_top_30ms', { before, mid, after, errors });
      await ctx.close();
    }
    // S2: slow human typing (180 ms/key): which key triggers the rewrite.
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      const row = '[SETUP — rhyme groups — 1.T4,8]';
      const steps = [];
      for (const ch of row) {
        await page.keyboard.type(ch);
        await page.waitForTimeout(180);
        const s = await state(page);
        steps.push({ typed: ch, row1: s.setupRows[0] || null, caret: s.caret, len: s.len, lineOfCaret: s.lineOfCaret });
      }
      const jumps = steps.filter((s, i) => i && s.lineOfCaret !== 1);
      log('S2_top_slow', { firstJump: jumps[0] || null, last3: steps.slice(-3), errors });
      await ctx.close();
    }
    // S3: fast typing then Enter + next word before any 120 ms pause.
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      await page.keyboard.type('[SETUP — rhyme groups — 1.T4,8]', { delay: 20 });
      await page.keyboard.press('Enter');
      await page.keyboard.type('[SETUP — returns — 5,8]', { delay: 20 });
      await page.waitForTimeout(800);
      const mid = await state(page);
      await page.keyboard.type('Q');
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => {
        const v = document.getElementById('lyrics-draft').value;
        const q = v.indexOf('Q');
        return { lines123: v.split('\n').slice(0, 3), lineOfQ: v.slice(0, q).split('\n').length, lines: v.split('\n').length };
      });
      log('S3_two_rows_fast', { mid, after, errors });
      await ctx.close();
    }
    // S4: numbered member on lines whose cut did NOT change (5 and 6).
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      await page.keyboard.type('[SETUP — rhyme groups — 5.T3,6]', { delay: 30 });
      await page.waitForTimeout(1200);
      const mid = await state(page);
      log('S4_numbered_unchanged_line', { mid, errors });
      await ctx.close();
    }
    // S5: named places on a changed-cut line (line 1 end, line 8).
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      await page.keyboard.type('[SETUP — rhyme groups — 1,8]', { delay: 30 });
      await page.waitForTimeout(1200);
      const mid = await state(page);
      log('S5_named_changed_line', { mid, errors });
      await ctx.close();
    }
    // S6: named places on unchanged lines (5,6): expected no rewrite.
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      await page.keyboard.type('[SETUP — rhyme groups — 5,6]', { delay: 30 });
      await page.waitForTimeout(1200);
      const mid = await state(page);
      log('S6_named_unchanged_line', { mid, errors });
      await ctx.close();
    }
    // S7: row typed already marked with the current cut: expected no rewrite.
    {
      const { ctx, page, errors } = await fresh(browser, base, '\n' + LYRICS);
      await caretTo(page, 1, 0);
      await page.keyboard.type('[SETUP — rhyme groups — 1.T5,8 — cut v2]', { delay: 30 });
      await page.waitForTimeout(1200);
      const mid = await state(page);
      log('S7_marked_row', { mid, errors });
      await ctx.close();
    }
    // S8: editing inside an existing (unrewritten) row: turn "5,6" into
    // "5.T3,6" by typing ".T3" after the 5.
    {
      const { ctx, page, errors } = await fresh(browser, base, '[SETUP — rhyme groups — 5,6]\n' + LYRICS);
      const pre = await state(page);
      const col = '[SETUP — rhyme groups — 5'.length;
      await caretTo(page, 1, col);
      const steps = [];
      for (const ch of '.T3') {
        await page.keyboard.type(ch);
        await page.waitForTimeout(250);
        const s = await state(page);
        steps.push({ typed: ch, row1: s.setupRows[0], caret: s.caret, lineOfCaret: s.lineOfCaret, len: s.len });
      }
      await page.keyboard.type('Y');
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => {
        const v = document.getElementById('lyrics-draft').value;
        const y = v.lastIndexOf('Y');
        return { line1: v.split('\n')[0], lineOfY: v.slice(0, y).split('\n').length, lastLine: v.split('\n').pop() };
      });
      log('S8_edit_inside_row', { pre: pre.setupRows, steps, after, errors });
      await ctx.close();
    }
  } catch (e) {
    out.threw = String(e.stack || e);
    console.log('THREW', out.threw);
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, `caret_${label}.json`), JSON.stringify(out, null, 2));
})();
