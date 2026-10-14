// verify-f4-card-11 helpers (independent of h695/f4-card/lib.js; same
// approach: serve a tree root over local http, Chromium at
// /opt/pw-browsers/chromium, mcp.codexmusica.com routed to a stub).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-11');
const TREES = {
  cand: path.join(S, 'wt-695'),
  p61b: path.join(S, 'wt-61b'),
  p678: path.join(S, 'wt-678'),
  main: path.join(S, 'wt-main'),
  base: path.join(S, 'wt-base'),
};
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
};
// One origin; `state.root` picks the tree served (switchable mid-run, so one
// origin's localStorage/IndexedDB can be carried from one tree to another).
function serve(state) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const root = state.root;
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(f).pipe(res);
  });
}
async function start(tree) {
  const state = { root: TREES[tree] };
  const server = serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return { state, server, url, browser };
}
async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route(/mcp\.codexmusica\.com/, (r) =>
    r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
  );
  return ctx;
}
async function waitReady(page) {
  await page.waitForFunction(
    () => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model,
    null,
    { timeout: 90000 }
  );
}
async function open(ctx, url, errors) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await waitReady(page);
  return page;
}
// An envelope made by the served page's own makeWorkingCopyEnvelope from a
// meta whose libraryOrigin is NOT adapted and carries `declarations`.
function makeEnvelope(page, text, title, declarations) {
  return page.evaluate(
    async ([t, title, decl]) => {
      const meta = {
        version: 1,
        brief: '',
        notes: {},
        drafts: {},
        ui: {},
        libraryOrigin: {
          version: 1,
          handoffId: 'handoff:' + crypto.randomUUID(),
          digest: '0'.repeat(64),
          importedAt: Date.now(),
          adapted: false,
          title,
          language: 'eng',
          scope: 'whole',
          provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' },
          lineage: [],
          declarations: decl,
        },
      };
      return CMLibraryImport.makeWorkingCopyEnvelope(t, meta);
    },
    [text, title, declarations]
  );
}
// Import through the Lyrics page's own file input (as a person picks a file).
async function importFile(page, file, draftId) {
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, draftId, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
}
// What the page shows and holds about the Library source.
const state = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    const o = app.lyricMeta && app.lyricMeta.libraryOrigin;
    const card = document.querySelector('[aria-label="Library source"]');
    const stored = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}');
    const so = stored.lyricMeta && stored.lyricMeta.libraryOrigin;
    return {
      draftId: app.lyricMeta.draftId || null,
      adapted: o ? o.adapted : null,
      declarations: o ? o.declarations : null,
      label: card ? card.querySelector('p').innerText.trim() : null,
      draft: $ui('lyrics-draft').value,
      original: typeof lyLibraryRecord !== 'undefined' && lyLibraryRecord ? lyLibraryRecord.originalText : null,
      storedAdapted: so ? so.adapted : null,
      renumberedCard: !!(LY.items || []).find((x) => x.id === 'renumbered'),
    };
  });
// The page's own download action (the handler the "Download text and
// sources" menu item runs), captured as a browser download.
async function download(page, file) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.evaluate(() => LY_ACTIONS['ly-download']()),
  ]);
  await dl.saveAs(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
const results = [];
function record(id, claim, observed, ok) {
  const status = ok === null ? 'info' : ok ? 'pass' : 'fail';
  results.push({ id, claim, observed, status });
  console.log(`[${status.toUpperCase()}] ${id}: ${claim}\n    observed: ${JSON.stringify(observed)}`);
}
module.exports = { fs, path, S, OUT, TREES, start, newCtx, open, waitReady, makeEnvelope, importFile, state, download, results, record };
