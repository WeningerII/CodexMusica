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
// Sections: explore, works, rights, reader, compare, analysis,
// declarations, retained. A section whose
// chunk is not in the build prints SKIP (not a failure). Every section runs in
// both themes at 1280 and 390 wide; any console error, uncaught exception,
// failed same-origin request or horizontal page overflow fails the run.
//
//   node scripts/check_library_page.js                 # build, then check
//   node scripts/check_library_page.js --built=DIR     # check an existing build
//   node scripts/check_library_page.js --only=reader,compare --headed
//   node scripts/check_library_page.js --shots=DIR     # screenshot each section
/* global document, location, getComputedStyle, libraryChunk, indexedDB */ // inside page.evaluate
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
    if (r.url().startsWith(url))
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
          text: (e?.textContent || '').trim().slice(0, 120),
          first: !!e?.querySelector('[data-lw="page"][data-to="0"]'),
          all: !!e?.querySelector('[data-lw="all-works"]'),
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
    const none = await outcome('/works?collection=collection_nope');
    check(
      `${tag} works: an unknown collection says No such collection, not a load error`,
      none.tone !== 'danger' && /No such collection/.test(none.text) && none.all && !none.retry,
      JSON.stringify(none)
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
    }
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
      /Nothing was sent/.test(await text('.la-section[aria-live]')),
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
const NEEDS = {
  explore: 'core',
  works: 'works',
  rights: 'rights',
  reader: 'reader',
  compare: 'compare',
  analysis: 'analysis',
  declarations: 'analysis',
  retained: 'analysis',
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
        ...(['compare', 'analysis', 'declarations', 'retained'].includes(name) ? ['reader'] : []),
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
          await fn({ page, base: srv.url, tag, log });
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
