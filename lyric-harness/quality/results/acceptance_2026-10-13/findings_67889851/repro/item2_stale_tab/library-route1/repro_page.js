#!/usr/bin/env node
'use strict';
// BB8 library-route1: independent drive of the BUILT Library page (codex.html +
// library/code chunks committed in the tree) with seeded IndexedDB records.
// usage: node repro_page.js <tree> <label> <out.json>
// Serves <tree> with the tree's own static server; stubs only the Render API
// host (records every POST /analyses body). Nothing in <tree> is written.
/* global document, indexedDB */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const TREE = path.resolve(process.argv[2]);
const LABEL = process.argv[3];
const OUT = process.argv[4];
const { start } = require(path.join(TREE, 'scripts/_pages_server.js'));
const { chromium } = require(path.join(TREE, 'node_modules/playwright'));

const API = 'https://mcp.codexmusica.com/library/v1';
const EPI_A = 'reading_570567e3-ba7f-56f3-a1bf-f06c6a8d9b81';
const DATA = path.join(TREE, 'library', 'data');
const gz = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, p))));
const shard = EPI_A.split('_')[1].slice(0, 2);
const unit = gz(`u/${shard}.json.gz`).units.find((u) => u[0] === EPI_A);
const HEAD = gz(`r/${shard}/${EPI_A}/${unit[1]}/head.json.gz`);
const KEY = `interpretation:${EPI_A}:${HEAD.reading_revision}`;

const OH = 'Oh--oh, oh my love';
const EARLY = 'Early, before the worlds light-giving lampe';
const WOODS = 'The woods shall to me answer, and my Eccho ring.';
const ONE = '1 more time I call your name';
const YES = 'yes--no--maybe so';
const row = (line, token, word) => ({
  line,
  token,
  word,
  phones: ['OW1'],
  basis: 'declared',
  source: 'bb8 legacy fixture',
});

const SCENARIOS = {
  // the recurring-oh repro plus two rows whose v1/v2 spans differ/agree
  oh: {
    declarations: {
      pronunciations: [row(OH, 2, 'oh'), row(EARLY, 6, 'lampe'), row(ONE, 1, 'more')],
      hooks: [{ text: 'Eccho ring', source: 'bb8' }],
    },
  },
  // control (a): every row's v1 and v2 spans identical
  same: {
    declarations: {
      pronunciations: [row(EARLY, 6, 'lampe'), row(WOODS, 10, 'ring'), row(EARLY, 5, 'light-giving')],
    },
  },
  // control (b): unknown cut mark
  v9: { declarations: { pronunciations: [row(WOODS, 10, 'ring')] }, token_cut: 'v9' },
  // a legacy row no v2 word covers exactly, beside a movable one
  split: { declarations: { pronunciations: [row(OH, 2, 'oh'), row(YES, 1, 'yes--no--maybe')] } },
};

function stub(log) {
  const jobs = new Map();
  let n = 0;
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/library\/v1/, '').replace(/\/$/, '');
    const method = req.method();
    const reply = (status, body) =>
      route.fulfill({
        status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': req.headers().origin || '*',
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type, idempotency-key, if-match',
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    if (method === 'OPTIONS') return reply(204, '');
    log.push({ method, path: p });
    if (p === '/health')
      return reply(200, {
        contract: 1,
        snapshot_id: 'snap-bb8',
        readable_ids_sha256: '0'.repeat(64),
        counts: { units: 1, readable: 1 },
        search_ready: true,
        analysis_available: true,
        corpus: {},
      });
    let m;
    if ((m = /^\/metadata\/([^/]+)$/.exec(p)))
      return reply(200, {
        snapshot_id: 'snap-bb8',
        reading_unit_id: EPI_A,
        reading_revision: HEAD.reading_revision,
        title: HEAD.title,
        contributors: HEAD.contributors || [],
        language: HEAD.language,
        availability: 'readable',
        completeness: HEAD.completeness,
        edition_id: HEAD.edition_id,
        work_id: HEAD.work_id,
        source_path: HEAD.source_path,
        source_basis: 'public_domain',
        lines: 0,
      });
    if (p === '/analyses' && method === 'POST') {
      const raw = req.postData() || '{}';
      log.push({ POST_BODY: raw });
      const body = JSON.parse(raw);
      const id = `job_${String(++n).padStart(32, '0')}`;
      const job = {
        id,
        state: 'running',
        identity: {
          reading_unit_id: body.reading_unit_id,
          reading_revision: body.reading_revision,
          snapshot_id: 'snap-bb8',
        },
        attempt: 1,
        generation: 1,
        progress: { completed: 1, total: 4 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      jobs.set(id, job);
      return reply(202, { contract_version: 1, job });
    }
    if ((m = /^\/jobs\/([^/]+)$/.exec(p))) {
      const job = jobs.get(decodeURIComponent(m[1]));
      if (!job) return reply(404, { error: { code: 'NOT_FOUND', message: 'No such analysis.' } });
      return reply(200, { contract_version: 1, job });
    }
    if (p === '/viewer' || p === '/session' || p === '/me' || p === '/jobs')
      return reply(200, { contract_version: 1, viewer: 'viewer_bb8', jobs: [...jobs.values()] });
    log.push({ UNMATCHED: `${method} ${p}` });
    return reply(404, { error: { code: 'NOT_FOUND', message: `no stub for ${p}` } });
  };
}

const idb = (page, op, value) =>
  page.evaluate(
    ([op, key, value]) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('codex-musica-library-v1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('state');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const t = r.result.transaction('state', op === 'put' ? 'readwrite' : 'readonly');
          const s = t.objectStore('state');
          let out = null;
          if (op === 'put') s.put(value, key);
          else {
            const g = s.get(key);
            g.onsuccess = () => (out = g.result === undefined ? null : g.result);
          }
          t.oncomplete = () => (r.result.close(), resolve(out));
          t.onerror = () => reject(t.error);
        };
      }),
    [op, KEY, value]
  );

async function inspector(page) {
  await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 30000 });
  if (await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false))
    await page.click('#surface-library [data-rd="sheet"]');
  await page.waitForSelector('#surface-library [data-act="analyze"]', { timeout: 20000 });
  await page.waitForTimeout(1200); // loadInterpretation + draw
}
async function snapshot(page, log) {
  const s = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)].map((e) => e.innerText.trim());
    return {
      status: q('#surface-library .la-section[aria-live]'),
      cut: q('#surface-library [data-cut]'),
      cutAttrs: [...document.querySelectorAll('#surface-library [data-cut]')].map((e) => [
        e.dataset.cut,
        e.getAttribute('role'),
      ]),
      alerts: q('#surface-library [role="alert"]'),
      toast: (document.getElementById('toast')?.innerText || '').trim(),
      toastClass: document.getElementById('toast')?.className || '',
    };
  });
  s.idb = await idb(page, 'get');
  s.posts = log.filter((l) => l.POST_BODY).length;
  return s;
}
async function analyze(page, log) {
  const before = log.filter((l) => l.POST_BODY).length;
  await page.click('#surface-library [data-act="analyze"]');
  await page.waitForTimeout(1200);
  const bodies = log.filter((l) => l.POST_BODY).map((l) => l.POST_BODY);
  const sent = bodies.length > before ? JSON.parse(bodies[bodies.length - 1]) : null;
  const after = await snapshot(page, log);
  return {
    sent_declaration_set: sent ? sent.declaration_set : null,
    sent_declaration_set_raw: sent
      ? bodies[bodies.length - 1].match(/"declaration_set":(\{.*\}),"requested_layers"/)?.[1] ?? null
      : null,
    status_after: after.status,
    alerts_after: after.alerts,
  };
}
async function applyInterpretation(page) {
  await page.click('#surface-library [data-act="decl"]');
  await page.waitForSelector('#surface-library .la-decl [data-act="save"]', { timeout: 15000 });
  await page.click('#surface-library .la-decl [data-act="save"]');
  await page.waitForTimeout(800);
}

(async () => {
  const server = await start({ root: TREE });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const result = { tree: TREE, label: LABEL, key: KEY, scenarios: {} };
  try {
    for (const [name, seed] of Object.entries(SCENARIOS)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const log = [];
      const errors = [];
      await context.route(/^https:\/\/mcp\.codexmusica\.com\//, (route) =>
        route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': route.request().headers().origin || '*',
            'access-control-allow-credentials': 'true',
          },
          body: '{"ok":true,"enabled":true}',
        })
      );
      await context.route(`${API}/**`, stub(log));
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/^Failed to load resource/.test(m.text()))
          errors.push(`console: ${m.text().slice(0, 300)}`);
      });
      const R = (result.scenarios[name] = { seeded: seed, steps: [] });
      // Seed before the page ever runs on this origin.
      await page.goto(`${server.url}/robots.txt`);
      await idb(page, 'put', seed);
      R.seeded_readback = await idb(page, 'get');
      const url = `${server.url}/codex.html#library/read/${EPI_A}?lens=sound`;
      await page.goto(url);
      await inspector(page);
      const step = async (label, fn) => {
        const out = { label, ...(await fn()) };
        R.steps.push(out);
        return out;
      };
      await step('load1', () => snapshot(page, log));
      if (name === 'split') {
        await step('analyze1', () => analyze(page, log));
        await step('drop-undecided', async () => {
          const n = await page.$$eval('#surface-library [data-act="drop-undecided"]', (b) => b.length);
          if (n) await page.click('#surface-library [data-act="drop-undecided"]');
          await page.waitForTimeout(600);
          return { buttons: n, ...(await snapshot(page, log)) };
        });
        await step('analyze2', () => analyze(page, log));
      } else await step('analyze1', () => analyze(page, log));
      // full reload, no save: is the migrated / refused state persisted?
      await page.reload();
      await inspector(page);
      await step('reload1', () => snapshot(page, log));
      await step('analyze-after-reload1', () => analyze(page, log));
      // save through the page's own "Apply interpretation", then reload
      await applyInterpretation(page);
      await step('after-save', () => snapshot(page, log));
      await page.reload();
      await inspector(page);
      await step('reload2', () => snapshot(page, log));
      await step('analyze-after-reload2', () => analyze(page, log));
      R.errors = errors;
      R.unmatched = log.filter((l) => l.UNMATCHED);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`wrote ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
