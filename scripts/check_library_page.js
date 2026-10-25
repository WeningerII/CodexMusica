#!/usr/bin/env node
// check_library_page.js — the end-to-end gate for the native Library tab.
//
// Builds the lazy page with CODEX_LIBRARY=1 into a temporary directory (beside
// links to the repo's api/, assets/ and library/data/), serves it with
// scripts/_pages_server.js, and drives it in Chromium. Every Render route under
// https://mcp.codexmusica.com/library/v1/ is stubbed with the response shapes
// of mcp/library_routes.js, library_viewer_routes.js, library_export_routes.js
// and library_corpus_routes.js; search answers from the static w/title rows.
//
// Sections: explore, works, rights, reader, compare, focus, analysis,
// declarations, retained. A section whose
// chunk is not in the build prints SKIP (not a failure). Every section runs in
// both themes at 1280 and 390 wide; any console error, uncaught exception,
// failed same-origin request or horizontal page overflow fails the run.
//
//   node scripts/check_library_page.js                 # build, then check
//   node scripts/check_library_page.js --built=DIR     # check an existing build
//   node scripts/check_library_page.js --only=reader,compare --headed
//   node scripts/check_library_page.js --shots=DIR     # screenshot each section
/* global innerWidth, document, location, getComputedStyle, libraryChunk, indexedDB, window, MutationObserver */ // inside page.evaluate
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { start } = require('./_pages_server.js');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'library', 'data');
const API = 'https://mcp.codexmusica.com/library/v1';
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) throw Error(`unknown argument ${a}`);
    return [m[1], m[2] === undefined ? true : m[2]];
  })
);
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const SNAPSHOT = 'snapshot-check-library-page';

// ─── Fixture readings (real units in library/data) ──────────────────────────
// Epithalamion: two readings of one reviewed work, two pages each.
const EPI_A = 'reading_570567e3-ba7f-56f3-a1bf-f06c6a8d9b81';
// One of the two readings recorded with no title.
const UNTITLED = 'reading_c05c5055-7137-5e81-b6d1-7ebef7a0b3f3';
const EPI_B = 'reading_2c8cde38-7ea1-5dda-a413-98e3c4b0fb5f';
// Hafez: two Persian (right-to-left) ghazals.
const FAS_A = 'reading_001e1786-f68f-580f-94b0-fbea01a67323';
const FAS_B = 'reading_00c8f2f0-303e-50be-a653-406c0fc2cf8c';

const gz = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, p))));
const shardOf = (id) => id.replace(/^[a-z]+_/, '').slice(0, 2);
function headOf(id) {
  const unit = gz(`u/${shardOf(id)}.json.gz`).units.find((u) => u[0] === id);
  return gz(`r/${shardOf(id)}/${id}/${unit[1]}/head.json.gz`);
}

// The static Works rows as search results (fromStatic in works.js).
let ROWS = null;
function staticRows() {
  if (ROWS) return ROWS;
  ROWS = [];
  for (let k = 0; k < 8; k++) {
    const file = path.join(DATA, 'w', 'title', `${k}.json.gz`);
    if (!fs.existsSync(file)) break;
    for (const r of JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).rows)
      ROWS.push({
        reading_unit_id: r[0],
        reading_revision: r[1].split('-')[0].padEnd(64, '0'),
        path_key: r[1],
        title: r[2],
        contributors: (r[3] || []).map((c) => ({ name: c[0], role: c[1] })),
        language: r[4],
        availability: r[5],
        completeness: r[6],
        edition_id: r[7] ? `edition_${r[7]}` : '',
        work_id: r[8] ? `work_${r[8]}` : '',
        source_path: r[9],
        snippet: r[10],
        source_basis: 'public_domain',
      });
  }
  for (const id of [EPI_A, EPI_B]) {
    if (ROWS.some((r) => r.reading_unit_id === id)) continue;
    const h = headOf(id);
    ROWS.push({
      reading_unit_id: id,
      reading_revision: h.reading_revision,
      title: h.title,
      contributors: h.contributors || [],
      language: h.language,
      availability: 'readable',
      completeness: h.completeness,
      edition_id: h.edition_id,
      work_id: h.work_id,
      source_path: h.source_path,
      snippet: h.lines.find((l) => l[0] === 'lyric')?.[1] || '',
      source_basis: 'public_domain',
    });
  }
  return ROWS;
}

// ─── Render stub ─────────────────────────────────────────────────────────────
const JOB = 'job_0123456789abcdef0123456789abcdef';
function makeStub(log) {
  const jobs = new Map();
  const now = () => new Date().toISOString();
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/library\/v1/, '').replace(/\/$/, '');
    const method = req.method();
    const reply = (status, body, headers = {}) =>
      route.fulfill({
        status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': req.headers().origin || '*',
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type, idempotency-key, if-match',
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    if (method === 'OPTIONS') return reply(204, '');
    log.push(`${method} ${p}${url.search}`);
    if (p === '/health')
      return reply(200, {
        contract: 1,
        snapshot_id: SNAPSHOT,
        readable_ids_sha256: '0'.repeat(64),
        counts: { units: 25525, readable: 25525 },
        search_ready: true,
        analysis_available: true,
        corpus: {},
      });
    if (p === '/search') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const work = url.searchParams.get('work');
      const lang = url.searchParams.get('language');
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Math.min(100, Number(url.searchParams.get('limit') || 50));
      let hits = staticRows().filter(
        (r) =>
          (!q ||
            `${r.title}\n${r.snippet}\n${r.contributors.map((c) => c.name).join(' ')}`
              .toLowerCase()
              .includes(q)) &&
          (!work || r.work_id === work) &&
          (!lang || r.language === lang)
      );
      const total = hits.length;
      hits = hits.slice(offset, offset + limit).map((r) => ({ ...r, search_hit: null }));
      return reply(200, {
        snapshot_id: SNAPSHOT,
        items: hits,
        total,
        next_offset: offset + hits.length < total ? offset + hits.length : null,
      });
    }
    let m;
    if ((m = /^\/metadata\/([^/]+)$/.exec(p))) {
      const id = decodeURIComponent(m[1]);
      const row = staticRows().find((r) => r.reading_unit_id === id);
      if (!row)
        return reply(404, {
          error: { code: 'NOT_FOUND', message: 'This record is not in the snapshot.' },
        });
      return reply(200, { snapshot_id: SNAPSHOT, ...row, lines: 0 });
    }
    if (p === '/analyses' && method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      log.push(`BODY ${JSON.stringify(body.declaration_set ?? null)}`);
      const job = {
        id: JOB,
        state: 'running',
        identity: {
          reading_unit_id: body.reading_unit_id,
          reading_revision: body.reading_revision,
          snapshot_id: SNAPSHOT,
        },
        attempt: 1,
        generation: 1,
        progress: { completed: 1, total: 4 },
        created_at: now(),
        updated_at: now(),
      };
      jobs.set(JOB, job);
      return reply(202, { contract_version: 1, job });
    }
    if ((m = /^\/jobs\/([^/]+)$/.exec(p))) {
      const job = jobs.get(decodeURIComponent(m[1]));
      if (!job) return reply(404, { error: { code: 'NOT_FOUND', message: 'No such analysis.' } });
      if (method === 'DELETE') {
        jobs.delete(job.id);
        return reply(200, { contract_version: 1, deleted: true });
      }
      return reply(200, { contract_version: 1, job });
    }
    if ((m = /^\/jobs\/([^/]+)\/(cancel|resume)$/.exec(p))) {
      const job = jobs.get(decodeURIComponent(m[1]));
      if (!job) return reply(404, { error: { code: 'NOT_FOUND', message: 'No such analysis.' } });
      job.state = m[2] === 'cancel' ? 'cancelled' : 'running';
      return reply(200, { contract_version: 1, job });
    }
    if (p === '/viewer' || p === '/session' || p === '/me')
      return reply(200, { contract_version: 1, viewer: 'viewer_check', jobs: [...jobs.values()] });
    if (p === '/jobs' || p === '/analyses')
      return reply(200, { contract_version: 1, jobs: [...jobs.values()] });
    if (p === '/exports/plan' && method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      const ids = body.reading_unit_ids || body.ids || [];
      return reply(200, {
        snapshot_id: SNAPSHOT,
        content_id: 'c'.repeat(64),
        units: ids.length,
        bytes: 1024 * ids.length,
        url: `${API}/exports/p/${'c'.repeat(64)}.zip`,
      });
    }
    if (/^\/(exports\/p|corpus)\//.test(p))
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/zip' },
        body: Buffer.from('PK\x05\x06' + '\0'.repeat(18), 'binary'),
      });
    log.push(`UNMATCHED ${method} ${p}`);
    return reply(404, { error: { code: 'NOT_FOUND', message: `No stub for ${p}` } });
  };
}

// ─── Harness ─────────────────────────────────────────────────────────────────
function build() {
  if (args.built) return path.resolve(String(args.built));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-library-page-'));
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/build_html.js'), `--out=${dir}/codex.html`, '--quiet'],
    {
      cwd: ROOT,
      env: { ...process.env, CODEX_LIBRARY: '1' },
      stdio: ['ignore', 'ignore', 'inherit'],
    }
  );
  return dir;
}
function link(dir) {
  fs.mkdirSync(path.join(dir, 'library'), { recursive: true });
  for (const [from, to] of [
    [DATA, path.join(dir, 'library', 'data')],
    [path.join(ROOT, 'api'), path.join(dir, 'api')],
    [path.join(ROOT, 'assets'), path.join(dir, 'assets')],
  ]) {
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    fs.symlinkSync(from, to);
  }
}
function chunksIn(dir) {
  const code = path.join(dir, 'library', 'code');
  const names = new Set();
  if (fs.existsSync(code)) for (const f of fs.readdirSync(code)) names.add(f.split('.')[0]);
  // The embedded (non-lazy) build carries every chunk inline.
  const html = fs.readFileSync(path.join(dir, 'codex.html'), 'utf8');
  for (const m of html.matchAll(/CMLibraryDefine\("([a-z-]+)"/g)) names.add(m[1]);
  return names;
}

let failures = 0;
const results = [];
function check(label, ok, detail = '') {
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
  return ok;
}
const short = (s, n = 160) => String(s).replace(/\s+/g, ' ').slice(0, n);

// h1s in the Library a screen reader is given (display:none removes one).
const exposedH1s = (page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('#surface-library h1')].filter(
        (h) => getComputedStyle(h).display !== 'none'
      ).length
  );
async function openPage(browser, url, combo) {
  const context = await browser.newContext({
    viewport: { width: combo.width, height: combo.width > 600 ? 900 : 844 },
    colorScheme: combo.theme,
  });
  const log = [];
  // Every other call the page makes to the backend host (the shell's
  // /chat/status probe and the like) is answered too, as check_library_shell.js
  // does: nothing in this gate may reach the network, and a real response
  // without CORS headers would be a console error the page did not cause.
  await context.route(/^https:\/\/mcp\.codexmusica\.com\//, (route) => {
    const origin = route.request().headers().origin || '*';
    return route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      },
      body: '{"ok":true,"enabled":true}',
    });
  });
  // Registered last, so it is matched first for the Library's own routes.
  await context.route(`${API}/**`, makeStub(log));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${short(e.message, 300)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/^Failed to load resource/.test(m.text()))
      errors.push(`console: ${short(m.text(), 300)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(url))
      errors.push(`${r.status()} ${r.url().slice(url.length)}`);
  });
  page.on('requestfailed', (r) => {
    // A request the browser abandoned because the page navigated or reloaded
    // (the races' cold reloads cut off an in-flight favicon) is not a failure
    // of the page; anything else that fails still is (BB8's flake, #519).
    if (r.url().startsWith(url) && r.failure()?.errorText !== 'net::ERR_ABORTED')
      errors.push(`requestfailed ${r.url().slice(url.length)} ${r.failure()?.errorText}`);
  });
  return { context, page, errors, log };
}
async function go(page, base, hash) {
  await page.goto(`${base}/codex.html#library${hash}`);
  await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
}
// The chunk named on the Library's content element has rendered something
// that is not an error state.
async function settled(page, chunk, selector, timeout = 20000) {
  await page.waitForSelector(selector, { timeout });
  const failed = await page.evaluate(() => {
    const e = document.querySelector(
      '#surface-library .cm-empty[data-tone="danger"], #surface-library [role="alert"]:not(:empty)'
    );
    return e && e.offsetParent ? e.textContent.trim() : '';
  });
  return failed;
}
// Delay catalog.json by `ms`; the returned function waits until every delayed
// response has been served (not a fixed time, which flaked), then removes it.
async function slowCatalog(page, ms) {
  const served = [];
  await page.route('**/library/data/catalog.json', (route) => {
    served.push(new Promise((r) => setTimeout(r, ms)).then(() => route.continue()));
  });
  return async () => {
    await page.waitForTimeout(ms + 300);
    await Promise.all(served);
    await page.waitForTimeout(500);
    await page.unroute('**/library/data/catalog.json');
  };
}
async function overflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────
const SECTIONS = {
  async explore({ page, base, tag }) {
    await go(page, base, '');
    const failed = await settled(page, 'core', '#surface-library .lib-shelf');
    check(`${tag} explore renders without an error state`, !failed, failed);
    const info = await page.evaluate(() => ({
      shelves: [...document.querySelectorAll('#surface-library .lib-shelf')].map(
        (s) => s.dataset.lang
      ),
      cards: document.querySelectorAll('#surface-library .lib-card').length,
      art: [...document.querySelectorAll('#surface-library .lib-card img')].filter(
        (i) => i.complete && i.naturalWidth > 0
      ).length,
      rail: document.querySelectorAll(
        '#surface-library .lib-rail [data-cid], #surface-library .lib-rail a, #surface-library .lib-rail button'
      ).length,
      topline: document.querySelector('#surface-library .lib-topline')?.textContent.trim() || '',
    }));
    check(
      `${tag} explore: shelves in first-appearance order start cym,fas,fin,eng`,
      info.shelves.slice(0, 4).join(',') === 'cym,fas,fin,eng',
      info.shelves.join(',')
    );
    check(`${tag} explore: collection cards`, info.cards >= 6, `${info.cards} cards`);
    check(
      `${tag} explore: collections rail`,
      info.rail > 0 || /^(390)$/.test(String(tag).split(' ')[1]),
      `${info.rail} rail entries`
    );
    // A screen reader hears a page heading and a named shelf (Jony #23, #25).
    const sr = await page.evaluate(() => {
      const h1 = document.querySelector('#surface-library h1');
      const shelf = document.querySelector('#surface-library .lib-shelf-scroll');
      return {
        h1: h1 ? h1.textContent.trim() : null,
        shelfRole: shelf ? shelf.getAttribute('role') : 'none',
        shelfName: shelf ? shelf.getAttribute('aria-label') : null,
      };
    });
    check(
      // A shelf's scroller is a named group, not a landmark: one region per
      // language crowded the landmark list (Jony #127).
      `${tag} explore: the Library has an h1 and its shelf scrollers are named groups`,
      !!sr.h1 && sr.shelfRole === 'group' && !!sr.shelfName,
      JSON.stringify(sr)
    );
    check(`${tag} explore: topline`, info.topline.length > 0);
    // Collection page.
    const card = await page.$(
      '#surface-library .lib-card [data-cid], #surface-library .lib-card[data-cid], #surface-library .lib-card'
    );
    const cid = await page.evaluate(
      (c) => c?.dataset.cid || c?.querySelector('[data-cid]')?.dataset.cid || '',
      card
    );
    if (check(`${tag} explore: a card names its collection`, !!cid)) {
      await go(page, base, `/collections/${cid}`);
      const failedC = await settled(
        page,
        'core',
        '#surface-library .lib-coll-head, #surface-library .lib-coll-list'
      );
      const rows = await page.evaluate(
        () =>
          document.querySelectorAll(
            '#surface-library .lib-coll-list > *, #surface-library .lw-table tbody tr'
          ).length
      );
      check(`${tag} collection page renders`, !failedC && rows > 0, failedC || `${rows} rows`);
      check(
        `${tag} collection page: one h1 is exposed`,
        (await exposedH1s(page)) === 1,
        `${await exposedH1s(page)} h1s`
      );
    }
    // Where the rail is open, it is one tab stop: Tab leaves it for the page,
    // and the arrow keys move between rows across repaints (Jony's lane, #519).
    await go(page, base, '');
    await page.waitForSelector('#surface-library .lib-core-main', { timeout: 20000 });
    const railOpen = await page
      .waitForSelector('#surface-library .lib-rail:not([hidden]) .lib-spine', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (railOpen) {
      await page.focus('#surface-library .lib-spine');
      let reached = false;
      for (let i = 0; i < 12 && !reached; i++) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(
          () => !!document.activeElement?.closest('#surface-library .lib-core-main')
        );
      }
      check(`${tag} explore: Tab leaves the rail for the page within 12 presses`, reached);
      await page.focus('#surface-library .lib-spine');
      for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      const row = await page.evaluate(() => ({
        spine: !!document.activeElement?.classList.contains('lib-spine'),
        i: document.activeElement?.dataset?.i,
      }));
      check(
        `${tag} explore: ArrowDown moves through the rail and keeps focus across repaints`,
        row.spine && row.i === '30',
        JSON.stringify(row)
      );
      // Opening a collection from the rail replaces the spine pressed: focus
      // lands on the new collection's heading, not the page (Jony, #50).
      await page.keyboard.press('Enter');
      await page.waitForSelector('#surface-library .lib-coll-list', { timeout: 20000 });
      await page.waitForTimeout(800);
      const opened = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: (document.activeElement?.textContent || '').trim().slice(0, 40),
      }));
      check(
        `${tag} explore: opening a collection from the rail does not drop focus to the page`,
        opened.tag !== 'BODY' && !!opened.tag,
        JSON.stringify(opened)
      );
    }
    // Where the open rail overlays the page (narrow widths), it is a panel:
    // opening moves focus into it, Escape closes it back to the toggle, and
    // Tab out of it closes it, so no focused control sits under it (Jony).
    const overlay = await page.evaluate(() => {
      const r = document.querySelector('#surface-library .lib-rail');
      return !!r && r.hidden && window.innerWidth < 1100;
    });
    if (overlay) {
      const toggle = '#surface-library .lib-topline [data-lib-act="rail"]';
      await page.click(toggle);
      await page.waitForSelector('#surface-library .lib-rail:not([hidden]) .lib-spine', {
        timeout: 8000,
      });
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest('#surface-library .lib-rail')
      );
      check(`${tag} explore: opening the overlaying rail moves focus into it`, inside);
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(() => ({
        hidden: document.querySelector('#surface-library .lib-rail')?.hidden,
        toggle: !!document.activeElement?.matches('[data-lib-act="rail"]'),
      }));
      check(
        `${tag} explore: Escape closes the overlaying rail and returns focus to its toggle`,
        closed.hidden === true && closed.toggle,
        JSON.stringify(closed)
      );
      await page.click(toggle);
      await page.waitForSelector('#surface-library .lib-rail:not([hidden]) .lib-spine', {
        timeout: 8000,
      });
      let left = false;
      for (let i = 0; i < 8 && !left; i++) {
        await page.keyboard.press('Tab');
        left = await page.evaluate(
          () => !document.activeElement?.closest('#surface-library .lib-rail')
        );
      }
      const after = await page.evaluate(() => {
        const a = document.activeElement;
        return {
          hidden: document.querySelector('#surface-library .lib-rail')?.hidden,
          to: a ? `${a.tagName.toLowerCase()}.${a.className}[${a.dataset?.libAct || ''}]` : null,
        };
      });
      check(
        `${tag} explore: Tab out of the overlaying rail closes it`,
        left && after.hidden === true,
        `left=${left} ${JSON.stringify(after)}`
      );
      // It opens below the sticky app bar, so its head row is not covered,
      // and a press outside it closes it (Jony, #519).
      await page.click(toggle);
      await page.waitForSelector('#surface-library .lib-rail:not([hidden]) .lib-spine', {
        timeout: 8000,
      });
      const head = await page.evaluate(() => {
        const rail = document.querySelector('#surface-library .lib-rail');
        const bar = document.querySelector('.app-bar');
        const r = rail.getBoundingClientRect();
        const b = bar ? bar.getBoundingClientRect().bottom : 0;
        const controls = [...rail.querySelectorAll('.lib-rail-head button, .lib-rail-head select')];
        const covered = controls.filter((el) => {
          const c = el.getBoundingClientRect();
          return !el.contains(
            document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)
          );
        }).length;
        return { top: Math.round(r.top), bar: Math.round(b), controls: controls.length, covered };
      });
      check(
        `${tag} explore: the overlaying rail starts below the app bar, head row uncovered`,
        head.top >= head.bar && head.controls > 0 && head.covered === 0,
        JSON.stringify(head)
      );
      const spot = await page.evaluate(() => {
        const r = document.querySelector('#surface-library .lib-rail').getBoundingClientRect();
        for (let y = Math.round(r.top + 40); y < window.innerHeight - 8; y += 24)
          for (let x = window.innerWidth - 4; x > r.right + 2; x -= 12) {
            const el = document.elementFromPoint(x, y);
            if (
              el &&
              !el.closest('a,button,input,select,textarea,label,[tabindex],[role="button"]')
            )
              return { x, y };
          }
        return null;
      });
      if (spot) await page.mouse.click(spot.x, spot.y);
      const dismissed = await page.evaluate(
        () => document.querySelector('#surface-library .lib-rail')?.hidden
      );
      check(
        `${tag} explore: a press outside the overlaying rail closes it`,
        !!spot && dismissed === true,
        JSON.stringify({ spot, dismissed })
      );
      // That press only dismisses: a control under it is not also activated.
      await page.click(toggle);
      await page.waitForSelector('#surface-library .lib-rail:not([hidden]) .lib-spine', {
        timeout: 8000,
      });
      const under = await page.evaluate(() => {
        const r = document.querySelector('#surface-library .lib-rail').getBoundingClientRect();
        // A Library control beside the rail, else (on a phone, where the rail
        // leaves no room beside it) one in the app bar above it.
        const b = [
          ...document.querySelectorAll('#surface-library button'),
          ...document.querySelectorAll('.app-bar button'),
        ].find((el) => {
          const c = el.getBoundingClientRect();
          const x = c.left + c.width / 2;
          const y = c.top + c.height / 2;
          const inRail = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          return (
            c.width &&
            !inRail &&
            !el.matches('[data-lib-act="rail"]') &&
            el.contains(document.elementFromPoint(x, y))
          );
        });
        if (!b) return null;
        window.__libUnderHit = false;
        b.addEventListener('click', () => (window.__libUnderHit = true), { once: true });
        const c = b.getBoundingClientRect();
        return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
      });
      if (under) await page.mouse.click(under.x, under.y);
      const swallowed = await page.evaluate(() => ({
        hidden: document.querySelector('#surface-library .lib-rail')?.hidden,
        hit: window.__libUnderHit,
      }));
      check(
        `${tag} explore: the dismissing press does not also activate the control under it`,
        !!under && swallowed.hidden === true && swallowed.hit === false,
        JSON.stringify({ under, ...swallowed })
      );
    }
    // A collection's page is in the hash (?offset=), Back restores it, and it
    // never leaks into the next collection opened from history (BB8's L1).
    const colls = JSON.parse(
      fs.readFileSync(path.join(DATA, 'collections.json'), 'utf8')
    ).collections;
    const big = colls.find((c) => c[3] > 250);
    const small = colls.find((c) => c[3] > 0 && c[3] <= 250);
    if (big && small) {
      const pagerText = () =>
        page.evaluate(
          () => document.querySelector('#surface-library .lib-pager span')?.textContent
        );
      await go(page, base, `/collections/${small[0]}`);
      await settled(page, 'core', '#surface-library .lib-coll-list');
      await go(page, base, `/collections/${big[0]}`);
      await settled(page, 'core', '#surface-library .lib-pager');
      await page.click('#surface-library .lib-pager button:last-child');
      await page
        .waitForFunction(() => /\?offset=250$/.test(location.hash), null, { timeout: 8000 })
        .catch(() => {});
      await page
        .waitForFunction(
          () =>
            /^251/.test(
              document.querySelector('#surface-library .lib-pager span')?.textContent || ''
            ),
          null,
          { timeout: 8000 }
        )
        .catch(() => {});
      check(
        `${tag} collection Next writes ?offset=250`,
        /\?offset=250$/.test(await page.evaluate(() => location.hash)),
        await page.evaluate(() => location.hash)
      );
      check(
        `${tag} collection Next shows 251–`,
        /^251/.test((await pagerText()) || ''),
        await pagerText()
      );
      await page.goBack();
      await page.goBack();
      const failedS = await settled(
        page,
        'core',
        '#surface-library .lib-coll-list, #surface-library .cm-empty'
      );
      check(
        `${tag} Back to a one-page collection renders it, not the other's page`,
        !failedS,
        failedS
      );
      await page.goForward();
      await page.goForward();
      await page
        .waitForFunction(
          () =>
            /^251/.test(
              document.querySelector('#surface-library .lib-pager span')?.textContent || ''
            ),
          null,
          { timeout: 8000 }
        )
        .catch(() => {});
      check(
        `${tag} Forward restores the collection's page`,
        /^251/.test((await pagerText()) || ''),
        await pagerText()
      );
      await go(page, base, `/collections/${big[0]}?offset=300`);
      await page.reload(); // cold, as a shared link opens it
      await settled(page, 'core', '#surface-library .lib-pager');
      await page
        .waitForFunction(() => /\?offset=250$/.test(location.hash), null, { timeout: 8000 })
        .catch(() => {});
      check(
        `${tag} a cold load of a later page counts the whole collection`,
        /of [1-9]/.test((await pagerText()) || ''),
        await pagerText()
      );
      check(
        `${tag} an off-grid collection offset reads as its page, in the hash too`,
        /\?offset=250$/.test(await page.evaluate(() => location.hash)) &&
          /^251/.test((await pagerText()) || ''),
        `${await page.evaluate(() => location.hash)} ${await pagerText()}`
      );
    }
  },

  async works({ page, base, tag }) {
    await go(page, base, '/works');
    const failed = await settled(page, 'works', '#surface-library .lw-table tbody tr');
    const rows = await page.$$eval('#surface-library .lw-table tbody tr', (r) => r.length);
    check(`${tag} works: table renders 50 rows`, !failed && rows === 50, failed || `${rows} rows`);
    await page.fill('#surface-library [data-lw="q"]', 'epithalamion');
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('#surface-library .lw-table tbody tr')].some((r) =>
            /epithalamion/i.test(r.textContent)
          ) && document.querySelectorAll('#surface-library .lw-table tbody tr').length < 50,
        null,
        { timeout: 10000 }
      )
      .catch(() => {});
    const found = await page.$$eval('#surface-library .lw-table tbody tr', (r) =>
      r.map((x) => x.textContent)
    );
    check(
      `${tag} works: search finds Epithalamion`,
      found.length > 0 && found.every((t) => /epithalamion/i.test(t)),
      `${found.length} rows`
    );
    check(
      `${tag} works: q in the hash`,
      /[?&]q=epithalamion/i.test(await page.evaluate(() => location.hash))
    );
    // A value outside a closed set reads as its default everywhere, and the
    // hash says so (BB8's L2); an off-grid offset snaps to the 50 grid (L3).
    await go(page, base, '/works?sort=bogus&availability=bogus&completeness=&language=zzz');
    await settled(page, 'works', '#surface-library .lw-table tbody tr');
    await page
      .waitForFunction(() => location.hash === '#library/works', null, { timeout: 8000 })
      .catch(() => {});
    check(
      `${tag} works: unknown filter values are dropped from the hash`,
      (await page.evaluate(() => location.hash)) === '#library/works',
      await page.evaluate(() => location.hash)
    );
    check(
      `${tag} works: and no filter badge or chip shows for them`,
      await page.evaluate(
        () =>
          document.querySelector('#surface-library .lw-count')?.hidden !== false &&
          !/bogus|zzz|Sorted by/.test(
            document.querySelector('#surface-library .lw-chips')?.textContent || ''
          )
      )
    );
    await go(page, base, '/works?offset=75');
    await settled(page, 'works', '#surface-library .lw-table tbody tr');
    await page
      .waitForFunction(() => /offset=50$/.test(location.hash), null, { timeout: 8000 })
      .catch(() => {});
    const snapped = await page.$$eval('#surface-library .lw-table tbody tr', (r) => r.length);
    check(
      `${tag} works: offset=75 snaps to 50 with a full page`,
      /offset=50$/.test(await page.evaluate(() => location.hash)) && snapped === 50,
      `${await page.evaluate(() => location.hash)} ${snapped} rows`
    );
    // A shared or hand-edited link past the end, and one naming no
    // collection, are said as such: never a load error whose Retry can only
    // ask for the same missing file (BB8's lane, 6391088047).
    const outcome = async (sub) => {
      await go(page, base, sub);
      await page
        .waitForFunction(
          () => {
            const e = document.querySelector('#surface-library .lw-results .cm-empty');
            return e && !/Loading/.test(e.textContent);
          },
          null,
          { timeout: 20000 }
        )
        .catch(() => {});
      return page.evaluate(() => {
        const e = document.querySelector('#surface-library .lw-results .cm-empty');
        return {
          tone: e?.dataset.tone || '',
          text: (e?.textContent || '').trim().slice(0, 160),
          first: !!e?.querySelector('[data-lw="page"][data-to="0"]'),
          all: !!e?.querySelector('[data-lw="all-works"]'),
          every: !!e?.querySelector('[data-lw="all-availability"]'),
          retry: !!e?.querySelector('[data-lw="retry"]'),
        };
      });
    };
    const past = await outcome('/works?offset=999999');
    check(
      `${tag} works: offset=999999 says past the end with First page, not a load error`,
      past.tone !== 'danger' && /No more readings/.test(past.text) && past.first && !past.retry,
      JSON.stringify(past)
    );
    check(
      `${tag} works: and a static page past the end says where the list ends, not the search hint`,
      /past its end/.test(past.text) && !/Search is literal/.test(past.text),
      JSON.stringify(past)
    );
    const none = await outcome('/works?collection=collection_nope');
    check(
      `${tag} works: an unknown collection says No such collection, not a load error`,
      none.tone !== 'danger' && /No such collection/.test(none.text) && none.all && !none.retry,
      JSON.stringify(none)
    );
    // The id is shown as typed: escaped once (uiEmptyState), never twice.
    const amp = await outcome('/works?collection=' + encodeURIComponent('nope&co'));
    check(
      `${tag} works: an unknown id is shown as typed, escaped once`,
      /“nope&co”/.test(amp.text) && !/&amp;/.test(amp.text),
      JSON.stringify(amp)
    );
    // A LISTED collection with nothing readable has no head file; it is
    // held, not missing (BB8's W1: 48 such, e.g. "sonnets generated").
    const held = await outcome('/works?collection=collection_9edc5f69-bf21-5946-bb46-27d95903804c');
    check(
      `${tag} works: a held-only collection says Nothing here is readable, not No such collection`,
      held.tone !== 'danger' &&
        /Nothing here is readable/.test(held.text) &&
        !/No such collection/.test(held.text) &&
        held.every &&
        !held.retry,
      JSON.stringify(held)
    );
    // A listed collection that records no units at all is empty, not held.
    const empty = await outcome(
      '/works?collection=collection_6be22f99-f402-54a8-b0ef-d2f3ae08fbba'
    );
    check(
      `${tag} works: a collection with no units says it is empty, not that every unit is held`,
      empty.tone !== 'danger' &&
        /This collection is empty/.test(empty.text) &&
        !/held/.test(empty.text) &&
        empty.all,
      JSON.stringify(empty)
    );
    // A row with no recorded count is not a count of zero: it stays held.
    const HELD_ROW = 'collection_9edc5f69-bf21-5946-bb46-27d95903804c';
    await page.route('**/library/data/collections.json', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.collections = body.collections.map((c) => (c[0] === HELD_ROW ? c.slice(0, 4) : c));
      await route.fulfill({ response, json: body });
    });
    await go(page, base, `/works?collection=${HELD_ROW}`);
    await page.reload(); // cold, so the stubbed list is the one read
    const uncounted = await outcome(`/works?collection=${HELD_ROW}`);
    await page.unroute('**/library/data/collections.json');
    await page.reload();
    check(
      `${tag} works: a held collection with no recorded count is held, not empty`,
      /Nothing here is readable/.test(uncounted.text) && uncounted.every,
      JSON.stringify(uncounted)
    );
    // A navigation that lands while an earlier one still waits on the
    // catalog wins: the stale update writes neither its state nor the hash.
    let served = await slowCatalog(page, 2500);
    await go(page, base, '/works?language=eng');
    await page.reload(); // a cold start, so the catalog is fetched again
    await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => (location.hash = '#library/works?offset=50'));
    await served();
    const raced = await page.evaluate(() => ({
      hash: location.hash,
      chips: document.querySelector('#surface-library .lw-chips')?.textContent || '',
    }));
    check(
      `${tag} works: a later navigation beats an update still waiting on the catalog`,
      raced.hash === '#library/works?offset=50' && !/English/.test(raced.chips),
      JSON.stringify(raced)
    );
    // And back to the route already shown while the update still waits
    // (show()'s echo branch; Jony's review).
    served = await slowCatalog(page, 4000);
    await go(page, base, '/works');
    await page.reload(); // cold: the catalog is on its way for the whole run
    await page.waitForSelector('#surface-library .lw', { timeout: 20000 });
    await page.evaluate(() => (location.hash = '#library/works?language=eng'));
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = '#library/works'));
    await served();
    const back = await page.evaluate(() => ({
      hash: location.hash,
      chips: document.querySelector('#surface-library .lw-chips')?.textContent || '',
    }));
    check(
      `${tag} works: going back to the shown route beats an update still waiting`,
      back.hash === '#library/works' && !/English/.test(back.chips),
      JSON.stringify(back)
    );
    // And leaving Works for another Library page while it waits: the stale
    // update must not touch the detached view (BB8's L4; the section's
    // console-error check catches a TypeError).
    served = await slowCatalog(page, 3000);
    await go(page, base, '/works');
    await page.reload();
    await page.waitForSelector('#surface-library .lw', { timeout: 20000 });
    await page.evaluate(() => (location.hash = '#library/works?language=eng'));
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = '#library'));
    await served();
    check(
      `${tag} works: leaving Works while an update waits leaves Explore shown`,
      (await page.evaluate(() => location.hash)) === '#library'
    );
    await go(page, base, '/works?q=epithalamion');
    await settled(page, 'works', '#surface-library .lw-table tbody tr');
    // Filters sheet.
    await page.click('#surface-library [data-lw="filters"]');
    const sheet = await page
      .waitForSelector('#surface-library .lw-sheet', { timeout: 5000 })
      .catch(() => null);
    check(`${tag} works: filters sheet opens`, !!sheet);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(
      `${tag} works: Escape closes the filters sheet`,
      !(await page.$('#surface-library .lw-sheet:not([hidden])')) ||
        !(await page.isVisible('#surface-library .lw-sheet'))
    );
    // Metadata sheet.
    await page.click('#surface-library [data-lw="meta"]');
    const meta = await page
      .waitForSelector(
        '#surface-library .lw-sheet .lw-kv, #surface-library .lw-sheet dl, #surface-library .lw-sheet-body',
        { timeout: 8000 }
      )
      .catch(() => null);
    const metaText = meta ? await page.textContent('#surface-library .lw-sheet') : '';
    check(
      `${tag} works: metadata sheet shows the record`,
      /epithalamion/i.test(metaText) || /corpus\//.test(metaText),
      short(metaText)
    );
    await page.keyboard.press('Escape');
  },

  async rights({ page, base, tag }) {
    await go(page, base, '/rights');
    const failed = await settled(
      page,
      'rights',
      '#surface-library [data-library-chunk="rights"] *, #surface-library [data-lib-view="rights"], #surface-library .lr, #surface-library main *'
    );
    const text = await page.evaluate(
      () => document.querySelector('#surface-library')?.innerText || ''
    );
    check(
      `${tag} rights: view renders`,
      !failed && /source|rights|licen|export/i.test(text),
      failed || short(text)
    );
    // Selection: add Epithalamion through Works, then the export panel lists it.
    const sel = await page.evaluate(async (id) => {
      const core = await libraryChunk('core');
      await core.lib.selection?.add?.(id);
      return core.lib.selection?.ids?.has?.(id) || false;
    }, EPI_A);
    check(`${tag} rights: selection accepts a readable unit`, sel);
    await go(page, base, '/rights');
    await page.waitForTimeout(500);
    const after = await page.evaluate(
      () => document.querySelector('#surface-library')?.innerText || ''
    );
    check(
      `${tag} rights: export panel counts the selection`,
      /\b1 (pinned |selected )?reading unit\b/i.test(after) && !/Nothing selected yet/.test(after),
      short(after, 300)
    );
    await page.evaluate(async () => (await libraryChunk('core')).lib.selection?.clear?.());
  },

  async reader({ page, base, tag }) {
    await go(page, base, `/read/${EPI_A}`);
    const failed = await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    check(`${tag} reader: one h1 is exposed`, (await exposedH1s(page)) === 1);
    const head = headOf(EPI_A);
    const info = await page.evaluate(() => ({
      lines: document.querySelectorAll('#surface-library .rd-line').length,
      title: document.querySelector('#surface-library')?.innerText || '',
      next: !!document.querySelector('#surface-library [data-rd="next"]'),
    }));
    check(
      `${tag} reader: paper renders the first page`,
      !failed && info.lines > 0 && info.lines <= 250,
      failed || `${info.lines} lines`
    );
    check(`${tag} reader: title shown`, info.title.includes(head.title));
    if (check(`${tag} reader: Load next for a 2-page reading`, info.next)) {
      await page.click('#surface-library [data-rd="next"]');
      await page
        .waitForFunction(
          (n) => document.querySelectorAll('#surface-library .rd-line').length > n,
          info.lines,
          { timeout: 10000 }
        )
        .catch(() => {});
      const more = await page.$$eval('#surface-library .rd-line', (l) => l.length);
      check(
        `${tag} reader: paging appends the next rows`,
        more > info.lines,
        `${info.lines} → ${more}`
      );
    }
    // Line selection → passage bar → Lyrics handoff with the exact text.
    const toggles = await page.$$('#surface-library [data-rd="toggle"]');
    const picked = [];
    for (const t of toggles.slice(4, 7)) {
      await t.click();
      picked.push(await t.evaluate((el) => el.closest('.rd-line')?.id));
    }
    const texts = await page.evaluate(
      (ids) =>
        ids.map(
          (id) =>
            document.getElementById(id)?.querySelector('.rd-text, .rd-t, [class*="text"]')
              ?.textContent ?? ''
        ),
      picked
    );
    const bar = await page.isVisible('#surface-library [data-rd="p-lyrics"]').catch(() => false);
    if (
      check(
        `${tag} reader: passage bar after selecting lines`,
        bar && picked.length === 3,
        `${picked.length} picked`
      )
    ) {
      // The exact text: the derived lyric rows the reader holds for those ids.
      const expected = await page.evaluate(
        async ({ id, ids }) => {
          const core = await libraryChunk('core');
          const head = await core.lib.reading(id);
          return head.lines.filter((l, row) => ids.includes(row)).map((l) => l[1]);
        },
        {
          id: EPI_A,
          ids: await page.evaluate(
            (ids) => ids.map((i) => Number(document.getElementById(i)?.dataset.row)),
            picked
          ),
        }
      );
      await page.click('#surface-library [data-rd="p-lyrics"]');
      await page
        .waitForFunction(() => !location.hash.startsWith('#library'), null, { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(800);
      const lyr = await page.evaluate(() => ({
        hash: location.hash,
        text:
          [...document.querySelectorAll('textarea')].map((t) => t.value).join('\n') +
          '\n' +
          (document.querySelector('[id^="surface-lyrics"], #surface-lyrics')?.innerText || ''),
      }));
      check(`${tag} reader: Lyrics handoff opens Lyrics`, /lyrics/i.test(lyr.hash), lyr.hash);
      const missing = expected.filter((t) => t.trim() && !lyr.text.includes(t));
      check(
        `${tag} reader: Lyrics holds the exact excerpt`,
        expected.length === 3 && missing.length === 0,
        `missing ${JSON.stringify(missing.slice(0, 2))} (shown ${JSON.stringify(texts)})`
      );
    }
  },

  async compare({ page, base, tag }) {
    await go(page, base, `/read/${EPI_A}?compare=${EPI_B}`);
    const failed = await settled(page, 'compare', '#surface-library .lib-cmp-rows > div', 25000);
    const info = await page.evaluate(() => ({
      count: document.querySelector('#surface-library [data-count]')?.textContent || '',
      rows: document.querySelectorAll('#surface-library .lib-cmp-rows > div').length,
      related: [...document.querySelectorAll('#surface-library .lib-cmp-pick')].map(
        (b) => b.dataset.pick
      ),
    }));
    check(
      `${tag} compare: deep link ?compare= opens the aligned diff`,
      !failed && info.count === '340 differing aligned rows / 433 total' && info.rows === 250,
      failed || `${info.count} · ${info.rows} rows`
    );
    check(
      `${tag} compare: picker offers the other reading of the work`,
      info.related.includes(EPI_B),
      info.related.join(',')
    );
    // Golden: the chunk's alignLines equals compare-text.ts on these readings.
    await page.click('#surface-library [data-more]');
    check(
      `${tag} compare: Show next aligned rows`,
      (await page.$$eval('#surface-library .lib-cmp-rows > div', (d) => d.length)) === 433
    );
    await page.click('#surface-library [data-mode="Other"]');
    if (tag.includes('390')) {
      const shown = await page.$eval('#surface-library .lib-cmp-rows > div', (r) =>
        [...r.children].map((c) => getComputedStyle(c).display)
      );
      check(
        `${tag} compare: mobile Other mode shows one column`,
        shown[0] === 'none' && shown[1] !== 'none',
        shown.join(',')
      );
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({
      open: !!document.querySelector('.lib-cmp-sheet'),
      hash: location.hash,
    }));
    check(
      `${tag} compare: Escape closes and removes ?compare`,
      !after.open && !/compare=/.test(after.hash),
      JSON.stringify(after)
    );
    // Compare passage: five selected lines → only their aligned rows.
    const toggles = await page.$$('#surface-library [data-rd="toggle"]');
    for (const t of toggles.slice(3, 8)) await t.click();
    await page.click('#surface-library [data-rd="p-compare"]');
    await page.click(`#surface-library .lib-cmp-pick[data-pick="${EPI_B}"]`);
    await page.waitForSelector('#surface-library .lib-cmp-rows > div', { timeout: 15000 });
    const passage = await page.evaluate(() => ({
      bar:
        document.querySelector('#surface-library .lib-cmp-bar')?.textContent.replace(/\s+/g, ' ') ||
        '',
      rows: document.querySelectorAll('#surface-library .lib-cmp-rows > div').length,
    }));
    check(
      `${tag} compare: Compare passage restricts to the selected lines`,
      /Selected earlier passage · 5 lines/.test(passage.bar) && passage.rows === 5,
      `${passage.rows} rows · ${passage.bar}`
    );
    await page.keyboard.press('Escape');
    // Right-to-left: two Persian readings (no RTL work has a second reading,
    // so a cross-work text comparison).
    await go(page, base, `/read/${FAS_A}?compare=${FAS_B}`);
    await page.waitForSelector('#surface-library .lib-cmp-rows > div', { timeout: 20000 });
    const rtl = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#surface-library .lib-cmp-rows > div > div')];
      return {
        dirs: [...new Set(cells.map((c) => c.getAttribute('dir')))],
        lang: [...new Set(cells.map((c) => c.querySelector('span')?.getAttribute('lang')))],
        badge: document.querySelector('#surface-library .lib-cmp-badge')?.textContent || '',
      };
    });
    check(
      `${tag} compare: Persian pair renders right-to-left, lang fas, as a text comparison`,
      rtl.dirs.join() === 'rtl' && rtl.lang.join() === 'fas' && rtl.badge === 'Text comparison',
      JSON.stringify(rtl)
    );
  },

  // Jony's round 6: the compare dialog keeps focus (#17), the phone
  // inspector takes it and gives it back (#18), and four actions that
  // re-render or navigate land focus on a real control, never <body> (#19).
  // Real keys throughout.
  async focus({ page, base, tag }) {
    const where = () =>
      page.evaluate(() => {
        const a = document.activeElement;
        return {
          body: !a || a === document.body,
          cmp: !!a?.closest('.lib-cmp-sheet'),
          insp: !!a?.closest('#surface-library .rd-insp'),
          rd: a?.dataset?.rd || '',
          id: a?.dataset?.id || a?.id || '',
          pressed: a?.getAttribute('aria-pressed'),
          tag: a?.tagName || '',
          name: (a?.getAttribute('aria-label') || a?.textContent || '').trim().slice(0, 40),
        };
      });
    // #17: Tab and Shift+Tab never leave the compare dialog.
    await go(page, base, `/read/${EPI_A}?compare=${EPI_B}`);
    await page.waitForSelector('#surface-library .lib-cmp-rows > div', { timeout: 25000 });
    await page.focus('.lib-cmp-sheet [data-close]');
    const out = [];
    for (const key of [...Array(4).fill('Shift+Tab'), ...Array(30).fill('Tab')]) {
      await page.keyboard.press(key);
      const w = await where();
      if (!w.body && !w.cmp) out.push(w.name);
    }
    check(
      `${tag} focus: Tab stays in the compare dialog`,
      !out.length,
      `${out.length} stop(s) outside: ${out.slice(0, 4).join(' | ')}`
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // #19a: Export selection keeps focus on the toggled button.
    await go(page, base, `/read/${EPI_A}`);
    await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    await page.focus('#surface-library [data-rd="select"]');
    await page.keyboard.press('Enter');
    const sel = await where();
    check(
      `${tag} focus: Export selection keeps focus on its button`,
      sel.rd === 'select' && sel.pressed === 'true',
      JSON.stringify(sel)
    );
    // #49: the content area is not itself a live region (a re-render would be
    // read aloud whole); a short status goes to the one region outside it.
    const live = await page.evaluate(() => {
      const main = document.getElementById('library-main');
      const region = document.getElementById('library-live');
      return {
        mainLive: main?.getAttribute('aria-live') || null,
        role: region?.getAttribute('role') || null,
        outside: !!region && !!main && !main.contains(region),
      };
    });
    check(
      `${tag} live: the Library content area is not a live region; one status region sits outside it`,
      !live.mainLive && live.role === 'status' && live.outside,
      JSON.stringify(live)
    );
    await page.focus('#surface-library .rd-num:not([disabled])');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const heard = await page.evaluate(
      () => document.getElementById('library-live')?.textContent || ''
    );
    check(
      `${tag} live: selecting a line says how many are selected`,
      heard === '1 line selected',
      heard
    );
    await page.keyboard.press('Enter');
    // #18: at a phone width, Inspect moves focus into the sheet, Tab stays
    // there, and Escape gives it back to Inspect.
    if (await page.isVisible('#surface-library [data-rd="sheet"]')) {
      await page.focus('#surface-library [data-rd="sheet"]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      const opened = await where();
      const behind = [];
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const w = await where();
        if (!w.body && !w.insp) behind.push(w.name);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const back = await where();
      check(
        `${tag} focus: Inspect moves focus into the inspector sheet`,
        opened.insp,
        JSON.stringify(opened)
      );
      check(
        `${tag} focus: Tab stays in the inspector sheet`,
        !behind.length,
        `${behind.length} stop(s) behind it: ${behind.slice(0, 4).join(' | ')}`
      );
      check(
        `${tag} focus: closing the inspector sheet returns focus to Inspect`,
        back.rd === 'sheet',
        JSON.stringify(back)
      );
    }
    // #19b: Inspect source row lands on the Sources lens it opened.
    await page.focus('#surface-library [data-rd="srcrow"]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const src = await where();
    check(
      `${tag} focus: Inspect source row lands on the Sources lens`,
      src.rd === 'lens' && src.id === 'sources',
      JSON.stringify(src)
    );
    // #51: where that opens the sheet, the sheet is a modal dialog, and Escape
    // returns focus to the source row's button, re-rendered meanwhile.
    const sheet = await page.evaluate(() => {
      const insp = document.querySelector('#surface-library .rd-insp');
      return {
        open: !!document.querySelector('#surface-library .rd-sheet'),
        fixed: !!insp && getComputedStyle(insp).position === 'fixed',
        role: insp?.getAttribute('role') || null,
        modal: insp?.getAttribute('aria-modal') || null,
      };
    });
    if (sheet.open && sheet.fixed) {
      check(
        `${tag} focus: the inspector sheet is a modal dialog`,
        sheet.role === 'dialog' && sheet.modal === 'true',
        JSON.stringify(sheet)
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const backSrc = await where();
      check(
        `${tag} focus: Escape from the sheet returns focus to Inspect source row`,
        backSrc.rd === 'srcrow',
        JSON.stringify(backSrc)
      );
    }
    // #19c: a works result opens the reader with focus on its title.
    await go(page, base, '/works');
    await settled(page, 'works', '#surface-library [data-lw="open"][aria-label^="Read "]');
    await page.focus('#surface-library [data-lw="open"][aria-label^="Read "]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 20000 });
    await page.waitForTimeout(200);
    const opened = await where();
    check(
      `${tag} focus: a works result opens the reader with focus on its title`,
      opened.tag === 'H1',
      JSON.stringify(opened)
    );
    // An untitled reading's title still says something, so focus on it is
    // never an empty, zero-size heading (Jony, on d66311db3c).
    await go(page, base, `/read/${UNTITLED}`);
    await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    await page.waitForTimeout(200);
    const untitled = await page.evaluate(() => {
      const a = document.activeElement;
      return { tag: a.tagName, text: a.textContent.trim(), width: a.getBoundingClientRect().width };
    });
    check(
      `${tag} focus: an untitled reading focuses a heading that says so`,
      untitled.tag === 'H1' && untitled.text === 'Untitled reading' && untitled.width > 0,
      JSON.stringify(untitled)
    );
    await go(page, base, `/read/${EPI_A}`);
    await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    // #19d: Open in Lyrics lands in the Lyrics draft.
    await page.focus('#surface-library [data-rd="lyrics"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash.startsWith('#lyrics'), null, {
      timeout: 20000,
    });
    // The import finishes after the route changes: wait for it, not a fixed time.
    await page
      .waitForFunction(() => document.activeElement?.id === 'lyrics-draft', null, {
        timeout: 10000,
      })
      .catch(() => {});
    const ly = await where();
    check(
      `${tag} focus: Open in Lyrics lands in the Lyrics draft`,
      ly.id === 'lyrics-draft',
      JSON.stringify(ly)
    );
  },

  async analysis({ page, base, tag, log }) {
    await go(page, base, `/read/${EPI_A}?lens=sound`);
    await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    // Narrow screens keep the inspector in a sheet: open it.
    if (await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false))
      await page.click('#surface-library [data-rd="sheet"]');
    const analyze = await page
      .waitForSelector('#surface-library [data-act="analyze"]', { timeout: 15000 })
      .catch(() => null);
    if (!check(`${tag} analysis: Sound lens offers Analyze`, !!analyze)) return;
    await analyze.click();
    await page
      .waitForFunction(
        () => /running/i.test(document.querySelector('#surface-library')?.innerText || ''),
        null,
        { timeout: 10000 }
      )
      .catch(() => {});
    check(
      `${tag} analysis: POST /analyses sent`,
      log.some((l) => l.startsWith('POST /analyses')),
      log.slice(-5).join(' | ')
    );
    const state = await page.evaluate(
      () => document.querySelector('#surface-library')?.innerText || ''
    );
    check(`${tag} analysis: job state shown`, /running/i.test(state), short(state, 300));
    for (const lens of ['form', 'rhythm', 'language', 'summary', 'sources']) {
      const tab = await page.$(`#surface-library [data-rd="lens"][data-id="${lens}"]`);
      if (!tab) {
        check(`${tag} analysis: ${lens} lens tab present`, false);
        continue;
      }
      await tab.click();
      await page.waitForTimeout(250);
      const h = await page.evaluate(() => location.hash);
      check(
        `${tag} analysis: ${lens} lens renders`,
        h.includes(`lens=${lens}`) || lens === 'summary',
        h
      );
      const kept = await page.evaluate(() => ({
        rd: document.activeElement?.dataset?.rd || document.activeElement?.tagName,
        id: document.activeElement?.dataset?.id,
        live: document.getElementById('library-live')?.textContent || '',
      }));
      check(
        `${tag} analysis: the ${lens} lens chip keeps focus and is named`,
        kept.rd === 'lens' && kept.id === lens && / lens$/.test(kept.live),
        JSON.stringify(kept)
      );
    }
    // A lens switch that changes no state says only the lens: everything
    // written to #library-live is "<Lens> lens", and no other polite live
    // region in the inspector re-reads the analysis intro (Jony, 6396554291).
    await page.evaluate(() => {
      window.__said = [];
      const live = document.getElementById('library-live');
      new MutationObserver(() => live.textContent && window.__said.push(live.textContent)).observe(
        live,
        { childList: true, characterData: true, subtree: true }
      );
    });
    await page.click('#surface-library [data-rd="lens"][data-id="form"]');
    await page.waitForTimeout(700);
    const quiet = await page.evaluate(() => ({
      said: window.__said,
      others: [...document.querySelectorAll('#surface-library [aria-live]')]
        .filter((el) => el.id !== 'library-live' && el.getAttribute('aria-live') !== 'off')
        .map((el) => el.className || el.id),
    }));
    check(
      `${tag} analysis: a lens switch with no state change says only the lens name`,
      quiet.said.length > 0 && quiet.said.every((t) => t === 'Form lens') && !quiet.others.length,
      JSON.stringify(quiet)
    );
  },
};
// Saved pronunciation choices across the reader's word cut
// (src/library/analysis.js savedInterpretation): a record the page writes
// carries token_cut; an unmarked one is rebound once on the same characters
// with a visible notice, and a choice no current word covers is shown as
// needing a decision, is not sent, and stops a new analysis until removed.
// The inspector on a reader page, opened to its analysis status.
async function inspectorOpen(page) {
  await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
  if (await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false))
    await page.click('#surface-library [data-rd="sheet"]');
  return page
    .waitForSelector('#surface-library [data-act="analyze"]', { timeout: 15000 })
    .catch(() => null);
}
// The Library's device store (core's IndexedDB): 'put' a record, or 'list'
// every record whose key starts with `key`.
const idbOp = (page, op, key, value) =>
  page.evaluate(
    ([op, key, value]) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('codex-musica-library-v1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('state');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const t = r.result.transaction('state', op === 'put' ? 'readwrite' : 'readonly');
          const s = t.objectStore('state');
          const out = {};
          if (op === 'put') s.put(value, key);
          else {
            const c = s.openCursor();
            c.onsuccess = () => {
              const cur = c.result;
              if (!cur) return;
              if (String(cur.key).startsWith(key)) out[cur.key] = cur.value;
              cur.continue();
            };
          }
          t.oncomplete = () => (r.result.close(), resolve(out));
          t.onerror = () => reject(t.error);
        };
      }),
    [op, key, value]
  );
const savedChoice = (line, token, word) => ({
  line,
  token,
  word,
  phones: ['AA1'],
  basis: 'declared',
  source: 'the singer',
});
SECTIONS.declarations = async function ({ page, base, tag, log }) {
  const open = () => inspectorOpen(page);
  const idb = (op, key, value) => idbOp(page, op, key, value);
  await go(page, base, `/read/${EPI_A}?lens=sound`);
  if (!check(`${tag} declarations: inspector mounted`, !!(await open()))) return;
  // An interpretation applied now is written with the current cut's mark.
  await page.click('#surface-library [data-act="decl"]');
  await page.waitForSelector('#surface-library .la-decl [data-act="save"]', { timeout: 10000 });
  await page.click('#surface-library .la-decl [data-act="save"]');
  await page.waitForTimeout(300);
  const written = await idb('list', `interpretation:${EPI_A}:`);
  const key = Object.keys(written)[0];
  if (!check(`${tag} declarations: an applied interpretation is saved`, !!key)) return;
  check(
    `${tag} declarations: a record written now carries token_cut v2`,
    written[key].token_cut === 'v2',
    JSON.stringify(written[key])
  );
  await idb('put', key, {
    declarations: {
      pronunciations: [
        savedChoice('U--h, Lawdy', 2, 'Lawdy'),
        savedChoice('ways:--and the road', 2, '--and'),
        savedChoice('Oh--oh, oh my love', 2, 'oh'),
      ],
    },
  });
  await page.reload();
  await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
  if (!check(`${tag} declarations: inspector remounted`, !!(await open()))) return;
  await page
    .waitForSelector('#surface-library [data-cut="renumbered"]', { timeout: 10000 })
    .catch(() => {});
  const text = (sel) =>
    page.evaluate((s) => document.querySelector(s)?.innerText || '', `#surface-library ${sel}`);
  check(
    `${tag} declarations: the renumbering is said`,
    /“Lawdy” token 2 → 3/.test(await text('[data-cut="renumbered"]')),
    await text('[data-cut="renumbered"]')
  );
  check(
    `${tag} declarations: the uncovered choice needs a decision`,
    /--and/.test(await text('[data-cut="undecided"]')),
    await text('[data-cut="undecided"]')
  );
  check(
    `${tag} declarations: a number naming different words under the two cuts is set aside naming both`,
    /“oh” at characters 9–10 under the earlier word cut and “oh” at characters 5–6 under the current one/.test(
      await text('[data-cut="undecided"]')
    ),
    await text('[data-cut="undecided"]')
  );
  await page.click('#surface-library [data-act="analyze"]');
  await page.waitForTimeout(300);
  check(
    `${tag} declarations: no analysis starts while a choice is undecided`,
    !log.some((l) => l.startsWith('POST /analyses')) &&
      /Nothing was sent/.test(
        await page.evaluate(() => document.getElementById('library-live')?.textContent || '')
      ),
    log.slice(-4).join(' | ')
  );
  for (let i = 0; i < 2; i++) {
    await page.click('#surface-library [data-act="drop-undecided"]');
    await page.waitForTimeout(300);
  }
  await page.click('#surface-library [data-act="analyze"]');
  await page
    .waitForFunction(
      () => /running/i.test(document.querySelector('#surface-library')?.innerText || ''),
      null,
      {
        timeout: 10000,
      }
    )
    .catch(() => {});
  const body = log.find((l) => l.startsWith('BODY ')) || '';
  check(
    `${tag} declarations: the rebound choice is sent on its new number, the removed one never`,
    /"token":3/.test(body) && !/--and/.test(body) && !/"token":2/.test(body) && !/"oh"/.test(body),
    body
  );
  const after = (await idb('list', key))[key] || {};
  check(
    `${tag} declarations: the saved record is marked, keeps the original, has no undecided`,
    after.token_cut === 'v2' && !!after.legacy_declarations && !after.undecided,
    JSON.stringify(after).slice(0, 300)
  );
};
// A tab opened before this release still runs the previous generation's
// analysis chunk (library/code/generations.json keeps it 30 days), and that
// chunk saves `{ declarations }` with no word-cut mark. A record the current
// page wrote under the current cut, re-saved there, comes back unmarked: the
// current page keeps the rows it can prove (same characters under both cuts,
// or a match only under the current cut) and sets aside, naming both
// readings, a number that names different words under the two cuts, instead
// of moving it to whichever word the earlier cut would give.
const RETAINED_ANALYSIS = 'analysis.71b110b249.js';
SECTIONS.retained = async function ({ page, base, tag }) {
  const file = path.join(ROOT, 'library', 'code', RETAINED_ANALYSIS);
  if (!fs.existsSync(file)) {
    results.push(`SKIP ${tag} retained — ${RETAINED_ANALYSIS} is no longer kept`);
    return;
  }
  const bytes = fs.readFileSync(file);
  const integrity = `sha384-${require('crypto').createHash('sha384').update(bytes).digest('base64')}`;
  const idb = (op, key, value) => idbOp(page, op, key, value);
  const text = (sel) =>
    page.evaluate((q) => document.querySelector(q)?.innerText || '', `#surface-library ${sel}`);
  await go(page, base, `/read/${EPI_A}?lens=sound`);
  if (!check(`${tag} retained: current inspector mounted`, !!(await inspectorOpen(page)))) return;
  const key = `interpretation:${EPI_A}:`;
  const rows = [
    savedChoice('U--h, Lawdy', 3, 'Lawdy'), // a match only under the current cut
    savedChoice('the night is long above', 5, 'above'), // same characters under both
    savedChoice('Oh--oh, oh, oh my love', 3, 'oh'), // different characters under each
  ];
  // The current page saves an interpretation (marked), and holds these rows
  // as a record it wrote under the current cut.
  await page.click('#surface-library [data-act="decl"]');
  await page.waitForSelector('#surface-library .la-decl [data-act="save"]', { timeout: 10000 });
  await page.click('#surface-library .la-decl [data-act="save"]');
  await page.waitForTimeout(300);
  let saved = await idb('list', key);
  const full = Object.keys(saved)[0];
  if (
    !check(
      `${tag} retained: the current page saved a marked record`,
      saved[full]?.token_cut === 'v2',
      JSON.stringify(saved)
    )
  )
    return;
  await idb('put', full, { declarations: { pronunciations: rows }, token_cut: 'v2' });
  // An old tab: codex.html as the previous build wrote it, naming the
  // retained analysis chunk.
  await page.route(`${base}/codex.html`, async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace(
      /analysis:\["library\/code\/analysis\.[0-9a-f]{10}\.js","sha384-[^"]+"\]/,
      `analysis:["library/code/${RETAINED_ANALYSIS}","${integrity}"]`
    );
    await route.fulfill({ response: res, body: html });
  });
  await page.route(`${base}/library/code/${RETAINED_ANALYSIS}`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: bytes })
  );
  await page.reload();
  await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
  if (!check(`${tag} retained: the retained chunk mounted`, !!(await inspectorOpen(page)))) return;
  check(
    `${tag} retained: the old tab runs the retained chunk`,
    await page.evaluate(
      (name) => [...document.scripts].some((s) => s.src.endsWith(name)),
      RETAINED_ANALYSIS
    )
  );
  await page.click('#surface-library [data-act="decl"]');
  await page.waitForSelector('#surface-library .la-decl [data-act="save"]', { timeout: 10000 });
  await page.click('#surface-library .la-decl [data-act="save"]');
  await page.waitForTimeout(300);
  saved = (await idb('list', key))[full] || {};
  check(
    `${tag} retained: the retained chunk's save drops the word-cut mark`,
    saved.token_cut === undefined && saved.declarations?.pronunciations?.length === 3,
    JSON.stringify(saved).slice(0, 300)
  );
  // The same tab reloaded after the release: the current chunk again.
  await page.unroute(`${base}/codex.html`);
  await page.unroute(`${base}/library/code/${RETAINED_ANALYSIS}`);
  await page.reload();
  await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
  if (!check(`${tag} retained: the current chunk remounted`, !!(await inspectorOpen(page)))) return;
  await page
    .waitForSelector('#surface-library [data-cut="undecided"]', { timeout: 10000 })
    .catch(() => {});
  const undecided = await text('[data-cut="undecided"]');
  check(
    `${tag} retained: the number that names different words is set aside, naming both`,
    /“oh” at characters 13–14 under the earlier word cut and “oh” at characters 9–10 under the current one/.test(
      undecided
    ),
    undecided
  );
  check(
    `${tag} retained: no row was moved to another word`,
    !(await page.$('#surface-library [data-cut="renumbered"]')),
    await text('[data-cut="renumbered"]')
  );
  const after = (await idb('list', key))[full] || {};
  check(
    `${tag} retained: the provable rows are kept on their numbers, and the record is marked again`,
    after.token_cut === 'v2' &&
      JSON.stringify(after.declarations?.pronunciations?.map((r) => [r.word, r.token])) ===
        JSON.stringify([
          ['Lawdy', 3],
          ['above', 5],
        ]) &&
      after.undecided?.length === 1,
    JSON.stringify(after).slice(0, 400)
  );
};
// Retry (Jony #59): every Library data file answers 503, so each view shows its
// failure; a Retry that fails again lands focus on the new Retry and says, in
// plain words, what to do; served again, a Retry lands on the loaded view and
// says it loaded. Before the fix both ended with focus on BODY and the line
// read "Failed to fetch" or "Library data 503: …".
SECTIONS.retry = async function ({ page, base, tag, errors }) {
  const RETRY =
    '#surface-library .cm-empty [data-lib-act="retry"], #surface-library [data-lw="retry"], #surface-library [data-rd-retry]';
  const live = () =>
    page.evaluate(() => document.getElementById('library-live')?.textContent || '');
  const focused = (sel) =>
    page.evaluate((s) => {
      const a = document.activeElement;
      return a && a !== document.body && a.matches(s) ? a.outerHTML.slice(0, 120) : '';
    }, sel);
  // Click the Retry on screen and wait for its replacement (a new Retry, or
  // the loaded view's own selector).
  const retryInto = async (sel) => {
    await page.$eval(RETRY, (b) => (b.dataset.old = '1'));
    await page.evaluate(() => (document.getElementById('library-live').textContent = ''));
    await page.click(RETRY);
    await page.waitForFunction(
      (s) => {
        const e = document.querySelector(s);
        return e && !e.dataset.old;
      },
      sel,
      { timeout: 20000 }
    );
    await page
      .waitForFunction(() => document.getElementById('library-live')?.textContent, null, {
        timeout: 3000,
      })
      .catch(() => {});
  };
  const fail = (route) => route.fulfill({ status: 503, body: 'unavailable' });
  for (const [view, hash, loaded, landing] of [
    ['home', '', '#surface-library .lib-shelf', '.lib-shelf-scroll'],
    ['works', '/works', '#surface-library [data-lw="open"]', '[data-lw="open"]'],
    ['reader', `/read/${EPI_A}`, '#surface-library .rd h1', '.rd h1'],
  ]) {
    await page.route('**/library/data/**', fail);
    await go(page, base, hash);
    await page.waitForSelector(RETRY, { timeout: 20000 });
    const shown = await page.$eval('#surface-library .cm-empty', (e) => e.textContent);
    check(
      `${tag} retry ${view}: the failure says what to do, not the transport's words`,
      /Couldn’t reach the Library\. Check your connection and try again\./.test(shown) &&
        !/Failed to fetch|\b503\b|library\/data|\.json/i.test(shown),
      short(shown)
    );
    // Said once (R2's nit on d53f3ac04b): the visible state is not a second
    // live region; #library-live is the one voice, first failure included.
    await page
      .waitForFunction(() => document.getElementById('library-live')?.textContent, null, {
        timeout: 3000,
      })
      .catch(() => {});
    const once = await page.evaluate(() => ({
      said: document.getElementById('library-live')?.textContent || '',
      voices: [
        ...document.querySelectorAll(
          '#surface-library [aria-live], #surface-library [role="status"], #surface-library [role="alert"]'
        ),
      ]
        .filter((el) => el.id !== 'library-live' && el.getAttribute('aria-live') !== 'off')
        .map((el) => el.className || el.tagName),
    }));
    check(
      `${tag} retry ${view}: the failure is said once, through #library-live`,
      /Couldn’t reach the Library/.test(once.said) && !once.voices.length,
      JSON.stringify(once)
    );
    await retryInto(RETRY);
    check(
      `${tag} retry ${view}: a Retry that fails again lands on the new Retry`,
      !!(await focused(RETRY)),
      await page.evaluate(() => document.activeElement?.tagName)
    );
    const saidFail = await live();
    check(
      `${tag} retry ${view}: and says the plain line through #library-live`,
      /Couldn’t reach the Library/.test(saidFail) && !/Failed to fetch|\b503\b/.test(saidFail),
      short(saidFail)
    );
    await page.unroute('**/library/data/**', fail);
    await retryInto(loaded);
    check(
      `${tag} retry ${view}: a Retry that succeeds lands on the loaded view`,
      !!(await focused(`#surface-library ${landing}`)),
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
    );
    const saidOk = await live();
    const voices = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '#surface-library [aria-live], #surface-library [role="status"]'
        ),
      ]
        .filter((el) => el.id !== 'library-live' && el.getAttribute('aria-live') !== 'off')
        .map((el) => el.className || el.tagName)
    );
    check(
      `${tag} retry ${view}: and says it loaded, in one line from the one live region`,
      /loaded/.test(saidOk) && !/\n|Work \/ reading|Contributor/.test(saidOk) && !voices.length,
      `${short(saidOk)} · ${voices.join(',')}`
    );
  }
  // Analyze (Jony #59, 3PO's wording): a 503 after POST /analyses cannot show
  // that nothing was admitted, so it never says "Nothing was sent"; it says the
  // status is unconfirmed, and focus stays on Analyze through the redraws.
  // Served again, the next press starts the job with focus still there.
  const down = (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 503,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': req.headers().origin || '*',
        'access-control-allow-credentials': 'true',
      },
      body: '{}',
    });
  };
  await page.route(`${API}/analyses`, down);
  await go(page, base, `/read/${EPI_A}?lens=sound`);
  const analyze = await inspectorOpen(page);
  if (check(`${tag} retry analyze: Sound lens offers Analyze`, !!analyze)) {
    await page.evaluate(() => (document.getElementById('library-live').textContent = ''));
    await analyze.click();
    await page.waitForSelector('#surface-library .la-error', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(300);
    const err = await page
      .$eval('#surface-library .la-error', (e) => e.textContent)
      .catch(() => '');
    check(
      `${tag} retry analyze: a 503 after POST says the status is unconfirmed, never "Nothing was sent"`,
      err === 'The analysis service is unavailable. We couldn’t confirm the current status.',
      short(err)
    );
    check(
      `${tag} retry analyze: a failed Analyze keeps focus on Analyze`,
      !!(await focused('#surface-library [data-act="analyze"]')),
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
    );
    const said = await live();
    check(
      `${tag} retry analyze: and says the same line through #library-live`,
      /couldn’t confirm the current status/.test(said) && !/Nothing was sent|\b503\b/.test(said),
      short(said)
    );
    await page.unroute(`${API}/analyses`, down);
    await page.click('#surface-library [data-act="analyze"]');
    await page
      .waitForFunction(
        () =>
          /running/i.test(document.querySelector('#surface-library .la-section')?.innerText || ''),
        null,
        { timeout: 10000 }
      )
      .catch(() => {});
    await page.waitForTimeout(300);
    check(
      `${tag} retry analyze: an Analyze that starts the job keeps focus on its replacement`,
      !!(await focused('#surface-library [data-act="analyze"]')),
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
    );
  }
  // The failures this section asked for are not the page's errors.
  for (let i = errors.length - 1; i >= 0; i--)
    if (/^(503 \/library\/data\/|console: \[library( reader)?\])/.test(errors[i]))
      errors.splice(i, 1);
};
// Keys (Jony round 15). #67: one Escape, one layer: the Escape that closes
// the app's More menu does not also clear the reader's line selection, and
// one pressed in the reader still does. #68: the Works hint names the
// platform's key (Ctrl K off Apple), and Ctrl+K is taken only while Works is
// on screen and focus is not in another text field.
SECTIONS.keys = async function ({ page, base, tag }) {
  const pressed = () =>
    page.$$eval('#surface-library [data-rd="toggle"][aria-pressed="true"]', (b) => b.length);
  await go(page, base, `/read/${EPI_A}`);
  await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
  const toggles = await page.$$('#surface-library [data-rd="toggle"]:not([disabled])');
  for (const t of toggles.slice(0, 2)) await t.click();
  const before = await pressed();
  await page.click('[data-ui="menu"]');
  await page.waitForSelector('#ui-menu:not([hidden])', { timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const menuHidden = await page.$eval('#ui-menu', (m) => m.hidden);
  const after = await pressed();
  check(
    `${tag} keys: the Escape that closes the More menu leaves the line selection`,
    before === 2 && menuHidden && after === 2,
    `selected ${before} → ${after}, menu hidden ${menuHidden}`
  );
  // Where the menu's Escape cleared it (before the fix), select again so the
  // reader's own Escape is still tested.
  if (!(await pressed())) await page.click('#surface-library [data-rd="toggle"]:not([disabled])');
  await page.focus('#surface-library [data-rd="toggle"][aria-pressed="true"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(
    `${tag} keys: an Escape pressed in the reader still clears the selection`,
    (await pressed()) === 0,
    String(await pressed())
  );

  await go(page, base, '/works');
  await settled(page, 'works', '#surface-library [data-lw="open"]');
  const hint = await page.$eval('#surface-library .cm-search kbd', (k) => k.textContent);
  const aria = await page.$eval('#surface-library [data-lw="q"]', (i) =>
    i.getAttribute('aria-keyshortcuts')
  );
  check(
    `${tag} keys: off Apple platforms the Works hint says Ctrl K`,
    hint === 'Ctrl K' && aria === 'Control+K',
    `${hint} · ${aria}`
  );
  // What Ctrl+K did: where focus landed, and whether the page took the key
  // from the browser.
  const ctrlK = async () => {
    await page.evaluate(() => {
      window.__k = null;
      const seen = (e) => {
        if (e.key.toLowerCase() !== 'k') return;
        window.__k = e.defaultPrevented;
        window.removeEventListener('keydown', seen);
      };
      window.addEventListener('keydown', seen);
    });
    await page.keyboard.press('Control+k');
    return page.evaluate(() => ({
      taken: window.__k,
      search: document.activeElement?.matches('[data-lw="q"]') || false,
    }));
  };
  await page.evaluate(() => document.activeElement?.blur());
  const free = await ctrlK();
  check(
    `${tag} keys: Ctrl+K on the Works page focuses Search`,
    free.search && free.taken === true,
    JSON.stringify(free)
  );
  await page.evaluate(() => {
    const f = document.createElement('input');
    f.id = 'keys-other-field';
    document.querySelector('#surface-library .lw-head').append(f);
    f.focus();
  });
  const typing = await ctrlK();
  check(
    `${tag} keys: Ctrl+K in another text field leaves focus and the key alone`,
    !typing.search && typing.taken === false,
    JSON.stringify(typing)
  );
  await page.evaluate(() => document.getElementById('keys-other-field')?.remove());
  await page.click('[data-view="lyrics"]');
  await page
    .waitForFunction(
      () => !document.getElementById('surface-library')?.getClientRects().length,
      null,
      { timeout: 5000 }
    )
    .catch(() => {});
  await page.evaluate(() => document.activeElement?.blur());
  const away = await ctrlK();
  check(
    `${tag} keys: with the Library not shown, Ctrl+K stays the browser's`,
    !away.search && away.taken === false,
    JSON.stringify(away)
  );
  // On an Apple platform the hint and the binding are ⌘K.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
  });
  // A real reload of the Works route (a hash change alone keeps the page),
  // so the init script runs; no about:blank hop, whose favicon fetch logs.
  await go(page, base, '/works');
  await page.reload();
  await page.waitForSelector('#surface-library [data-lw="open"]', { timeout: 20000 });
  const mac = await page.$eval('#surface-library .cm-search kbd', (k) => k.textContent);
  check(`${tag} keys: on Apple platforms the hint says ⌘ K`, mac === '⌘ K', mac);
};
// The artwork credit opens from a card's menu (it loads with the rights
// chunk, never on the shelves' first view): a dialog naming the artwork,
// and Close returns focus to the menu button.
SECTIONS.credit = async function ({ page, base, tag }) {
  await go(page, base, '');
  const failed = await settled(page, 'core', '#surface-library .lib-card[data-art]');
  if (!check(`${tag} credit: a card with artwork`, !failed, failed)) return;
  const menu = '#surface-library .lib-card[data-art] [data-lib-act="menu"]';
  await page.click(menu);
  await page.click('#surface-library .lib-menu [data-lib-act="credit"]');
  const dialog = await page
    .waitForSelector('#surface-library dialog.lib-credit[open] h2', { timeout: 15000 })
    .catch(() => null);
  const title = dialog ? (await dialog.textContent()).trim() : '';
  check(`${tag} credit: the artwork credit opens and names its artwork`, !!title, title);
  await page.click('#surface-library dialog.lib-credit .lib-credit-close');
  await page.waitForTimeout(200);
  const back = await page.evaluate(
    (sel) => document.activeElement === document.querySelector(sel),
    menu
  );
  check(`${tag} credit: Close returns focus to the card's menu button`, back);
};
// Keyboard range selection in the reader, as in a list (Jony #116):
// Shift+Arrow extends from the anchor line, Shift+Home/End to the first and
// last line, going back shrinks it, Shift+click matches, Escape clears, and
// the count is said through #library-live.
SECTIONS.range = async function ({ page, base, tag }) {
  await go(page, base, `/read/${EPI_A}`);
  const failed = await settled(
    page,
    'reader',
    '#surface-library .rd-paper .rd-num:not([disabled])'
  );
  if (!check(`${tag} range: reader lines`, !failed, failed)) return;
  const state = () =>
    page.evaluate(() => {
      const nums = [...document.querySelectorAll('#surface-library .rd-num:not([disabled])')];
      const a = document.activeElement;
      return {
        selected: nums
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map((b) => nums.indexOf(b)),
        focus: nums.indexOf(a),
        total: nums.length,
        said: document.getElementById('library-live')?.textContent || '',
      };
    });
  const said = async () => {
    await page.waitForTimeout(120);
    return (await state()).said;
  };
  const nums = '#surface-library .rd-num:not([disabled])';
  await page.locator(nums).nth(1).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  let st = await state();
  check(
    `${tag} range: Shift+ArrowDown twice extends 1 line to 3, focus on the last`,
    JSON.stringify(st.selected) === '[1,2,3]' && st.focus === 3,
    JSON.stringify(st)
  );
  check(`${tag} range: the count is said`, (await said()) === '3 lines selected', st.said);
  await page.keyboard.press('Shift+ArrowUp');
  st = await state();
  check(
    `${tag} range: Shift+ArrowUp shrinks it back to 2`,
    JSON.stringify(st.selected) === '[1,2]' && st.focus === 2,
    JSON.stringify(st)
  );
  await page.keyboard.press('Shift+End');
  st = await state();
  check(
    `${tag} range: Shift+End extends to the last line`,
    st.selected.length === st.total - 1 && st.selected[0] === 1 && st.focus === st.total - 1,
    JSON.stringify({ ...st, selected: st.selected.length })
  );
  await page.keyboard.press('Shift+Home');
  st = await state();
  check(
    `${tag} range: Shift+Home extends from the anchor to the first line`,
    JSON.stringify(st.selected) === '[0,1]' && st.focus === 0,
    JSON.stringify(st)
  );
  await page.keyboard.press('Escape');
  st = await state();
  check(`${tag} range: Escape clears the selection`, st.selected.length === 0, JSON.stringify(st));
  // The body re-renders on Escape; focus stays on the line number that held
  // it rather than dropping to the page, and the clear is said (Jony #130).
  check(
    `${tag} range: Escape keeps focus on the line it was on`,
    st.focus === 0,
    JSON.stringify({ ...st, active: await page.evaluate(() => document.activeElement?.tagName) })
  );
  check(
    `${tag} range: and says the selection is cleared`,
    (await said()) === 'Selection cleared',
    st.said
  );
  await page.locator(nums).nth(0).click();
  await page
    .locator(nums)
    .nth(3)
    .click({ modifiers: ['Shift'] });
  st = await state();
  check(
    `${tag} range: Shift+click selects from the anchor to the clicked line`,
    JSON.stringify(st.selected) === '[0,1,2,3]',
    JSON.stringify(st)
  );
  check(`${tag} range: and says so`, (await said()) === '4 lines selected', st.said);
};
// The rail at a narrow width covers the page: choosing a collection from it
// closes it and lands focus on the collection's heading, said through
// #library-live (Jony #122: it stayed open at 390). Wider, it stays open.
SECTIONS.railpick = async function ({ page, base, tag }) {
  await go(page, base, '');
  const failed = await settled(page, 'core', '#surface-library .lib-card');
  if (!check(`${tag} railpick: shelves`, !failed, failed)) return;
  const narrow = await page.evaluate(() => innerWidth < 1100);
  if (await page.$eval('#surface-library .lib-rail', (r) => r.hidden))
    await page.click('#surface-library .lib-topline [data-lib-act="rail"]');
  await page.waitForSelector('#surface-library .lib-rail .lib-spine', { timeout: 15000 });
  await page.evaluate(() => (document.getElementById('library-live').textContent = ''));
  await page.click('#surface-library .lib-rail .lib-spine');
  await page.waitForSelector('#surface-library .lib-coll-head h1', { timeout: 15000 });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => {
    const rail = document.querySelector('#surface-library .lib-rail');
    const h = document.querySelector('#surface-library .lib-coll-head h1');
    return {
      railOpen: !!rail && !rail.hidden,
      overlays: !!rail && getComputedStyle(rail).position === 'fixed',
      onHeading: document.activeElement === h,
      title: h?.textContent.trim(),
      said: document.getElementById('library-live').textContent,
    };
  });
  if (narrow)
    check(
      `${tag} railpick: choosing a collection closes the narrow rail, focuses and says its heading`,
      !st.railOpen && st.onHeading && st.said.includes(st.title),
      JSON.stringify(st)
    );
  else
    check(
      `${tag} railpick: wide, the rail stays open after choosing a collection`,
      st.railOpen,
      JSON.stringify(st)
    );
};
// Structure as a screen reader meets it (Jony #127, #128), read from
// Chrome's accessibility tree: each language shelf is one group (it was a
// region, listed under landmarks beside its heading), the Works table has a
// name, and the reader's headings nest under its h1 with no level skipped
// (its lens sections were h3 straight under the h1).
SECTIONS.ax = async function ({ page, base, tag }) {
  const cdp = await page.context().newCDPSession(page);
  const ax = async () =>
    (await cdp.send('Accessibility.getFullAXTree')).nodes
      .filter((n) => !n.ignored)
      .map((n) => ({ role: n.role?.value, name: n.name?.value || '' }));
  await go(page, base, '');
  const failed = await settled(page, 'core', '#surface-library .lib-shelf');
  if (!check(`${tag} ax: shelves`, !failed, failed)) return;
  const langs = await page.$$eval('#surface-library .lib-shelf-head h2', (h) =>
    h.map((x) => x.textContent.trim())
  );
  const nodes = await ax();
  const twice = langs.filter(
    (l) =>
      nodes.filter((n) => n.role === 'region' && n.name === l).length !== 0 ||
      nodes.filter((n) => n.role === 'group' && n.name === l).length !== 1
  );
  check(
    `${tag} ax: each language shelf is one group, not a region`,
    langs.length > 0 && twice.length === 0,
    `${langs.length} shelves; wrong: ${twice.join(', ')}`
  );
  await go(page, base, '/works');
  await settled(page, 'works', '#surface-library [data-lw="open"]');
  const table = (await ax()).find((n) => n.role === 'table');
  check(`${tag} ax: the Works table is named`, !!table?.name, JSON.stringify(table));
  for (const lens of ['summary', 'sources', 'sound']) {
    await go(page, base, `/read/${EPI_A}?lens=${lens}`);
    await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    const sheetOpen = await page
      .$eval('#surface-library .rd', (r) => r.classList.contains('rd-sheet'))
      .catch(() => true);
    if (
      !sheetOpen &&
      (await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false))
    )
      await page.click('#surface-library [data-rd="sheet"]');
    await page.waitForTimeout(300);
    const levels = await page.$$eval(
      '#surface-library h1, #surface-library h2, #surface-library h3, #surface-library h4, #surface-library h5',
      (hs) => hs.filter((h) => h.getClientRects().length).map((h) => Number(h.tagName[1]))
    );
    const skip = levels.findIndex((l, i) => (i === 0 ? l !== 1 : l > levels[i - 1] + 1));
    check(
      `${tag} ax: reader (${lens}) headings nest under its h1`,
      levels.length > 1 && skip < 0,
      levels.join(' ')
    );
  }
};
// A page load's first view is a landing (Jony #129): a direct link to a
// reading or a collection leaves focus where the browser put it, so the
// first Tab reaches the top of the page (the app bar and skip links), not
// past them. In-app steps whose opener went away still land on the heading.
SECTIONS.fresh = async function ({ page, base, tag }) {
  const top = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        body: a === document.body,
        inLibrary: !!a?.closest?.('#surface-library'),
        tag: a?.tagName,
      };
    });
  const firstTab = async () => {
    await page.keyboard.press('Tab');
    return top();
  };
  const collection =
    JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'library', 'data', 'collections.json'), 'utf8')
    ).collections.find((r) => r[3] > 0)?.[0] || '';
  for (const [what, hash, ready] of [
    ['reading', `/read/${EPI_A}`, '#surface-library .rd-paper .rd-line'],
    [
      'collection',
      `/collections/${encodeURIComponent(collection)}`,
      '#surface-library .lib-coll-list',
    ],
  ]) {
    await page.goto('about:blank');
    await go(page, base, hash);
    await page.waitForSelector(ready, { timeout: 20000 });
    await page.waitForTimeout(300);
    const landed = await top();
    check(
      `${tag} fresh: a direct link to a ${what} leaves focus on the page`,
      landed.body,
      JSON.stringify(landed)
    );
    const tabbed = await firstTab();
    check(
      `${tag} fresh: the first Tab after a direct ${what} link reaches the top of the page`,
      !tabbed.body && !tabbed.inLibrary,
      JSON.stringify(tabbed)
    );
  }
  // In-app: a Works result opens the reading and its h1 takes focus.
  await go(page, base, '/works');
  await settled(page, 'works', '#surface-library [data-lw="open"]');
  await page.click('#surface-library [data-lw="open"]');
  await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 20000 });
  await page.waitForTimeout(300);
  const h1 = await page.evaluate(() => document.activeElement?.tagName === 'H1');
  check(`${tag} fresh: a Works result still lands focus on the reading's h1`, h1);
};
const NEEDS = {
  explore: 'core',
  works: 'works',
  rights: 'rights',
  reader: 'reader',
  compare: 'compare',
  focus: 'compare',
  analysis: 'analysis',
  declarations: 'analysis',
  retained: 'analysis',
  retry: 'works',
  keys: 'works',
  credit: 'rights',
  range: 'reader',
  railpick: 'works',
  ax: 'reader',
  fresh: 'reader',
};

(async () => {
  const dir = build();
  link(dir);
  const chunks = chunksIn(dir);
  const srv = await start({ root: dir, port: 0 });
  const { chromium } = require('playwright');
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({
    headless: !args.headed,
    ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  });
  const combos = [];
  for (const theme of ['light', 'dark'])
    for (const width of [1280, 390]) combos.push({ theme, width });
  try {
    for (const [name, fn] of Object.entries(SECTIONS)) {
      if (ONLY && !ONLY.has(name)) continue;
      const need = [
        NEEDS[name],
        ...(['compare', 'focus', 'analysis', 'declarations', 'retained', 'retry', 'keys'].includes(
          name
        )
          ? ['reader']
          : []),
      ];
      const missing = need.filter((c) => !chunks.has(c));
      if (missing.length) {
        results.push(`SKIP ${name} — chunk not in this build: ${missing.join(', ')}`);
        continue;
      }
      for (const combo of combos) {
        const tag = `[${combo.theme} ${combo.width}]`;
        const { context, page, errors, log } = await openPage(browser, srv.url, combo);
        try {
          await fn({ page, base: srv.url, tag, log, errors });
        } catch (e) {
          check(`${tag} ${name}: ran to the end`, false, short(e.message, 300));
        }
        const theme = await page
          .evaluate(() => document.documentElement.dataset.theme || '')
          .catch(() => '');
        check(`${tag} ${name}: theme is ${combo.theme}`, theme === combo.theme, theme);
        const over = await overflow(page).catch(() => 0);
        check(`${tag} ${name}: no horizontal page overflow`, over <= 1, `${over}px`);
        if (args.shots) {
          fs.mkdirSync(String(args.shots), { recursive: true });
          await page
            .screenshot({
              path: path.join(String(args.shots), `${name}-${combo.theme}-${combo.width}.png`),
            })
            .catch(() => {});
        }
        const unmatched = log.filter((l) => l.startsWith('UNMATCHED'));
        check(
          `${tag} ${name}: no console errors`,
          errors.length === 0,
          errors.slice(0, 4).join(' | ')
        );
        if (unmatched.length)
          results.push(
            `note ${tag} ${name}: unstubbed Render calls ${[...new Set(unmatched)].join(', ')}`
          );
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  console.log(results.join('\n'));
  const ran = results.filter((r) => /^(ok|FAIL)/.test(r)).length;
  console.log(
    `check_library_page: ${failures ? 'FAIL' : 'PASS'} — ${ran - failures}/${ran} checks, chunks: ${[...chunks].sort().join(',')}`
  );
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
