// (b) Stress: one import that renumbers N entries (50, 200, 500), with words
// over 40 characters and a reading whose line is sung more than 4 times.
// Truth is computed from the saved rows before/after (lib.truthFromRows),
// independently of the card. Usage: node b_stress.js <tree> <txt|lib> N...
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'cand';
const PATH = process.argv[3] || 'txt';
const SIZES = process.argv.slice(4).map(Number).filter(Boolean);
const az = (k) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26);
  } while (k > 0);
  return s;
};
const LONG = (k) => 'supercalifragilisticexpialidociousantidisestablishment' + az(k + 26 * 26); // > 40 chars
const QUOTE = (s) => JSON.stringify(s);
// v1 cut of "Ah--ah, ah my heart and soul W": 7 words; T2..T7 each move +1.
function generate(N) {
  const sung = [];
  const readings = [];
  const groups = [];
  const returns = [];
  let count = 0;
  const add = (line) => sung.push(line) && sung.length;
  // 1. A chorus line sung 6 times, with one reading on it (one entry, 6 lines).
  const CHORUS = 'Oh--oh, oh my chorus line';
  const chorusLines = [];
  for (let k = 0; k < 6; k++) chorusLines.push(add(CHORUS));
  readings.push(`[SETUP — reading — token 2 "oh" in ${QUOTE(CHORUS)} — OW1 — declared — source: me]`);
  count++;
  // 2. Two long-word lines: a reading (early in card order) and a returns
  // member (last in card order) on each long word.
  const longLines = [];
  for (let k = 0; k < 2; k++) {
    const line = `Oh--oh, oh my ${LONG(k)}`;
    longLines.push(add(line));
    readings.push(`[SETUP — reading — token 4 ${QUOTE(LONG(k))} in ${QUOTE(line)} — S UW1 — declared — source: me]`);
    count++;
  }
  returns.push(`${longLines[0]}.T4,${longLines[1]}.T4`);
  count += 2;
  // 3. A reading sung 5 times at the end of card order too (a returns row has
  // no multi-line member, so this is only for readings).
  // 4. Fill with Ah-lines: readings on word 7, then rhyme-group pairs.
  let w = 0;
  const ahLine = () => `Ah--ah, ah my heart and soul ${'w' + az(w++)}`;
  const nReadings = Math.max(0, Math.round(N * 0.1) - 3);
  for (let k = 0; k < nReadings && count < N; k++) {
    const line = ahLine();
    add(line);
    const word = line.split(' ').pop();
    readings.push(`[SETUP — reading — token 7 ${QUOTE(word)} in ${QUOTE(line)} — W AH1 — declared — source: me]`);
    count++;
  }
  while (count < N) {
    const a = add(ahLine()),
      b = add(ahLine());
    const parts = [];
    for (let t = 2; t <= 7 && count < N; t++) {
      if (N - count >= 2) {
        parts.push(`${a}.T${t},${b}.T${t}`);
        count += 2;
      } else {
        parts.push(`${a}.T${t},${b}`); // bare member: not renumbered
        count += 1;
      }
    }
    groups.push(parts.join(';'));
  }
  const text = [
    '[SETUP — title — "Stress ' + N + '"]',
    ...readings,
    ...groups.map((g) => `[SETUP — rhyme groups — ${g}]`),
    ...returns.map((g) => `[SETUP — returns — ${g}]`),
    '',
    '[VERSE]',
    ...sung,
  ].join('\n');
  return { text, expected: count, chorusLines, longLines };
}
function match(truth, items) {
  const pool = items.map((m, i) => ({ ...m, i }));
  const rows = [];
  for (const t of truth) {
    let j = pool.findIndex(
      (m) =>
        m.kind === t.kind &&
        m.from === t.from &&
        m.to === t.to &&
        (m.word === t.word || (t.word.length > 40 && m.word === t.word.slice(0, 40))) &&
        Array.isArray(m.n) &&
        (t.n.length ? m.n[0] === t.n[0] : m.n.length === 0)
    );
    if (j < 0) {
      rows.push({ ...t, status: 'lost' });
      continue;
    }
    const m = pool.splice(j, 1)[0];
    const wordCut = m.word !== t.word;
    const linesCut = JSON.stringify(m.n) !== JSON.stringify(t.n);
    rows.push({ kind: t.kind, word: t.word, from: t.from, to: t.to, n: t.n, cardWord: m.word, cardN: m.n, status: wordCut || linesCut ? 'listed-cut' : 'listed', wordCut, linesCut });
  }
  return { rows, unmatchedCard: pool };
}
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, path: PATH, runs: [] };
  try {
    for (const N of SIZES) {
      const g = generate(N);
      L.fs.writeFileSync(L.path.join(L.OUT, `b_stress_${N}.txt`), g.text);
      const ctx = await L.newCtx(browser);
      const page = await L.open(ctx, url, errors);
      const t0 = Date.now();
      if (PATH === 'lib') {
        const env = await L.makeEnvelope(page, g.text, 'Stress ' + N);
        await L.importLibrary(page, env, L.path.join(L.OUT, `b_${TREE}_${N}_wc.json`));
      } else await L.importTxt(page, `stress-${N}.txt`, g.text, `Stress ${N}`);
      const ms = Date.now() - t0;
      const after = await L.draftOf(page);
      const truth = L.truthFromRows(g.text, after);
      const other = truth.filter((t) => t.kind === 'other-change');
      const real = truth.filter((t) => t.kind !== 'other-change');
      const toast = await L.toasts(page);
      const c = await L.card(page);
      const items = (c.meta && c.meta.items) || [];
      const more = (c.meta && c.meta.more) || 0;
      const { rows, unmatchedCard } = match(real, items);
      const listed = rows.filter((r) => r.status !== 'lost');
      const lost = rows.filter((r) => r.status === 'lost');
      const wordCut = rows.filter((r) => r.wordCut);
      const linesCut = rows.filter((r) => r.linesCut);
      const titleN = c.item ? Number((/^(\d+)/.exec(c.item.title) || [])[1]) : null;
      const moreText = c.item ? (/and (\d+) earlier ones? no longer listed/.exec(c.item.text) || [null, null])[1] : null;
      // Every listed entry rendered in the Review pane?
      const notRendered = listed.filter((r) => !c.pane.includes(`“${r.cardWord}”`) || !c.pane.includes(`word ${r.from} → ${r.to}`));
      // Reload: the same items, the page context not dropped by lyricMetaOf.
      await L.settle(page, 800);
      await page.reload();
      await L.waitReady(page);
      await L.settle(page, 800);
      const c2 = await L.card(page);
      const run = {
        N,
        generatedExpected: g.expected,
        importMs: ms,
        truthCount: real.length,
        otherRowChanges: other.length,
        cardTitleCount: titleN,
        metaItems: items.length,
        metaMore: more,
        cardSaysHidden: moreText === null ? null : Number(moreText),
        listed: listed.length,
        lost: lost.length,
        lostKinds: lost.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {}),
        lostExamples: lost.slice(0, 5).map((r) => ({ kind: r.kind, word: r.word, n: r.n, from: r.from, to: r.to })),
        wordTruncated: wordCut.map((r) => ({ kind: r.kind, word: r.word, len: r.word.length, cardWord: r.cardWord })),
        linesCut: linesCut.map((r) => ({ kind: r.kind, word: r.word, n: r.n, cardN: r.cardN })),
        lostWithLongWord: lost.filter((r) => r.word.length > 40).length,
        lostChorus: lost.filter((r) => r.n.length > 4).length,
        unmatchedCardItems: unmatchedCard.length,
        notRendered: notRendered.length,
        uiLen: c.uiLen,
        afterReloadSame: JSON.stringify(c2.meta) === JSON.stringify(c.meta),
        afterReloadUiLen: c2.uiLen,
        toast,
        cardTitle: c.item && c.item.title,
        cardTextLen: c.item && c.item.text.length,
        cardTextTail: c.item && c.item.text.slice(-260),
        cardTextHead: c.item && c.item.text.slice(0, 400),
      };
      out.runs.push(run);
      console.log(JSON.stringify({ ...run, toast: undefined, cardTextHead: undefined }, null, 1));
      L.record(
        `${TREE}.b.${PATH}.${N}.everyListed`,
        `one ${PATH} import renumbering ${N}: the card lists every renumbered entry`,
        `${real.length} listed, none lost`,
        { listed: listed.length, lost: lost.length, more, title: titleN },
        lost.length === 0
      );
      L.record(
        `${TREE}.b.${PATH}.${N}.counted`,
        'the card title counts every renumbered entry and says how many are not listed',
        `title ${real.length}; hidden ${lost.length}`,
        { title: titleN, hidden: moreText },
        titleN === real.length && (lost.length === 0 ? moreText === null : Number(moreText) === lost.length)
      );
      L.record(
        `${TREE}.b.${PATH}.${N}.words`,
        'no listed word is cut at 40 characters without saying so',
        'no truncated words',
        wordCut.map((r) => `${r.word.length}->${r.cardWord.length}`),
        wordCut.length === 0
      );
      L.record(
        `${TREE}.b.${PATH}.${N}.lines`,
        'a listed reading names every line it applies to (no silent cut at 4)',
        'no line list cut',
        linesCut.map((r) => `${JSON.stringify(r.n)} -> ${JSON.stringify(r.cardN)}`),
        linesCut.length === 0
      );
      if (N === SIZES[SIZES.length - 1])
        await page.evaluate(() => {
          LY_ACTIONS['ly-tab']('review');
        });
      await page.screenshot({ path: L.path.join(L.OUT, `b_${TREE}_${PATH}_${N}.png`) });
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `b_${TREE}_${PATH}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
