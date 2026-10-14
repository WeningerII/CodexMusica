// verify-f1-selection-5, control that every tree can run on equal terms:
// in ONE synchronous page evaluate -- no typing refresh can run in between --
// put the unmarked draft in the editor, focus it, place the selection, and
// run the send boundary (LY_ACTIONS['ly-run-review']). Then read the text and
// the selection immediately and after the page settles. On 61b6618a the
// migration would otherwise already have run in the typing refresh before
// the selection was placed (v5_c61b_*.log), so this is the like-for-like
// control for "where does the selection go when the boundary rewrites".
// Usage: node v5sync.js <treeDir> <label>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const O = path.join(S, 'h695/verify-f1-selection-5');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const ROOT = process.argv[2];
const LABEL = process.argv[3];
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOCS = {
  CARRIED: '[SETUP — returns — 1.end, 2.end]',
  TWO_ROWS: '[SETUP — returns — 1.T2, 2.end]\n[SETUP — rhyme groups — 5.end, 6]',
  CARRIED_TWO: '[SETUP — returns — 1.end, 2.end]\n[SETUP — rhyme groups — 5.end, 6]',
};
// [case, label, function(doc) -> [s, e, dir]]
const SELS = [
  ['CARRIED', 'caret_in_2end', (d) => [d.indexOf(', 2.end') + 4, d.indexOf(', 2.end') + 4]],
  ['CARRIED', 'sel_2end', (d) => [d.indexOf(', 2.end') + 2, d.indexOf(', 2.end') + 7]],
  ['CARRIED', 'sel_2end_back', (d) => [d.indexOf(', 2.end') + 2, d.indexOf(', 2.end') + 7, 'backward']],
  ['CARRIED', 'caret_in_1end', (d) => [d.indexOf('1.end') + 2, d.indexOf('1.end') + 2]],
  ['TWO_ROWS', 'other_caret_5end', (d) => [d.indexOf('5.end') + 1, d.indexOf('5.end') + 1]],
  ['TWO_ROWS', 'other_sel_6', (d) => [d.indexOf(' 6]') + 1, d.indexOf(' 6]') + 2]],
  ['CARRIED_TWO', 'other_caret_5end', (d) => [d.indexOf('5.end') + 1, d.indexOf('5.end') + 1]],
  ['CARRIED_TWO', 'first_caret_in_2end', (d) => [d.indexOf(', 2.end') + 4, d.indexOf(', 2.end') + 4]],
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain', '.webp': 'image/webp' };
function show(text, s, e) {
  const rs = text.lastIndexOf('\n', s - 1) + 1;
  let re = text.indexOf('\n', e);
  if (re < 0) re = text.length;
  return s === e ? text.slice(rs, s) + '|' + text.slice(s, re) : text.slice(rs, s) + '«' + text.slice(s, e) + '»' + text.slice(e, re);
}
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404), res.end('nf');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  try {
    for (const [ck, sk, f] of SELS) {
      const calls = [];
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
        if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
          calls.push(JSON.parse(r.request().postData() || '{}'));
          return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
        }
        return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
      });
      const page = await ctx.newPage();
      await page.goto(`${base}/codex.html#lyrics`);
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
      await page.waitForTimeout(300);
      const doc = `${DOCS[ck]}\n\n${BODY}`;
      const [s, e, dir = 'forward'] = f(doc);
      const r = await page.evaluate(
        ([doc, s, e, dir]) => {
          const d = $ui('lyrics-draft');
          d.value = doc;
          d.focus();
          d.setSelectionRange(s, e, dir);
          const pre = { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection] };
          LY_ACTIONS['ly-run-review']();
          const now = { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection] };
          return { pre, now };
        },
        [doc, s, e, dir]
      );
      await page.waitForTimeout(400);
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
      const settled = await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], focused: document.activeElement === d };
      });
      const rec = {
        id: `${LABEL}.sync.${ck}.${sk}`,
        preUnchanged: r.pre.text === doc,
        before: { sel: r.pre.sel, shown: show(r.pre.text, r.pre.sel[0], r.pre.sel[1]) },
        migrated: r.now.text !== r.pre.text,
        rowsAfter: r.now.text.split('\n').filter((l) => l.startsWith('[SETUP')),
        afterImmediate: { sel: r.now.sel, shown: show(r.now.text, r.now.sel[0], r.now.sel[1]) },
        afterSettled: { sel: settled.sel, focused: settled.focused, shown: show(settled.text, settled.sel[0], settled.sel[1]), textSameAsImmediate: settled.text === r.now.text },
        sent: calls.map((x) => (x.lyric_context ? x.lyric_context.declarations : null)),
      };
      out.push(rec);
      console.log(`${rec.id}: preUnchanged=${rec.preUnchanged} migrated=${rec.migrated}\n   before   ${JSON.stringify(rec.before)}\n   rows     ${JSON.stringify(rec.rowsAfter)}\n   now      ${JSON.stringify(rec.afterImmediate)}\n   settled  ${JSON.stringify(rec.afterSettled)}\n   sent     ${JSON.stringify(rec.sent)}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(O, `v5sync_${LABEL}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
