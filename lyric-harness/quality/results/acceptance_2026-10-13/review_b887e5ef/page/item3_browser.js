// Item 3: real Chromium (Playwright) probe of Tab-then-mouse Run review selection/caret.
// usage: node item3_browser.js <repoRoot> <variant>   variant: b887 | nohandler | focusedonly
//   b887        = codex.html as built at the root (identical to a fresh build of b887 src)
//   nohandler   = the same HTML with the lyWire mousedown handler removed (counterfactual)
//   focusedonly = handler restricted to `document.activeElement === draft` (84f7fa94 form)
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2]);
const VARIANT = process.argv[3] || 'b887';
const HTML = 'codex.html';
const HANDLER = `surface.addEventListener("mousedown",e=>{if(e.button===0&&e.target.closest('[data-ui="ly-run-review"]')){e.preventDefault();if(document.activeElement===draft)pushHistory();else{const selection=[draft.selectionStart,draft.selectionEnd,draft.selectionDirection];draft.focus({preventScroll:true});draft.setSelectionRange(...selection)}}});`;
let html = fs.readFileSync(path.join(ROOT, HTML), 'utf8');
if (VARIANT !== 'b887') {
  if (!html.includes(HANDLER)) throw new Error('handler text not found');
  html = html.replace(HANDLER, VARIANT === 'nohandler' ? '' :
    `surface.addEventListener("mousedown",e=>{if(e.button===0&&document.activeElement===draft&&e.target.closest('[data-ui="ly-run-review"]')){e.preventDefault();pushHistory()}});`);
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '/' + HTML) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const exe = (() => { const b = process.env.PLAYWRIGHT_BROWSERS_PATH; for (const d of fs.readdirSync(b)) if (/^chromium-\d+$/.test(d)) return path.join(b, d, 'chrome-linux', 'chrome'); })();
const LEG = '[SETUP — rhyme groups — 1.T2,2.end]';
const SONG = '[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight';
const LONG = Array.from({ length: 120 }, (_, i) => `filler line number ${i} of a long song`).join('\n');
// Each scenario: text, how to find [start,end] (in the ORIGINAL text) and the text expected selected after.
const S = [
  { id: 'S1 sung-line forward', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('sing it'), t.indexOf('sing it') + 7], dir: 'forward', want: 'sing it' },
  { id: 'S1b sung-line backward', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('sing it'), t.indexOf('sing it') + 7], dir: 'backward', want: 'sing it' },
  { id: 'S2 unchanged member in rewritten row (backward)', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('2.end'), t.indexOf('2.end') + 5], dir: 'backward', want: '2.end' },
  { id: 'S3 span over changed member', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('1.T2'), t.indexOf('2.end') + 5], dir: 'forward', want: '1.T3,2.end' },
  { id: 'S3b changed member only (backward)', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('1.T2'), t.indexOf('1.T2') + 4], dir: 'backward', want: '1.T3' },
  { id: 'S4 multi-row from 2.end into sung line', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('2.end'), t.indexOf('my love') + 2], dir: 'backward', want: '2.end — cut v2]\n[VERSE]\nOh--oh, oh my' },
  { id: 'S5 caret inside 2.end', text: `${LEG}\n${SONG}`, sel: (t) => [t.indexOf('2.end') + 2, t.indexOf('2.end') + 2], dir: 'none', wantCaret: (t) => t.indexOf('2.end') + 2 },
  { id: 'S6 no migration (row already marked)', text: `[SETUP — rhyme groups — 1.T3,2.end — cut v2]\n${SONG}`, sel: (t) => [t.indexOf('sing it'), t.indexOf('sing it') + 7], dir: 'backward', want: 'sing it' },
];
const results = [];
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${HTML}#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const boot = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const q = { replies: [], calls: [] };
    await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
      if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
        q.calls.push(1);
        const next = q.replies.shift() || { reply: 'no fixture', history: [], sig: 'x' };
        await new Promise((res) => setTimeout(res, 150));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
      }
      return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, { timeout: 60000 });
    return { ctx, page, q, errors };
  };
  const setDraft = (page, t) => page.evaluate((t) => { $ui('lyrics-draft').value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, t);
  const state = (page) => page.evaluate(() => { const d = $ui('lyrics-draft'); const a = document.activeElement;
    return { start: d.selectionStart, end: d.selectionEnd, dir: d.selectionDirection, selected: d.value.slice(d.selectionStart, d.selectionEnd),
      text: d.value, active: a === d ? 'draft' : (a && (a.getAttribute('data-ui') || a.id || a.tagName)), scroll: $ui('ly-main-scroll') && $ui('ly-main-scroll').scrollTop, hist: app.history.length, hi: app.historyIndex }; });
  const review = async (page, q) => {
    q.replies.push({ reply: 'Fixture review only', history: [], sig: 'fixture' });
    await page.locator('[data-ui="ly-run-review"]:visible').first().click();
    await page.waitForFunction(() => !chatState.busy && chatState.sig === 'fixture', null, { timeout: 20000 });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  for (const mode of ['mouse', 'tab-mouse']) for (const sc of S) {
    const { ctx, page, q, errors } = await boot();
    await setDraft(page, sc.text);
    const [a, b] = sc.sel(sc.text);
    await page.evaluate(([a, b, dir]) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(a, b, dir); }, [a, b, sc.dir]);
    if (mode === 'tab-mouse') await page.keyboard.press('Tab');
    const mid = await state(page);
    await review(page, q);
    const got = await state(page);
    const ok = sc.wantCaret ? got.start === got.end && got.start === sc.wantCaret(got.text) : got.selected === sc.want;
    const dirOk = sc.wantCaret ? true : got.dir === sc.dir;
    results.push({ variant: VARIANT, mode, id: sc.id, before: [a, b, sc.dir], afterTab: { active: mid.active, start: mid.start, end: mid.end }, after: { start: got.start, end: got.end, dir: got.dir, selected: got.selected, active: got.active }, calls: q.calls.length, textOk: ok, dirOk, errors });
    await ctx.close();
  }
  // S7: focus elsewhere (chat input / any other text field) with draft selection retained, then mouse Run review.
  // S8: long draft, draft never focused, main pane scrolled; does mouse Run review move focus / scroll?
  for (const id of ['S7 focus in other input then mouse', 'S8 long draft scrolled, draft unfocused']) {
    const { ctx, page, q, errors } = await boot();
    const text = id.startsWith('S8') ? `${LEG}\n${SONG}\n${LONG}` : `${LEG}\n${SONG}`;
    await setDraft(page, text);
    let other = null;
    if (id.startsWith('S7')) {
      await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); const at = d.value.indexOf('sing it'); d.setSelectionRange(at, at + 7, 'backward'); });
      other = await page.evaluate(() => { const el = [...document.querySelectorAll('input[type="text"],input:not([type]),textarea')].find((x) => x.id !== 'lyrics-draft' && x.offsetParent); if (!el) return null; el.focus(); return el.id || el.getAttribute('data-ui') || el.name || el.tagName; });
    } else {
      await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(5, 5); d.blur(); const s = $ui('ly-main-scroll'); s.scrollTop = s.scrollHeight; });
    }
    const mid = await state(page);
    await review(page, q);
    const got = await state(page);
    results.push({ variant: VARIANT, mode: 'mouse', id, other, mid: { active: mid.active, scroll: mid.scroll, start: mid.start, end: mid.end }, after: { active: got.active, scroll: got.scroll, start: got.start, end: got.end, dir: got.dir, selected: got.selected }, calls: q.calls.length, errors });
    await ctx.close();
  }
  await browser.close();
  server.close();
  for (const r of results) console.log(JSON.stringify(r));
  const bad = results.filter((r) => r.textOk === false || r.dirOk === false);
  console.log(`${VARIANT}: ${bad.length} selection/direction failures of ${results.filter((r) => 'textOk' in r).length}`);
})().catch((e) => { console.error(e); process.exit(1); });
