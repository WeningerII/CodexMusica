// BB8 verify-library-routes234-2: fixtures + stub copied from wt-main/scripts/check_library_page.js lines 21-232 (ROOT repointed)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { start } = require(process.env.TREE + '/scripts/_pages_server.js');

const ROOT = process.env.TREE;
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


// ─── BB8 driver ──────────────────────────────────────────────────────────────
const LINE = process.env.LINE || 'Oh--oh, oh my love';
const LEGACY = { declarations: { pronunciations: [
  { line: LINE, token: Number(process.env.TOK || 2), word: process.env.WORD || 'oh', phones: ['AA1'], basis: 'declared', source: 'the singer' } ] } };
(async () => {
  const dir = String(process.env.BUILT);
  fs.mkdirSync(path.join(dir, 'library'), { recursive: true });
  for (const [from, to] of [[DATA, path.join(dir, 'library', 'data')], [path.join(ROOT, 'api'), path.join(dir, 'api')], [path.join(ROOT, 'assets'), path.join(dir, 'assets')]])
    if (fs.existsSync(from) && !fs.existsSync(to)) fs.symlinkSync(from, to);
  const srv = await start({ root: dir, port: 0 });
  const { chromium } = require(process.env.TREE + '/node_modules/playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const out = { tree: ROOT, built: dir };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const log = [];
    const bodies = [];
    await context.route(/^https:\/\/mcp\.codexmusica\.com\//, (route) => route.fulfill({ status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': route.request().headers().origin || '*', 'access-control-allow-credentials': 'true' },
      body: '{"ok":true,"enabled":true}' }));
    const stub = makeStub(log);
    await context.route(`${API}/**`, async (route) => {
      const r = route.request();
      if (r.method() === 'POST' && /\/analyses\/?$/.test(new URL(r.url()).pathname)) bodies.push(JSON.parse(r.postData() || '{}'));
      return stub(route);
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    const rev = headOf(EPI_A).reading_revision;
    const key = `interpretation:${EPI_A}:${rev}`;
    await page.goto(`${srv.url}/codex.html#library`);
    await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
    // seed the page's own storage with a pre-batch (unmarked) record
    const putIn = async (db, store) => page.evaluate(async ({ key, rec, db, store }) => {
      await new Promise((res, rej) => {
        const q = indexedDB.open(db, 1);
        q.onupgradeneeded = () => q.result.createObjectStore(store);
        q.onsuccess = () => { const t = q.result.transaction(store, 'readwrite'); t.objectStore(store).put(rec, key); t.oncomplete = () => { q.result.close(); res(); }; t.onerror = () => rej(t.error); };
        q.onerror = () => rej(q.error);
      });
    }, { key, rec: LEGACY, db, store });
    // seed the page's own storage with a pre-batch (unmarked) record: the
    // core lib.device store (codex-musica-library-v1/state) and the chunk's
    // fallback store (codex-musica-library-analysis-v1/kv)
    await putIn('codex-musica-library-v1', 'state');
    await putIn('codex-musica-library-analysis-v1', 'kv');
    await page.goto(`${srv.url}/codex.html#library/read/${EPI_A}?lens=sound`);
    await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 30000 });
    const analyze = await page.waitForSelector('#surface-library [data-act="analyze"]', { timeout: 20000 }).catch(() => null);
    out.analyze_button = !!analyze;
    out.status_before = await page.evaluate(() => [...document.querySelectorAll('#surface-library [role="status"],#surface-library [role="alert"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
    await page.waitForTimeout(2000);
    out.status_before = await page.evaluate(() => [...document.querySelectorAll('#surface-library [role="status"],#surface-library [role="alert"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
    if (analyze) {
      await analyze.click();
      await page.waitForTimeout(2500);
    }
    out.status_after = await page.evaluate(() => [...document.querySelectorAll('#surface-library [role="status"],#surface-library [role="alert"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
    const dump = (db, store) => page.evaluate(async ({ db, store }) => new Promise((res) => {
      const q = indexedDB.open(db, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(store);
      q.onsuccess = () => { const o = {}; const c = q.result.transaction(store).objectStore(store).openCursor();
        c.onsuccess = () => { const cur = c.result; if (!cur) { q.result.close(); return res(o); } if (String(cur.key).startsWith('interpretation:')) o[cur.key] = cur.value; cur.continue(); }; };
    }), { db, store });
    out.stored_after = { 'codex-musica-library-v1/state': await dump('codex-musica-library-v1', 'state'), 'codex-musica-library-analysis-v1/kv': await dump('codex-musica-library-analysis-v1', 'kv') };
    out.post_bodies = bodies.map((b) => ({ keys: Object.keys(b).sort(), declaration_set: b.declaration_set }));
    out.errors = errors;
    await context.close();
  } finally {
    await browser.close();
    await srv.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(2); });
