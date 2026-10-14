#!/usr/bin/env node
'use strict';
// verify-library-route1-0: independent re-test of the "stale tab double migration".
// Two tabs in ONE browser context (one origin, one IndexedDB):
//   OLD = codex-old.html (main 8b1d2ad2 shell -> retained chunk analysis.71b110b249.js)
//   NEW = codex.html     (candidate shell  -> analysis.9ebd86e5f8.js)
// usage: node stale2tab.js <served-root> <tree-for-server+playwright> <scenario> <out.json>
// scenario: S1 (old tab mounts AFTER new tab migrated), S2 (old tab mounted BEFORE),
//           S3 (S1 on 'Oh--oh, oh my love'), B1 (baseline: both tabs main code, root=wt-main)
/* global document, indexedDB, location, performance */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const [ROOT, TREE, SCEN, OUT] = process.argv.slice(2);
const { start } = require(path.join(TREE, 'scripts/_pages_server.js'));
const { chromium } = require(path.join(TREE, 'node_modules/playwright'));

const UNIT = 'reading_3a0f9ca3-a476-5a96-a5ff-ae209af0b53f'; // "XXX The Lamplighter"
const DATA = path.join(ROOT, 'library', 'data');
const gz = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, p))));
const urow = gz('u/3a.json.gz').units.find((u) => u[0] === UNIT);
const HEAD = gz(`r/3a/${UNIT}/${urow[1]}/head.json.gz`);
const KEY = `interpretation:${UNIT}:${HEAD.reading_revision}`;
const LINE = SCEN === 'S3' ? 'Oh--oh, oh my love' : 'Oh--oh, oh, oh my love';
const HASH = `#library/read/${UNIT}?lens=sound`;

const posts = [];
const reqs = [];
async function api(route) {
  const req = route.request();
  const u = new URL(req.url());
  const p = u.pathname.replace(/^\/library\/v1/, '');
  const h = {
    'content-type': 'application/json',
    'access-control-allow-origin': req.headers().origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, idempotency-key, if-match',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  };
  const send = (status, body) => route.fulfill({ status, headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return send(204, '');
  reqs.push(`${req.method()} ${u.pathname}`);
  if (!u.pathname.startsWith('/library/v1')) return send(200, { ok: true, enabled: true });
  if (p === '/health')
    return send(200, { contract: 1, snapshot_id: 'snap-v', readable_ids_sha256: '0'.repeat(64), counts: { units: 1, readable: 1 }, search_ready: true, analysis_available: true, corpus: {} });
  let m;
  if ((m = /^\/metadata\/([^/]+)$/.exec(p)))
    return send(200, { snapshot_id: 'snap-v', reading_unit_id: UNIT, reading_revision: HEAD.reading_revision, title: HEAD.title, contributors: HEAD.contributors || [], language: HEAD.language, availability: 'readable', completeness: HEAD.completeness, edition_id: HEAD.edition_id, work_id: HEAD.work_id, source_path: HEAD.source_path, source_basis: 'public_domain', lines: 0 });
  if (p === '/analyses' && req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}');
    posts.push({ from: req.headers()['referer'] || '', body });
    const now = new Date().toISOString();
    const job = { id: `job_${String(posts.length).padStart(32, '0')}`, state: 'running', identity: { reading_unit_id: body.reading_unit_id, reading_revision: body.reading_revision, snapshot_id: 'snap-v' }, attempt: 1, generation: 1, progress: { completed: 0, total: 4 }, created_at: now, updated_at: now };
    return send(202, { contract_version: 1, job });
  }
  if ((m = /^\/jobs\/([^/]+)$/.exec(p)))
    return send(200, { contract_version: 1, job: { id: decodeURIComponent(m[1]), state: 'running', identity: { reading_unit_id: UNIT, reading_revision: HEAD.reading_revision, snapshot_id: 'snap-v' }, attempt: 1, generation: 1, progress: { completed: 0, total: 4 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
  return send(404, { error: { code: 'NOT_FOUND', message: 'stub' } });
}

const idb = (page, value) =>
  page.evaluate(
    ([key, value]) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('codex-musica-library-v1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('state');
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
          const t = r.result.transaction('state', value === undefined ? 'readonly' : 'readwrite');
          let out = null;
          if (value === undefined) {
            const g = t.objectStore('state').get(key);
            g.onsuccess = () => (out = g.result ?? null);
          } else t.objectStore('state').put(value, key);
          t.oncomplete = () => (r.result.close(), res(out));
        };
      }),
    [KEY, value]
  );
const privateStore = (page) =>
  page.evaluate(() => indexedDB.databases().then((d) => d.map((x) => x.name)));

async function inspector(page) {
  await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 40000 });
  await page.waitForSelector('#surface-library [data-act="analyze"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
}
const view = (page) =>
  page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)].map((e) => [e.getAttribute('role'), e.dataset.cut || '', e.innerText.trim()]);
    return {
      cut: q('#surface-library [data-cut]'),
      alerts: q('#surface-library [role="alert"]'),
      status: q('#surface-library [role="status"]'),
      toast: (document.getElementById('toast')?.innerText || '').trim(),
      chunks: performance.getEntriesByType('resource').map((e) => e.name.split('/').pop()).filter((n) => /^analysis\./.test(n)),
    };
  });
async function analyze(page) {
  const n = posts.length;
  await page.click('#surface-library [data-act="analyze"]');
  await page.waitForTimeout(1500);
  return posts.length > n ? posts[posts.length - 1].body.declaration_set : null;
}
const rows = (r) => (r && r.declarations && Array.isArray(r.declarations.pronunciations) ? r.declarations.pronunciations.map((x) => [x.line, x.token, x.word]) : r);
const brief = (r) => (r ? { keys: Object.keys(r), token_cut: r.token_cut, rows: rows(r), legacy: r.legacy_declarations ? rows({ declarations: r.legacy_declarations }) : undefined, renumbered: r.renumbered, undecided: r.undecided } : r);

(async () => {
  const server = await start({ root: ROOT });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const log = [];
  const say = (label, o) => { log.push({ label, ...o }); console.log('==', label, JSON.stringify(o)); };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/^https:\/\/mcp\.codexmusica\.com\//, api);
    const errs = [];
    const oldShell = SCEN === 'B1' ? 'codex.html' : 'codex-old.html';
    const seedPage = await ctx.newPage();
    await seedPage.goto(`${server.url}/robots.txt`).catch(() => {});
    const seed = { declarations: { pronunciations: [{ line: LINE, token: 2, word: 'oh', phones: ['OW1'], basis: 'declared', source: 'verify legacy fixture' }] } };
    await idb(seedPage, seed);
    say('seeded', brief(await idb(seedPage)));
    await seedPage.close();

    const OLD = await ctx.newPage();
    OLD.on('pageerror', (e) => errs.push('OLD ' + e.message.slice(0, 200)));
    if (SCEN === 'S2') {
      // stale tab already showing the reading (record read BEFORE migration)
      await OLD.goto(`${server.url}/${oldShell}${HASH}`);
      await inspector(OLD);
      say('OLD mounted first', { view: await view(OLD), idb: brief(await idb(OLD)) });
    } else {
      // stale tab open on the Library shelf, analysis chunk not yet loaded
      await OLD.goto(`${server.url}/${oldShell}#library`);
      await OLD.waitForTimeout(3000);
      say('OLD on shelf', { chunks: (await view(OLD)).chunks });
    }

    const NEW = await ctx.newPage();
    NEW.on('pageerror', (e) => errs.push('NEW ' + e.message.slice(0, 200)));
    await NEW.goto(`${server.url}/codex.html${HASH}`);
    await inspector(NEW);
    say('NEW mount 1', { view: await view(NEW), idb: brief(await idb(NEW)) });
    say('NEW analyze 1', { sent: rows({ declarations: await analyze(NEW) }) });

    await OLD.bringToFront();
    if (SCEN !== 'S2') {
      await OLD.evaluate((h) => (location.hash = h), HASH); // in-app navigation, no reload
      await inspector(OLD);
      say('OLD mounted after NEW migrated', { view: await view(OLD), idb: brief(await idb(OLD)) });
    }
    say('OLD analyze', { sent: rows({ declarations: await analyze(OLD) }) });
    await OLD.click('#surface-library [data-act="decl"]');
    await OLD.waitForSelector('#surface-library .la-decl [data-act="save"]', { timeout: 20000 });
    const raw = await OLD.$eval('#surface-library .la-decl [data-f="raw"]', (t) => t.value);
    say('OLD raw shown in Reading interpretations', { raw: JSON.parse(raw) });
    await OLD.click('#surface-library .la-decl [data-act="save"]');
    await OLD.waitForTimeout(1000);
    say('OLD after Apply interpretation', { idb: brief(await idb(OLD)), view: await view(OLD) });

    await NEW.bringToFront();
    say('NEW before reload, still in memory', { sent: rows({ declarations: await analyze(NEW) }) });
    await NEW.reload();
    await inspector(NEW);
    say('NEW mount 2 (after reload)', { view: await view(NEW), idb: brief(await idb(NEW)) });
    say('NEW analyze 2', { sent: rows({ declarations: await analyze(NEW) }) });
    say('dbs', { dbs: await privateStore(NEW) });
    say('errors', { errs, api: [...new Set(reqs)] });
    await ctx.close();
  } finally {
    await browser.close();
    await server.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(log, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
