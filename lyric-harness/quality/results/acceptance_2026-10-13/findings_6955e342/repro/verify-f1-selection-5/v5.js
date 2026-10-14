// verify-f1-selection-5: independent re-check of f1-selection claim c5.
// Serves one pinned tree's committed codex.html (byte-equal to a
// CODEX_LIBRARY=1 build, COMMANDS.txt), stubs every mcp.codexmusica.com
// request locally (records /chat bodies, no provider reached), drives
// Chromium. Independent of the tester's refmap.js/f1lib.js: the expected
// position is computed here from the exact expected rewritten row.
// Usage: node v5.js <treeDir> <label> [putMode=raw|typed] [triggers=prog,kbd,click,dock]
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const O = path.join(S, 'h695/verify-f1-selection-5');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const ROOT = process.argv[2];
const LABEL = process.argv[3];
const PUT = process.argv[4] || 'raw';
const TRIGS = (process.argv[5] || 'prog,kbd,click,dock').split(',');
const ONLY = process.env.CASES ? process.env.CASES.split(',') : null;

const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
Love above`;
const CARRIED_IN = '[SETUP — returns — 1.end, 2.end]';
const CARRIED_OUT = '[SETUP — returns — 1.end (carried across the word-cut change), 2.end — cut v2]';
const CARRIED_RHY_IN = '[SETUP — rhyme groups — 1.end, 2.end]';
const CARRIED_RHY_OUT = '[SETUP — rhyme groups — 1.end (carried across the word-cut change), 2.end — cut v2]';
const T_IN = '[SETUP — returns — 1.T2, 2.end]';
const T_OUT = '[SETUP — returns — 1.T3, 2.end — cut v2]';
const UNCH = '[SETUP — rhyme groups — 5.end, 6]';
// Each case: rows (in, expected out if the candidate migrates), placement,
// and selections. A selection: [rowIndex, anchor, offsetInAnchor, len, dir].
// The expected position in the migrated text is: start of that row in the
// migrated text + index of the SAME anchor in the migrated row + offset
// (anchors are chosen to be unique in both rows).
const CASES = {
  CARRIED: {
    rows: [[CARRIED_IN, CARRIED_OUT]],
    sels: {
      caret_in_2end: [0, ', 2.end', 4, 0], // 2.|end
      sel_2end: [0, ', 2.end', 2, 5],
      sel_2end_back: [0, ', 2.end', 2, 5, 'backward'],
      caret_in_1end: [0, '1.end', 2, 0], // 1.|end (shared prefix)
      caret_before_2: [0, ', 2.end', 2, 0], // |2.end
      caret_after_row: [0, ']', 1, 0],
    },
  },
  CARRIED_BOTTOM: {
    where: 'bottom',
    rows: [[CARRIED_IN, CARRIED_OUT]],
    sels: { caret_in_2end: [0, ', 2.end', 4, 0], sel_2end: [0, ', 2.end', 2, 5] },
  },
  CARRIED_RHY: {
    rows: [[CARRIED_RHY_IN, CARRIED_RHY_OUT]],
    sels: { caret_in_2end: [0, ', 2.end', 4, 0], sel_2end: [0, ', 2.end', 2, 5] },
  },
  // carried first row, unchanged second row
  CARRIED_TWO: {
    rows: [
      [CARRIED_IN, CARRIED_OUT],
      [UNCH, UNCH],
    ],
    sels: {
      other_caret_5end: [1, '5.end', 1, 0],
      other_sel_6: [1, ' 6]', 1, 1],
      first_caret_in_2end: [0, ', 2.end', 4, 0],
    },
  },
  // the tester's TWO_ROWS
  TWO_ROWS: {
    rows: [
      [T_IN, T_OUT],
      [UNCH, UNCH],
    ],
    sels: { other_caret_5end: [1, '5.end', 1, 0], other_sel_6: [1, ' 6]', 1, 1] },
  },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.webp': 'image/webp' };
function startServer(root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}
function docOf(c, which) {
  const rows = c.rows.map((r) => r[which]).join('\n');
  return c.where === 'bottom' ? `${BODY}\n\n${rows}` : `${rows}\n\n${BODY}`;
}
function rowStart(doc, rowText) {
  const k = doc.indexOf(rowText);
  if (k < 0) throw Error('row not found ' + rowText);
  return k;
}
function posOf(doc, c, which, spec) {
  const [ri, anchor, off] = spec;
  const row = c.rows[ri][which];
  const rs = rowStart(doc, row);
  const k = anchor === ']' ? row.length - 1 : row.indexOf(anchor);
  if (k < 0 || (anchor !== ']' && row.indexOf(anchor, k + 1) >= 0)) throw Error(`anchor ${anchor} not unique in ${row}`);
  return rs + k + off;
}
function show(text, s, e) {
  const rs = text.lastIndexOf('\n', s - 1) + 1;
  let re = text.indexOf('\n', e);
  if (re < 0) re = text.length;
  return s === e ? text.slice(rs, s) + '|' + text.slice(s, re) : text.slice(rs, s) + '«' + text.slice(s, e) + '»' + text.slice(e, re);
}

(async () => {
  const { server, base } = await startServer(ROOT);
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { label: LABEL, root: ROOT, put: PUT, cases: [] };
  try {
    for (const trig of TRIGS)
      for (const [ck, c] of Object.entries(CASES)) {
        if (ONLY && !ONLY.includes(ck)) continue;
        for (const [sk, spec] of Object.entries(c.sels)) {
          const calls = [];
          const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
            if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
              calls.push(JSON.parse(r.request().postData() || '{}'));
              await new Promise((res) => setTimeout(res, 60));
              return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
            }
            return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
          });
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto(`${base}/codex.html#lyrics`);
          await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
          await page.waitForTimeout(300);
          const id = `${LABEL}.${PUT}.${trig}.${ck}.${sk}`;
          const r = { id, trig, case: ck, sel: sk };
          try {
            const docIn = docOf(c, 0);
            await page.evaluate(
              ([t, put]) => {
                const d = $ui('lyrics-draft');
                d.value = t;
                uiSaveLyrics();
                pushHistory();
                if (put === 'typed') lyRefresh(true);
              },
              [docIn, PUT]
            );
            await page.waitForTimeout(250);
            const s0 = posOf(docIn, c, 0, spec);
            const e0 = s0 + spec[3];
            const dir = spec[4] || 'forward';
            await page.evaluate(
              ([s, e, dir]) => {
                const d = $ui('lyrics-draft');
                d.focus();
                d.setSelectionRange(s, e, dir);
              },
              [s0, e0, dir]
            );
            await page.waitForTimeout(150);
            const pre = await page.evaluate(() => {
              const d = $ui('lyrics-draft');
              return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection] };
            });
            r.preTextEqualsInput = pre.text === docIn;
            r.before = { sel: pre.sel, shown: show(pre.text, pre.sel[0], pre.sel[1]) };
            const n = calls.length;
            if (trig === 'prog') await page.evaluate(() => LY_ACTIONS['ly-run-review']());
            else if (trig === 'kbd') {
              // keyboard: move focus to the visible Run review button, press Enter
              const ok = await page.evaluate(() => {
                const b = [...document.querySelectorAll('[data-ui="ly-run-review"]')].find((x) => x.offsetParent !== null);
                if (!b) return false;
                b.focus();
                return document.activeElement === b;
              });
              r.kbdFocusedButton = ok;
              await page.keyboard.press('Enter');
            } else if (trig === 'click') await page.locator('[data-ui="ly-run-review"]:visible').first().click();
            else if (trig === 'dock') {
              await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
              await page.waitForTimeout(200);
              r.dockFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
              await page.keyboard.type('Tighten line 2', { delay: 5 });
              await page.locator('#chat-send').click();
            }
            await page.waitForTimeout(300);
            await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(200);
            const post = await page.evaluate(() => {
              const d = $ui('lyrics-draft');
              return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], focused: document.activeElement === d };
            });
            r.sent = calls.slice(n).map((x) => (x.lyric_context ? x.lyric_context.declarations : null));
            r.migrated = post.text !== pre.text;
            r.after = { sel: post.sel, focused: post.focused, shown: show(post.text, post.sel[0], post.sel[1]) };
            r.afterRows = post.text.split('\n').filter((l) => l.startsWith('[SETUP'));
            if (r.migrated) {
              const docOut = docOf(c, 1);
              r.rewriteAsExpected = post.text === docOut;
              if (r.rewriteAsExpected) {
                const s1 = posOf(docOut, c, 1, spec);
                r.expected = [s1, s1 + spec[3], dir];
              }
            } else r.expected = [s0, e0, dir];
            r.selOK = !!r.expected && post.sel[0] === r.expected[0] && post.sel[1] === r.expected[1] && post.sel[2] === r.expected[2];
            if (r.expected) r.expectedShown = show(post.text, r.expected[0], r.expected[1]);
            r.unchangedRowBytesKept = c.rows.filter((x) => x[0] === x[1]).every((x) => post.text.includes(x[0]));
            // the writer returns to the editor and types
            await page.evaluate(() => $ui('lyrics-draft').focus());
            await page.keyboard.type('ZQ', { delay: 20 });
            await page.waitForTimeout(300);
            const typed = await page.evaluate(() => $ui('lyrics-draft').value);
            const z = typed.indexOf('ZQ');
            r.typedRow = typed.slice(typed.lastIndexOf('\n', z) + 1, typed.indexOf('\n', z) < 0 ? typed.length : typed.indexOf('\n', z));
            r.typedParsed = await page.evaluate((t) => {
              const m = lyParse(t);
              return { setup: m.setup.map((x) => x.raw), sungCount: m.sung.length };
            }, typed);
            r.errors = errors;
          } catch (x) {
            r.threw = String(x.stack || x);
          }
          out.cases.push(r);
          console.log(
            `${id}: migrated=${r.migrated} rewriteAsExpected=${r.rewriteAsExpected} selOK=${r.selOK} unchangedRowKept=${r.unchangedRowBytesKept}\n` +
              `   before ${JSON.stringify(r.before)}\n   after  ${JSON.stringify(r.after)}\n   expect ${JSON.stringify(r.expected)} ${JSON.stringify(r.expectedShown)}\n` +
              `   rows ${JSON.stringify(r.afterRows)}\n   sent ${JSON.stringify(r.sent)}\n   ZQ -> ${JSON.stringify(r.typedRow)}${r.threw ? '\n   THREW ' + r.threw : ''}${r.errors && r.errors.length ? '\n   ERR ' + r.errors.join(' | ') : ''}`
          );
          await ctx.close();
        }
      }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(O, `v5_${LABEL}_${PUT}_${TRIGS.join('-')}${ONLY ? '_' + ONLY.join('-') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
