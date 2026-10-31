#!/usr/bin/env node
/* global document, requestAnimationFrame, window */ // inside page.evaluate
'use strict';
// Acceptance of the connection views on the production route, in Chromium:
// the real Library page, the reader, the analysis chunk's mount, the adapter,
// views, marks and bindings, against a stubbed Library API serving the
// committed AnalysisSession capture (scripts/fixtures/connection-backend.json)
// as verified pages. What a reader can do and hear, end to end:
//
//   directed   a→b roles kept as asked, including a later-to-earlier binding,
//              never reversed or collapsed into an unordered pair; and, once
//              directed holds are drawn as arcs (the arrowhead patch), each
//              arc runs from a to b and carries its direction
//   keyboard   poem Tab order (words in reading order before any arc), Enter
//              inspects, Esc layers (sheet, then selection) keep focus on the
//              word, matrix arrows stay inside the grid
//   stale      a link from another reading is refused, shown and said; a
//              valid link restores its selection
//   paging     unloaded evidence is never a negative; the final page brings
//              the holds, keeps the view and the address, and sends no new
//              computation
//   auth       losing the session (404) or expiry (410) tears the views down
//
// Reuses check_library_page.js's own harness (build, server, page, stubs) by
// reading that file up to its runner, so both drive the identical route; if
// the harness changes shape this script fails loudly at load, not silently.
//
//   node scripts/check_connection_acceptance_browser.js [--dark] [--require-arrows]
//        [--section=directed|keyboard|stale|paging|auth] [--width=1280|390]
//
// --require-arrows turns "directed holds are not drawn as arcs yet" from a
// PENDING note into a failure: use it once the arrowhead patch is integrated.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const HARNESS = path.join(__dirname, 'check_library_page.js');
const src = fs.readFileSync(HARNESS, 'utf8');
const cut = src.indexOf('\n(async () => {\n  const dir = build();');
if (cut < 0) throw Error('check_library_page.js runner not found: update the harness hook');
const mine = new Set(['dark', 'require-arrows']);
const pick = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || '';
const argv = process.argv.slice(2);
process.argv.splice(
  2,
  argv.length,
  ...argv.filter((a) => !mine.has(a.replace(/^--/, '')) && !/^--(section|width)=/.test(a))
);
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
const REQUIRE_ARROWS = argv.includes('--require-arrows');
const ONLY_SECTION = pick('section');
const ONLY_WIDTH = Number(pick('width')) || 0;
const pending = [];
const notes = [];

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

// The capture with one binding asked later-to-earlier: woods (b) before watch (a).
function reversed() {
  const records = JSON.parse(JSON.stringify(FIXTURE.records));
  const r = records.find(
    (x) => x.kind === 'relation_instance' && x.a.token_ids[0] === 'line:0:token:0'
  );
  [r.a, r.b] = [r.b, r.a];
  if (r.compared && r.compared.a && r.compared.b)
    [r.compared.a, r.compared.b] = [r.compared.b, r.compared.a];
  return records;
}

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

// The reader's controls: at phone width they sit behind the reader's sheet
// button, which may already be open after a reload.
async function analyze(page) {
  const run = page.locator('[data-act="analyze"]');
  if (!(await run.isVisible())) {
    const sheet = page.locator('#surface-library [data-rd="sheet"]');
    if (await sheet.isVisible()) await sheet.click({ timeout: 5000 }).catch(() => {});
  }
  await run.click();
}
// Reader on a reading, sound lens, analysis run, views mounted.
async function open(page, base, reading, { complete = false } = {}) {
  await H.go(page, base, `/read/${reading}?lens=sound`);
  await H.settled(page, 'reader', '#surface-library .rd-paper .rd-line');
  await analyze(page);
  await page.waitForSelector('.cv-root', { timeout: 20000 });
  if (complete) {
    await page.click('[data-act="more"]');
    await page.waitForFunction(() =>
      document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
    );
  }
}
const live = (page) => page.textContent('.lib-cb-live');
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a.tagName,
      key: a.dataset?.selection || '',
      visible: a !== document.body && a.getClientRects().length > 0,
    };
  });
const nativeLabels = (page) =>
  page.$$eval('.cv-native button', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ')));
const closeSheet = async (page) => {
  if (await page.isVisible('.lib-cb-sheet-body')) await page.keyboard.press('Escape');
};

const SECTIONS = {
  async directed({ page, base, tag }) {
    let state = await serve(page);
    await open(page, base, H.EPI_A, { complete: true });
    let labels = await nativeLabels(page);
    H.check(
      `${tag} directed: each asked binding is listed a → b as asked`,
      labels.some((l) => /a: watch[^→]*→ b: woods/.test(l)) &&
        labels.some((l) => /a: cat[^→]*→ b: hat/.test(l)),
      JSON.stringify(labels)
    );
    await page.click('.cv-native button >> nth=0');
    await closeSheet(page);
    const sel = new URL(page.url()).searchParams.get('sel') || '';
    H.check(
      `${tag} directed: the selection is a role-ordered binding, never an unordered pair`,
      sel.startsWith('b:') && /a=line%3A0%3Atoken%3A0,b=line%3A0%3Atoken%3A1/.test(sel),
      sel
    );
    H.check(
      `${tag} directed: the inspector names the roles a → b`,
      /a: watch[^→]*→ b: woods/.test(await page.textContent('.cv-inspector')),
      (await page.textContent('.cv-inspector')).slice(0, 200)
    );
    // Arrows: once directed holds are drawn in the poem, each arc runs from
    // its a word to its b word and carries its direction.
    await page.click('.cv-root [data-view="poem"]');
    await settle(page);
    const arcs = await page.$$eval('.cv-poem .lib-mk-arc', (as) =>
      as.map((a) => ({
        key: a.dataset.selection || '',
        label: a.getAttribute('aria-label') || '',
        marker: !!(
          a.querySelector('[marker-end],[marker-start],marker,.lib-mk-arrow') ||
          a.getAttribute('marker-end')
        ),
      }))
    );
    const directedArcs = arcs.filter((a) => a.key.startsWith('b:'));
    if (!directedArcs.length) {
      const note = `${tag} directed: directed holds are not drawn as poem arcs yet (arrowheads pending)`;
      if (REQUIRE_ARROWS) H.check(note, false);
      else pending.push(note);
    } else {
      H.check(
        `${tag} directed: every directed arc carries a direction mark`,
        directedArcs.every((a) => a.marker),
        JSON.stringify(directedArcs)
      );
      const runs = await page.evaluate(() => {
        const ports = {};
        for (const g of document.querySelectorAll('.cv-poem g[data-selection^="o:"] circle'))
          ports[g.closest('[data-selection]').dataset.selection.slice(2)] = {
            x: +g.getAttribute('cx'),
            y: +g.getAttribute('cy'),
          };
        return [...document.querySelectorAll('.cv-poem .lib-mk-arc[data-selection^="b:"]')].map(
          (arc) => {
            const d = (arc.querySelector('path') || arc).getAttribute('d') || '';
            const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
            const roles = Object.fromEntries(
              arc.dataset.selection
                .split(':')
                .slice(2)
                .join(':')
                .split(',')
                .map((m) => m.split('=').map(decodeURIComponent))
            );
            return { start: [nums[0], nums[1]], a: ports[roles.a], b: ports[roles.b] };
          }
        );
      });
      const near = (p, q) => p && q && Math.hypot(p[0] - q.x, p[1] - q.y) < 20;
      H.check(
        `${tag} directed: each directed arc starts at its a word, not its b word`,
        runs.length > 0 && runs.every((r) => near(r.start, r.a) && !near(r.start, r.b)),
        JSON.stringify(runs)
      );
    }
    // A binding asked later-to-earlier stays that way round.
    await page.context().clearCookies();
    await page.unroute(H.API + '/**');
    state = await serve(page, reversed());
    await open(page, base, H.EPI_A, { complete: true });
    labels = await nativeLabels(page);
    H.check(
      `${tag} directed: a later-to-earlier binding is kept as asked (a: woods → b: watch)`,
      labels.some((l) => /a: woods[^→]*→ b: watch/.test(l)) &&
        !labels.some((l) => /a: watch[^→]*→ b: woods/.test(l)),
      JSON.stringify(labels)
    );
    H.check(`${tag} directed: viewing sends no computation`, state.posts === 1);
  },

  async keyboard({ page, base, tag, width }) {
    await serve(page);
    await open(page, base, H.EPI_A, { complete: true });
    await page.click('.cv-root [data-view="poem"]');
    await settle(page);
    // Tab through the poem: words in reading order, then any arcs.
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.cv-poem [tabindex="0"]')].map(
        (n) => n.dataset.selection || ''
      )
    );
    const words = order.filter((k) => k.startsWith('o:'));
    const firstArc = order.findIndex((k) => !k.startsWith('o:'));
    H.check(
      `${tag} keyboard: poem words come first, in reading order`,
      words.join(' ') ===
        [
          'o:line%3A0%3Atoken%3A0',
          'o:line%3A0%3Atoken%3A1',
          'o:line%3A1%3Atoken%3A0',
          'o:line%3A1%3Atoken%3A1',
        ].join(' ') &&
        (firstArc < 0 || firstArc === words.length),
      JSON.stringify(order)
    );
    await page.focus('.cv-poem [data-selection="o:line%3A0%3Atoken%3A0"][tabindex="0"]');
    await page.keyboard.press('Enter');
    await settle(page);
    H.check(
      `${tag} keyboard: Enter on a word selects it and says so`,
      /watch .*selected/.test(await live(page)),
      await live(page)
    );
    // The sheet follows the layout the views actually get (their container
    // query), not the viewport: in the Library's analysis column a desktop
    // viewport can still be phone layout.
    const phone = await page.evaluate(
      () => window.getComputedStyle(document.querySelector('.cv-layout')).display === 'block'
    );
    if (width <= 600)
      H.check(`${tag} keyboard: at phone width the views use the phone layout`, phone);
    if (phone) {
      const inSheet = await page.evaluate(
        () => !!document.activeElement.closest('.lib-cb-sheet-body')
      );
      H.check(`${tag} keyboard: in phone layout the inspector sheet takes focus`, inSheet);
      await page.keyboard.press('Escape');
      await settle(page);
      const back = await active(page);
      H.check(
        `${tag} keyboard: the first Esc closes the sheet and returns to the word`,
        back.key === 'o:line%3A0%3Atoken%3A0' && back.visible,
        JSON.stringify(back)
      );
    }
    await page.keyboard.press('Escape');
    await settle(page);
    const cleared = await active(page);
    H.check(
      `${tag} keyboard: Esc clears the selection and focus stays on the word`,
      !new URL(page.url()).searchParams.get('sel') &&
        cleared.key === 'o:line%3A0%3Atoken%3A0' &&
        cleared.visible,
      JSON.stringify(cleared)
    );
    H.check(
      `${tag} keyboard: clearing is said`,
      /cleared/i.test(await live(page)),
      await live(page)
    );
    if (phone) {
      const host = await page.evaluate(() =>
        Math.round(document.querySelector('.cv-root').getBoundingClientRect().width)
      );
      notes.push(
        `${tag} keyboard: the views are in phone layout here (view width ${host} px), so the desktop matrix and its arrow keys are not reachable at this viewport`
      );
    } else {
      await page.click('.cv-root [data-view="matrix"]');
      await settle(page);
      const first = page.locator('.cv-desktop-matrix [data-row][data-col]').first();
      await first.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowLeft');
      H.check(
        `${tag} keyboard: matrix arrows move between cells and stay inside the grid`,
        await page.evaluate(() => !!document.activeElement.closest('.cv-desktop-matrix'))
      );
    }
  },

  async stale({ page, base, tag }) {
    await serve(page);
    await open(page, base, H.EPI_A, { complete: true });
    await page.click('.cv-native button >> nth=0');
    await closeSheet(page);
    const link = page.url();
    // The same link opened fresh (a real load, not a fragment navigation, so
    // no earlier mount survives) on the same reading restores its selection.
    await page.goto('about:blank');
    await page.goto(link);
    await H.settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    await analyze(page);
    await page.waitForSelector('.cv-root');
    await page.click('[data-act="more"]');
    await page.waitForFunction(() =>
      document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
    );
    H.check(
      `${tag} stale: a link on its own reading restores the selection`,
      new URL(page.url()).searchParams.get('sel') === new URL(link).searchParams.get('sel') &&
        !(await page.$('.cv-notice')),
      page.url()
    );
    // The same selection opened on another reading is refused, shown and said.
    const other = new URL(link);
    other.hash = `#library/read/${H.EPI_B}?lens=sound`;
    await page.goto('about:blank');
    await page.goto(other.href);
    await H.settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    await analyze(page);
    await page.waitForSelector('.cv-notice');
    await settle(page);
    H.check(
      `${tag} stale: another reading's link is refused and shown`,
      /no longer exists/.test(await page.textContent('.cv-notice'))
    );
    H.check(`${tag} stale: the refusal is said`, /no longer exists/.test(await live(page)));
    H.check(
      `${tag} stale: nothing is selected in its place`,
      !(await page.$('.cv-root .cv-selected, .cv-root .lib-mk-select'))
    );
  },

  async paging({ page, base, tag }) {
    const state = await serve(page);
    await open(page, base, H.EPI_A);
    await page.click('.cv-root [data-view="matrix"]');
    const labels = await page
      .locator('.cv-root [data-selection]')
      .evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label') || ''));
    H.check(
      `${tag} paging: before the final page nothing reads as a negative`,
      !labels.some((l) => /does not hold/.test(l)),
      JSON.stringify(labels.filter((l) => /hold/.test(l)).slice(0, 4))
    );
    await page.locator('.cv-root [data-selection]:visible').first().click();
    await closeSheet(page);
    const address = page.url();
    await page.click('[data-act="more"]');
    await page.waitForFunction(() =>
      document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
    );
    H.check(
      `${tag} paging: the final page brings the holds`,
      /holds/.test(await page.textContent('.cv-root'))
    );
    H.check(
      `${tag} paging: the view and the address are kept`,
      (await page.getAttribute('.cv-root [data-view="matrix"]', 'aria-current')) === 'true' &&
        page.url() === address,
      page.url()
    );
    const focus = await active(page);
    H.check(
      `${tag} paging: focus lands somewhere visible after the page loads`,
      focus.visible,
      JSON.stringify(focus)
    );
    H.check(`${tag} paging: loading pages sends no new computation`, state.posts === 1);
  },

  async auth({ page, base, tag }) {
    for (const [status, word] of [
      [410, 'expired'],
      [404, 'session'],
    ]) {
      const state = await serve(page);
      await open(page, base, H.EPI_A, { complete: true });
      state.status = status;
      await page.click('[data-rd="lens"][data-id="form"]');
      await page.click('[data-rd="lens"][data-id="sound"]');
      await page.waitForFunction(
        (w) => document.querySelector('.la-root')?.textContent.toLowerCase().includes(w),
        word,
        { timeout: 20000 }
      );
      H.check(
        `${tag} auth: a ${status} tears the connection views down`,
        !(await page.$('.cv-root')),
        (await page.textContent('.la-root')).slice(0, 160)
      );
      await page.unroute(H.API + '/**');
    }
  },
};

(async () => {
  const dir = H.build();
  H.link(dir);
  const chunks = H.chunksIn(dir);
  for (const c of ['analysis', 'connection-views', 'connection-bindings', 'marks', 'reader'])
    if (!chunks.has(c)) throw Error(`chunk not in this build: ${c}`);
  const srv = await H.start({ root: dir, port: 0 });
  const { chromium } = require('playwright');
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  });
  const combos = [];
  for (const theme of DARK ? ['light', 'dark'] : ['light'])
    for (const width of [1280, 390])
      if (!ONLY_WIDTH || width === ONLY_WIDTH) combos.push({ theme, width });
  try {
    for (const [name, fn] of Object.entries(SECTIONS).filter(
      ([n]) => !ONLY_SECTION || n === ONLY_SECTION
    ))
      for (const combo of combos) {
        const tag = `[${combo.theme} ${combo.width}]`;
        const { context, page, errors } = await H.openPage(browser, srv.url, combo);
        try {
          await fn({ page, base: srv.url, tag, width: combo.width });
        } catch (e) {
          H.check(`${tag} ${name}: ran to the end`, false, String(e.message).slice(0, 300));
        }
        H.check(`${tag} ${name}: no page errors`, errors.length === 0, errors.join(' | '));
        await context.close();
      }
  } finally {
    await browser.close();
    await srv.close();
  }
  for (const r of H.results) console.log(r);
  for (const p of pending) console.log(`PENDING ${p}`);
  for (const n of notes) console.log(`NOTE ${n}`);
  const n = H.results.length;
  const failed = H.failures();
  console.log(
    `CONNECTION ACCEPTANCE: ${failed ? 'FAIL' : 'PASS'} — ${n - failed}/${n} checks` +
      (pending.length ? `, ${pending.length} pending (arrowheads)` : '')
  );
  process.exit(failed ? 1 : 0);
})();
