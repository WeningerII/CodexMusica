// verify-f1-selection-0: is the Lyrics page mount (src/pages/lyrics.js:6148 on
// 643e292e / 6955e342) a working migration boundary? Every lyEnsureTokenScheme
// call is recorded from DOMContentLoaded on (before the app's own handler), and
// optionally (MODE=inject) the served page carries an in-memory probe at the
// mount itself. No tracked file is touched: the tree's committed codex.html
// (cmp-equal to a CODEX_LIBRARY=1 build, COMMANDS.txt) is read and served.
// Usage: node mount_probe.js <cand|c61b|c678|main> <hook|inject> [scenario,...]
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f1-selection-0');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = { cand: 'wt-695', c61b: 'wt-61b', c678: 'wt-678', main: 'wt-main' };
const TREE = process.argv[2] || 'cand';
const MODE = process.argv[3] || 'hook';
const ONLY = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
const ROOT = path.join(S, TREES[TREE]);

const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
I hold the dove
Run to the sea
Love above`;
const ROWS = [
  '[SETUP — rhyme groups — 1.T4,8]',
  '[SETUP — returns — 1.T2, 2.end]',
  '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]',
];
const UNMARKED = `${ROWS.join('\n')}\n\n${BODY}`;
const MIGRATED = [
  '[SETUP — rhyme groups — 1.T5,8 — cut v2]',
  '[SETUP — returns — 1.T3, 2.end — cut v2]',
  '[SETUP — reading — token 3 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me — cut v2]',
].join('\n') + `\n\n${BODY}`;
const TYPED_ROW = ROWS[1] + '\n';
const label = (t) =>
  t === null || t === undefined ? String(t)
  : t === UNMARKED ? 'UNMARKED'
  : t === MIGRATED ? 'MIGRATED'
  : t === BODY ? 'BODY'
  : t === TYPED_ROW + BODY ? 'TYPED_UNMARKED_ROW+BODY'
  : t === '' ? 'EMPTY'
  : 'other:' + JSON.stringify(t.slice(0, 80)) + `(len ${t.length})`;
const SESSION = (lyrics) => JSON.stringify({ version: 3, name: 'F1 mount', cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: {} } });

let html = fs.readFileSync(path.join(ROOT, 'codex.html'), 'utf8');
const inject = { wire: 0, call: 0 };
if (MODE === 'inject') {
  const a = '$ui("ly-page").dataset.size=LY.size;lyWire(surface);';
  inject.wire = html.split(a).length - 1;
  html = html.replace(a, a + '__mountProbe("mount:afterWire");');
  const b = 'lyWire(surface);__mountProbe("mount:afterWire");lyEnsureTokenScheme();LY.model=';
  inject.call = html.split(b).length - 1;
  html = html.replace(b, 'lyWire(surface);__mountProbe("mount:afterWire");__mountProbe("mount:call",lyEnsureTokenScheme());LY.model=');
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '/codex.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    return res.end(html);
  }
  if (p === '/other.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    return res.end('<!doctype html><title>other</title><p>away');
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

// Runs in the page before any page script (every navigation of the context).
function initProbe() {
  const log = (window.__probe = []);
  const t0 = performance.now();
  const dv = () => {
    const els = document.querySelectorAll('#lyrics-draft');
    const d = document.getElementById('lyrics-draft');
    return { value: d ? d.value : null, count: els.length, histLen: typeof app !== 'undefined' && Array.isArray(app.history) ? app.history.length : null, appLyrics: typeof app !== 'undefined' ? app.lyrics ?? null : null, view: typeof UI !== 'undefined' ? UI.view : null };
  };
  window.__mountProbe = (tag, ret) => {
    log.push({ tag, ret, t: Math.round(performance.now() - t0), ...dv() });
  };
  document.addEventListener('DOMContentLoaded', () => {
    log.push({ tag: 'DOMContentLoaded', t: Math.round(performance.now() - t0), hasFn: typeof window.lyEnsureTokenScheme === 'function', ...dv() });
    const orig = window.lyEnsureTokenScheme;
    if (typeof orig !== 'function') return;
    window.lyEnsureTokenScheme = function () {
      const before = dv();
      const ret = orig.apply(this, arguments);
      const after = dv();
      const st = new Error().stack.split('\n').slice(2, 6).map((s) => s.trim().replace(/^at /, '').split(' (')[0]);
      log.push({ tag: 'ensure', how: arguments.length ? arguments[0] : '(none: default)', ret, t: Math.round(performance.now() - t0), before: before.value, after: after.value, histBefore: before.histLen, histAfter: after.histLen, count: before.count, view: before.view, stack: st.join(' < ') });
      return ret;
    };
  });
}

async function boot(browser, base, { session = null, legacy = null, hash = '#lyrics' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  await ctx.addInitScript(initProbe);
  await ctx.addInitScript(() => {
    window.__toastLog = [];
    const mo = new MutationObserver(() => {
      const t = document.getElementById('toast');
      const txt = t && t.innerText;
      if (txt && window.__toastLog[window.__toastLog.length - 1] !== txt) window.__toastLog.push(txt);
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (session !== null || legacy !== null) {
    await page.goto(`${base}/other.html`);
    await page.evaluate(([s, l]) => {
      if (s !== null) localStorage.setItem('codex-workbench-v1', s);
      if (l !== null) localStorage.setItem('musica-lyrics-v3', l);
    }, [session, legacy]);
  }
  await page.goto(`${base}/codex.html${hash}`);
  return { ctx, page, errors };
}
const ready = (page) => page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model && typeof _workspaceReady !== 'undefined' && _workspaceReady, null, { timeout: 90000 }).then(() => page.waitForTimeout(500));
const end = (page) =>
  page.evaluate(() => {
    const d = document.getElementById('lyrics-draft');
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('codex-workbench-v1') || 'null')?.lyrics ?? null; } catch (e) { saved = 'ERR'; }
    return { draft: d && d.value, hist: (app.history || []).map((h) => JSON.parse(h).lyrics), idx: app.historyIndex, appLyrics: app.lyrics, saved, undoDisabled: document.getElementById('btn-undo')?.disabled ?? null, renumbered: app.lyricMeta?.ui?.renumbered || null, toasts: window.__toastLog.slice(), probe: window.__probe };
  });
const sum = (e) => ({
  draft: label(e.draft), steps: e.hist.map(label), idx: e.idx, appLyrics: label(e.appLyrics), saved: label(e.saved), undoDisabled: e.undoDisabled,
  renumberedItems: e.renumbered ? e.renumbered.items.length : 0, toasts: e.toasts,
  probe: e.probe.map((p) => ({ ...p, value: p.value !== undefined ? label(p.value) : undefined, before: p.before !== undefined ? label(p.before) : undefined, after: p.after !== undefined ? label(p.after) : undefined, appLyrics: p.appLyrics !== undefined ? label(p.appLyrics) : undefined })),
});

const SCEN = {
  // A returning user's saved session holding unmarked rows, opened on #lyrics.
  async restoreLyrics(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { session: SESSION(UNMARKED) });
    await ready(page);
    const r = sum(await end(page));
    await ctx.close();
    return { ...r, errors };
  },
  // Same, opened on the genre page; Lyrics visited afterwards.
  async restoreGenreThenLyrics(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { session: SESSION(UNMARKED), hash: '' });
    await ready(page);
    await page.evaluate(() => uiNavigate('lyrics'));
    await page.waitForTimeout(600);
    const r = sum(await end(page));
    await ctx.close();
    return { ...r, errors };
  },
  // The flagged Library build's deferred boot (#library): the workspace is
  // restored later, on the first need for it; then Lyrics is opened.
  async deferredLibraryThenLyrics(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { session: SESSION(UNMARKED), hash: '#library' });
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const atLibrary = await page.evaluate(() => ({ workspaceReady: _workspaceReady, view: UI.view, draft: document.getElementById('lyrics-draft')?.value ?? null, probe: window.__probe.slice() }));
    await page.evaluate(() => { location.hash = '#lyrics'; });
    await ready(page);
    const r = sum(await end(page));
    await ctx.close();
    return { atLibrary: { ...atLibrary, draft: label(atLibrary.draft), probe: atLibrary.probe.map((p) => ({ ...p, value: p.value !== undefined ? label(p.value) : undefined, before: p.before !== undefined ? label(p.before) : undefined, after: p.after !== undefined ? label(p.after) : undefined, appLyrics: p.appLyrics !== undefined ? label(p.appLyrics) : undefined })) }, ...r, errors };
  },
  // No saved session; the older lyrics-only key holds the unmarked text.
  async legacyKey(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { legacy: UNMARKED });
    await ready(page);
    const r = sum(await end(page));
    await ctx.close();
    return { ...r, errors };
  },
  // First run: nothing saved.
  async firstRun(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, {});
    await ready(page);
    const r = sum(await end(page));
    await ctx.close();
    return { ...r, errors };
  },
  // The writer types an unmarked row by hand (no boundary), leaves the page
  // for another document and comes Back: does the browser's form-state
  // restoration put text in the textarea the mount creates?
  async typedThenBack(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { session: SESSION(BODY) });
    await ready(page);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
    await page.keyboard.insertText(TYPED_ROW);
    await page.waitForTimeout(600);
    const typed = await end(page);
    await page.goto(`${base}/other.html`);
    await page.waitForTimeout(300);
    await page.goBack();
    await ready(page);
    const r = sum(await end(page));
    await ctx.close();
    return { typed: { draft: label(typed.draft), saved: label(typed.saved), ensureCallsWhileTyping: typed.probe.filter((p) => p.tag === 'ensure' && p.ret).length }, afterBack: r, errors };
  },
  // Same, then a reload.
  async typedThenReload(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { session: SESSION(BODY) });
    await ready(page);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
    await page.keyboard.insertText(TYPED_ROW);
    await page.waitForTimeout(600);
    const typed = await end(page);
    await page.reload();
    await ready(page);
    const r = sum(await end(page));
    await ctx.close();
    return { typed: { draft: label(typed.draft), saved: label(typed.saved) }, afterReload: r, errors };
  },
  // SYNTHETIC (not a user path): mount the page again over a draft that holds
  // typed unmarked text, to show what the mount's own call can ever see.
  async syntheticRemount(browser, base) {
    const { ctx, page, errors } = await boot(browser, base, { session: SESSION(BODY) });
    await ready(page);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
    await page.keyboard.insertText(TYPED_ROW);
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => ({ draft: $ui('lyrics-draft').value, n: window.__probe.length }));
    await page.evaluate(() => UI_PAGES.lyrics.mount($ui('surface-lyrics')));
    await page.waitForTimeout(400);
    const after = await page.evaluate((n) => ({ draft: $ui('lyrics-draft').value, appLyrics: app.lyrics, probe: window.__probe.slice(n) }), before.n);
    await ctx.close();
    return { beforeRemount: label(before.draft), afterRemount: { draft: label(after.draft), appLyrics: label(after.appLyrics), probe: after.probe.map((p) => ({ ...p, value: p.value !== undefined ? label(p.value) : undefined, before: p.before !== undefined ? label(p.before) : undefined, after: p.after !== undefined ? label(p.after) : undefined, appLyrics: p.appLyrics !== undefined ? label(p.appLyrics) : undefined })) }, errors };
  },
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, root: ROOT, mode: MODE, inject, scen: {} };
  console.log(`[${TREE}/${MODE}] inject points: ${JSON.stringify(inject)}`);
  try {
    for (const [name, fn] of Object.entries(SCEN)) {
      if (ONLY && !ONLY.has(name)) continue;
      let r;
      try { r = await fn(browser, base); } catch (e) { r = { threw: String(e.stack || e) }; }
      out.scen[name] = r;
      console.log(`[${TREE}/${MODE}] ${name}: ${JSON.stringify(r)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, `mount_probe_${TREE}_${MODE}${ONLY ? '_' + [...ONLY].join('-') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
