// verify-f1-selection-3: independent helpers (written from scratch).
// Serves <folder>/built-<tree>.html as /codex.html and every other path from
// the pinned tree; stubs mcp.codexmusica.com (no provider reached).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const V = path.join(S, 'h695/verify-f1-selection-3');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = { cand: 'wt-695', c61b: 'wt-61b', main: 'wt-main' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };

async function serveTree(key) {
  const tree = TREES[key];
  const root = path.join(S, tree);
  const page = path.join(V, `built-${tree}.html`);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') p = null;
    const f = p === null ? page : path.join(root, p);
    if (p !== null && (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory())) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const launch = () => chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function open(browser, base, { width = 1440, height = 900 } = {}) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    const req = r.request();
    if (/\/chat$/.test(req.url()) && req.method() === 'POST') {
      calls.push(JSON.parse(req.postData() || '{}'));
      await new Promise((res) => setTimeout(res, 60));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(300);
  return { ctx, page, calls, errors };
}

// Independent "same characters" reference: a character LCS between the old
// and new text; a gap (caret offset) in `a` maps to the RANGE of gaps in `b`
// lying between the images of its nearest matched neighbours.
function lcsAlign(a, b) {
  const n = a.length, m = b.length;
  const W = m + 1;
  const L = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = a[i] === b[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  const map = new Array(n).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j] && L[i * W + j] === L[(i + 1) * W + j + 1] + 1) { map[i] = j; i++; j++; }
    else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++;
    else j++;
  }
  return map;
}
// Rows are replaced in place (same row count), so align row by row.
function refRange(before, after, pos) {
  const A = before.split('\n'), B = after.split('\n');
  if (A.length !== B.length) return null;
  let oa = 0, ob = 0;
  for (let r = 0; r < A.length; r++) {
    const x = A[r], y = B[r];
    if (pos <= oa + x.length) {
      const c = pos - oa;
      if (x === y) return { lo: ob + c, hi: ob + c };
      const mp = lcsAlign(x, y);
      let lo = 0, hi = y.length;
      for (let k = c - 1; k >= 0; k--) if (mp[k] >= 0) { lo = mp[k] + 1; break; }
      for (let k = c; k < x.length; k++) if (mp[k] >= 0) { hi = mp[k]; break; }
      return { lo: ob + lo, hi: ob + hi };
    }
    oa += x.length + 1;
    ob += y.length + 1;
  }
  return { lo: after.length, hi: after.length };
}
const show = (t, s, e) => {
  const a = t.lastIndexOf('\n', s - 1) + 1;
  let z = t.indexOf('\n', e);
  if (z < 0) z = t.length;
  return s === e ? t.slice(a, s) + '|' + t.slice(s, z) : t.slice(a, s) + '«' + t.slice(s, e) + '»' + t.slice(e, z);
};
const state = (page) =>
  page.evaluate(() => {
    const d = $ui('lyrics-draft');
    return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], active: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute('data-ui') || document.activeElement.tagName) };
  });
// How the page reads a text: the [SETUP] rows and the declarations it would send.
const parse = (page, text) =>
  page.evaluate((t) => {
    const m = lyParse(t);
    const decl = typeof lyDeclarationsOf === 'function' ? lyDeclarationsOf(m) : null;
    return { setup: m.setup.map((s) => ({ key: s.key, raw: s.raw, value: s.value, malformed: !!s.malformed })), decl: JSON.parse(JSON.stringify(decl)) };
  }, text);
module.exports = { fs, path, S, V, TREES, serveTree, launch, open, refRange, show, state, parse };

// Reference 2 (edit-structure): the migration (a) respells changed members /
// the reading's number in place and (b) appends ' — cut v2' before the row's
// closing ']'. Strip (b), map through (a) by common prefix/suffix (exact when
// one region changed, as in every fixture here), then through (b): an offset
// exactly at the insertion point may sit on either side of the mark.
function refRange2(before, after, pos, mark = ' — cut v2') {
  const A = before.split('\n'), B = after.split('\n');
  if (A.length !== B.length) return null;
  let oa = 0, ob = 0;
  for (let r = 0; r < A.length; r++) {
    const x = A[r], y = B[r];
    if (pos <= oa + x.length) {
      const c = pos - oa;
      if (x === y) return { lo: ob + c, hi: ob + c };
      let y0 = y, markAt = -1;
      if (y.endsWith(mark + ']') && !x.endsWith(mark + ']')) { y0 = y.slice(0, -(mark.length + 1)) + ']'; markAt = y0.length - 1; }
      let p = 0;
      while (p < x.length && p < y0.length && x[p] === y0[p]) p++;
      let s = 0;
      while (s < x.length - p && s < y0.length - p && x[x.length - 1 - s] === y0[y0.length - 1 - s]) s++;
      let lo, hi;
      if (c <= p) lo = hi = c;
      else if (c >= x.length - s) lo = hi = c + (y0.length - x.length);
      else { lo = p; hi = y0.length - s; }
      const lift = (q, side) => (markAt < 0 || q < markAt ? q : q > markAt ? q + mark.length : side === 'lo' ? q : q + mark.length);
      return { lo: ob + lift(lo, 'lo'), hi: ob + lift(hi, 'hi') };
    }
    oa += x.length + 1;
    ob += y.length + 1;
  }
  return { lo: after.length, hi: after.length };
}
module.exports.refRange2 = refRange2;
