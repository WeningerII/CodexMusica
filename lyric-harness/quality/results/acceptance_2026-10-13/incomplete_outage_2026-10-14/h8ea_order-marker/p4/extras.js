// p4 (BB8 order-marker at 8ea94ac9): the typing refresh never migrates, and the renumbering
// record / Review card through APP history (the page's Undo/Redo) vs BROWSER-NATIVE undo
// (Ctrl+Z with the caret in the textarea), after a form commit that applied the policy.
// Row RG4 = '[SETUP — rhyme groups — 1.T4,8; 2,3]'. Helpers from p2/com.js (check-order-marker).
// Usage: node extras.js <cand|c0af|c695|c61b|main> [filter]
'use strict';
const C = require('../p2/com.js');
const TREE = process.argv[2] || 'cand';
const FILTER = process.argv[3] || '';
const OUT = C.path.join(C.S, 'h8ea/order-marker/p4');
const BODY = ['[VERSE]', 'Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'I hear the sound', 'The night is cold', 'Love above', '', '[BRIDGE]', 'Go slow', 'Hold on', '', '[BRIDGE]', 'Go slow', 'Hold on'].join('\n');
const ROW = '[SETUP — rhyme groups — 1.T4,8; 2,3]';
const setupRows = (t) => t.split('\n').filter((l) => /^\s*\[SETUP/.test(l));
const marker = (rows) => rows.map((r) => (/—\s*cut\s+\S+\s*\]\s*$/.test(r) ? r.match(/cut\s+\S+?(?=\s*\]\s*$)/)[0] : 'UNMARKED'));
async function state(page) {
  return page.evaluate(() => {
    const meta = app.lyricMeta || {};
    const rec = meta.renumbered || (meta.ui && meta.ui.renumbered) || null;
    let card = null;
    try {
      const c = typeof lyRenumberedCheck === 'function' ? lyRenumberedCheck() : null;
      card = c ? c.title : null;
    } catch (e) {
      card = 'ERR ' + e;
    }
    return { record: rec ? JSON.parse(JSON.stringify(rec)) : null, card, histIdx: app.historyIndex, histN: app.history.length, histRows: app.history.map((h) => { const x = JSON.parse(h); return (x.lyrics || '').split('\n').filter((l) => /^\s*\[SETUP/.test(l)).join(' | '); }) };
  });
}
async function removeB(page) {
  await C.openTool(page, 'rhymes');
  await page.locator('input[name="ly-link-group"][value="1"]').check();
  await page.waitForTimeout(200);
  await page.locator('[data-ui="ly-link-remove"]').click();
  await page.waitForTimeout(400);
}
async function review(page, q) {
  const n = q.calls.length;
  await page.locator('.ly-run').first().click();
  await C.idle(page);
  const out = [];
  for (const c of q.calls.slice(n)) {
    const ctx = c.lyric_context || null;
    out.push({ declarations: ctx ? ctx.declarations : null, sung: ctx && ctx.document ? await page.evaluate((d) => lyParse(d).sung.map((s) => s.text), ctx.document) : null });
  }
  return out;
}
const SC = {
  async T1_typing_never_migrates(page, q, log) {
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
    await page.keyboard.type(ROW, { delay: 15 });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await log('typed row (keyboard.type, 15 ms/char) + Enter Enter');
    await page.waitForTimeout(1500);
    await log('+1.5 s idle (typing refresh 120 ms)');
    // edit INSIDE the row: caret after '2,3', type ',5', then Backspace twice
    await page.evaluate(() => { const d = $ui('lyrics-draft'); const k = d.value.indexOf('2,3') + 3; d.focus(); d.setSelectionRange(k, k); });
    await page.keyboard.type(',5', { delay: 30 });
    await page.waitForTimeout(800);
    await log('typed ",5" inside the row');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(800);
    await log('Backspace x2 inside the row');
    await C.openTool(page, 'rhymes');
    await log('opened Rhymes tool (display)');
    await C.openTool(page, 'repeats-voices');
    await log('opened Repeats tool (display)');
    await page.locator('[data-ui="ly-tab"][data-id="review"]').first().click();
    await page.waitForTimeout(300);
    await log('opened Review tab (display)');
    return review(page, q);
  },
  async U1_appUndo_toast_then_appRedo(page, q, log) {
    await C.insertAtTop(page, `${ROW}\n\n`, 'paste');
    await log('pasted (real Ctrl+V)');
    await removeB(page);
    await log('Remove link (form; policy pass)');
    await page.locator('#toast button:has-text("Undo")').first().click();
    await page.waitForTimeout(400);
    await log('APP Undo (the commit toast\'s Undo button)');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(400);
    await log('APP Redo (Ctrl+Shift+Z, focus off the textarea)');
    return review(page, q);
  },
  async U2_appUndo_then_send(page, q, log) {
    await C.insertAtTop(page, `${ROW}\n\n`, 'paste');
    await log('pasted (real Ctrl+V)');
    await removeB(page);
    await log('Remove link (form; policy pass)');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    await log('APP Undo (Ctrl+Z, focus off the textarea)');
    return review(page, q);
  },
  async U3_nativeUndo_in_textarea(page, q, log) {
    await C.insertAtTop(page, `${ROW}\n\n`, 'paste');
    await log('pasted (real Ctrl+V)');
    await removeB(page);
    await log('Remove link (form; policy pass)');
    await page.locator('#lyrics-draft').click();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await log('BROWSER-NATIVE Ctrl+Z #1 (caret in textarea)');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await log('BROWSER-NATIVE Ctrl+Z #2 (caret in textarea)');
    return review(page, q);
  },
};
(async () => {
  const { server, base } = await C.startServer(TREE);
  const browser = await C.launch();
  const out = [];
  try {
    for (const [id, fn] of Object.entries(SC)) {
      if (FILTER && !id.includes(FILTER)) continue;
      const { ctx, page, q, errors } = await C.boot(browser, base);
      const steps = [];
      const log = async (label) => {
        const t = await C.draftText(page);
        const rows = setupRows(t);
        steps.push({ step: label, rows, cut: marker(rows), toasts: await C.toasts(page), ...(await state(page)) });
      };
      const r = { id: `${TREE}.${id}`, steps };
      try {
        await C.enterBody(page, BODY);
        await C.toasts(page);
        await log('body entered');
        r.payload = await fn(page, q, log);
        await log('after Run review');
        r.sung = await page.evaluate(() => lyParse($ui('lyrics-draft').value).sung.map((s) => s.text));
      } catch (e) {
        r.threw = String(e.stack || e);
      }
      r.errors = errors;
      out.push(r);
      console.log(`### ${r.id}\n${steps.map((s) => `   ${s.step}: ${s.rows.join(' | ') || '(no SETUP row)'} {${s.cut}} [hist ${s.histIdx}/${s.histN}] record=${JSON.stringify(s.record)} card=${JSON.stringify(s.card)} toasts=${JSON.stringify(s.toasts)}`).join('\n')}\n   payload=${JSON.stringify((r.payload || []).map((p) => p.declarations && { groups: p.declarations.groups, gnd: p.declarations.groups_need_decision }))}${r.threw ? '\n   THREW ' + r.threw.split('\n')[0] : ''} errs=${errors.length}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  C.fs.writeFileSync(C.path.join(OUT, `extras_${TREE}${FILTER ? '_' + FILTER : ''}.json`), JSON.stringify(out, null, 1));
})().catch((e) => (console.error(e), process.exit(1)));
