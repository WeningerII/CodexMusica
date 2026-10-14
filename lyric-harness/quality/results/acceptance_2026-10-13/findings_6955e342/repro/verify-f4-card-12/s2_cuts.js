// S2: the 40-character word cut and the 4-line cut, and the worst-case
// capacity (long words, readings on lines sung 4+ times).
// Usage: node s2_cuts.js <tree> <txt|lib>
'use strict';
const H = require('./h');
const G = require('./gen');
const tree = process.argv[2];
const route = process.argv[3] || 'txt';
const LONG1 = 'Pneumonoultramicroscopicsilicovolcanoconiosis-of-the-heart'; // 58 chars, one v2 word (single hyphens)
const LONG2 = 'Pneumonoultramicroscopicsilicovolcanoconiosis-of-the-soul'; // same first 40 chars as LONG1
const CHORUS = 'Oh--oh, oh my chorus line';
function songA() {
  const sung = [];
  const add = (l) => sung.push(l);
  const ch = [];
  for (let k = 0; k < 6; k++) ch.push(add(CHORUS)); // sung 6 times
  const l1 = add(`Oh--oh, oh my ${LONG1}`);
  const l2 = add(`Oh--oh, oh my ${LONG2}`);
  const rows = [
    '[SETUP — title — "Cuts"]',
    `[SETUP — reading — token 2 "oh" in ${G.Q(CHORUS)} — OW1 — declared — source: me]`,
    `[SETUP — reading — token 4 ${G.Q(LONG1)} in ${G.Q(`Oh--oh, oh my ${LONG1}`)} — HH AA1 R T — declared — source: me]`,
    `[SETUP — rhyme groups — ${l1}.T4,${l2}.T4]`,
    '',
    '[VERSE]',
    ...sung,
  ];
  const truth = [
    { kind: 'reading', word: 'oh', n: ch, from: 2, to: 3 },
    { kind: 'reading', word: LONG1, n: [l1], from: 4, to: 5 },
    { kind: 'rhyme groups', word: LONG1, n: [l1], from: 4, to: 5 },
    { kind: 'rhyme groups', word: LONG2, n: [l2], from: 4, to: 5 },
  ];
  return { text: rows.join('\n'), truth };
}
// Worst case for capacity: K readings, each a 41+-char word on a line sung 4 times.
function songW(K) {
  const sung = [];
  const rows = ['[SETUP — title — "Worst"]'];
  const truth = [];
  for (let k = 0; k < K; k++) {
    const w = 'Supercalifragilisticexpialidocious-and-more-' + G.az(k + 676); // 47 chars
    const line = `Oh--oh, oh my ${w}`;
    const ns = [];
    for (let r = 0; r < 4; r++) ns.push(sung.push(line));
    rows.push(`[SETUP — reading — token 4 ${G.Q(w)} in ${G.Q(line)} — S UW1 — declared — source: me]`);
    truth.push({ kind: 'reading', word: w, n: ns, from: 4, to: 5 });
  }
  return { text: [...rows, '', '[VERSE]', ...sung].join('\n'), truth };
}
async function load(page, name, text, title) {
  if (route === 'lib') return H.importLibrary(page, text, title, H.path.join(H.OUT, `s2_${tree}_${name}_wc.json`));
  return H.importTxt(page, `${name}.txt`, text);
}
(async () => {
  const env = await H.boot(tree);
  const errs = [];
  const out = { tree, route };
  try {
    // A
    let ctx = await H.context(env);
    let page = await H.openPage(ctx, env, errs);
    const A = songA();
    H.fs.writeFileSync(H.path.join(H.OUT, 's2_songA.txt'), A.text);
    await load(page, 'cutsA', A.text, 'Cuts');
    const after = await H.draft(page);
    const st = await H.cardState(page);
    const t = await H.toasts(page);
    // The page's own view of where the chorus reading applies (all its lines).
    const pageLines = await page.evaluate((c) => lyParse(document.getElementById('lyrics-draft').value).sung.filter((x) => x.text === c).map((x) => x.n), CHORUS);
    out.A = { afterRows: after.split('\n').slice(0, 5), stored: st.stored, title: st.title, cardText: st.text, toasts: t, pageLinesOfChorus: pageLines };
    const items = st.stored ? st.stored.items : [];
    const chorus = items.find((m) => m.kind === 'reading' && m.word === 'oh');
    H.rec('s2.fourLines', 'a reading on a line sung 6 times: lines the card names', 'all 6 lines [1..6]', { stored: chorus && chorus.n, pageSays: (st.text || '').match(/the reading for “oh”[^;]*/)?.[0] }, chorus && chorus.n.length === 6 ? 'PASS' : 'FAIL');
    const longs = items.filter((m) => m.word.startsWith('Pneumono'));
    H.rec('s2.fortyChars', 'words over 40 characters: what the card names', 'full words ' + LONG1.length + '/' + LONG2.length + ' chars', longs.map((m) => ({ kind: m.kind, word: m.word, len: m.word.length, n: m.n, from: m.from, to: m.to })), longs.every((m) => m.word === LONG1 || m.word === LONG2) ? 'PASS' : 'FAIL');
    H.rec('s2.fortyChars.distinct', 'two different long words that share their first 40 characters: can the card text tell them apart by word?', 'distinct words', longs.map((m) => m.word), new Set(longs.map((m) => m.word)).size === longs.length ? 'PASS' : 'FAIL');
    H.rec('s2.fortyChars.ellipsis', 'is the cut word marked as cut in the rendered card?', 'an ellipsis or a note', (st.text || '').match(/“Pneumono[^”]*”/g), /“Pneumono[^”]*(…|\.\.\.)”/.test(st.text || '') ? 'PASS' : 'FAIL');
    H.rec('s2.allEntries', 'every moved entry has an item (kind, from, to, first line)', '4 items', items.length, items.length === 4 ? 'PASS' : 'FAIL');
    await ctx.close();
    // Worst-case capacity
    out.W = [];
    for (const K of [20, 30, 31, 32, 35, 40]) {
      ctx = await H.context(env);
      page = await H.openPage(ctx, env, errs);
      const W = songW(K);
      await load(page, 'worst' + K, W.text, 'Worst');
      const s = await H.cardState(page);
      const its = s.stored ? s.stored.items : [];
      out.W.push({ K, listed: its.length, more: s.stored ? s.stored.more : null, sampleItem: its[0], storedLen: JSON.stringify(s.stored || {}).length });
      console.log(JSON.stringify(out.W[out.W.length - 1]));
      await ctx.close();
    }
  } finally {
    await env.close();
  }
  out.errs = errs;
  out.log = H.log;
  H.fs.writeFileSync(H.path.join(H.OUT, `s2_${tree}_${route}.json`), JSON.stringify(out, null, 1));
  console.log('page errors:', errs.length, errs.slice(0, 3));
})();
