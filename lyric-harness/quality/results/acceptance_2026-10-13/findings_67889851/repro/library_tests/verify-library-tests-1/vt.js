// BB8 verify-library-tests-1: independent re-check of the claim
// "Library -> Lyrics handoff drops blocked (undecided) pronunciation choices
// without trace in Lyrics; a v9 record arrives as pronunciations: [];
// Lyrics' Download working copy re-sends origin.declarations, so a round trip
// keeps only the reduced set; originals survive only in the Library record;
// not a regression vs main".
// Real built page; the tree's own static server + Render stub (helper half of
// its scripts/check_library_page.js, loaded verbatim); our scenarios/asserts.
//   node vt.js --tree=DIR --built=DIR --out=FILE.json [--only=a,b]
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

const A = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (!m) throw Error('bad arg ' + a);
    return [m[1], m[2]];
  })
);
process.argv = process.argv.slice(0, 2); // the helper half parses argv
function helpers(tree) {
  const file = path.join(tree, 'scripts', 'check_library_page.js');
  const src = fs.readFileSync(file, 'utf8');
  const cut = src.indexOf('// ─── Sections');
  if (cut < 0) throw Error('no Sections marker');
  const m = new Module(file, module);
  m.filename = path.join(tree, 'scripts', '__vt_helpers.js');
  m.paths = Module._nodeModulePaths(path.join(tree, 'scripts'));
  m._compile(
    src.slice(0, cut).replace(/^#!.*\n/, '') +
      '\nmodule.exports={start,openPage,go,headOf,link,EPI_A};\n',
    m.filename
  );
  m.exports.req = Module.createRequire(path.join(tree, 'scripts', 'x.js'));
  return m.exports;
}
const H = helpers(A.tree);
const { chromium } = H.req('playwright');

const L1 = 'Oh--oh, oh my love';
const L2 = 'ways:--and the road';
const row = (line, token, word) => ({ line, token, word, phones: ['AA1'], basis: 'declared', source: 'the singer' });
const NARR = { source: 'the singer', atoms: ['ESTABLISH'], junctions: [] };
const SC = {
  // unmarked (legacy) record: "oh" t2 rebinds to 3, "--and" t2 has no v2 word
  legacy_blocked: { rec: { declarations: { pronunciations: [row(L1, 2, 'oh'), row(L2, 2, '--and')] } } },
  // the same record already migrated on an earlier visit (as the page itself writes it)
  migrated_second_visit: { second: true, rec: { declarations: { pronunciations: [row(L1, 2, 'oh'), row(L2, 2, '--and')] } } },
  // unknown cut marker, pronunciations only
  v9_pron: { rec: { token_cut: 'v9', declarations: { pronunciations: [row(L1, 2, 'oh')] } } },
  // unknown cut marker plus a non-pronunciation declaration
  v9_mixed: { rec: { token_cut: 'v9', declarations: { pronunciations: [row(L1, 2, 'oh')], narrative: NARR } } },
  // legacy record, reader inspector collapsed (its remembered setting)
  legacy_blocked_insp_closed: { closed: true, rec: { declarations: { pronunciations: [row(L1, 2, 'oh'), row(L2, 2, '--and')] } } },
  // control: current-cut record, nothing blocked
  valid_v2: { rec: { token_cut: 'v2', declarations: { pronunciations: [row(L1, 3, 'oh')] } } },
  // silent paths: no toast is expected and the inspector is collapsed
  v9_insp_closed: { closed: true, rec: { token_cut: 'v9', declarations: { pronunciations: [row(L1, 2, 'oh')] } } },
  second_visit_insp_closed: { second: true, closed: true, rec: { declarations: { pronunciations: [row(L1, 2, 'oh'), row(L2, 2, '--and')] } } },
  // phone width, default settings
  v9_390: { width: 390, rec: { token_cut: 'v9', declarations: { pronunciations: [row(L1, 2, 'oh')] } } },
  legacy_blocked_390: { width: 390, rec: { declarations: { pronunciations: [row(L1, 2, 'oh'), row(L2, 2, '--and')] } } },
};
const ONLY = A.only ? new Set(A.only.split(',')) : null;
const DL = path.join(path.dirname(A.out), 'dl-' + path.basename(A.out, '.json'));
fs.mkdirSync(DL, { recursive: true });

const idbPut = ([key, value]) =>
  new Promise((res, rej) => {
    const q = indexedDB.open('codex-musica-library-v1', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('state');
    q.onerror = () => rej(q.error);
    q.onsuccess = () => {
      const t = q.result.transaction('state', 'readwrite');
      t.objectStore('state').put(value, key);
      t.oncomplete = () => (q.result.close(), res(true));
    };
  });
const idbGet = (key) =>
  new Promise((res) => {
    const q = indexedDB.open('codex-musica-library-v1', 1);
    q.onerror = () => res({ error: String(q.error) });
    q.onsuccess = () => {
      const g = q.result.transaction('state').objectStore('state').get(key);
      g.onsuccess = () => (q.result.close(), res(g.result));
    };
  });

async function openReader(page, sc) {
  await page.evaluate((id) => (location.hash = `#library/read/${id}?lens=sound`), H.EPI_A);
  await page.waitForSelector('#surface-library [data-rd="lyrics"]', { timeout: 20000 });
  // wait for the analysis controller to have loaded the saved interpretation
  await page.waitForSelector('#surface-library [data-act="decl"]', { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(1500);
}

(async () => {
  const out = { tree: A.tree, built: A.built, scenarios: {} };
  H.link(A.built);
  const srv = await H.start({ root: A.built, port: 0 });
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const rev = H.headOf(H.EPI_A).reading_revision;
  const KEY = `interpretation:${H.EPI_A}:${rev}`;
  out.key = KEY;
  try {
    for (const [name, sc] of Object.entries(SC)) {
      if (ONLY && !ONLY.has(name)) continue;
      const { context, page, errors } = await H.openPage(browser, srv.url, { theme: 'light', width: sc.width || 1280 });
      const r = { errors };
      try {
        await page.addInitScript(() => {
          window.__toasts = [];
          let last = '';
          setInterval(() => {
            const t = document.getElementById('toast');
            const s = t ? t.textContent.trim() : '';
            if (s && s !== last) window.__toasts.push(s);
            last = s;
          }, 30);
        });
        await H.go(page, srv.url, '');
        await page.waitForSelector('#surface-library .lib-shelf', { timeout: 20000 });
        r.seeded = await page.evaluate(idbPut, [KEY, sc.rec]);
        if (sc.closed) await page.evaluate(() => localStorage.setItem('cm-library-inspector', 'false'));
        if (sc.second) {
          // first visit migrates and writes the record; then leave and come back
          await openReader(page, sc);
          r.first_visit_record = await page.evaluate(idbGet, KEY);
          await page.evaluate(() => (location.hash = '#library'));
          await page.waitForTimeout(800);
          await page.reload();
          await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
          await page.waitForTimeout(800);
          await page.evaluate(() => (window.__toasts = []));
        }
        await openReader(page, sc);
        r.library_before = await page.evaluate(() => {
          const vis = (e) => !!e && e.checkVisibility() && e.getBoundingClientRect().height > 0;
          const und = document.querySelector('#surface-library [data-cut="undecided"]');
          const ren = document.querySelector('#surface-library [data-cut="renumbered"]');
          return {
            noinsp_class: !!document.querySelector('#surface-library .rd.rd-noinsp'),
            undecided_text: und ? und.innerText : '',
            undecided_visible: vis(und),
            renumbered_text: ren ? ren.innerText : '',
            renumbered_visible: vis(ren),
            toasts: window.__toasts.slice(),
          };
        });
        await page.evaluate(() => {
          window.__env = [];
          const orig = window.uiOpenInLyrics;
          window.uiOpenInLyrics = (e) => (window.__env.push(JSON.parse(JSON.stringify(e))), orig(e));
          window.__toasts = [];
        });
        await page.click('#surface-library [data-rd="lyrics"]');
        await page.waitForFunction(() => location.hash.startsWith('#lyrics'), null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        r.envelope = await page.evaluate(() =>
          window.__env.map((e) => ({ scope: e.payload.scope, declarations: e.payload.declarations }))
        );
        r.lyrics_origin_declarations = await page.evaluate(() => app.lyricMeta?.libraryOrigin?.declarations);
        r.lyrics_text = await page.evaluate(() => document.querySelector('#surface-lyrics')?.innerText || '');
        r.toasts_after = await page.evaluate(() => window.__toasts.slice());
        // Export source details
        {
          const b = await page.$('[data-ui="ly-library-provenance"]');
          const [d] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), b.click()]);
          const p = path.join(DL, `${name}.source.json`);
          await d.saveAs(p);
          const j = JSON.parse(fs.readFileSync(p, 'utf8'));
          r.export_source = { file: p, declarations: j.libraryOrigin.declarations, has_dash_and: /--and/.test(JSON.stringify(j)) };
        }
        // Export > Download text and sources (working copy), unedited draft
        {
          await page.click('#surface-lyrics [data-ui="ly-menu"][data-id="export"]');
          await page.waitForTimeout(200);
          r.download_label = await page.evaluate(() => document.querySelector('[data-ui="ly-download"]')?.innerText.trim());
          const [d] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
            page.click('[data-ui="ly-download"]'),
          ]);
          const p = path.join(DL, `${name}.working-copy.json`);
          await d.saveAs(p);
          const j = JSON.parse(fs.readFileSync(p, 'utf8'));
          r.working_copy = {
            file: p,
            payload_declarations: j.payload.declarations,
            workingCopy_declarations: j.payload.provenance.workingCopy.declarations,
            adapted: j.payload.provenance.workingCopy.adapted,
            has_dash_and: /--and/.test(JSON.stringify(j)),
          };
          // round trip: import that file back into Lyrics (Import > file)
          await page.evaluate(() => (window.__toasts = []));
          await page.setInputFiles('#ly-file', p);
          await page.waitForTimeout(1500);
          r.reimport = {
            toasts: await page.evaluate(() => window.__toasts.slice()),
            origin_declarations: await page.evaluate(() => app.lyricMeta?.libraryOrigin?.declarations),
            origin_handoff: await page.evaluate(() => app.lyricMeta?.libraryOrigin?.handoffId),
          };
        }
        r.library_record_after = await page.evaluate(idbGet, KEY);
        const blob = [r.lyrics_text, ...r.toasts_after, ...(r.reimport?.toasts || [])].join('\n');
        r.lyrics_mentions = {
          dash_and: /--and/.test(blob),
          pronunciation: /pronunciation/i.test(blob),
          decision_words: /undecided|decision|set aside|left out|omitted|not sent|not carried/i.test(blob),
          declaration: /declaration/i.test(blob),
        };
      } catch (e) {
        r.exception = String(e && e.stack ? e.stack : e).slice(0, 800);
      }
      out.scenarios[name] = r;
      const brief = { ...r, lyrics_text: (r.lyrics_text || '').slice(0, 120) };
      console.log('##', name, JSON.stringify(brief));
      await context.close();
    }
  } finally {
    await browser.close();
    await srv.close();
    fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
  }
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
