// verify-f4-card-1: does ONE import that renumbers N saved word numbers leave
// a Review card that lists every one? Independent generator and truth.
// Usage: node v1.js <tree> <txt|lib> <mix> N...
//   mix: mixed (text order: returns rows, then rhyme-group rows, then reading
//        rows -- the reverse of the page's own scan order), reading, groups.
'use strict';
const L = require('./vlib');
const [TREE, PATH, MIX] = process.argv.slice(2, 5);
const SIZES = process.argv.slice(5).map(Number);
const tag = (k) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26);
  } while (k > 0);
  return 'z' + s;
};
// v1 reads "Oh--oh," as ONE word; v2 as two. So on these lines v1 word t
// (t >= 2) is v2 word t+1, on the same characters: every numbered reference
// with t >= 2 must be renumbered t -> t+1.
const WORDS = ['we', 'ride', 'the', 'long', 'road'];
const lineOf = (k) => `Oh--oh, ${WORDS.join(' ')} ${tag(k)}`; // v1: 7 words
const v1word = (k, t) => (t === 7 ? tag(k) : WORDS[t - 2]);
function generate(N, mix) {
  const sung = [];
  const readings = [];
  const groups = [];
  const returns = [];
  let count = 0;
  let k = 0;
  const addLine = () => (sung.push(lineOf(k++)), sung.length);
  const want = (share) => Math.round(N * share);
  const nRead = mix === 'reading' ? N : mix === 'groups' ? N % 2 : Math.max(1, want(0.2));
  const nRet = mix === 'mixed' ? 2 * Math.max(1, Math.round(want(0.1) / 2)) : 0;
  for (let i = 0; i < nRead; i++) {
    const n = addLine();
    const t = 2 + (i % 6);
    readings.push(`[SETUP — reading — token ${t} "${v1word(n - 1, t)}" in "${sung[n - 1]}" — R OW1 D — declared — source: me]`);
    count++;
  }
  const pairs = (rows, total) => {
    let made = 0;
    while (made < total) {
      const a = addLine(),
        b = addLine();
      const parts = [];
      for (let t = 2; t <= 7 && made < total; t++) {
        parts.push(`${a}.T${t},${b}.T${t}`);
        made += 2;
      }
      rows.push(parts.join('; '));
    }
    return made;
  };
  count += pairs(returns, nRet);
  count += pairs(groups, N - count);
  const rowsText = [
    ...returns.map((g) => `[SETUP — returns — ${g}]`),
    ...groups.map((g) => `[SETUP — rhyme groups — ${g}]`),
    ...readings,
  ];
  const text = ['[SETUP — title — "Verify ' + N + '"]', ...rowsText, '', '[VERSE]', ...sung, ''].join('\n');
  return { text, expected: count };
}
// Truth: diff the rows as imported against the rows the page saved.
const RD = /^\[SETUP — reading — token (\d+) "((?:[^"\\]|\\.)*)" in "((?:[^"\\]|\\.)*)"/;
const GR = /^\[SETUP — (rhyme groups|returns) — (.+?)(?: — cut v2)?\]$/;
function truthOf(before, after) {
  const a = before.split('\n'),
    b = after.split('\n');
  if (a.length !== b.length) return { error: `row count ${a.length} -> ${b.length}` };
  const sung = a.filter((r) => r.trim() && !/^\[.*\]$/.test(r.trim()));
  const out = [];
  const odd = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    let p = RD.exec(a[i]),
      q = RD.exec(b[i]);
    if (p && q) {
      if (p[1] !== q[1]) out.push({ kind: 'reading', word: p[2], n: sung.indexOf(JSON.parse(`"${p[3]}"`)) + 1, from: +p[1], to: +q[1], row: i });
      else odd.push({ i, a: a[i], b: b[i] });
      continue;
    }
    p = GR.exec(a[i]);
    q = GR.exec(b[i]);
    if (p && q && p[1] === q[1]) {
      const ma = p[2].split(/[;,]/).map((s) => s.trim()),
        mb = q[2].split(/[;,]/).map((s) => s.trim());
      for (let j = 0; j < ma.length; j++) {
        const x = /^(\d+)\.T(\d+)$/.exec(ma[j]),
          y = /^(\d+)\.T(\d+)$/.exec(mb[j]);
        if (x && y && x[2] !== y[2]) out.push({ kind: p[1], n: +x[1], from: +x[2], to: +y[2], row: i });
        else if (ma[j] !== mb[j]) odd.push({ i, a: ma[j], b: mb[j] });
      }
      continue;
    }
    odd.push({ i, a: a[i], b: b[i] });
  }
  return { entries: out, odd };
}
function matchCard(entries, items) {
  const pool = items.map((m, i) => ({ ...m, i }));
  const listed = [],
    lost = [];
  for (const t of entries) {
    const j = pool.findIndex((m) => m.kind === t.kind && m.from === t.from && m.to === t.to && Array.isArray(m.n) && m.n[0] === t.n && (t.kind !== 'reading' || m.word === t.word));
    if (j < 0) lost.push(t);
    else listed.push({ ...t, cardIndex: pool.splice(j, 1)[0].i });
  }
  return { listed, lost, unmatched: pool };
}
(async () => {
  const errs = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, path: PATH, mix: MIX, runs: [] };
  try {
    for (const N of SIZES) {
      const g = generate(N, MIX);
      L.fs.writeFileSync(L.path.join(L.OUT, `gen_${MIX}_${N}.txt`), g.text);
      const ctx = await L.ctxOf(browser);
      const page = await L.openPage(ctx, url, errs);
      await L.toasts(page);
      if (PATH === 'lib') {
        const env = await page.evaluate(
          async ([t, title]) =>
            CMLibraryImport.makeWorkingCopyEnvelope(t, {
              version: 1, brief: '', notes: {}, drafts: {}, ui: {},
              libraryOrigin: {
                version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title, language: 'eng', scope: 'whole',
                provenance: { snapshotId: 'snap:v', unitId: 'unit:v', workId: 'work:v', editionId: 'ed:v', revisionId: 'rev:v' }, lineage: [], declarations: [],
              },
            }),
          [g.text, 'Verify ' + N]
        );
        await L.importFile(page, `wc-${N}.json`, 'application/json', JSON.stringify(env), null);
        await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
        await page.waitForTimeout(1200);
      } else await L.importFile(page, `verify-${N}.txt`, 'text/plain', g.text);
      const after = await L.draft(page);
      const tr = truthOf(g.text, after);
      const toast = await L.toasts(page);
      const c = await L.cardOf(page);
      const items = (c.renumbered && c.renumbered.items) || [];
      const m = matchCard(tr.entries || [], items);
      const title = c.item ? Number((/^(\d+)/.exec(c.item.title) || [])[1]) : null;
      const hiddenSaid = c.item ? (/and (\d+) earlier ones? no longer listed/.exec(c.item.text) || [])[1] : undefined;
      const order = (tr.entries || []).slice().sort((x, y) => ['reading', 'rhyme groups', 'returns'].indexOf(x.kind) - ['reading', 'rhyme groups', 'returns'].indexOf(y.kind) || x.row - y.row);
      const lostIdx = m.lost.map((t) => order.indexOf(t)).sort((x, y) => x - y);
      const lostArePrefixOfPageOrder = lostIdx.every((v, i) => v === i);
      const rowOrder = (tr.entries || []).slice().sort((x, y) => x.row - y.row);
      const lostRowIdx = m.lost.map((t) => rowOrder.indexOf(t)).sort((x, y) => x - y);
      const lostArePrefixOfTextOrder = lostRowIdx.every((v, i) => v === i);
      // Persistence across a reload.
      await page.waitForTimeout(900);
      await page.reload();
      await L.ready(page);
      await page.waitForTimeout(900);
      const c2 = await L.cardOf(page);
      // Undo once: what the draft returns to.
      const undo = await page.evaluate(() => {
        const b = $ui('lyrics-draft').value;
        if (typeof undo === 'function') undo();
        else if (typeof uiUndo === 'function') uiUndo();
        const a = $ui('lyrics-draft').value;
        return { changed: a !== b, headAfter: a.slice(0, 120), hasUnmarkedImport: a.includes('Verify') && !a.includes('— cut v2') };
      });
      const run = {
        N,
        generatorExpected: g.expected,
        truth: (tr.entries || []).length,
        truthError: tr.error || null,
        oddRowChanges: (tr.odd || []).length,
        toastError: toast.some((t) => /needs? your decision/.test(t)),
        toast,
        cardTitle: c.item && c.item.title,
        cardTitleCount: title,
        cardSaysHidden: hiddenSaid === undefined ? null : Number(hiddenSaid),
        storedItems: items.length,
        storedMore: c.renumbered ? c.renumbered.more : null,
        listed: m.listed.length,
        lost: m.lost.length,
        unmatchedCardItems: m.unmatched.length,
        lostByKind: m.lost.reduce((a, t) => ((a[t.kind] = (a[t.kind] || 0) + 1), a), {}),
        listedByKind: m.listed.reduce((a, t) => ((a[t.kind] = (a[t.kind] || 0) + 1), a), {}),
        lostArePrefixOfPageOrder,
        lostArePrefixOfTextOrder,
        paneShowsCard: c.item ? c.pane.includes(c.item.title) : false,
        paneShowsHiddenCount: hiddenSaid ? c.pane.includes(`and ${hiddenSaid} earlier`) : null,
        uiJsonLen: c.uiJsonLen,
        afterReload: { same: JSON.stringify(c2.renumbered) === JSON.stringify(c.renumbered), title: c2.item && c2.item.title },
        undo,
        cardTextTail: c.item && c.item.text.slice(-230),
      };
      out.runs.push(run);
      console.log(JSON.stringify({ ...run, toast: toast.map((t) => t.slice(0, 260)) }));
      await ctx.close();
    }
  } catch (e) {
    out.error = String(e && e.stack);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errs;
    L.fs.writeFileSync(L.path.join(L.OUT, `v1_${TREE}_${PATH}_${MIX}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
