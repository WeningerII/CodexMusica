// verify-f4-card-2: independent repro of f4-card b3 ("No word on the card is cut").
// Usage: node v.js <treeLabel> <caseName|all> [lib]
// Serves <tree>/codex.html from a local http server, stubs mcp.codexmusica.com
// (no provider, no network), imports a generated .txt through the Lyrics page's
// own #ly-file input (or a Library working copy with "lib"), then reads:
//   - the renumbered Review item (LY.items), the rendered Review pane text,
//   - app.lyricMeta.ui.renumbered (the stored record) and its localStorage copy,
//   - the toast log, and the same after a reload.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-2');
const TREES = {
  cand: path.join(S, 'wt-695'),
  prev61b: path.join(S, 'wt-61b'),
  prev678: path.join(S, 'wt-678'),
  main: path.join(S, 'wt-main'),
  base: path.join(S, 'wt-base'),
};
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));
const TREE = process.argv[2] || 'cand';
const WHICH = process.argv[3] || 'all';
const LIB = process.argv[4] === 'lib';

const PREFIX54 = 'supercalifragilisticexpialidociousantidisestablishment'; // 54 chars
// Words: label -> word
const W = {
  w57a: PREFIX54 + 'baa', // 57, same 40-prefix as w57b
  w57b: PREFIX54 + 'bab',
  w40: 'abcdefghijklmnopqrstuvwxyzabcdefghijklmn', // exactly 40
  w41: 'abcdefghijklmnopqrstuvwxyzabcdefghijklmno', // 41
  de63: 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz', // real German law name
  de42: 'Donaudampfschifffahrtsgesellschaftskapitän', // classic German compound
  hy: 'forget-me-not-and-never-ever-come-back-again-tomorrow', // hyphenated compound
};
const q = (s) => JSON.stringify(s);
// One line per word: "Oh--oh, oh my <word>": v1 reads "Oh--oh" as one token,
// so <word> is v1 token 4 and current-cut token 5.
function caseText(name, labels, withReturns) {
  const lines = labels.map((l) => `Oh--oh, oh my ${W[l]}`);
  const rows = ['[SETUP — title — "' + name + '"]'];
  labels.forEach((l, k) => rows.push(`[SETUP — reading — token 4 ${q(W[l])} in ${q(lines[k])} — S UW1 — declared — source: me]`));
  if (withReturns) rows.push(`[SETUP — returns — ${labels.map((_, k) => `${k + 1}.T4`).join(',')}]`);
  return [...rows, '', '[VERSE]', ...lines].join('\n');
}
const CASES = {
  // the tester's scenario reduced: two 57-char words sharing a 40-char prefix,
  // each with a reading and a returns member.
  same40: { labels: ['w57a', 'w57b'], returns: true },
  // boundary: exactly 40 vs 41.
  boundary: { labels: ['w40', 'w41'], returns: false },
  // realistic long words (German compounds, a hyphenated compound).
  natural: { labels: ['de63', 'de42', 'hy'], returns: false },
  // readings whose line is not (or no longer) sung in the draft: the card entry
  // has no line reference, so the (cut) word is its only identifier.
  unsung: {
    labels: ['w57a', 'w57b'],
    text: ['[SETUP — title — "unsung"]',
      ...['w57a', 'w57b'].map((l) => `[SETUP — reading — token 4 ${q(W[l])} in ${q('Oh--oh, oh my ' + W[l])} — S UW1 — declared — source: me]`),
      '', '[VERSE]', 'A different line is sung here', 'And another one'].join('\n'),
  },
};

function serve(root) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.wasm': 'application/wasm' };
  return http.createServer((req, res) => {
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
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
}
const snapshot = (page) =>
  page.evaluate(() => {
    if (typeof lyRefresh === 'function') lyRefresh(true);
    const item = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    if (typeof LY_ACTIONS !== 'undefined' && LY_ACTIONS['ly-tab']) LY_ACTIONS['ly-tab']('review');
    const paneEl = document.getElementById('ly-panel-review');
    const r = app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered;
    let ls = null;
    try {
      const s = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}');
      ls = s.lyricMeta && s.lyricMeta.ui ? s.lyricMeta.ui.renumbered || null : null;
    } catch (e) {
      ls = 'ERR ' + e.message;
    }
    return {
      hasCardFn: typeof lyRenumberedCheck === 'function',
      hasMigrate: typeof lyMigrateSavedReadings === 'function',
      item: item && { title: item.title, text: item.text },
      pane: paneEl ? paneEl.innerText : null,
      stored: r ? JSON.parse(JSON.stringify(r)) : null,
      localStorage: ls,
      draft: document.getElementById('lyrics-draft') ? document.getElementById('lyrics-draft').value : null,
    };
  });

(async () => {
  const root = TREES[TREE];
  const server = serve(root);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, root, lib: LIB, cases: [] };
  // file:<path>:<marker> imports an existing text file (e.g. the f4-card stress files).
  if (WHICH.startsWith('file:')) {
    const [, fp, marker] = WHICH.split(':');
    const t = fs.readFileSync(fp, 'utf8');
    CASES[marker] = { text: t, labels: [], returns: false, marker };
  }
  const names = WHICH === 'all' ? Object.keys(CASES) : WHICH.startsWith('file:') ? [WHICH.split(':')[2]] : [WHICH];
  try {
    for (const name of names) {
      const c = CASES[name];
      const text = c.text || caseText(name, c.labels, c.returns);
      fs.writeFileSync(path.join(OUT, `case_${name}.txt`), text);
      const errors = [];
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
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
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url);
      await ready(page);
      const before = await page.evaluate(() => document.getElementById('lyrics-draft').value);
      if (LIB) {
        const env = await page.evaluate(
          ([t, title]) =>
            CMLibraryImport.makeWorkingCopyEnvelope(t, {
              version: 1, brief: '', notes: {}, drafts: {}, ui: {},
              libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title, language: 'eng', scope: 'whole',
                provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] },
            }),
          [text, name]
        );
        const f = path.join(OUT, `lib_${TREE}_${name}.json`);
        fs.writeFileSync(f, JSON.stringify(env));
        await page.setInputFiles('#ly-file', f);
        await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
        await page.waitForTimeout(1200);
      } else {
        await page.setInputFiles('#ly-file', { name: `${name}.txt`, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
        await page.waitForFunction(([b, m]) => { const v = document.getElementById('lyrics-draft').value; return v !== b && v.includes(m); }, [before, c.marker ? c.marker.replace(/_/g, ' ') : `"${name}"`], { timeout: 20000 });
        await page.waitForTimeout(600);
      }
      const toasts = await page.evaluate(() => window.__toasts.slice());
      const s1 = await snapshot(page);
      await page.screenshot({ path: path.join(OUT, `shot_${TREE}_${LIB ? 'lib' : 'txt'}_${name}.png`), fullPage: false });
      await page.waitForTimeout(800);
      await page.reload();
      await ready(page);
      await page.waitForTimeout(800);
      const s2 = await snapshot(page);
      // Analysis
      const words = c.labels.map((l) => ({ label: l, word: W[l], len: W[l].length }));
      const storedItems = (s1.stored && s1.stored.items) || [];
      const perWord = words.map((w) => {
        const hits = storedItems.filter((it) => w.word.startsWith(it.word) && it.word.length >= Math.min(40, w.len));
        const full = storedItems.filter((it) => it.word === w.word);
        return {
          ...w,
          storedAs: hits.map((h) => ({ kind: h.kind, word: h.word, len: h.word.length, n: h.n, from: h.from, to: h.to })),
          storedFull: full.length,
          cardHasFull: !!(s1.item && s1.item.text.includes(`“${w.word}”`)),
          paneHasFull: !!(s1.pane && s1.pane.includes(`“${w.word}”`)),
          cardHasCut40: !!(s1.item && s1.item.text.includes(`“${w.word.slice(0, 40)}”`)),
          cardHasEllipsisAfterCut: !!(s1.item && (s1.item.text.includes(`${w.word.slice(0, 40)}…`) || s1.item.text.includes(`${w.word.slice(0, 40)}...`))),
          toastHasFull: toasts.some((t) => t.includes(w.word)),
          draftHasFull: s1.draft.includes(w.word),
        };
      });
      const res = { name, text, toasts, after: s1, afterReload: { item: s2.item, stored: s2.stored, sameStored: JSON.stringify(s2.stored) === JSON.stringify(s1.stored) }, perWord, errors };
      out.cases.push(res);
      console.log(`== ${TREE} ${LIB ? 'lib' : 'txt'} ${name}: card fn=${s1.hasCardFn} migrate fn=${s1.hasMigrate} item=${!!s1.item} reloadSame=${res.afterReload.sameStored}`);
      console.log('  title:', s1.item && s1.item.title);
      console.log('  text :', s1.item && s1.item.text);
      for (const p of perWord) console.log('  ', JSON.stringify({ label: p.label, len: p.len, storedAs: p.storedAs.map((x) => `${x.kind}:${x.len}:${x.word}`), cardHasFull: p.cardHasFull, paneHasFull: p.paneHasFull, cardHasCut40: p.cardHasCut40, ellipsis: p.cardHasEllipsisAfterCut, toastHasFull: p.toastHasFull, draftHasFull: p.draftHasFull }));
      console.log('  toasts:', JSON.stringify(toasts));
      console.log('  draft rows changed:', s1.draft.split('\n').filter((r, i) => r !== text.split('\n')[i]).length, 'pageErrors:', errors.length);
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    fs.writeFileSync(path.join(OUT, `v_${TREE}_${LIB ? 'lib' : 'txt'}${process.env.SUFFIX || ''}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
