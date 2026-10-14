// verify-f1-selection-2: independent repro of claim c1 (3PO case).
// An unmarked '[SETUP — returns — 1.T2, 2.end]' row is put in the draft by
// real keyboard input (Ctrl+A + insertText, i.e. a paste; no boundary), the
// caret/selection is put on the UNCHANGED member '2.end' with real arrow
// keys, then a send boundary runs. Recorded: text, selection (+direction),
// focus, what the page sent, and what two typed keys do afterwards.
// Serves the tree's files, with /codex.html replaced by this folder's build
// of that tree (cmp-identical, COMMANDS.txt). mcp.codexmusica.com is stubbed.
// Usage: node sel.js <tree-label> <trigger>[,<trigger>...] [placement,...]
//   trigger: chatClick | reviewKbd | reviewClick | reviewProg
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const O = path.join(S, 'h695/verify-f1-selection-2');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = { cand: 'wt-695', c61b: 'wt-61b', c678: 'wt-678', main: 'wt-main', base: 'wt-base' };
const LABEL = process.argv[2];
const TRIGGERS = (process.argv[3] || 'chatClick,reviewKbd,reviewClick,reviewProg').split(',');
const PLACES = (process.argv[4] || 'top,bottom').split(',');
const ROOT = path.join(S, TREES[LABEL]);
const PAGE = path.join(O, 'built', `built-${TREES[LABEL]}.html`);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const ROW = '[SETUP — returns — 1.T2, 2.end]';
const NEWROW = '[SETUP — returns — 1.T3, 2.end — cut v2]';
const docOf = (where) => (where === 'top' ? `${ROW}\n\n${BODY}` : `${BODY}\n\n${ROW}`);
// selections: [name, startInRow, endInRow, direction]
const k2 = ROW.indexOf('2.end');
const SELS = process.env.SELSET === 'body'
  ? [['body_caret_w|alk', 'BODY', 'walk', 1]]
  : [
      ['caret_2.|end', k2 + 2, k2 + 2, 'forward'],
      ['sel_2end_fwd', k2, k2 + 5, 'forward'],
      ['sel_2end_back', k2, k2 + 5, 'backward'],
    ];

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return fs.createReadStream(PAGE).pipe(res);
    }
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
const st = (page) =>
  page.evaluate(() => {
    const d = document.getElementById('lyrics-draft');
    return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], active: document.activeElement ? document.activeElement.id || document.activeElement.getAttribute('data-ui') || document.activeElement.tagName : null };
  });
const show = (t, a, b) => {
  const ls = t.lastIndexOf('\n', a - 1) + 1;
  let le = t.indexOf('\n', b);
  if (le < 0) le = t.length;
  return a === b ? t.slice(ls, a) + '|' + t.slice(a, le) : t.slice(ls, a) + '«' + t.slice(a, b) + '»' + t.slice(b, le);
};

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { label: LABEL, tree: ROOT, page: PAGE, browser: browser.version(), cases: [] };
  try {
    for (const trig of TRIGGERS)
      for (const where of PLACES)
        for (const [sname, rs, re, dir] of SELS) {
          const doc = docOf(where);
          const rowAt = doc.indexOf(ROW);
          const bodyCase = rs === 'BODY';
          const want = bodyCase ? [doc.indexOf(re) + dir, doc.indexOf(re) + dir] : [rowAt + rs, rowAt + re];
          const c = { id: `${LABEL}.${trig}.${where}.${sname}`, doc_row_at: rowAt, set: [...want, dir] };
          const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const calls = [];
          await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
            const rq = r.request();
            if (rq.method() === 'POST' && /\/chat$/.test(rq.url())) {
              let b = {};
              try { b = JSON.parse(rq.postData() || '{}'); } catch (e) {}
              calls.push({ url: rq.url(), declarations: b.lyric_context ? b.lyric_context.declarations : undefined, hasCtx: !!b.lyric_context });
              await new Promise((s) => setTimeout(s, 60));
              return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
            }
            return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
          });
          const page = await ctx.newPage();
          const errs = [];
          page.on('pageerror', (e) => errs.push(e.message));
          try {
            await page.goto(`${base}/codex.html#lyrics`);
            await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
            await page.waitForTimeout(500);
            // Real input: click the editor, select all, paste the document.
            const ta = page.locator('#lyrics-draft');
            await ta.click();
            await page.keyboard.press('Control+A');
            await page.keyboard.insertText(doc);
            await page.waitForTimeout(700); // the typing refresh (120 ms) runs
            const afterPaste = await st(page);
            c.pasteKeptBytes = afterPaste.text === doc;
            if (!c.pasteKeptBytes) c.afterPasteText = afterPaste.text;
            // Real keys: put the caret / selection on 2.end.
            await page.keyboard.press('Control+Home');
            const startAt = !bodyCase && dir === 'backward' ? want[1] : want[0];
            for (let i = 0; i < startAt; i++) await page.keyboard.press('ArrowRight');
            if (!bodyCase && want[1] !== want[0])
              for (let i = 0; i < want[1] - want[0]; i++) await page.keyboard.press(dir === 'backward' ? 'Shift+ArrowLeft' : 'Shift+ArrowRight');
            await page.waitForTimeout(300);
            const pre = await st(page);
            c.before = { sel: pre.sel, shown: show(pre.text, pre.sel[0], pre.sel[1]), active: pre.active, sameText: pre.text === doc };
            c.keysPlacedAsIntended = pre.sel[0] === want[0] && pre.sel[1] === want[1];
            const n0 = calls.length;
            if (trig === 'chatClick') {
              // The page's own entry: "Write with AI" menu -> "Edit this draft".
              let opened = false;
              const editItem = page.locator('[data-ui="edit-lyrics"]:visible').first();
              if (!(await editItem.count())) {
                const mb = page.locator('[data-ui="ly-menu"][data-id="ai"]:visible').first();
                c.menuButton = await mb.count();
                if (c.menuButton) await mb.click();
              }
              const item = page.locator('[data-ui="edit-lyrics"]:visible').first();
              c.editItem = await item.count();
              if (c.editItem) { await item.click(); opened = true; }
              else await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
              c.openedByClick = opened;
              await page.waitForTimeout(300);
              c.activeAfterOpen = (await st(page)).active;
              await page.keyboard.type('Tighten line 2', { delay: 5 });
              await page.locator('#chat-send').click();
            } else if (trig === 'reviewKbd') {
              // Keyboard: focus moves to the button (as Tab does), Enter activates.
              const b = page.locator('[data-ui="ly-run-review"]:visible').first();
              await b.focus();
              c.activeOnButton = (await st(page)).active;
              await page.keyboard.press('Enter');
            } else if (trig === 'reviewClick') {
              await page.locator('[data-ui="ly-run-review"]:visible').first().click();
            } else if (trig === 'reviewProg') {
              await page.evaluate(() => LY_ACTIONS['ly-run-review']());
            }
            await page.waitForTimeout(400);
            await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(300);
            const post = await st(page);
            c.sent = calls.slice(n0).map((x) => x.declarations === undefined ? '(no lyric_context)' : x.declarations);
            c.migrated = post.text !== pre.text;
            c.rowAfter = post.text.split('\n')[(where === 'top' ? 0 : post.text.split('\n').length - 1)];
            c.after = { sel: post.sel, shown: show(post.text, post.sel[0], post.sel[1]), active: post.active };
            // Same characters, computed here: 2.end in the row as it now reads.
            const nrow = post.text.lastIndexOf(c.rowAfter);
            const k = c.rowAfter.indexOf('2.end');
            c.sameCharsWant = bodyCase ? [post.text.indexOf(re) + dir, post.text.indexOf(re) + dir] : rs === re ? [nrow + k + 2, nrow + k + 2] : [nrow + k, nrow + k + 5];
            c.sameChars = post.sel[0] === c.sameCharsWant[0] && post.sel[1] === c.sameCharsWant[1];
            c.pageMapPredicted = await page.evaluate(([a, b, s, e]) => (typeof lyMapOffset === 'function' ? [lyMapOffset(a, b, s), lyMapOffset(a, b, e)] : null), [pre.text, post.text, pre.sel[0], pre.sel[1]]);
            // Back to the editor by keyboard: Shift+Tab until the editor has focus.
            let hops = 0;
            if (post.active !== 'lyrics-draft') {
              for (; hops < 60; hops++) {
                await page.keyboard.press('Shift+Tab');
                if ((await st(page)).active === 'lyrics-draft') break;
              }
            }
            const back = await st(page);
            c.returnByShiftTab = { hops: hops + (back.active === 'lyrics-draft' ? 1 : 0), reached: back.active === 'lyrics-draft', sel: back.sel };
            if (back.active !== 'lyrics-draft') {
              await page.evaluate(() => document.getElementById('lyrics-draft').focus());
              c.returnByFocusCall = (await st(page)).sel;
            }
            await page.keyboard.type('ZQ', { delay: 20 });
            await page.waitForTimeout(500);
            const typed = await st(page);
            const z = typed.text.indexOf('ZQ');
            const ln = typed.text.slice(0, z).split('\n').length - 1;
            c.typedZQ = { at: z, rowNow: typed.text.split('\n')[ln] };
            c.parsedAfterTyping = await page.evaluate((t) => {
              const m = lyParse(t);
              const d = lyDeclarationsOf(m);
              return { declarations: JSON.parse(JSON.stringify(d)), refusal: typeof lyUndecidedRefusal === 'function' ? lyUndecidedRefusal(m) : null };
            }, typed.text);
            c.errors = errs;
          } catch (x) {
            c.threw = String((x && x.stack) || x);
          }
          out.cases.push(c);
          console.log(`${c.id}: keysOK=${c.keysPlacedAsIntended} pasteKept=${c.pasteKeptBytes} migrated=${c.migrated} sameChars=${c.sameChars}
   before ${JSON.stringify(c.before && c.before.sel)} ${JSON.stringify(c.before && c.before.shown)} active=${c.before && c.before.active}
   after  ${JSON.stringify(c.after && c.after.sel)} ${JSON.stringify(c.after && c.after.shown)} active=${c.after && c.after.active}
   want   ${JSON.stringify(c.sameCharsWant)}  lyMapOffset=${JSON.stringify(c.pageMapPredicted)}
   row    ${JSON.stringify(c.rowAfter)}
   back   ${JSON.stringify(c.returnByShiftTab)}${c.returnByFocusCall ? ' focus()->' + JSON.stringify(c.returnByFocusCall) : ''}
   ZQ ->  ${JSON.stringify(c.typedZQ)}
   parsed ${JSON.stringify(c.parsedAfterTyping && c.parsedAfterTyping.declarations)}
   refusal ${JSON.stringify(c.parsedAfterTyping && c.parsedAfterTyping.refusal)}
   sent   ${JSON.stringify(c.sent)}${c.threw ? '\n   THREW ' + c.threw : ''}${c.errors && c.errors.length ? '\n   ERR ' + c.errors.join(' | ') : ''}`);
          await ctx.close();
        }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(O, `sel_${LABEL}_${TRIGGERS.join('-')}_${PLACES.join('-')}${process.env.SELSET ? '_' + process.env.SELSET : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
