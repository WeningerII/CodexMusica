// verify-f4-card-6 (adversarial skeptic of f4-card check c5). Scratch only.
// The Review "renumbered" card versus the draft across Undo/Redo of a .txt
// import, with the same steps on every tree as a control.
// Usage: node v6.js <cand|prev61b|prev678|main|base>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-6');
const TREES = {
  cand: 'wt-695',
  prev61b: 'wt-61b',
  prev678: 'wt-678',
  main: 'wt-main',
  base: 'wt-base',
};
const TREE = process.argv[2] || 'cand';
const ROOT = path.join(S, TREES[TREE]);
// The page is my own CODEX_LIBRARY=1 build of the tree (verified identical to
// its codex.html, see COMMANDS.txt); every other file comes from the tree root.
const BUILT = path.join(OUT, `build-${TREES[TREE]}`, `built-${TREES[TREE]}.html`);
const { chromium } = require(path.join(S, 'wt-695', 'node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '/codex.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    return fs.createReadStream(BUILT).pipe(res);
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

// Songs: one rhyme-group row with v1 word numbers. The v1 cut reads
// "Oh--oh" as one word, so apple/anchor are word 4; the v2 cut splits it, so
// they are word 5 (same for B with bravo/banjo).
const song = (title, a, b) => [`[SETUP — title — "${title}"]`, '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', a, b].join('\n');
const A = song('Song A', 'Oh--oh, oh my apple', 'Oh--oh, oh my anchor');
const B = song('Song B', 'Ah--ah, ah my bravo', 'Ah--ah, ah my banjo');

const results = [];
const log = [];
function rec(id, claim, expected, observed, status) {
  results.push({ id, claim, expected, observed, status });
  console.log(`[${status}] ${TREE}.${id}: ${claim}\n    expected: ${expected}\n    observed: ${JSON.stringify(observed)}`);
}

async function newPage(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
  await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
  await ready(page);
  return { ctx, page };
}
const ready = (page) =>
  page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });

async function importTxt(page, name, text, marker) {
  const before = await page.evaluate(() => $ui('lyrics-draft').value);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(([m, b]) => $ui('lyrics-draft').value !== b && $ui('lyrics-draft').value.includes(m), [marker, before], { timeout: 20000 });
  await page.waitForTimeout(500);
}
// Real pointer clicks on the shell's Undo / Redo buttons.
async function clickBtn(page, id) {
  const vis = await page.locator('#' + id).isVisible();
  if (vis) await page.click('#' + id);
  else await page.evaluate((i) => document.getElementById(i).click(), id);
  await page.waitForTimeout(700);
  return vis ? 'mouse' : 'dom-click';
}
// Everything about the card and the draft at one moment.
async function snap(page, tag) {
  const s = await page.evaluate(() => {
    lyRefresh(true);
    const draft = $ui('lyrics-draft').value;
    const item = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    LY_ACTIONS['ly-tab']('review');
    const pane = $ui('ly-panel-review') ? $ui('ly-panel-review').innerText : null;
    const ui = (app.lyricMeta && app.lyricMeta.ui) || {};
    const hist = app.history.map((h) => {
      const j = JSON.parse(h);
      return { lyricMetaKeys: j.lyricMeta ? Object.keys(j.lyricMeta) : null, hasRenumbered: /renumbered/.test(h), head: (j.lyrics || '').split('\n')[0] };
    });
    let storedUi = null;
    try {
      const st = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}');
      storedUi = st.lyricMeta ? st.lyricMeta.ui || null : null;
    } catch (e) {
      storedUi = 'ERR ' + e.message;
    }
    return {
      draft,
      card: item && { title: item.title, text: item.text },
      paneHasCard: !!pane && /renumbered to the current word cut/.test(pane),
      ui: JSON.parse(JSON.stringify(ui)),
      storedRenumbered: storedUi && storedUi.renumbered ? storedUi.renumbered : null,
      historyIndex: app.historyIndex,
      history: hist,
      toasts: window.__toasts.splice(0),
    };
  });
  const words = ((s.ui.renumbered && s.ui.renumbered.items) || []).map((m) => m.word);
  const inDraft = Object.fromEntries(words.map((w) => [w, new RegExp(`\\b${w}\\b`).test(s.draft)]));
  const o = { tag, words, inDraft, draftHead: s.draft.split('\n')[0], ...s };
  log.push(o);
  console.log(`   [${tag}] draftHead=${o.draftHead} words=${JSON.stringify(words)} inDraft=${JSON.stringify(inDraft)} paneHasCard=${o.paneHasCard} hIdx=${o.historyIndex}/${o.history.length} histHasRenumbered=${o.history.some((h) => h.hasRenumbered)} toasts=${JSON.stringify(o.toasts)}`);
  return o;
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const out = { tree: TREE, root: ROOT, built: BUILT, scenarios: {} };
  const scen = async (name, fn) => {
    console.log('## ' + name);
    log.length = 0;
    const { ctx, page } = await newPage(browser, errors);
    try {
      await fn(page);
    } catch (e) {
      log.push({ error: String((e && e.stack) || e) });
      console.log('ERROR', e && e.stack);
    }
    out.scenarios[name] = JSON.parse(JSON.stringify(log));
    await ctx.close();
  };
  try {
    // U1: the c5 repro, then more Undo/Redo and a reload on A.
    await scen('U1 txt A -> txt B -> Undo -> Redo -> Undo -> reload', async (page) => {
      const s0 = await snap(page, 'fresh');
      await importTxt(page, 'a.txt', A, 'Song A');
      const sA = await snap(page, 'after A');
      await importTxt(page, 'b.txt', B, 'Song B');
      const sB = await snap(page, 'after B');
      const how1 = await clickBtn(page, 'btn-undo');
      const sU = await snap(page, `after Undo (${how1})`);
      rec('u1.undoText', 'Undo of import B restores the draft from before B, exactly', 'draft === draft after A', { equal: sU.draft === sA.draft }, sU.draft === sA.draft ? 'PASS' : 'FAIL');
      rec('u1.cardAfterUndo', 'the card after Undo of import B (the c5 observation)', "c5 tester: apple, anchor only; R2's claim: listed until dismissed", { words: sU.words, inDraft: sU.inDraft, cardText: sU.card && sU.card.text }, 'INFO');
      rec('u1.historyHasNoCard', 'no Undo step records the card (lyricMeta.ui is not in a history snapshot)', 'no snapshot contains "renumbered"; snapshot lyricMeta keys exclude ui', { anyHas: sU.history.some((h) => h.hasRenumbered), keys: [...new Set(sU.history.map((h) => JSON.stringify(h.lyricMetaKeys)))] }, sU.history.some((h) => h.hasRenumbered) ? 'FAIL' : 'PASS');
      const how2 = await clickBtn(page, 'btn-redo');
      const sR = await snap(page, `after Redo (${how2})`);
      rec('u1.redoText', 'Redo restores the migrated draft B', 'draft === draft after B', { equal: sR.draft === sB.draft }, sR.draft === sB.draft ? 'PASS' : 'FAIL');
      rec('u1.cardAfterRedo', 'the card after Redo', 'apple, anchor, bravo, banjo (B evidence present with B text)', sR.words, JSON.stringify(sR.words) === JSON.stringify(['apple', 'anchor', 'bravo', 'banjo']) ? 'PASS' : 'FAIL');
      await clickBtn(page, 'btn-undo');
      const sU2 = await snap(page, 'after second Undo');
      await page.waitForTimeout(800);
      await page.reload();
      await ready(page);
      await page.waitForTimeout(800);
      const sL = await snap(page, 'after reload (draft A)');
      rec('u1.reload', 'after reload on A the card and draft', 'informational', { draftHead: sL.draftHead, words: sL.words, draftEqualsA: sL.draft === sA.draft }, 'INFO');
    });
    // U2: the state R2 claims (the card survives a later import): A's words
    // over B's text, no Undo involved.
    await scen('U2 txt A -> txt B (no Undo): card words vs draft', async (page) => {
      await importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A');
      await importTxt(page, 'b.txt', B, 'Song B');
      const s = await snap(page, 'after B');
      rec('u2.laterImport', 'after import B the card lists A entries whose text is no longer in the draft', 'R2 claim: survives a later import (f4-card scored this PASS as c1.accumulate)', { words: s.words, inDraft: s.inDraft }, 'INFO');
    });
    // U3: Undo of a single import: back to the page's start draft.
    await scen('U3 txt A -> Undo', async (page) => {
      const s0 = await snap(page, 'fresh');
      await importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A');
      await clickBtn(page, 'btn-undo');
      const s = await snap(page, 'after Undo');
      rec('u3.cardOverStart', 'after Undo of the only import the card and draft', 'informational', { draftEqualsFresh: s.draft === s0.draft, draftHead: s.draftHead, words: s.words, inDraft: s.inDraft }, 'INFO');
    });
    // U4: Undo B, then import B again: does the card list B twice?
    await scen('U4 txt A -> txt B -> Undo -> txt B again', async (page) => {
      await importTxt(page, 'a.txt', A, 'Song A');
      await importTxt(page, 'b.txt', B, 'Song B');
      await clickBtn(page, 'btn-undo');
      await snap(page, 'after Undo');
      await importTxt(page, 'b2.txt', B, 'Song B');
      const s = await snap(page, 'after B again');
      rec('u4.reimport', 'importing B again after its Undo: card entries', 'informational (duplicates?)', { words: s.words, title: s.card && s.card.title }, 'INFO');
    });
    // U5: the hypothetical "expected" behaviour, SIMULATED: drop B's entries
    // at Undo (what the c5 expectation asks for), then Redo. Since lyricMeta.ui
    // is not in any history snapshot, Redo cannot bring them back.
    await scen('U5 SIMULATION: prune B entries at Undo, then Redo', async (page) => {
      await importTxt(page, 'a.txt', A, 'Song A');
      await importTxt(page, 'b.txt', B, 'Song B');
      await clickBtn(page, 'btn-undo');
      await page.evaluate(() => {
        const r = app.lyricMeta.ui && app.lyricMeta.ui.renumbered;
        if (r) r.items = r.items.filter((m) => !['bravo', 'banjo'].includes(m.word));
        lyMetaSaved();
        lyRefresh(true);
      });
      await snap(page, 'after Undo + simulated prune');
      await clickBtn(page, 'btn-redo');
      const s = await snap(page, 'after Redo');
      rec('u5.simRedo', 'SIMULATED prune-on-Undo, then Redo: is B evidence back with B text?', 'informational', { draftHead: s.draftHead, words: s.words, bRowMarked: /rhyme groups — 1\.T5,2\.T5 — cut v2/.test(s.draft) }, 'INFO');
    });
  } finally {
    out.pageErrors = errors;
    out.results = results;
    fs.writeFileSync(path.join(OUT, `v6_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
