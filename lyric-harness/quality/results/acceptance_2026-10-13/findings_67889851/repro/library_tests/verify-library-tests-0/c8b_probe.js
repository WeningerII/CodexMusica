#!/usr/bin/env node
// BB8 verify C8b: is the omission of a set-aside (blocked) saved pronunciation
// choice visible anywhere in Lyrics after the Library "Open in Lyrics" whole-reading
// handoff? Own script. Uses only the tree's static page server (_pages_server.js)
// and the tree's built codex.html; the Library backend is stubbed here.
//   node c8b_probe.js --tree=DIR --built=DIR --out=FILE [--width=1280] [--only=a,b]
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return [m[1], m[2] === undefined ? true : m[2]];
  })
);
const TREE = path.resolve(args.tree);
const BUILT = path.resolve(args.built);
const WIDTH = Number(args.width || 1280);
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const { start } = require(path.join(TREE, 'scripts/_pages_server.js'));
const { chromium } = require(path.join(TREE, 'node_modules/playwright'));
const DATA = path.join(TREE, 'library', 'data');
const API = 'https://mcp.codexmusica.com/library/v1';
const SNAPSHOT = 'snapshot-bb8-c8b';
const UNIT = 'reading_570567e3-ba7f-56f3-a1bf-f06c6a8d9b81'; // Epithalamion (fixture used by check_library_page.js)

const gz = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, p))));
const shardOf = (id) => id.replace(/^[a-z]+_/, '').slice(0, 2);
function headOf(id) {
  const unit = gz(`u/${shardOf(id)}.json.gz`).units.find((u) => u[0] === id);
  return gz(`r/${shardOf(id)}/${id}/${unit[1]}/head.json.gz`);
}
const HEAD = headOf(UNIT);
const REV = HEAD.reading_revision;
const KEY = `interpretation:${UNIT}:${REV}`;

// link api/assets/library data beside the build (own scratch dir)
fs.mkdirSync(path.join(BUILT, 'library'), { recursive: true });
for (const [from, to] of [
  [DATA, path.join(BUILT, 'library', 'data')],
  [path.join(TREE, 'api'), path.join(BUILT, 'api')],
  [path.join(TREE, 'assets'), path.join(BUILT, 'assets')],
])
  if (!fs.existsSync(to)) fs.symlinkSync(from, to);

const choice = (line, token, word) => ({
  line,
  token,
  word,
  phones: ['AA1'],
  basis: 'declared',
  source: 'the singer',
});
// A row that rebinds (v1 token 2 "oh" -> v2 token 3) and a row no v2 word covers ("--and").
const GOOD_V1 = choice('Oh--oh, oh my love', 2, 'oh');
const GOOD_V2 = choice('Oh--oh, oh my love', 3, 'oh');
const BLOCKED = choice('ways:--and the road', 2, '--and');
const SCENARIOS = {
  // control: current-cut record, one row, nothing set aside
  v2_clean: { token_cut: 'v2', declarations: { pronunciations: [GOOD_V2] } },
  // unmarked (pre-release) record: one rebindable row, one blocked row; first load migrates
  unmarked_blocked: { declarations: { pronunciations: [GOOD_V1, BLOCKED] } },
  // the same record after its one migration was persisted (second and later loads)
  v2_persisted_undecided: {
    declarations: { pronunciations: [GOOD_V2] },
    token_cut: 'v2',
    undecided: [{ row: BLOCKED, reason: 'persisted reason text' }],
    renumbered: [{ word: 'oh', line: GOOD_V1.line, from: 2, to: 3 }],
    legacy_declarations: { pronunciations: [GOOD_V1, BLOCKED] },
  },
  // a record naming an unknown cut: every row set aside
  unknown_cut_v9: { token_cut: 'v9', declarations: { pronunciations: [GOOD_V2, BLOCKED] } },
  // only a blocked row, unmarked
  unmarked_only_blocked: { declarations: { pronunciations: [BLOCKED] } },
};

function stub(log) {
  const job = { v: null };
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
    log.push(`${method} ${p}`);
    if (p === '/health')
      return reply(200, {
        contract: 1,
        snapshot_id: SNAPSHOT,
        readable_ids_sha256: '0'.repeat(64),
        counts: { units: 1, readable: 1 },
        search_ready: true,
        analysis_available: true,
        corpus: {},
      });
    let m;
    if ((m = /^\/metadata\/([^/]+)$/.exec(p)))
      return reply(200, {
        snapshot_id: SNAPSHOT,
        reading_unit_id: UNIT,
        reading_revision: REV,
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
    if (p === '/search') return reply(200, { snapshot_id: SNAPSHOT, items: [], total: 0, next_offset: null });
    if (p === '/analyses' && method === 'POST') {
      log.push(`BODY ${req.postData()}`);
      return reply(503, { error: { code: 'UNAVAILABLE', message: 'stub' } });
    }
    if (p === '/viewer' || p === '/session' || p === '/me' || p === '/jobs' || p === '/analyses')
      return reply(200, { contract_version: 1, viewer: 'viewer_bb8', jobs: [] });
    log.push(`UNMATCHED ${method} ${p}`);
    return reply(404, { error: { code: 'NOT_FOUND', message: `No stub for ${p}` } });
  };
}

const TERMS = {
  dash_and: /--and/,
  token_cut: /token_cut/,
  legacy: /legacy/i,
  undecided: /undecided/i,
  decision: /decision/i,
  left_out: /left out|leave out|omit|set aside|not (?:sent|carried|included)|dropped|excluded/i,
  saved_choice: /saved pronunciation choice|pronunciation choice/i,
  needs: /\bneeds? your\b/i,
};
const hits = (s) => Object.fromEntries(Object.entries(TERMS).map(([k, re]) => [k, re.test(String(s))]));

async function idbDump(page) {
  return page.evaluate(async () => {
    const out = {};
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const { name, version } of dbs) {
      out[name] = await new Promise((resolve) => {
        const r = indexedDB.open(name, version);
        r.onerror = () => resolve({ error: String(r.error) });
        r.onsuccess = () => {
          const db = r.result;
          const stores = {};
          const names = [...db.objectStoreNames];
          if (!names.length) return (db.close(), resolve(stores));
          const t = db.transaction(names, 'readonly');
          for (const n of names) {
            stores[n] = [];
            const c = t.objectStore(n).openCursor();
            c.onsuccess = () => {
              const cur = c.result;
              if (!cur) return;
              stores[n].push({ key: cur.key, value: cur.value });
              cur.continue();
            };
          }
          t.oncomplete = () => (db.close(), resolve(stores));
          t.onerror = () => (db.close(), resolve({ error: String(t.error) }));
        };
      });
    }
    return out;
  });
}

async function run(browser, base, name, record) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: WIDTH > 600 ? 900 : 844 },
    colorScheme: 'light',
    acceptDownloads: true,
  });
  const log = [];
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
  // record every toast text, from the first document on
  await context.addInitScript(() => {
    window.__toasts = [];
    const hook = () => {
      const t = document.getElementById('toast');
      if (!t) return void setTimeout(hook, 20);
      new MutationObserver(() => {
        const s = t.textContent.trim();
        if (s && window.__toasts[window.__toasts.length - 1]?.text !== s)
          window.__toasts.push({ at: performance.now(), text: s, hash: location.hash });
      }).observe(t, { childList: true, characterData: true, subtree: true });
    };
    document.addEventListener('DOMContentLoaded', hook);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 300)}`));
  const downloads = [];
  page.on('download', async (d) => {
    const p = await d.path().catch(() => null);
    downloads.push({ name: d.suggestedFilename(), text: p ? fs.readFileSync(p, 'utf8') : null });
  });
  const res = { scenario: name, width: WIDTH, stored_record: record };
  // 1. seed the device record on the same origin BEFORE the app ever loads (no page can migrate it first)
  await page.goto(`${base}/api/index.json`);
  await page.evaluate(
    ([key, value]) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('codex-musica-library-v1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('state');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const t = r.result.transaction('state', 'readwrite');
          t.objectStore('state').put(value, key);
          t.oncomplete = () => (r.result.close(), resolve());
          t.onerror = () => reject(t.error);
        };
      }),
    [KEY, record]
  );
  // 2. open the reading: the inspector loads the record (first and only load)
  await page.goto(`${base}/codex.html#library/read/${UNIT}?lens=sound`);
  await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 30000 });
  // wait until the analysis controller has read the device record (analyze button present)
  const narrow = await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false);
  res.narrow_sheet_toggle_visible = narrow;
  await page.waitForSelector('#surface-library [data-act="analyze"]', { state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  res.library_before = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const vis = (e) => !!(e && e.offsetParent !== null && e.getClientRects().length);
    const und = q('#surface-library [data-cut="undecided"]');
    const ren = q('#surface-library [data-cut="renumbered"]');
    return {
      undecided_alert_text: und?.innerText || null,
      undecided_alert_visible: vis(und),
      renumbered_text: ren?.innerText || null,
      renumbered_visible: vis(ren),
      lyrics_button_visible: vis(q('#surface-library [data-rd="lyrics"]')),
      insp_box: (() => { const e = q('#surface-library .rd-insp'); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { w: r.width, h: r.height, display: cs.display, visibility: cs.visibility, transform: cs.transform, cls: e.className }; })(),
      toasts: [...window.__toasts],
    };
  });
  if (args.shots) {
    fs.mkdirSync(path.resolve(args.shots), { recursive: true });
    await page.screenshot({ path: path.join(path.resolve(args.shots), `${name}-${WIDTH}-library-before-click.png`) });
  }
  res.device_record_before_click = (await idbDump(page))['codex-musica-library-v1']?.state?.find((r) => r.key && String(r.key).startsWith('interpretation:'))?.value ?? null;
  // what the handoff will carry: the reader's own declarationsFor path (live handle getter)
  res.analysis_module_declarations = await page
    .evaluate(
      async ([u, r]) => {
        const a = await libraryChunk('analysis');
        return a.declarations({ reading_unit_id: u, reading_revision: r });
      },
      [UNIT, REV]
    )
    .catch((e) => ({ error: String(e) }));
  const nToasts = res.library_before.toasts.length;
  // 3. Open in Lyrics (whole reading)
  await page.click('#surface-library [data-rd="lyrics"]');
  await page.waitForFunction(() => location.hash.startsWith('#lyrics'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  res.hash_after = await page.evaluate(() => location.hash);
  res.toasts_after_click = (await page.evaluate(() => window.__toasts)).slice(nToasts);
  if (args.shots)
    await page.screenshot({ path: path.join(path.resolve(args.shots), `${name}-${WIDTH}-lyrics-after-click.png`) });
  res.lyrics = await page.evaluate(() => {
    const surf = document.querySelector('#surface-lyrics');
    let meta = null;
    try {
      meta = typeof lyMeta === 'function' ? JSON.parse(JSON.stringify(lyMeta().libraryOrigin || null)) : 'lyMeta not global';
    } catch (e) {
      meta = 'error ' + e.message;
    }
    return {
      surface_text: surf?.innerText || '',
      surface_html_len: surf?.innerHTML.length || 0,
      textareas: [...document.querySelectorAll('textarea')].map((t) => t.value),
      libraryOrigin: meta,
    };
  });
  // 4. History panel
  const hist = await page.$('#surface-lyrics [data-ui="ly-tab"][data-id="history"]');
  if (hist) {
    await hist.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  res.history_text = await page.evaluate(() => document.getElementById('ly-panel-history')?.innerText || null);
  // 5. Export source details (download) and Download text and sources
  const prov = await page.$('[data-ui="ly-library-provenance"]');
  if (prov) {
    await prov.click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  // Download text and sources (the working-copy envelope); the button may sit in a closed menu
  res.ly_download_clicked = await page.evaluate(() => {
    const b = document.querySelector('[data-ui="ly-download"]');
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForTimeout(1500);
  res.downloads = downloads.map((d) => ({ name: d.name, text: d.text }));
  res.idb_after = await idbDump(page);
  res.localStorage_after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  // 6. term scan over every Lyrics-side surface
  const lyricsDraftStores = Object.entries(res.idb_after).filter(([n]) => n !== 'codex-musica-library-v1');
  res.scan = {
    toasts_after_click: hits(JSON.stringify(res.toasts_after_click)),
    lyrics_surface_text: hits(res.lyrics.surface_text),
    history_text: hits(res.history_text),
    libraryOrigin: hits(JSON.stringify(res.lyrics.libraryOrigin)),
    downloads: hits(JSON.stringify(res.downloads)),
    lyrics_idb: hits(JSON.stringify(lyricsDraftStores)),
    localStorage: hits(JSON.stringify(res.localStorage_after)),
  };
  res.carried_pronunciations = (() => {
    const d = res.lyrics.libraryOrigin?.declarations;
    return Array.isArray(d) ? d.map((x) => x?.pronunciations ?? null) : d;
  })();
  res.errors = errors;
  res.backend_log = log;
  await context.close();
  return res;
}

(async () => {
  const srv = await start({ root: BUILT, port: 0 });
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const out = { tree: TREE, built: BUILT, key: KEY, scenarios: {} };
  try {
    for (const [name, rec] of Object.entries(SCENARIOS)) {
      if (ONLY && !ONLY.has(name)) continue;
      try {
        out.scenarios[name] = await run(browser, srv.url, name, rec);
      } catch (e) {
        out.scenarios[name] = { error: String(e.stack || e) };
      }
      const s = out.scenarios[name];
      console.log(
        name,
        JSON.stringify({
          err: s.error?.slice(0, 200),
          hash: s.hash_after,
          lib_alert: s.library_before?.undecided_alert_text?.slice(0, 160),
          lib_alert_visible: s.library_before?.undecided_alert_visible,
          lib_toasts: s.library_before?.toasts?.map((t) => t.text),
          after_toasts: s.toasts_after_click?.map((t) => t.text),
          carried: s.carried_pronunciations,
          scan: s.scan,
        })
      );
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  fs.writeFileSync(path.resolve(args.out), JSON.stringify(out, null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
