// verify-page-rules-6: does the page's cut migration move the caret while the
// person types or pastes into the draft? Independent repro, candidate vs main.
// Usage: node caret.js <tree-root> <label>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const ROOT = process.argv[2];
const LABEL = process.argv[3] || path.basename(ROOT);
const OUT = __dirname;
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const { chromium } = require(path.join(S, 'wt-678/node_modules/playwright'));

// Sung lines: 1 "Oh--oh, oh my love" (cut changes v1->v2), 2-4 plain words.
const DOC = `[VERSE]
Oh--oh, oh my love
I hold the dove

[CHORUS]
Run to the sea
And stay with me`;
// The caret goes on the blank line between sections (after "dove\n").
const AT = DOC.indexOf('dove\n') + 'dove\n'.length;

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    const ext = path.extname(f);
    res.writeHead(200, {
      'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(f).pipe(res);
  });
}

const CASES = [
  // [id, how, text]
  ['typed_unmarked_T', 'type', '[SETUP — rhyme groups — 1.T4,2]'],
  ['typed_marked_T', 'type', '[SETUP — rhyme groups — 1.T5,2 — cut v2]'],
  ['typed_bare_changed_line', 'type', '[SETUP — rhyme groups — 1,2]'],
  ['typed_bare_unchanged_lines', 'type', '[SETUP — rhyme groups — 2,4]'],
  ['typed_unmarked_reading', 'type', '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love"]'],
  ['inserted_unmarked_T', 'insert', '[SETUP — rhyme groups — 1.T4,2]'],
];

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  for (const [id, how, row] of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
    await ctx.addInitScript(() => {
      window.__toasts = [];
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          const t = document.getElementById('toast');
          const s = t && t.innerText;
          if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${base}/codex.html#lyrics`);
    await page.waitForFunction(() => typeof LY !== 'undefined' && !!LY.model && typeof UI !== 'undefined' && UI.ready, null, { timeout: 90000 });
    await page.waitForTimeout(400);
    await page.evaluate((t) => {
      $ui('lyrics-draft').value = t;
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
    }, DOC);
    await page.waitForTimeout(300);
    const seeded = await page.evaluate(() => $ui('lyrics-draft').value);
    await page.click('#lyrics-draft');
    await page.evaluate((at) => {
      const d = $ui('lyrics-draft');
      d.focus();
      d.setSelectionRange(at, at);
    }, AT);
    await page.evaluate(() => (window.__toasts.length = 0));
    // Type (or insert in one go, as a paste does) the row, then Enter, then
    // stop for 1s: the debounced refresh (120 ms) runs in the pause.
    if (how === 'type') await page.keyboard.type(row + '\n', { delay: 25 });
    else await page.keyboard.insertText(row + '\n');
    const justAfter = await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      return { caret: d.selectionStart, end: d.selectionEnd, len: d.value.length };
    });
    await page.waitForTimeout(1000);
    const afterPause = await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      return { caret: d.selectionStart, end: d.selectionEnd, len: d.value.length, focused: document.activeElement === d, rowNow: d.value.split('\n').find((r) => /^\[SETUP/.test(r)) || null };
    });
    await page.keyboard.type('ZQ', { delay: 25 });
    await page.waitForTimeout(400);
    const fin = await page.evaluate(() => {
      const t = $ui('lyrics-draft').value;
      const z = t.indexOf('ZQ');
      return { text: t, zAt: z, lineOfZ: z < 0 ? null : t.slice(0, z).split('\n').length, lineCount: t.split('\n').length, toasts: window.__toasts.slice() };
    });
    // Where the person meant ZQ to go: right after the row and its newline.
    const intended = AT + row.length + 1;
    const intendedLine = DOC.slice(0, AT).split('\n').length + 1;
    const r = {
      tree: LABEL,
      id,
      how,
      typedRow: row,
      seededOk: seeded === DOC,
      caretBeforePause: justAfter,
      intendedCaret: intended,
      afterPause,
      caretMoved: afterPause.caret !== justAfter.caret,
      caretAtDocEnd: afterPause.caret === afterPause.len,
      zAt: fin.zAt,
      lineOfZ: fin.lineOfZ,
      intendedLine,
      zLandedWhereIntended: fin.lineOfZ === intendedLine,
      finalText: fin.text,
      toasts: fin.toasts,
      pageErrors: errs,
    };
    results.push(r);
    console.log(`[${LABEL}] ${id} (${how}): row now=${JSON.stringify(afterPause.rowNow)} caret ${justAfter.caret}->${afterPause.caret} (len ${afterPause.len}, focused ${afterPause.focused}); ZQ on line ${fin.lineOfZ} (intended ${intendedLine}) -> ${r.zLandedWhereIntended ? 'OK' : 'MISPLACED'}; toasts=${JSON.stringify(fin.toasts)} errors=${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, `caret_${LABEL}.json`), JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
