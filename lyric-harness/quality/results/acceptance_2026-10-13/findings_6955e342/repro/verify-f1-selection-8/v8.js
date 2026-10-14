// verify-f1-selection-8: does a form commit between boundaries stamp an
// unmarked (legacy) T<k> row `— cut v2` without migrating it, so the same row
// binds a different word depending on which action comes first?
// Usage: node v8.js <tree> <methods,comma> <paths,comma>
//   methods: prog (value set + save + history + refresh, as the original test),
//            insert (real keyboard insertText -> input event),
//            paste  (real Ctrl+V from the clipboard -> paste + input events),
//            type   (keyboard.type, one key per character)
//   paths:   A_send, B_remove, C_add, D_returns, E_title, F_reload, G_B_reload, H_dock
'use strict';
const L = require('./lib8.js');
const TREE = process.argv[2] || 'cand';
const METHODS = (process.argv[3] || 'prog').split(',');
const PATHS = (process.argv[4] || 'A_send,B_remove,C_add,D_returns,E_title,F_reload,G_B_reload,H_dock').split(',');
const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
I hold the dove
Run to the sea
Love above`;
const ROW_RHYME = '[SETUP — rhyme groups — 1.T4,8; 2,3]';
const ROW_RET = '[SETUP — returns — 1.T4,4.T5]';
const ROW_SIB = '[SETUP — rhyme groups — 2,3 — cut v2]\n[SETUP — rhyme groups — 1.T4,8]';
const docFor = (p) => `${process.env.ROW || (p === 'D_returns' ? ROW_RET : /^J_/.test(p) ? ROW_SIB : ROW_RHYME)}\n\n${BODY}`;

async function input(page, method, doc) {
  const d = 'textarea[data-ui="lyrics-draft"], [data-ui="lyrics-draft"]';
  if (method === 'prog') {
    await page.evaluate((t) => {
      $ui('lyrics-draft').value = t;
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
    }, doc);
  } else {
    await page.evaluate(() => {
      const el = $ui('lyrics-draft');
      el.focus();
      el.select();
    });
    if (method === 'insert') await page.keyboard.insertText(doc);
    else if (method === 'paste') {
      await page.evaluate((t) => navigator.clipboard.writeText(t), doc);
      await page.keyboard.press('Control+V');
    } else if (method === 'type') {
      await page.keyboard.press('Delete');
      await page.keyboard.type(doc);
    }
  }
  await page.waitForTimeout(500);
  return page.evaluate((t) => ({ equal: $ui('lyrics-draft').value === t, value: $ui('lyrics-draft').value }), doc);
}
async function openTool(page, id) {
  await page.evaluate((i) => {
    LY_ACTIONS['ly-tool'](i);
    lyRefresh(true);
  }, id);
  await page.waitForTimeout(200);
}
async function shown(page) {
  await openTool(page, 'rhymes');
  return page.evaluate(() => [...document.querySelectorAll('.ly-links li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
}
async function shownReturns(page) {
  await openTool(page, 'repeats-voices');
  return page.evaluate(() => {
    const h = [...document.querySelectorAll('h4')].find((x) => /Declared returns/.test(x.textContent));
    const ul = h && h.nextElementSibling;
    return ul && ul.tagName === 'UL' ? [...ul.querySelectorAll('li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()) : [];
  });
}
const view = (page, p) => (p === 'D_returns' ? shownReturns(page) : shown(page));
const renumbered = (page) => page.evaluate(() => (app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered) || null);
// Which word each numbered member names under the page's current cut (and the
// earlier cut where the page has its migration tokenizer).
const bind = (page, groups) =>
  page.evaluate((g) => {
    const m = lyParse($ui('lyrics-draft').value);
    const out = [];
    for (const part of String(g || '').split(/[;,]/)) {
      const x = /^\s*(\d+)\.T(\d+)/.exec(part);
      if (!x) continue;
      const row = m.sung[Number(x[1]) - 1];
      const cur = row ? lyTokens(row.text, m.voices) : [];
      const v1 = row && typeof lyV1MigrationTokens === 'function' ? lyV1MigrationTokens(row.text, m.voices) : null;
      out.push({ member: `${x[1]}.T${x[2]}`, current_cut_word: cur[Number(x[2]) - 1] || null, earlier_cut_word: v1 ? v1[Number(x[2]) - 1] || null : 'n/a (page has one cut)' });
    }
    return out;
  }, groups);
async function send(page, q) {
  const n = q.calls.length;
  const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
  let via = 'click';
  if (await btn.count()) await btn.click();
  else {
    via = 'action';
    await page.evaluate(() => LY_ACTIONS['ly-run-review']());
  }
  await L.idle(page);
  const calls = q.calls.slice(n);
  const lc = calls.map((c) => c.lyric_context || null);
  return { via, n_calls: calls.length, declarations: lc.map((c) => (c ? c.declarations : null)), lyric_context: lc };
}
async function removeOther(page) {
  await openTool(page, 'rhymes');
  await page.check('input[name="ly-link-group"][value="1"]');
  await page.waitForTimeout(150);
  await page.click('[data-ui="ly-link-remove"]');
  await page.waitForTimeout(400);
}
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, head: null, runs: [] };
  try {
    for (const method of METHODS)
      for (const p of PATHS) {
        const { ctx, page, q, errors } = await L.boot(browser, base);
        const r = { method, path: p };
        try {
          const doc = docFor(p);
          r.input = await input(page, method, doc);
          if (!r.input.equal) r.input_note = 'draft value differs from the fixture';
          delete r.input.value;
          r.rows_after_input = await L.setupRows(page);
          r.shown_after_input = await view(page, p);
          r.toasts_after_input = await L.toasts(page);
          if (p === 'B_remove' || p === 'G_B_reload') await removeOther(page);
          else if (p === 'C_add') {
            await openTool(page, 'rhymes');
            for (const n of ['5', '7']) {
              await page.selectOption('#ly-link-line', n);
              await page.waitForTimeout(120);
              await page.selectOption('#ly-link-place', 'end');
              await page.waitForTimeout(80);
              await page.click('[data-ui="ly-link-add"]');
              await page.waitForTimeout(150);
            }
            await page.click('[data-ui="ly-draft-apply"][data-id="rhymes"]');
            await page.waitForTimeout(400);
          } else if (p === 'D_returns') {
            await openTool(page, 'repeats-voices');
            await page.evaluate(() => {
              lyDraftSet('repeats-voices', 'song', 'placed', [{ line: 6, place: 'end' }, { line: 9, place: 'end' }]);
              lyRefresh(true);
            });
            await page.waitForTimeout(200);
            await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
            await page.waitForTimeout(400);
          } else if (p === 'I_gate') {
            // Members picked but not applied; Run review then opens the gate
            // and its "Apply all" commits the pending link and sends.
            await openTool(page, 'rhymes');
            for (const n of ['5', '7']) {
              await page.selectOption('#ly-link-line', n);
              await page.waitForTimeout(120);
              await page.selectOption('#ly-link-place', 'end');
              await page.waitForTimeout(80);
              await page.click('[data-ui="ly-link-add"]');
              await page.waitForTimeout(150);
            }
          } else if (p === 'J_sibling_remove') {
            await openTool(page, 'rhymes');
            await page.check('input[name="ly-link-group"][value="0"]');
            await page.waitForTimeout(150);
            await page.click('[data-ui="ly-link-remove"]');
            await page.waitForTimeout(400);
          } else if (p === 'K_B_undo') {
            await removeOther(page);
            r.rows_after_B = await L.setupRows(page);
            await page.evaluate(() => LY_ACTIONS['ly-undo']());
            await page.waitForTimeout(400);
          } else if (p === 'E_title') {
            await page.evaluate(() => lySetupCommit('title', ['Test title'], 'Title set.'));
            await page.waitForTimeout(400);
          }
          if (p === 'F_reload' || p === 'G_B_reload') {
            r.rows_before_reload = await L.setupRows(page);
            await page.evaluate(() => {
              const el = $ui('lyrics-draft');
              el.blur();
            });
            await page.waitForTimeout(300);
            await page.reload();
            await L.ready(page);
          }
          if (p === 'H_dock') {
            // The conversation's page context for an edit task (what a chat
            // send carries): the window hook the dock calls.
            r.dock_context = await page.evaluate(() => {
              const c = window.uiLyricContext ? window.uiLyricContext('lyrics-edit') : null;
              return c ? { declarations: c.declarations || null, blocked: c.blocked || null } : null;
            });
          }
          r.rows_after_action = await L.setupRows(page);
          r.shown_after_action = await view(page, p);
          r.toasts_after_action = await L.toasts(page);
          r.renumbered_card_after_action = await renumbered(page);
          if (p === 'I_gate') {
            const n0 = q.calls.length;
            await page.locator('[data-ui="ly-run-review"]:visible').first().click();
            await page.waitForTimeout(300);
            r.gate_shown = await page.locator('[data-ui="ly-gate-apply"]:visible').count();
            r.rows_at_gate = await L.setupRows(page);
            if (r.gate_shown) await page.locator('[data-ui="ly-gate-apply"]:visible').first().click();
            await L.idle(page);
            const calls = q.calls.slice(n0);
            const lc = calls.map((c) => c.lyric_context || null);
            r.send = { via: 'run-review + gate apply', n_calls: calls.length, declarations: lc.map((c) => (c ? c.declarations : null)), lyric_context: lc };
          } else r.send = await send(page, q);
          const key = p === 'D_returns' ? 'returns' : 'groups';
          r.sent_member_words = await bind(page, (r.send.declarations[0] || {})[key]);
          r.rows_after_send = await L.setupRows(page);
          r.shown_after_send = await view(page, p);
          r.toasts_after_send = await L.toasts(page);
          r.renumbered_card_after_send = await renumbered(page);
        } catch (x) {
          r.threw = String(x.stack || x).split('\n').slice(0, 4).join(' | ');
        }
        r.errors = errors;
        out.runs.push(r);
        console.log(
          `[${TREE}] ${method}/${p}${r.input_note ? ' (' + r.input_note + ')' : ''}\n` +
            `   after input : ${JSON.stringify(r.rows_after_input)}  list ${JSON.stringify(r.shown_after_input)}\n` +
            (r.rows_before_reload ? `   before reload: ${JSON.stringify(r.rows_before_reload)}\n` : '') +
            (r.rows_after_B ? `   after B     : ${JSON.stringify(r.rows_after_B)}\n` : '') +
            (r.rows_at_gate ? `   at gate     : shown=${r.gate_shown} ${JSON.stringify(r.rows_at_gate)}\n` : '') +
            (r.dock_context ? `   dock context: ${JSON.stringify(r.dock_context)}\n` : '') +
            `   after action: ${JSON.stringify(r.rows_after_action)}  list ${JSON.stringify(r.shown_after_action)}\n` +
            `   sent        : ${JSON.stringify(r.send && r.send.declarations)} via ${r.send && r.send.via} -> ${JSON.stringify(r.sent_member_words)}\n` +
            `   after send  : ${JSON.stringify(r.rows_after_send)}  list ${JSON.stringify(r.shown_after_send)}\n` +
            `   toasts      : input ${JSON.stringify(r.toasts_after_input)} action ${JSON.stringify(r.toasts_after_action)} send ${JSON.stringify(r.toasts_after_send)}\n` +
            `   card        : action ${JSON.stringify(r.renumbered_card_after_action)} send ${JSON.stringify(r.renumbered_card_after_send)}` +
            (r.errors.length ? `\n   page errors : ${JSON.stringify(r.errors)}` : '') +
            (r.threw ? `\n   THREW ${r.threw}` : '')
        );
        await ctx.close();
      }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `v8${process.env.TAG || ""}_${TREE}_${METHODS.join("-")}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
