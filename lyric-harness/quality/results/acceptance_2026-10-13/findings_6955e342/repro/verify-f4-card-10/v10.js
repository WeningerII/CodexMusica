// verify-f4-card-10: independent, from-scratch re-check of f4-card claim d4
// ("Wording and tone are accurate"). Scratch only; serves a tree root over a
// local http server; the chat host is routed to an in-process stub (no
// provider, no network, no secret).
// Usage: node v10.js <cand|prev61b|prev678|main|base> [scenario,...]
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-10');
const TREES = {
  cand: path.join(S, 'wt-695'),
  prev61b: path.join(S, 'wt-61b'),
  prev678: path.join(S, 'wt-678'),
  main: path.join(S, 'wt-main'),
  base: path.join(S, 'wt-base'),
};
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREE = process.argv[2] || 'cand';
const ONLY = (process.argv[3] || 'S1,S2,S3,S4').split(',');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

function serve(root) {
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

const D = ' — ';
const reading = (tok, word, line) => `[SETUP — reading — token ${tok} ${JSON.stringify(word)} in ${JSON.stringify(line)} — OW1 — declared — source: me]`;
// Letter-only distinct words.
const W = (i) => 'w' + String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26)) + 'en';

async function newPage(browser, phone) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
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
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  return { ctx, page };
}
async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
}
async function importTxt(page, name, text, marker) {
  const before = await page.evaluate(() => $ui('lyrics-draft').value);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(([m, b]) => $ui('lyrics-draft').value !== b && $ui('lyrics-draft').value.includes(m), [marker, before], { timeout: 30000 });
  await page.waitForTimeout(500);
}
// The page's own item, the rendered <li>, the page-context record.
const cardState = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    LY_ACTIONS['ly-tab']('review');
    const item = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    const lis = [...document.querySelectorAll('#ly-panel-review li.ly-item')];
    const li = lis.find((l) => /renumbered to the current word cut/.test(l.innerText)) || null;
    const r = app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered;
    let liInfo = null;
    if (li) {
      const svg = li.querySelector('svg');
      liInfo = {
        text: li.innerText,
        dataTone: li.getAttribute('data-tone'),
        iconHtmlHead: svg ? svg.outerHTML.slice(0, 160) : null,
        mentionsPronunciation: /Pronunciation/.test(li.innerText),
        smalls: [...li.querySelectorAll('small')].map((s) => s.innerText),
        width: li.getBoundingClientRect().width,
        scrollW: li.scrollWidth,
        clientW: li.clientWidth,
      };
    }
    return {
      item: item && { title: item.title, text: item.text, tone: item.tone, category: item.category, where: item.where, lines: item.lines, actions: item.actions },
      li: liInfo,
      meta: r ? JSON.parse(JSON.stringify(r)) : null,
      uiLen: JSON.stringify((app.lyricMeta && app.lyricMeta.ui) || {}).length,
      docScrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  });
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
const draft = (page) => page.evaluate(() => $ui('lyrics-draft').value);
const sung = (text) => text.split('\n').filter((r) => r.trim() && !/^\s*\[.*\]\s*$/.test(r));

const out = { tree: TREE, head: null, scenarios: {} };
(async () => {
  const root = TREES[TREE];
  out.head = require('child_process').execSync(`git -C ${root} rev-parse HEAD`).toString().trim();
  const server = serve(root);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    // ── S1: the basic card (reading, rhyme link, return), desktop + 390 px.
    if (ONLY.includes('S1'))
      for (const phone of [false, true]) {
        const OH = 'Oh--oh, oh my love';
        const SONG = ['[SETUP — title — "Old Song"]', reading(2, 'oh', OH), '[SETUP — rhyme groups — 1.T4,2]', '[SETUP — returns — 1.T3,3.T3]', '', '[VERSE]', OH, 'You are the one I dream of my dove', OH].join('\n');
        const { ctx, page } = await newPage(browser, phone);
        await ready(page, url);
        await toasts(page);
        await importTxt(page, 'old-song.txt', SONG, 'Old Song');
        const t = await toasts(page);
        const c = await cardState(page);
        const res = { toasts: t, card: c, draftAfter: await draft(page), errors: page.__errors };
        if (c.li) {
          const loc = page.locator('#ly-panel-review li.ly-item', { hasText: 'renumbered to the current word cut' }).first();
          await loc.scrollIntoViewIfNeeded();
          await loc.screenshot({ path: path.join(OUT, `S1_${TREE}_${phone ? 'phone' : 'desktop'}.png`) });
        }
        out.scenarios[`S1_${phone ? 'phone' : 'desktop'}`] = res;
        console.log(`S1 ${phone ? 'phone' : 'desktop'}:`, JSON.stringify({ toasts: t, item: c.item, li: c.li && { dataTone: c.li.dataTone, mentionsPronunciation: c.li.mentionsPronunciation, smalls: c.li.smalls, scrollW: c.li.scrollW, clientW: c.li.clientW }, docScrollW: c.docScrollW, vw: c.vw }, null, 1));
        await ctx.close();
      }

    // ── S2: ONE import, nothing listed before, more renumbered numbers than
    // the record keeps. Rhyme-group rows are placed BEFORE the reading rows
    // in the text, so text order and the page's scan order differ.
    if (ONLY.includes('S2')) {
      const N = 30;
      const lines = [];
      for (let i = 0; i < N; i++) lines.push(`Oh--oh, oh my ${W(i)}`);
      const groups = [];
      for (let i = 0; i < N; i += 2) groups.push(`[SETUP — rhyme groups — ${i + 1}.T4,${i + 2}.T4]`);
      const reads = lines.map((l) => reading(2, 'oh', l));
      const SONG = ['[SETUP — title — "Big Import"]', ...groups, ...reads, '', '[VERSE]', ...lines].join('\n');
      fs.writeFileSync(path.join(OUT, 'S2_song.txt'), SONG);
      const { ctx, page } = await newPage(browser, false);
      await ready(page, url);
      const pre = await cardState(page);
      await toasts(page);
      await importTxt(page, 'big.txt', SONG, 'Big Import');
      const t = await toasts(page);
      const c = await cardState(page);
      // Independent truth: every generated row moves (readings 2→3, rhyme T4→T5).
      const truth = [
        ...lines.map((l, i) => ({ kind: 'rhyme groups', word: W(i), n: [i + 1], from: 4, to: 5, textRow: 1 + Math.floor(i / 2) })),
        ...lines.map((l, i) => ({ kind: 'reading', word: 'oh', n: [i + 1], from: 2, to: 3, textRow: 1 + N / 2 + i })),
      ];
      const key = (m) => `${m.kind}|${m.word}|${(m.n || []).join('.')}|${m.from}>${m.to}`;
      const listed = new Set(((c.meta && c.meta.items) || []).map(key));
      const evicted = truth.filter((m) => !listed.has(key(m)));
      const draftAfter = await draft(page);
      // What the toast named, and whether each of those is still listed.
      const toastNamed = [];
      for (const s of t) for (const m of s.matchAll(/“([^”]+)” word (\d+) → (\d+)/g)) toastNamed.push({ word: m[1], from: +m[2], to: +m[3] });
      const toastNamedListed = toastNamed.map((x) => ({ ...x, listedAnywhereOnCard: !!(c.item && c.item.text.includes(`“${x.word}”`) && c.item.text.includes(`word ${x.from} → ${x.to}`)) }));
      // Is "oh" (reading) still on the card at all?
      const res = {
        preCard: !!pre.item,
        toasts: t,
        title: c.item && c.item.title,
        metaItems: c.meta && c.meta.items.length,
        metaMore: c.meta && c.meta.more,
        uiLen: c.uiLen,
        cardTail: c.item && c.item.text.slice(-200),
        cardHead: c.item && c.item.text.slice(0, 400),
        evictedCount: evicted.length,
        evictedKinds: evicted.reduce((a, m) => ((a[m.kind] = (a[m.kind] || 0) + 1), a), {}),
        evictedTextRows: evicted.map((m) => m.textRow),
        firstListed: c.meta && c.meta.items.slice(0, 3),
        listedKindsInOrder: c.meta && [...new Set(c.meta.items.map((m) => m.kind))],
        toastNamedListed,
        cardMentionsReadingOh: !!(c.item && /the reading for “oh”/.test(c.item.text)),
        groupRowsBeforeReadingRowsInText: draftAfter.indexOf('rhyme groups') < draftAfter.indexOf('reading —'),
        errors: page.__errors,
      };
      out.scenarios.S2 = res;
      console.log('S2:', JSON.stringify(res, null, 1));
      // Reload keeps the same record?
      await page.reload();
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
      const c2 = await cardState(page);
      out.scenarios.S2.afterReload = { title: c2.item && c2.item.title, same: JSON.stringify(c2.meta) === JSON.stringify(c.meta) };
      console.log('S2 reload:', JSON.stringify(out.scenarios.S2.afterReload));
      await ctx.close();
    }

    // ── S3: truncation of the word (> 40 characters) and of the line list
    // (a reading's line text sung 6 times).
    if (ONLY.includes('S3')) {
      const OH = 'Oh--oh, oh my love';
      const LONG = 'supercalifragilisticexpialidociousantidisestablishmentarianism'; // 62 letters
      const LL = `Oh--oh, oh my ${LONG}`;
      const SONG = ['[SETUP — title — "Trunc"]', reading(2, 'oh', OH), reading(4, LONG, LL), '[SETUP — returns — 7.T4,8.T4]', '', '[CHORUS]', OH, OH, OH, OH, OH, OH, LL, LL].join('\n');
      const { ctx, page } = await newPage(browser, false);
      await ready(page, url);
      await toasts(page);
      await importTxt(page, 'trunc.txt', SONG, 'Trunc');
      const t = await toasts(page);
      const c = await cardState(page);
      const d = await draft(page);
      const s = sung(d);
      const ohLines = s.map((x, i) => (x === OH ? i + 1 : 0)).filter(Boolean);
      // Does the reading row apply to every sung line with its text? Ask the page.
      const scope = await page.evaluate(() => {
        try {
          const m = lyParse($ui('lyrics-draft').value);
          const r = lySetupOf(m, 'reading')[0];
          return { line: r.line, token: r.token, word: r.word, sungWithText: m.sung.filter((x) => x.text === r.line).map((x) => x.n) };
        } catch (e) {
          return String(e);
        }
      });
      const res = {
        toasts: t,
        cardText: c.item && c.item.text,
        ohLinesInDraft: ohLines,
        readingScopeFromPage: scope,
        cardOhLineRef: c.item && (c.item.text.match(/the reading for “oh”, ([^:]*):/) || [])[1],
        cardLongWords: c.item && [...c.item.text.matchAll(/“([^”]+)”/g)].map((m) => m[1]).filter((w) => w.startsWith('super')),
        toastLongWords: t.flatMap((x) => [...x.matchAll(/“([^”]+)”/g)].map((m) => m[1]).filter((w) => w.startsWith('super'))),
        metaItems: c.meta && c.meta.items,
        errors: page.__errors,
      };
      out.scenarios.S3 = res;
      console.log('S3:', JSON.stringify(res, null, 1));
      await ctx.close();
    }

    // ── S4: two .txt imports, A then B; then a reload.
    if (ONLY.includes('S4')) {
      const A = ['[SETUP — title — "Song A"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh my apple', 'Oh--oh, oh my anchor'].join('\n');
      const B = ['[SETUP — title — "Song B"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh my bravo', 'Oh--oh, oh my banjo', 'A third line here'].join('\n');
      const { ctx, page } = await newPage(browser, false);
      await ready(page, url);
      await toasts(page);
      await importTxt(page, 'a.txt', A, 'Song A');
      const tA = await toasts(page);
      const cA = await cardState(page);
      await importTxt(page, 'b.txt', B, 'Song B');
      const tB = await toasts(page);
      const cB = await cardState(page);
      const dB = await draft(page);
      const sB = sung(dB);
      await page.reload();
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
      const cR = await cardState(page);
      const res = {
        toastA: tA,
        cardAfterA: cA.item && cA.item.text,
        toastB: tB,
        cardAfterB: cB.item && { title: cB.item.title, text: cB.item.text },
        currentSungLinesB: sB,
        aEntriesLine1Now: sB[0],
        aWordsInCurrentDraft: ['apple', 'anchor'].map((w) => ({ w, inDraft: dB.includes(w) })),
        cardHasSourceLabel: !!(cB.item && /Song A|a\.txt|import/i.test(cB.item.text + cB.item.where + cB.item.title)),
        afterReload: cR.item && cR.item.text,
        errors: page.__errors,
      };
      out.scenarios.S4 = res;
      console.log('S4:', JSON.stringify(res, null, 1));
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    fs.writeFileSync(path.join(OUT, `v10_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
