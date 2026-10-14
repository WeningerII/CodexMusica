// verify-page-rules-6, part 2.
//  A. Causal check: the same typed row, with lyEnsureTokenScheme wrapped (in
//     the page, at runtime) to record selection before/after each call. Then
//     the same with the wrapper restoring the selection: does the jump vanish?
//  B. Broader trigger: an existing unmarked bare-N row on lines whose cut does
//     not change; the person then edits a SUNG line so its cut changes, typing
//     at a human pace (160 ms per key, above the 120 ms refresh debounce).
// Usage: node caret2.js <tree-root> <label>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const ROOT = process.argv[2];
const LABEL = process.argv[3];
const OUT = __dirname;
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));

const DOC = `[VERSE]
Oh--oh, oh my love
I hold the dove

[CHORUS]
Run to the sea
And stay with me`;
const AT = DOC.indexOf('dove\n') + 'dove\n'.length;
const ROW = '[SETUP — rhyme groups — 1.T4,2]';
const DOC_B = `${DOC}\n\n[SETUP — rhyme groups — 2,4]`;

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': path.extname(f) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function open(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof LY !== 'undefined' && !!LY.model && typeof UI !== 'undefined' && UI.ready, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}
const seed = (page, t) =>
  page.evaluate((t) => {
    $ui('lyrics-draft').value = t;
    uiSaveLyrics();
    pushHistory();
    lyRefresh(true);
  }, t);

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = {};
  for (const mode of ['observe', 'restore']) {
    const { ctx, page, errs } = await open(browser, base);
    const wrapped = await page.evaluate((mode) => {
      if (typeof window.lyEnsureTokenScheme !== 'function') return false;
      const orig = window.lyEnsureTokenScheme;
      window.__calls = [];
      window.lyEnsureTokenScheme = function () {
        const d = $ui('lyrics-draft');
        const s0 = [d.selectionStart, d.selectionEnd, d.value.length];
        const r = orig.apply(this, arguments);
        const s1 = [d.selectionStart, d.selectionEnd, d.value.length];
        if (mode === 'restore' && r) d.setSelectionRange(s0[0], s0[1]);
        window.__calls.push({ changed: r, before: s0, after: s1, final: [d.selectionStart, d.selectionEnd] });
        return r;
      };
      return true;
    }, mode);
    await seed(page, DOC);
    await page.waitForTimeout(300);
    await page.click('#lyrics-draft');
    await page.evaluate((at) => {
      const d = $ui('lyrics-draft');
      d.focus();
      d.setSelectionRange(at, at);
      window.__calls = [];
    }, AT);
    await page.keyboard.type(ROW + '\n', { delay: 25 });
    await page.waitForTimeout(1000);
    await page.keyboard.type('ZQ', { delay: 25 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const t = $ui('lyrics-draft').value;
      const z = t.indexOf('ZQ');
      return { lineOfZ: t.slice(0, z).split('\n').length, text: t, calls: (window.__calls || []).filter((c) => c.changed) };
    });
    out[`A_${mode}`] = { wrapped, ...r, errs };
    console.log(`[${LABEL}] A.${mode}: wrapped=${wrapped} ZQ on line ${r.lineOfZ} (intended 5); rewriting calls=${JSON.stringify(r.calls)} errs=${JSON.stringify(errs)}`);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open(browser, base);
    await seed(page, DOC_B);
    await page.waitForTimeout(300);
    const seeded = await page.evaluate(() => $ui('lyrics-draft').value);
    // Caret after "I hold the dove" (end of sung line 2); type "--oh my" at a
    // human pace. "dove--oh" is cut differently by v1 and v2 (checked below).
    const at = DOC_B.indexOf('dove') + 4;
    await page.click('#lyrics-draft');
    await page.evaluate((at) => {
      const d = $ui('lyrics-draft');
      d.focus();
      d.setSelectionRange(at, at);
    }, at);
    const steps = [];
    for (const ch of '--oh my') {
      await page.keyboard.type(ch);
      await page.waitForTimeout(160);
      steps.push(await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        return { caret: d.selectionStart, len: d.value.length, line2: d.value.split('\n')[2], row: d.value.split('\n').find((r) => /^\[SETUP/.test(r)) };
      }));
    }
    await page.waitForTimeout(600);
    const fin = await page.evaluate(() => {
      const t = $ui('lyrics-draft').value;
      return { text: t, cutChanged: typeof lyLineCutChanged === 'function' ? [lyLineCutChanged('I hold the dove', false), lyLineCutChanged('I hold the dove--oh my', false)] : null };
    });
    out.B = { seededOk: seeded === DOC_B, steps, ...fin, errs };
    console.log(`[${LABEL}] B: seededOk=${seeded === DOC_B} cutChanged(before,after)=${JSON.stringify(fin.cutChanged)}`);
    for (const s of steps) console.log(`   caret ${s.caret}/${s.len}  line2=${JSON.stringify(s.line2)}  row=${JSON.stringify(s.row)}`);
    console.log('   final text:\n' + fin.text.split('\n').map((l) => '     | ' + l).join('\n'));
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, `caret2_${LABEL}.json`), JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
