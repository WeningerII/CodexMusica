// BB8 f6-bytes-returns: what the Lyrics page does to [SETUP — returns|rhyme groups — ...]
// rows (bytes, marks, member spelling) and what it puts on the wire to /chat,
// through load, reload, send, Keep, section reorder, the Repeats / Rhymes /
// "Declare exact repeat" forms, export/import, voices toggle and a hand-pasted
// unmarked row. /chat and every mcp.codexmusica.com request are stubbed in-page;
// no provider is reached. Scratch only; reads the tree, writes only under OUT.
//
//   node drive.js <label> <treeRoot> <out.json> [scenarioIdRegex]
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const [, , LABEL, ROOT, OUTJSON, FILTER] = process.argv;
const OUT = path.dirname(path.resolve(OUTJSON));
const DL = path.join(OUT, 'dl', LABEL);
fs.mkdirSync(DL, { recursive: true });
const { chromium } = require('/home/user/CodexMusica/node_modules/playwright');
const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios.json'), 'utf8'));
const SONG = SPEC.song.join('\n');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain', '.woff2': 'font/woff2' };
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
const docOf = (sc) =>
  [
    ...(sc.voices ? ['[SETUP — voices — parentheses are sung]'] : []),
    ...(sc.R != null ? [`[SETUP — returns — ${sc.R}]`] : []),
    ...(sc.G != null ? [`[SETUP — rhyme groups — ${sc.G}]`] : []),
    '',
    SONG,
  ].join('\n');
const sessionOf = (lyrics) => ({ version: 1, name: 'bb8', cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: { tab: 'tools', tool: 'repeats-voices', outline: true } } });

let browser, base;
async function open(lyrics) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      calls.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'stub', history: [] }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/robots.txt`).catch(() => {});
  await page.evaluate((s) => localStorage.setItem('codex-workbench-v1', s), JSON.stringify(sessionOf(lyrics)));
  await page.goto(`${base}/codex.html#lyrics`);
  await ready(page);
  return { ctx, page, calls, errors };
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model && !!document.getElementById('lyrics-draft'), null, { timeout: 90000 });
  await page.waitForTimeout(400);
}
const SNAP = () => {
  lyRefresh(true);
  const isRow = (r) => /^\s*\[SETUP/.test(r);
  const text = $ui('lyrics-draft').value;
  let stored = '';
  try {
    stored = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '';
  } catch (e) {
    stored = 'ERR ' + e;
  }
  return {
    rows: text.split('\n').filter(isRow),
    stored_rows: stored.split('\n').filter(isRow),
    song: text.split('\n').filter((r) => !isRow(r)).join('\n'),
    items: (LY.items || []).filter((i) => /carried|renumbered|returns|rhyme|undecided|cut/i.test(`${i.id} ${i.title}`)).map((i) => `${i.tone} | ${i.id} | ${i.title}`),
    history: Array.isArray(app.history) ? app.history.length : null,
  };
};
async function snap(o, tag, log) {
  await o.page.waitForTimeout(150);
  const s = await o.page.evaluate(SNAP);
  log.push({ step: tag, ...s });
  return s;
}
async function send(o, tag, log) {
  const n = o.calls.length;
  const err = await o.page.evaluate(async () => {
    try {
      // The stubbed /chat leaves no continuation; reset the conversation only
      // (never the draft) so each send is a fresh request.
      if (typeof _chatReset === 'function') _chatReset();
      await LY_ACTIONS['ly-run-review']();
      return null;
    } catch (e) {
      return String(e);
    }
  });
  await o.page.waitForTimeout(500);
  await o.page.waitForFunction(() => typeof chatState === 'undefined' || !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  const sent = o.calls.slice(n).map((c) => c.lyric_context?.declarations ?? null);
  const toast = await o.page.evaluate(() => [...document.querySelectorAll('.toast, .cm-toast, [role="status"]')].map((t) => t.textContent.trim()).filter(Boolean).slice(-2));
  const after = await o.page.evaluate(SNAP);
  log.push({ step: `${tag}:send`, sent, sent_count: sent.length, err, toast, rows_after_send: after.rows });
  return sent;
}
async function keepAll(o, log) {
  const kept = [];
  for (let k = 0; k < 12; k++) {
    const id = await o.page.evaluate(() => {
      lyRefresh(true);
      const it = (LY.items || []).find((i) => (i.actions || []).some((a) => a[0] === 'ly-carried-keep'));
      return it ? it.actions.find((a) => a[0] === 'ly-carried-keep')[3] : null;
    });
    if (!id) break;
    kept.push(id);
    await o.page.evaluate((x) => LY_ACTIONS['ly-carried-keep'](x), id);
    await o.page.waitForTimeout(150);
  }
  log.push({ step: 'keep_actions', kept });
}
async function reload(o) {
  await o.page.waitForTimeout(300);
  await o.page.reload();
  await ready(o.page);
}
async function placedAdd(page, members) {
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
  await page.waitForTimeout(250);
}
async function linkAdd(page, members) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
  for (const [line, place] of members) {
    await page.selectOption('#ly-link-place', place);
    await page.selectOption('#ly-link-line', String(line));
    await page.click('[data-ui="ly-link-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="rhymes"]');
  await page.waitForTimeout(250);
}
async function download(page, fn, file) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.evaluate(fn)]);
  await dl.saveAs(file);
  return file;
}
async function importInto(file, inputId, log, tag) {
  const o = await open('');
  await o.page.setInputFiles(`#${inputId}`, file);
  await o.page.waitForFunction(() => /\[SETUP/.test($ui('lyrics-draft').value), null, { timeout: 30000 }).catch(() => {});
  await o.page.waitForTimeout(400);
  await snap(o, tag, log);
  await send(o, tag, log);
  log.push({ step: `${tag}:errors`, errors: o.errors });
  await o.ctx.close();
}

async function scenario(sc) {
  const doc = docOf(sc);
  const res = { id: sc.id, written: { R: sc.R, G: sc.G, voices: sc.voices }, doc, flows: {} };
  // A: load -> send -> reload -> send -> Keep every carried member -> send -> reload -> send
  {
    const log = [];
    const o = await open(doc);
    await snap(o, 'load', log);
    await send(o, 'load', log);
    await reload(o);
    await snap(o, 'reload', log);
    await send(o, 'reload', log);
    await keepAll(o, log);
    await snap(o, 'keep', log);
    await send(o, 'keep', log);
    await reload(o);
    await snap(o, 'keep_reload', log);
    await send(o, 'keep_reload', log);
    // export what the page now holds (after Keep), for the round trip
    try {
      await download(o.page, () => uiExport(), path.join(DL, `${sc.id}_after_keep.session.json`));
      await download(o.page, () => LY_ACTIONS['ly-download'](), path.join(DL, `${sc.id}_after_keep.txt`));
    } catch (e) {
      log.push({ step: 'export_error', e: String(e) });
    }
    log.push({ step: 'errors', errors: o.errors });
    res.flows.A = log;
    await o.ctx.close();
  }
  // R: section reorder down, then back
  {
    const log = [];
    const o = await open(doc);
    await snap(o, 'load', log);
    await o.page.evaluate(() => LY_ACTIONS['ly-sec-move']('0:1'));
    await snap(o, 'reorder1', log);
    await send(o, 'reorder1', log);
    await o.page.evaluate(() => LY_ACTIONS['ly-sec-move']('0:1'));
    await snap(o, 'reorder2', log);
    await send(o, 'reorder2', log);
    await reload(o);
    await snap(o, 'reorder2_reload', log);
    log.push({ step: 'errors', errors: o.errors });
    res.flows.R = log;
    await o.ctx.close();
  }
  // FP: Repeats form, placed return 2.head + 3.head
  for (const [flow, act] of [
    ['FP', (p) => placedAdd(p, [[2, 'head'], [3, 'head']])],
    ['FR', (p) => linkAdd(p, [[2, 'end'], [3, 'end']])],
    ['FD', (p) => p.evaluate(() => LY_ACTIONS['ly-declare-repeat']('0:1'))],
  ]) {
    const log = [];
    const o = await open(doc);
    await snap(o, 'load', log);
    try {
      await act(o.page);
    } catch (e) {
      log.push({ step: 'form_error', e: String(e).slice(0, 300) });
    }
    await snap(o, 'form', log);
    await send(o, 'form', log);
    await reload(o);
    await snap(o, 'form_reload', log);
    log.push({ step: 'errors', errors: o.errors });
    res.flows[flow] = log;
    await o.ctx.close();
  }
  // X: export after load, then imports into a blank page
  {
    const log = [];
    const o = await open(doc);
    await snap(o, 'load', log);
    let sj, st;
    try {
      sj = await download(o.page, () => uiExport(), path.join(DL, `${sc.id}_load.session.json`));
      st = await download(o.page, () => LY_ACTIONS['ly-download'](), path.join(DL, `${sc.id}_load.txt`));
      log.push({ step: 'exported', session_rows: JSON.parse(fs.readFileSync(sj, 'utf8')).lyrics.split('\n').filter((r) => /^\s*\[SETUP/.test(r)), txt_rows: fs.readFileSync(st, 'utf8').split('\n').filter((r) => /^\s*\[SETUP/.test(r)) });
    } catch (e) {
      log.push({ step: 'export_error', e: String(e) });
    }
    log.push({ step: 'errors', errors: o.errors });
    await o.ctx.close();
    const legacyTxt = path.join(DL, `${sc.id}_original.txt`);
    fs.writeFileSync(legacyTxt, doc);
    const legacyJson = path.join(DL, `${sc.id}_original.session.json`);
    fs.writeFileSync(legacyJson, JSON.stringify({ version: 3, ...sessionOf(doc) }, null, 2));
    if (sj) await importInto(sj, 'ui-file', log, 'import_exported_session');
    if (st) await importInto(st, 'ly-file', log, 'import_exported_txt');
    await importInto(legacyTxt, 'ly-file', log, 'import_original_txt');
    await importInto(legacyJson, 'ui-file', log, 'import_original_session');
    res.flows.X = log;
  }
  return res;
}

async function extras() {
  const out = {};
  // V: voices off -> on via the Repeats & voices form, on U11's rows.
  {
    const sc = SPEC.scenarios.find((s) => s.id === 'U11');
    const log = [];
    const o = await open(docOf(sc));
    await snap(o, 'load', log);
    await o.page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
    await o.page.evaluate(() => LY_ACTIONS['ly-voices']('sung'));
    await o.page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]').catch((e) => log.push({ step: 'click_error', e: String(e).slice(0, 200) }));
    await o.page.waitForTimeout(250);
    await snap(o, 'voices_on', log);
    await send(o, 'voices_on', log);
    await reload(o);
    await snap(o, 'voices_on_reload', log);
    log.push({ step: 'errors', errors: o.errors });
    out.V_U11 = log;
    await o.ctx.close();
  }
  // P: an unmarked row pasted (typed) after load, then a form; P2: then a send.
  for (const [id, row, form] of [
    ['P_groups_form', '[SETUP — rhyme groups — 1.T4,8.T4]', (p) => linkAdd(p, [[5, 'end'], [6, 'end']])],
    ['P_returns_form', '[SETUP — returns — 5.end,6.end;1.T4,8.T4]', (p) => placedAdd(p, [[2, 'head'], [3, 'head']])],
    ['P_groups_send', '[SETUP — rhyme groups — 1.T4,8.T4]', null],
    ['P_returns_send', '[SETUP — returns — 5.end,6.end;1.T4,8.T4]', null],
    ['P_returns_reorder', '[SETUP — returns — 5.end,6.end;1.T4,8.T4]', (p) => p.evaluate(() => LY_ACTIONS['ly-sec-move']('0:1'))],
    ['P_returns_declare', '[SETUP — returns — 1.T4,8.T4]', (p) => p.evaluate(() => LY_ACTIONS['ly-declare-repeat']('0:1'))],
  ]) {
    const log = [];
    const o = await open(SONG);
    await snap(o, 'load', log);
    await o.page.focus('#lyrics-draft');
    await o.page.evaluate(() => $ui('lyrics-draft').setSelectionRange(0, 0));
    await o.page.keyboard.insertText(`${row}\n\n`);
    await o.page.waitForTimeout(600);
    await snap(o, 'pasted', log);
    if (form) {
      await o.page.evaluate(() => document.activeElement?.blur?.());
      try {
        await form(o.page);
      } catch (e) {
        log.push({ step: 'form_error', e: String(e).slice(0, 300) });
      }
      await snap(o, 'form', log);
    }
    await send(o, form ? 'form' : 'pasted', log);
    log.push({ step: 'errors', errors: o.errors });
    out[id] = log;
    await o.ctx.close();
  }
  return out;
}

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const server = serve(path.resolve(ROOT));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const result = { tree: LABEL, root: ROOT, scenarios: [], extras: null };
  const re = FILTER ? new RegExp(FILTER) : null;
  for (const sc of SPEC.scenarios) {
    if (re && !re.test(sc.id)) continue;
    const t0 = Date.now();
    try {
      result.scenarios.push(await scenario(sc));
    } catch (e) {
      result.scenarios.push({ id: sc.id, error: String(e.stack || e).slice(0, 1000) });
    }
    console.log(`[${LABEL}] ${sc.id} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    fs.writeFileSync(OUTJSON, JSON.stringify(result, null, 1));
  }
  if (!re || re.test('EXTRAS')) {
    try {
      result.extras = await extras();
    } catch (e) {
      result.extras = { error: String(e.stack || e).slice(0, 1000) };
    }
    console.log(`[${LABEL}] extras done`);
  }
  fs.writeFileSync(OUTJSON, JSON.stringify(result, null, 1));
  server.close();
  await browser.close();
})();
