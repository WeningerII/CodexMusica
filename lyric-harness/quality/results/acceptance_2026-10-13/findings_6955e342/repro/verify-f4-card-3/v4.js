// verify-f4-card-3 (BB8 team adversarial re-check of f4-card b4).
// Independent repro: one reading on a line sung K times, imported once (.txt
// and Library working copy), then: what the Review "renumbered" card says,
// what the page context stores, what the page's own Pronunciation tool
// (Declared readings) says for the same reading, and after a reload.
// Plus eviction order (reading first vs last in setup order) and controls.
// Usage: node v4.js <tree> <mode>   tree: cand|prev61b|prev678|main|base
//   mode: lines | evict
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-3');
const TREES = { cand: 'wt-695', prev61b: 'wt-61b', prev678: 'wt-678', main: 'wt-main', base: 'wt-base' };
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREE = process.argv[2] || 'cand';
const MODE = process.argv[3] || 'lines';
const ROOT = path.join(S, TREES[TREE]);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Chat service stubbed locally: no provider, no network.
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  await ctx.addInitScript(() => {
    window.__toastLog = [];
    const mo = new MutationObserver(() => {
      const t = document.getElementById('toast');
      if (!t) return;
      const txt = t.innerText;
      if (txt && window.__toastLog[window.__toastLog.length - 1] !== txt) window.__toastLog.push(txt);
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  return ctx;
}
const ready = (page) =>
  page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
const draftOf = (page) => page.evaluate(() => $ui('lyrics-draft').value);

const CHORUS = 'Oh--oh, oh my chorus line';
const OTHER = (k) => `Something else entirely here ${String.fromCharCode(97 + k)}`;
const READ = `[SETUP — reading — token 2 "oh" in ${JSON.stringify(CHORUS)} — OW1 — declared — source: me]`;
// K occurrences of the chorus; interleaved => a distinct line between them.
function chorusSong(K, interleaved) {
  const sung = [];
  const at = [];
  for (let k = 0; k < K; k++) {
    if (interleaved) sung.push(OTHER(k));
    sung.push(CHORUS);
    at.push(sung.length);
  }
  const text = [`[SETUP — title — "Chorus ${K}${interleaved ? ' i' : ''}"]`, READ, '', '[VERSE]', ...sung].join('\n');
  return { text, at, title: `Chorus ${K}${interleaved ? ' i' : ''}` };
}
// Eviction: F filler readings (each renumbered 7 -> 8) plus the chorus reading
// placed first or last in setup order.
function evictSong(F, chorusPos) {
  const sung = [];
  const rows = [];
  const az = (k) => {
    let s = '';
    do {
      s = String.fromCharCode(97 + (k % 26)) + s;
      k = Math.floor(k / 26);
    } while (k > 0);
    return s;
  };
  for (let k = 0; k < 6; k++) sung.push(CHORUS);
  for (let k = 0; k < F; k++) {
    const w = 'w' + az(k);
    const line = `Ah--ah, ah my heart and soul ${w}`;
    sung.push(line);
    rows.push(`[SETUP — reading — token 7 ${JSON.stringify(w)} in ${JSON.stringify(line)} — W AH1 — declared — source: me]`);
  }
  const setup = chorusPos === 'first' ? [READ, ...rows] : [...rows, READ];
  const title = `Evict ${F} ${chorusPos}`;
  return { text: [`[SETUP — title — "${title}"]`, ...setup, '', '[VERSE]', ...sung].join('\n'), title };
}

async function importTxt(page, name, text, marker) {
  const before = await draftOf(page);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(([m, b]) => $ui('lyrics-draft').value !== b && $ui('lyrics-draft').value.includes(m), [marker, before], { timeout: 20000 });
  await page.waitForTimeout(500);
}
async function importLib(page, text, title, file) {
  const env = await page.evaluate(
    async ([t, title]) =>
      CMLibraryImport.makeWorkingCopyEnvelope(t, {
        version: 1, brief: '', notes: {}, drafts: {}, ui: {},
        libraryOrigin: {
          version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false,
          title, language: 'eng', scope: 'whole',
          provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' },
          lineage: [], declarations: [],
        },
      }),
    [text, title]
  );
  fs.writeFileSync(file, JSON.stringify(env, null, 1));
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1200);
}
// Everything the page says about the chorus reading.
const observe = (page) =>
  page.evaluate((CH) => {
    if (typeof lyRefresh === 'function') lyRefresh(true);
    const item = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    const r = app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered;
    let paneCard = null;
    try {
      LY_ACTIONS['ly-tab']('review');
      const pane = $ui('ly-panel-review').innerText;
      const i = pane.indexOf('Each was saved without the current cut mark');
      paneCard = i < 0 ? null : pane.slice(i, i + 600);
    } catch (e) {
      paneCard = 'ERR ' + e.message;
    }
    // The page's own Pronunciation tool, Declared readings list.
    let declared = null;
    if (typeof lyToolPronunciation === 'function') {
      const d = new DOMParser().parseFromString(lyToolPronunciation(LY.model), 'text/html');
      declared = Array.from(d.querySelectorAll('.ly-readings li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim());
    }
    const sungAt = LY.model.sung.filter((x) => x.text === CH).map((x) => x.n);
    const chorusItem = r && Array.isArray(r.items) ? r.items.find((m) => m.word === 'oh' && m.kind === 'reading') || null : null;
    const m = item && /the reading for “oh”, (lines? [^:]+): word (\d+) → (\d+)/.exec(item.text);
    return {
      hasCard: !!item,
      title: item && item.title,
      cardReadingPhrase: m ? m[0] : null,
      cardReadingLines: m ? m[1] : null,
      moreText: item ? (/and (\S+) earlier ones? no longer listed/.exec(item.text) || [null, null])[1] : null,
      metaChorusItem: chorusItem,
      metaItems: r && Array.isArray(r.items) ? r.items.length : null,
      metaMore: r ? r.more : null,
      sungAt,
      declaredReadings: declared,
      paneCardHead: paneCard && paneCard.slice(0, 300),
      uiLen: JSON.stringify((app.lyricMeta && app.lyricMeta.ui) || {}).length,
      readingRow: $ui('lyrics-draft').value.split('\n').find((l) => l.includes('reading') && l.includes('"oh"')) || null,
    };
  }, CHORUS);
const toasts = (page) => page.evaluate(() => window.__toastLog.splice(0));

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, root: ROOT, mode: MODE, runs: [], errors: [] };
  try {
    const cases = [];
    if (MODE === 'lines') {
      for (const K of [1, 4, 5, 6, 9]) cases.push({ path: 'txt', ...chorusSong(K, false), K, interleaved: false, reload: K === 6 });
      cases.push({ path: 'txt', ...chorusSong(6, true), K: 6, interleaved: true, reload: true });
      cases.push({ path: 'lib', ...chorusSong(6, false), K: 6, interleaved: false, reload: true });
      cases.push({ path: 'lib', ...chorusSong(6, true), K: 6, interleaved: true, reload: false });
    } else {
      for (const F of [40, 49, 55, 60, 200]) for (const pos of ['first', 'last']) cases.push({ path: 'txt', ...evictSong(F, pos), F, pos, reload: false });
    }
    for (const c of cases) {
      const ctx = await newCtx(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => out.errors.push(e.message));
      await page.goto(url);
      await ready(page);
      if (c.path === 'lib') {
        const hasLib = await page.evaluate(() => typeof CMLibraryImport !== 'undefined' && typeof CMLibraryImport.makeWorkingCopyEnvelope === 'function');
        if (!hasLib) {
          out.runs.push({ ...c, text: undefined, skipped: 'no CMLibraryImport.makeWorkingCopyEnvelope' });
          await ctx.close();
          continue;
        }
        await importLib(page, c.text, c.title, path.join(OUT, `env_${TREE}_${c.K}${c.interleaved ? 'i' : ''}.json`));
      } else await importTxt(page, `${c.title.replace(/\s+/g, '-')}.txt`, c.text, c.title);
      const after = await draftOf(page);
      const o = await observe(page);
      const t = await toasts(page);
      const run = { path: c.path, K: c.K, interleaved: c.interleaved, F: c.F, pos: c.pos, expectedLines: c.at, ...o, toasts: t, draftChangedRows: after.split('\n').filter((l, i) => l !== c.text.split('\n')[i]).length };
      if (c.reload) {
        await page.waitForTimeout(900);
        await page.reload();
        await ready(page);
        await page.waitForTimeout(900);
        const o2 = await observe(page);
        run.afterReload = { hasCard: o2.hasCard, cardReadingLines: o2.cardReadingLines, metaChorusItem: o2.metaChorusItem, declaredReadings: o2.declaredReadings };
      }
      if (TREE === 'cand' && c.path === 'txt' && c.K === 6 && c.interleaved) {
        await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
        await page.screenshot({ path: path.join(OUT, `card_${TREE}_K6i.png`) });
      }
      out.runs.push(run);
      console.log(JSON.stringify({ ...run, paneCardHead: undefined }, null, 0));
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    fs.writeFileSync(path.join(OUT, `v4_${TREE}_${MODE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
