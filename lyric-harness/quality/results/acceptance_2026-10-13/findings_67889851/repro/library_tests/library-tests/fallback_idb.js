// BB8 task 2: the Library analysis inspector's FALLBACK device store
// ('codex-musica-library-analysis-v1', object store 'kv'), used by
// src/library/analysis.js deviceStore(lib) when lib.device is absent.
// Drives the REAL built page (reader -> analysis chunk) with core's
// lib.device deleted before the reader mounts; seeds the fallback DB directly.
//   node fallback_idb.js --tree=DIR --built=DIR --out=FILE.json
'use strict';
const fs = require('fs');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    return [m[1], m[2]];
  })
);
// The helper prefix parses process.argv itself; hand it nothing.
process.argv = process.argv.slice(0, 2);
const H = require('./harness_lib.js')(args.tree);
const { chromium } = H.requireFromTree('playwright');

const LINE = 'Oh--oh, oh my love';
const CONTROL_LINE = 'my love is true';
const choice = (line, token, word) => ({
  line,
  token,
  word,
  phones: ['AA1'],
  basis: 'declared',
  source: 'the singer',
});

(async () => {
  const out = { tree: args.tree, built: args.built, steps: [] };
  const step = (name, data) => {
    out.steps.push({ name, ...data });
    console.log('##', name, JSON.stringify(data).slice(0, 900));
  };
  H.link(args.built);
  const srv = await H.start({ root: args.built, port: 0 });
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const { context, page, errors, log } = await H.openPage(browser, srv.url, {
    theme: 'light',
    width: 1280,
  });
  // Our own capture of every analysis request body (independent of the stub's log).
  const posted = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/library\/v1\/analyses\/?$/.test(new URL(r.url()).pathname))
      posted.push(JSON.stringify(JSON.parse(r.postData() || '{}').declaration_set ?? null));
  });
  await page.addInitScript(() => {
    window.__toasts = [];
    let last = '';
    setInterval(() => {
      const t = document.getElementById('toast');
      const s = t ? t.textContent.trim() : '';
      if (s && s !== last) window.__toasts.push(s);
      last = s;
    }, 40);
  });
  const revA = H.headOf(H.EPI_A).reading_revision;
  const revB = H.headOf(H.EPI_B).reading_revision;
  const KA = `interpretation:${H.EPI_A}:${revA}`;
  const KB = `interpretation:${H.EPI_B}:${revB}`;
  // Raw access to an IndexedDB database from the page origin.
  const idb = (db, store, op, key, value) =>
    page.evaluate(
      ([db, store, op, key, value]) =>
        new Promise((resolve, reject) => {
          const r = indexedDB.open(db, 1);
          r.onupgradeneeded = () => r.result.createObjectStore(store);
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const d = r.result;
            if (!d.objectStoreNames.contains(store)) {
              d.close();
              return resolve({ __nostore: [...d.objectStoreNames] });
            }
            const t = d.transaction(store, op === 'put' ? 'readwrite' : 'readonly');
            const s = t.objectStore(store);
            const res = {};
            if (op === 'put') s.put(value, key);
            else {
              const c = s.openCursor();
              c.onsuccess = () => {
                const cur = c.result;
                if (!cur) return;
                if (!key || String(cur.key).startsWith(key)) res[cur.key] = JSON.stringify(cur.value);
                cur.continue();
              };
            }
            t.oncomplete = () => (d.close(), resolve(res));
            t.onerror = () => reject(t.error);
          };
        }),
      [db, store, op, key, value]
    );
  const FALLBACK = ['codex-musica-library-analysis-v1', 'kv'];
  const MAIN = ['codex-musica-library-v1', 'state'];
  const dump = () => idb(...FALLBACK, 'list', 'interpretation:');
  const mainDump = () => idb(...MAIN, 'list', 'interpretation:');

  // Open a reading with lib.device removed from core's lib (no reload).
  // A full document load on the Explore route (IndexedDB persists in the context).
  async function reload() {
    await page.goto('about:blank');
    await H.go(page, srv.url, '');
    await page.waitForSelector('#surface-library .lib-shelf', { timeout: 20000 });
  }
  async function openNoDevice(id) {
    await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
    const dev = await page.evaluate(async () => {
      const core = await libraryChunk('core');
      const before = !!(core.lib.device && core.lib.device.read && core.lib.device.write);
      delete core.lib.device;
      return { before, after: 'device' in core.lib };
    });
    const t0 = log.length;
    await page.evaluate((id) => (location.hash = `#library/read/${id}?lens=sound`), id);
    await page.waitForSelector('#surface-library .rd-paper .rd-line', { timeout: 20000 });
    if (await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false))
      await page.click('#surface-library [data-rd="sheet"]');
    const mounted = !!(await page
      .waitForSelector('#surface-library [data-act="analyze"]', { timeout: 15000 })
      .catch(() => null));
    await page.waitForTimeout(800);
    const ui = await page.evaluate(() => {
      const q = (s) => document.querySelector(`#surface-library ${s}`)?.innerText || '';
      return {
        renumbered: q('[data-cut="renumbered"]'),
        undecided: q('[data-cut="undecided"]'),
        error: q('.la-section [role="alert"].la-error, .la-error'),
        toasts: window.__toasts.slice(),
        hash: location.hash,
      };
    });
    return { dev, mounted, ui, requests: log.slice(t0) };
  }

  try {
    await H.go(page, srv.url, '');
    await page.waitForSelector('#surface-library .lib-shelf', { timeout: 20000 });
    // Token geometry, from the page's own CMLyricTokens and plain slicing.
    step(
      'geometry',
      await page.evaluate((line) => {
        const T = window.CMLyricTokens;
        if (!T) return { CMLyricTokens: 'absent in this build' };
        const v1 = T.v1GraderSpans(line, false);
        const v2 = T.readerLine(line, { stripParens: false }).tokens;
        return {
          scheme: T.SCHEME,
          v1: v1.map((s) => [s.text, s.pieces]),
          v2: v2.map((t) => [t.text, t.pieces]),
          slice_8_10: line.slice(8, 10),
          rebind: T.rebindBySpan(line, 2, 'oh', v1, false),
        };
      }, LINE)
    );
    // Seed: an UNMARKED legacy record (token 2 'oh' + an unaffected control row)
    // for EPI_A, and an already-marked v2 control record for EPI_B.
    const legacy = {
      declarations: {
        pronunciations: [choice(LINE, 2, 'oh'), choice(CONTROL_LINE, 2, 'love')],
      },
    };
    const controlB = {
      declarations: { pronunciations: [choice(LINE, 3, 'oh')] },
      token_cut: 'v2',
    };
    await idb(...FALLBACK, 'put', KA, legacy);
    await idb(...FALLBACK, 'put', KB, controlB);
    const seeded = await dump();
    step('seeded', { fallback: seeded, main_db: await mainDump() });

    await reload();
    const load1 = await openNoDevice(H.EPI_A);
    const after1 = await dump();
    step('load1 EPI_A (no lib.device)', { ...load1, fallback: after1, main_db: await mainDump() });

    await reload();
    const load2 = await openNoDevice(H.EPI_A);
    const after2 = await dump();
    step('load2 EPI_A after reload', { ...load2, fallback: after2 });

    const loadB = await openNoDevice(H.EPI_B);
    const afterB = await dump();
    step('EPI_B control opened', { ...loadB, fallback: afterB });

    // The migrated record drives a new analysis: what is sent.
    await reload();
    await openNoDevice(H.EPI_A);
    const t0 = log.length;
    const p0 = posted.length;
    await page.click('#surface-library [data-act="analyze"]');
    await page.waitForTimeout(1200);
    step('analyze after migration', { requests: log.slice(t0), posted: posted.slice(p0) });

    // Unknown marker v9: blocked, and left exactly as stored.
    const v9 = {
      declarations: { pronunciations: [choice(LINE, 2, 'oh')] },
      token_cut: 'v9',
    };
    await idb(...FALLBACK, 'put', KA, v9);
    const v9Before = await dump();
    await reload();
    const loadV9 = await openNoDevice(H.EPI_A);
    const t1 = log.length;
    const p1 = posted.length;
    await page.click('#surface-library [data-act="analyze"]');
    await page.waitForTimeout(1200);
    const refusal = await page.evaluate(
      () => document.querySelector('#surface-library .la-section[aria-live]')?.innerText || ''
    );
    const v9After = await dump();
    step('v9', {
      ...loadV9,
      analyze_requests: log.slice(t1),
      posted: posted.slice(p1),
      refusal,
      fallback_before: v9Before,
      fallback_after: v9After,
    });

    // Reference: the SAME legacy seed through the normal lib.device store, in a
    // fresh context, to show the fallback migration is the same migration.
    const ref = await H.openPage(browser, srv.url, { theme: 'light', width: 1280 });
    let refRecord = null;
    let refNotice = '';
    try {
      await H.go(ref.page, srv.url, '');
      await ref.page.waitForSelector('#surface-library .lib-shelf', { timeout: 20000 });
      await ref.page.evaluate(
        ([key, value]) =>
          new Promise((resolve, reject) => {
            const q = indexedDB.open('codex-musica-library-v1', 1);
            q.onupgradeneeded = () => q.result.createObjectStore('state');
            q.onerror = () => reject(q.error);
            q.onsuccess = () => {
              const t = q.result.transaction('state', 'readwrite');
              t.objectStore('state').put(value, key);
              t.oncomplete = () => (q.result.close(), resolve());
            };
          }),
        [KA, legacy]
      );
      await ref.page.evaluate((id) => (location.hash = `#library/read/${id}?lens=sound`), H.EPI_A);
      await ref.page.waitForSelector('#surface-library [data-act="analyze"]', { timeout: 20000 });
      await ref.page.waitForTimeout(800);
      refNotice = await ref.page.evaluate(
        () => document.querySelector('#surface-library [data-cut="renumbered"]')?.innerText || ''
      );
      refRecord = await ref.page.evaluate(
        (key) =>
          new Promise((resolve) => {
            const q = indexedDB.open('codex-musica-library-v1', 1);
            q.onsuccess = () => {
              const g = q.result.transaction('state').objectStore('state').get(key);
              g.onsuccess = () => resolve(JSON.stringify(g.result));
            };
          }),
        KA
      );
    } finally {
      await ref.context.close();
    }
    step('reference: same seed via lib.device', { record: refRecord, notice: refNotice });

    // Assertions (ours).
    const rec1 = JSON.parse(after1[KA] || '{}');
    const rows1 = rec1.declarations?.pronunciations || [];
    const checks = {
      lib_device_was_present_then_absent: load1.dev.before === true && load1.dev.after === false,
      inspector_mounted: load1.mounted && load2.mounted && loadV9.mounted,
      fallback_used_not_main_db: Object.keys(await mainDump()).length === 0,
      migrated_token_3: rows1[0]?.token === 3 && rows1[0]?.word === 'oh',
      migrated_marked_v2: rec1.token_cut === 'v2',
      migrated_keeps_original: JSON.stringify(rec1.legacy_declarations) === JSON.stringify(legacy.declarations),
      migrated_renumbered_field:
        JSON.stringify(rec1.renumbered) === JSON.stringify([{ word: 'oh', line: LINE, from: 2, to: 3 }]),
      control_row_byte_identical: JSON.stringify(rows1[1]) === JSON.stringify(legacy.declarations.pronunciations[1]),
      notice_load1: /“oh” token 2 → 3/.test(load1.ui.renumbered),
      toast_load1: load1.ui.toasts.some((t) => /token 2 → 3/.test(t)),
      notice_load2_still_shown: /“oh” token 2 → 3/.test(load2.ui.renumbered),
      no_double_migration_on_reload: after2[KA] === after1[KA],
      control_record_B_byte_identical: afterB[KB] === seeded[KB] && after2[KB] === seeded[KB] && after1[KB] === seeded[KB],
      control_B_no_notice: !loadB.ui.renumbered && !loadB.ui.undecided,
      same_record_as_lib_device_path: refRecord === after1[KA],
      same_notice_as_lib_device_path: refNotice === load1.ui.renumbered,
      v9_undecided_shown: /v9/.test(loadV9.ui.undecided) && /v2/.test(loadV9.ui.undecided),
      v9_no_analysis_sent: !loadV9.requests.concat(log.slice(t1)).some((l) => /^POST \/analyses/.test(l)),
      v9_refusal_text: /Nothing was sent/.test(refusal),
      v9_record_byte_identical: v9After[KA] === v9Before[KA],
    };
    const sent = out.steps.find((s) => s.name === 'analyze after migration').posted[0];
    checks.analysis_sends_token_3_and_control = !!sent && /"token":3/.test(sent) && /"line":"my love is true","token":2/.test(sent) && !/"line":"Oh--oh, oh my love","token":2/.test(sent);
    out.checks = checks;
    out.errors = errors;
    console.log('CHECKS', JSON.stringify(checks, null, 1));
    console.log('PAGE ERRORS', JSON.stringify(errors));
  } finally {
    await context.close();
    await browser.close();
    await srv.close();
    fs.writeFileSync(args.out, JSON.stringify(out, null, 1));
  }
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
