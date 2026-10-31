#!/usr/bin/env node
/* global document, location, getComputedStyle, requestAnimationFrame, window */ // inside page.evaluate
'use strict';
// The reader's Connections mode (#637 6545739310, contract 6545872516), in
// Chromium on the production route: the real Library page and reader, the
// analysis chunk's one controller and the connection views, against a stubbed
// Library API serving the committed AnalysisSession capture. It checks what
// the mode promises and what it must not break:
//
//   - offered only on the Sound lens; entering widens the rail to the full
//     reading width (the views get more than 600 px on a desktop, r5's two
//     columns), hides the reading text the views draw again, lifts the
//     sheet's inert, keeps every analysis control, moves focus to "Back to
//     reading", says so, and writes conn=1;
//   - Back leaves and Forward re-enters; Esc (outside the views) and the
//     Back to reading button leave; focus returns to the Connections control
//     (at phone width inside the sheet it was entered from, and closing that
//     sheet returns to Inspect); a lens change leaves;
//   - view=source survives a round trip; no horizontal overflow; no page error.
//
// Reuses check_library_page.js's own harness exactly as
// check_connection_acceptance_browser.js does.
//
//   node scripts/check_reader_connections_mode.js [--dark] [--width=1280|390]
const fs = require('fs');
const path = require('path');
const Module = require('module');

const HARNESS = path.join(__dirname, 'check_library_page.js');
const src = fs.readFileSync(HARNESS, 'utf8');
const cut = src.indexOf('\n(async () => {\n  const dir = build();');
if (cut < 0) throw Error('check_library_page.js runner not found: update the harness hook');
const argv = process.argv.slice(2);
const pick = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || '';
process.argv.splice(2, argv.length, ...argv.filter((a) => a !== '--dark' && !/^--width=/.test(a)));
const harness = new Module(HARNESS, module);
harness.filename = HARNESS;
harness.paths = Module._nodeModulePaths(__dirname);
harness._compile(
  src.slice(0, cut) +
    '\nmodule.exports = { build, link, chunksIn, start, openPage, go, settled, check, results,' +
    ' API, EPI_A, EPI_B, failures: () => failures };',
  HARNESS
);
const H = harness.exports;
const DARK = argv.includes('--dark');
const ONLY_WIDTH = Number(pick('width')) || 0;

const crypto = require('crypto');
const FIXTURE = require('./fixtures/connection-backend.json');
const canonical = (v) =>
  v && typeof v === 'object'
    ? Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
          .join(',') +
        '}'
    : JSON.stringify(v);
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');

// The Library API as the analysis chunk reads it: one job, a manifest and its
// pages (tokens and results first, the relation instances on page 2).
async function serve(page, records = FIXTURE.records) {
  const payloads = [
    records.filter((r) => r.kind !== 'relation_instance'),
    records.filter((r) => r.kind === 'relation_instance'),
  ].map((instances) => JSON.stringify({ instances }));
  const hashes = payloads.map(digest);
  const state = { posts: 0, status: 200, job: null, manifest: null, hash: null };
  await page.route(H.API + '/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname.slice('/library/v1'.length);
    const reply = (value, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: typeof value === 'string' ? value : JSON.stringify(value),
      });
    if (p === '/analyses' && req.method() === 'POST') {
      const body = JSON.parse(req.postData());
      state.posts++;
      state.job = {
        id: `acceptance-${state.posts}`,
        state: 'running',
        identity: {
          reading_unit_id: body.reading_unit_id,
          reading_revision: body.reading_revision,
          requested_methods: body.requested_methods || [],
        },
        progress: { completed: 1, total: 2 },
      };
      state.manifest = JSON.stringify({
        job_id: state.job.id,
        identity_hash: digest(canonical(state.job.identity)),
        partial: false,
        page_count: 2,
        evidence_count: records.length,
      });
      state.hash = digest(state.manifest);
      return reply({ job: state.job }, 202);
    }
    const job = state.job;
    if (job && p === `/jobs/${job.id}`)
      return state.status === 200
        ? reply({ job: { ...job, state: 'complete', manifest_hash: state.hash } })
        : reply({ error: { code: state.status === 410 ? 'EXPIRED' : 'NOT_FOUND' } }, state.status);
    if (job && p === `/jobs/${job.id}/manifests/${state.hash}`) return reply(state.manifest);
    if (job && p === `/jobs/${job.id}/manifests/${state.hash}/pages`) {
      const i = Number(url.searchParams.get('offset'));
      return reply({
        manifest_hash: state.hash,
        page_refs: [{ sha256: hashes[i] }],
        next_offset: i === 0 ? 1 : null,
      });
    }
    const i = job ? hashes.findIndex((h) => p === `/jobs/${job.id}/pages/${h}`) : -1;
    if (i >= 0) return reply(payloads[i]);
    return route.fallback();
  });
  return state;
}

const tick = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const state = (page) =>
  page.evaluate(() => {
    const vis = (el) => !!el && el.getClientRects().length > 0;
    const rd = document.querySelector('#surface-library .rd');
    const cv = document.querySelector('.cv-root');
    const lay = document.querySelector('.cv-layout');
    const a = document.activeElement;
    return {
      conn: !!rd?.classList.contains('rd-conn'),
      sheet: !!rd?.classList.contains('rd-sheet'),
      paper: vis(document.querySelector('.rd-paper')),
      host: cv?.parentElement?.clientWidth ?? 0,
      columns: lay ? getComputedStyle(lay).gridTemplateColumns.split(' ').length : 0,
      inert: document.querySelectorAll('[inert]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: [...document.querySelectorAll('.rd-insp [data-act]')]
        .filter(vis)
        .map((b) => b.dataset.act),
      pressed: document.querySelector('[data-rd="conn"]')?.getAttribute('aria-pressed') ?? null,
      source: !!document.querySelector('[data-rd="source"]')?.checked,
      live: document.getElementById('library-live')?.textContent?.trim() || '',
      focus: a && a !== document.body ? a.dataset?.rd || a.dataset?.act || a.tagName : 'BODY',
      hash: location.hash,
    };
  });
// At phone width the lens chips sit in the reader's sheet.
async function reveal(page, sel) {
  if (!(await page.isVisible(sel))) await page.click('#surface-library [data-rd="sheet"]');
  await tick(page);
}
const said = (page, text) =>
  page
    .waitForFunction(
      (t) => document.getElementById('library-live')?.textContent?.trim() === t,
      text,
      {
        timeout: 2000,
      }
    )
    .then(
      () => true,
      () => false
    );
async function open(page, base, query = '') {
  const api = await serve(page);
  await H.go(page, base, `/read/${H.EPI_A}?lens=sound${query}`);
  // A fresh document: the reader reads view=source on a new load, not on a
  // hash change to the reading already open. A real reload, not an
  // about:blank hop (whose opaque origin races the favicon).
  if (query) await page.reload();
  await H.settled(page, 'reader', '#surface-library .rd-paper .rd-line');
  await reveal(page, '[data-act="analyze"]');
  await page.click('[data-act="analyze"]');
  await page.waitForSelector('.cv-root', { timeout: 20000 });
  await tick(page);
  return api;
}
// The analysis mount and the views' own address, to prove the mode moves
// neither: the same analysis root (.la-root), the same connections slot and
// the same bindings mount inside it, no new computation, cv/sel unchanged.
// (.cv-root itself is the views' render output, rebuilt on every redraw,
// including the resize the mode causes, so its identity proves nothing.)
const views = (page) =>
  page.evaluate(() => {
    const q = new URLSearchParams(location.search);
    const m = window.__mount || {};
    const la = document.querySelector('#surface-library .la-root');
    const slot = la?.querySelector('[data-slot="connections"]');
    return {
      same:
        !!slot?.firstElementChild &&
        la === m.la &&
        slot === m.slot &&
        slot.firstElementChild === m.stage,
      cv: q.get('cv') || '',
      sel: q.get('sel') || '',
    };
  });
const firstText = (page) =>
  page.evaluate(() =>
    (
      document.querySelector('#surface-library .rd-paper .rd-line .rd-text')?.textContent || ''
    ).trim()
  );

async function mode({ page, base, tag, width }) {
  const c = (name, ok, detail) => H.check(`${tag} connections mode: ${name}`, ok, detail);
  await open(page, base);
  const wide = width > 899;
  const before = await state(page);
  c(
    'reading text and a narrow rail before entry',
    before.paper && !before.conn,
    JSON.stringify(before)
  );
  await reveal(page, '[data-rd="conn"]');
  c('offered on the Sound lens, not pressed', (await state(page)).pressed === 'false');
  if (!wide) c('entered from the open sheet (inert outside it)', (await state(page)).inert > 0);
  await page.click('[data-rd="conn"]');
  await tick(page);
  const announced = await said(page, 'Connections, full width');
  const on = await state(page);
  c(
    'entering: the mode is on and the reading text is hidden',
    on.conn && !on.paper,
    JSON.stringify(on)
  );
  c('entering: the sheet and its inert are gone', !on.sheet && on.inert === 0, JSON.stringify(on));
  c(
    'entering: focus on Back to reading, and it is said',
    on.focus === 'conn-exit' && announced,
    JSON.stringify(on)
  );
  c('entering: the address carries conn=1', /[?&]conn=1\b/.test(on.hash), on.hash);
  c(
    'entering: Analyze and More stay in reach',
    ['analyze', 'more'].every((a) => on.controls.includes(a)),
    on.controls.join(',')
  );
  c('entering: no horizontal overflow', on.overflow <= 0, String(on.overflow));
  if (wide)
    c(
      'entering: the views get the desktop layout (host > 600 px, two columns)',
      on.host > 600 && on.columns === 2,
      `${on.host} px, ${on.columns} columns`
    );
  else
    c(
      'entering: the views keep the phone layout (host <= 600 px)',
      on.host > 0 && on.host <= 600,
      `${on.host} px`
    );
  await page.goBack();
  await tick(page);
  const back = await state(page);
  c(
    'Back leaves the mode, focus on Connections',
    !back.conn && back.paper && back.focus === 'conn' && !/conn=1/.test(back.hash),
    JSON.stringify(back)
  );
  await page.goForward();
  await tick(page);
  const fwd = await state(page);
  c('Forward re-enters the mode', fwd.conn && fwd.focus === 'conn-exit', JSON.stringify(fwd));
  await page.focus('[data-rd="conn-exit"]');
  await page.keyboard.press('Escape');
  await tick(page);
  const esc = await state(page);
  c(
    'Esc on Back to reading leaves the mode, focus on Connections',
    !esc.conn && esc.focus === 'conn',
    JSON.stringify(esc)
  );
  await reveal(page, '[data-rd="conn"]');
  await page.click('[data-rd="conn"]');
  await tick(page);
  await page.click('[data-rd="conn-exit"]');
  await tick(page);
  const out = await state(page);
  c(
    'Back to reading leaves the mode, focus on Connections',
    !out.conn && out.focus === 'conn',
    JSON.stringify(out)
  );
  if (!wide) {
    c('at phone width it returns to the sheet it was entered from', out.sheet, JSON.stringify(out));
    await page.keyboard.press('Escape');
    await tick(page);
    const shut = await state(page);
    c(
      'closing that sheet returns focus to Inspect',
      !shut.sheet && shut.focus === 'sheet',
      JSON.stringify(shut)
    );
  }
  await reveal(page, '[data-rd="conn"]');
  await page.click('[data-rd="conn"]');
  await tick(page);
  await page.click('[data-rd="lens"][data-id="summary"]');
  await tick(page);
  const lens = await state(page);
  c(
    'a lens change leaves the mode',
    !lens.conn && lens.paper && !/conn=1/.test(lens.hash),
    JSON.stringify(lens)
  );
  // The mode keeps the one analysis and the views' own selection.
  const api = await open(page, base);
  await reveal(page, '[data-act="more"]');
  await page.click('[data-act="more"]');
  await page.waitForFunction(() =>
    document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
  );
  if (await page.isVisible('#surface-library [data-rd="sheet"][aria-expanded="true"]'))
    await page.keyboard.press('Escape');
  await page.click('.cv-native button >> nth=0');
  if (await page.isVisible('.lib-cb-sheet-body')) await page.keyboard.press('Escape');
  await tick(page);
  await page.evaluate(() => {
    const la = document.querySelector('#surface-library .la-root');
    const slot = la?.querySelector('[data-slot="connections"]');
    window.__mount = { la, slot, stage: slot?.firstElementChild };
  });
  const picked = await views(page);
  const posts = api.posts;
  c('a views selection is in the address before entry', !!picked.sel, JSON.stringify(picked));
  await reveal(page, '[data-rd="conn"]');
  await page.click('[data-rd="conn"]');
  await tick(page);
  const inMode = await views(page);
  c(
    'entering keeps the same analysis root and sends no computation',
    inMode.same && api.posts === posts,
    JSON.stringify({ ...inMode, posts: api.posts, before: posts })
  );
  c(
    'entering keeps cv and sel',
    inMode.cv === picked.cv && inMode.sel === picked.sel,
    JSON.stringify({ picked, inMode })
  );
  await page.click('[data-rd="conn-exit"]');
  await tick(page);
  const left = await views(page);
  c(
    'leaving keeps the same root, no computation, cv and sel',
    left.same && api.posts === posts && left.cv === picked.cv && left.sel === picked.sel,
    JSON.stringify({ picked, left, posts: api.posts })
  );
  // A line selected before entering is the inner layer: Esc clears it first,
  // focus stays visible on the way out, and the next Esc leaves the mode.
  await open(page, base);
  // At phone width Analyze was pressed in the reader's sheet, which makes the
  // paper inert: close it first.
  if (await page.$('#surface-library .rd.rd-sheet')) {
    await page.keyboard.press('Escape');
    await tick(page);
  }
  await page.click('.rd-num:not([disabled]) >> nth=0');
  await tick(page);
  const lineOn = await page.$$eval('.rd-num[aria-pressed="true"]', (n) => n.length);
  c('a line is selected before entry', lineOn === 1, String(lineOn));
  await reveal(page, '[data-rd="conn"]');
  await page.click('[data-rd="conn"]');
  await tick(page);
  await page.focus('[data-rd="conn-exit"]');
  await page.keyboard.press('Escape');
  await tick(page);
  const cleared = await said(page, 'Selection cleared');
  const esc1 = await state(page);
  const lineOff = await page.$$eval('.rd-num[aria-pressed="true"]', (n) => n.length);
  c(
    'Esc clears the line selection first and stays in the mode, focus visible',
    esc1.conn && lineOff === 0 && esc1.focus === 'conn-exit' && cleared,
    JSON.stringify({ ...esc1, lineOff, cleared })
  );
  await page.keyboard.press('Escape');
  await tick(page);
  const esc2 = await state(page);
  c('the next Esc leaves the mode', !esc2.conn && esc2.focus === 'conn', JSON.stringify(esc2));
  // The source view renders the same text before and after a round trip.
  await open(page, base, '&view=source');
  const srcText = await firstText(page);
  await reveal(page, '[data-rd="conn"]');
  await page.click('[data-rd="conn"]');
  await tick(page);
  await page.click('[data-rd="conn-exit"]');
  await tick(page);
  const src = await state(page);
  const srcAfter = await firstText(page);
  c(
    'view=source survives a round trip and renders the same source text',
    src.source &&
      /[?&]view=source\b/.test(src.hash) &&
      !src.conn &&
      src.paper &&
      !!srcText &&
      srcAfter === srcText,
    JSON.stringify({ ...src, srcText, srcAfter })
  );
}

(async () => {
  const dir = H.build();
  H.link(dir);
  const chunks = H.chunksIn(dir);
  for (const c of ['analysis', 'connection-views', 'connection-bindings', 'reader'])
    if (!chunks.has(c)) throw Error(`chunk not in this build: ${c}`);
  const srv = await H.start({ root: dir, port: 0 });
  const { chromium } = require('playwright');
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  });
  try {
    for (const theme of DARK ? ['light', 'dark'] : ['light'])
      for (const width of [1280, 390]) {
        if (ONLY_WIDTH && width !== ONLY_WIDTH) continue;
        const tag = `[${theme} ${width}]`;
        const { context, page, errors } = await H.openPage(browser, srv.url, { theme, width });
        try {
          await mode({ page, base: srv.url, tag, width });
        } catch (e) {
          H.check(
            `${tag} connections mode: ran to the end`,
            false,
            String(e.message).slice(0, 300)
          );
        }
        H.check(`${tag} connections mode: no page errors`, errors.length === 0, errors.join(' | '));
        await context.close();
      }
  } finally {
    await browser.close();
    await srv.close();
  }
  for (const r of H.results) console.log(r);
  const n = H.results.length;
  const failed = H.failures();
  console.log(`READER CONNECTIONS MODE: ${failed ? 'FAIL' : 'PASS'} — ${n - failed}/${n} checks`);
  process.exit(failed ? 1 : 0);
})();
