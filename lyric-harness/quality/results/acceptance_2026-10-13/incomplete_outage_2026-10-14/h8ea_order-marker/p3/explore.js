// p3 exploration (display only): the earlier and current cuts of the body lines, and what the
// page's own lyMigrateSavedReadings does to candidate rows. Usage: node explore.js <tree>
'use strict';
const C = require('../p2/com.js');
const TREE = process.argv[2] || 'cand';
const LINES = ['Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'Love above', 'And love above', 'Go slow', "We're sailing on", 'Rock-and-roll all night'];
const ROWS = [
  '[SETUP — rhyme groups — 1.T4,8; 2,3]',
  '[SETUP — rhyme groups — 1.T4,8; 1.head (carried across the word-cut change),4.head]',
  '[SETUP — rhyme groups — 1.T4,8; 1,4]',
  '[SETUP — returns — 1.T4,8.T1; 1,13]',
  '[SETUP — returns — 1.T4,8.T1; 9 (carried across the word-cut change),11]',
  '[SETUP — rhyme groups — 1.T4,8; 4.T1,5]',
  '[SETUP — rhyme groups — 1.T4,8; 2.T9 (numbered under the earlier cut),3]',
];
(async () => {
  const { server, base } = await C.startServer(TREE);
  const browser = await C.launch();
  const { page } = await C.boot(browser, base);
  const cuts = await page.evaluate((L) => L.map((t) => {
    const c = typeof lyLineCuts === 'function' ? lyLineCuts(t, false) : null;
    return { t, old: c && c.old && c.old.map((s) => s.text), cur: c && c.cur.map((s) => s.text || s), changed: typeof lyLineCutChanged === 'function' ? lyLineCutChanged(t, false) : null };
  }), LINES);
  console.log(JSON.stringify(cuts, null, 1));
  const BODY = ['[VERSE]', ...['Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'I hear the sound', 'The night is cold', 'Love above'], '', '[BRIDGE]', 'Go slow', 'Hold on', '', '[BRIDGE]', 'Go slow', 'Hold on', '', '[OUTRO]', 'Oh--oh, oh my love'].join('\n');
  for (const r of ROWS) {
    const got = await page.evaluate(([r, b]) => { const d = lyMigrateSavedReadings(`${r}\n\n${b}`); return { row: d.text.split('\n')[0], moved: d.moved, carried: d.carried, blocked: d.blocked }; }, [r, BODY]);
    console.log(r, '\n   ->', JSON.stringify(got));
  }
  await browser.close(); server.close();
})().catch((e) => (console.error(e), process.exit(1)));
