// Candidate-page drivers for the page-rules run. Scratch only.
'use strict';
const L = require('./lib.js');

const C = '(carried across the word-cut change)';
const U = '(numbered under the earlier cut)';

async function boot(browser, base, { session = null } = {}) {
  const q = { replies: [], calls: [] };
  const ctx = await L.newCtx(browser, q);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (session !== null) {
    // The pre-batch user's saved session, in this origin's storage, before
    // the candidate page first loads.
    await page.goto(`${base}/robots.txt`);
    await page.evaluate((s) => localStorage.setItem('codex-workbench-v1', s), session);
  }
  await page.goto(`${base}/codex.html#lyrics`);
  await L.waitReady(page);
  await page.waitForTimeout(400);
  return { ctx, page, q, errors };
}
// Everything the checks read, from the page's own functions and storage.
const snap = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    LY_ACTIONS['ly-tab']('review');
    const text = $ui('lyrics-draft').value;
    const m = lyParse(text);
    const d = lyDeclarationsOf(m);
    const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
    return {
      text,
      rows: text.split('\n').filter((r) => /^\[SETUP/.test(r)),
      decl: pick(d, ['groups', 'returns', 'groups_need_decision', 'returns_need_decision', 'readings_need_decision', 'pronunciations']),
      items: (LY.items || [])
        .filter((i) => /carried|undecided|unknown-cut|^reading:|^rhyme groups|^returns/.test(i.id))
        .map((i) => ({ id: i.id, tone: i.tone, title: i.title, where: i.where, text: i.text, actions: (i.actions || []).map((a) => [a[0], a[1], String(a[3])]) })),
      review: $ui('ly-panel-review').innerText,
      saved: JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '',
      histLen: app.history.length,
      histIdx: app.historyIndex,
    };
  });
const carriedIds = (s) => s.items.filter((i) => /:carried:/.test(i.id));
// Run review through the page; what reached the stubbed /chat.
async function runReview(page, q) {
  const n = q.calls.length;
  q.replies.push({ reply: 'Noted.', history: [], sig: 'x' });
  const r = await page.evaluate(async () => {
    try {
      return { ret: await LY_ACTIONS['ly-run-review']() };
    } catch (e) {
      return { err: String(e) };
    }
  });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
  const calls = q.calls.slice(n);
  q.replies.length = 0;
  return { ret: r, calls: calls.map((c) => c.lyric_context?.declarations || null), toasts: await L.toasts(page) };
}
async function typedSend(page, q) {
  const n = q.calls.length;
  q.replies.push({ reply: 'Noted.', history: [], sig: 'x' });
  const r = await page.evaluate(async () => {
    const out = await _chatSend('Tighten line 2', { choice: 'lyrics-edit' });
    return { out: out && typeof out === 'object' ? { reason: out.reason, ok: out.ok } : out, log: ($ui('chat-log')?.innerText || '').slice(-600) };
  });
  await page.waitForTimeout(400);
  q.replies.length = 0;
  return { ...r, reached: q.calls.length - n };
}
async function moveSection(page, k, d) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('form-story'));
  await page.click(`[data-ui="ly-sec-move"][data-id="${k}:${d}"]`);
  await page.waitForTimeout(200);
}
async function addLinkUI(page, members) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
  for (const [line, place] of members) {
    await page.selectOption('#ly-link-line', String(line));
    await page.selectOption('#ly-link-place', place);
    await page.click('[data-ui="ly-link-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="rhymes"]');
  await page.waitForTimeout(200);
}
async function addPlacedUI(page, members) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
  for (const [line, place] of members) {
    await page.evaluate((n) => {
      LY.activeLine = n;
      lyRefresh(true);
    }, line);
    await page.evaluate(() => {
      const d = $ui('ly-placed-place')?.closest('details');
      if (d && !d.open) d.open = true;
    });
    await page.selectOption('#ly-placed-place', place);
    await page.click('[data-ui="ly-placed-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
  await page.waitForTimeout(200);
}
const undo = (page) => page.evaluate(() => { $ui('btn-undo').click(); lyRefresh(true); });
const redo = (page) => page.evaluate(() => { $ui('btn-redo').click(); lyRefresh(true); });
async function reload(page) {
  await page.reload();
  await L.waitReady(page);
  await page.waitForTimeout(400);
}
async function downloadText(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.evaluate(() => LY_ACTIONS['ly-download']())]);
  const p = await dl.path();
  return { name: dl.suggestedFilename(), body: L.fs.readFileSync(p, 'utf8') };
}
async function importFile(page, name, body, mimeType = 'text/plain') {
  await page.setInputFiles('#ly-file', { name, mimeType, buffer: Buffer.from(body, 'utf8') });
  await page.waitForTimeout(800);
  await page.evaluate(() => lyRefresh(true));
}
module.exports = { L, C, U, boot, snap, carriedIds, runReview, typedSend, moveSection, addLinkUI, addPlacedUI, undo, redo, reload, downloadText, importFile };
