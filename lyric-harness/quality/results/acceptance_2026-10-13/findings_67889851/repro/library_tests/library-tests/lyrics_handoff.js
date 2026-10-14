// BB8 task 3: Library -> Lyrics whole-reading handoff while a saved
// pronunciation choice is BLOCKED (undecided). Real built page, real reader
// "Open in Lyrics" button, normal lib.device store ('codex-musica-library-v1').
// Observes: the envelope handed to Lyrics (wrapping the global uiOpenInLyrics,
// observe-only), the committed Lyrics draft (app.lyricMeta.libraryOrigin and
// the 'codex-musica-library-drafts' IndexedDB record), every visible Lyrics
// text incl. History and toasts, and the "Export source details" download.
//   node lyrics_handoff.js --tree=DIR --built=DIR --out=FILE.json
'use strict';
const fs = require('fs');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    return [m[1], m[2]];
  })
);
process.argv = process.argv.slice(0, 2);
const H = require('./harness_lib.js')(args.tree);
const { chromium } = H.requireFromTree('playwright');

const LINE = 'Oh--oh, oh my love';
const DASH = 'ways:--and the road';
const choice = (line, token, word) => ({
  line,
  token,
  word,
  phones: ['AA1'],
  basis: 'declared',
  source: 'the singer',
});
const SCENARIOS = {
  // unmarked legacy: one row rebinds (oh 2 -> 3), one is blocked ('--and')
  blocked_row: {
    record: { declarations: { pronunciations: [choice(LINE, 2, 'oh'), choice(DASH, 2, '--and')] } },
    wait: true,
  },
  // unknown cut marker: every row blocked
  v9: { record: { declarations: { pronunciations: [choice(LINE, 2, 'oh')] }, token_cut: 'v9' }, wait: true },
  // a valid current-cut record, nothing blocked: control
  valid_v2: {
    record: { declarations: { pronunciations: [choice(LINE, 3, 'oh')] }, token_cut: 'v2' },
    wait: true,
  },
  // probe: the same valid record, Open in Lyrics clicked as soon as it is shown
  valid_v2_immediate: {
    record: { declarations: { pronunciations: [choice(LINE, 3, 'oh')] }, token_cut: 'v2' },
    wait: false,
  },
  // probes: the reader's inspector collapsed (its remembered setting) before opening
  valid_v2_inspector_closed: {
    record: { declarations: { pronunciations: [choice(LINE, 3, 'oh')] }, token_cut: 'v2' },
    wait: false,
    closed: true,
  },
  blocked_row_inspector_closed: {
    record: { declarations: { pronunciations: [choice(LINE, 2, 'oh'), choice(DASH, 2, '--and')] } },
    wait: false,
    closed: true,
  },
};
const ONLY = args.only ? new Set(args.only.split(',')) : null;

(async () => {
  const out = { tree: args.tree, built: args.built, scenarios: {} };
  H.link(args.built);
  const srv = await H.start({ root: args.built, port: 0 });
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const rev = H.headOf(H.EPI_A).reading_revision;
  const KEY = `interpretation:${H.EPI_A}:${rev}`;
  try {
    for (const [name, sc] of Object.entries(SCENARIOS)) {
      if (ONLY && !ONLY.has(name)) continue;
      const { context, page, errors, log } = await H.openPage(browser, srv.url, {
        theme: 'light',
        width: 1280,
      });
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
          }, 40);
        });
        await H.go(page, srv.url, '');
        await page.waitForSelector('#surface-library .lib-shelf', { timeout: 20000 });
        // Seed the normal device store exactly where core's lib.device writes.
        await page.evaluate(
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
          [KEY, sc.record]
        );
        // Observe-only wrapper on the global the reader calls.
        await page.evaluate(() => {
          const orig = window.uiOpenInLyrics;
          window.__envelopes = [];
          window.uiOpenInLyrics = (env) => {
            window.__envelopes.push(JSON.parse(JSON.stringify(env)));
            return orig(env);
          };
        });
        if (sc.closed) await page.evaluate(() => localStorage.setItem('cm-library-inspector', 'false'));
        await page.evaluate((id) => (location.hash = `#library/read/${id}?lens=sound`), H.EPI_A);
        await page.waitForSelector('#surface-library [data-rd="lyrics"]', { timeout: 20000 });
        if (sc.wait) {
          await page
            .waitForSelector('#surface-library [data-act="analyze"]', { timeout: 15000 })
            .catch(() => null);
          await page.waitForTimeout(800);
        }
        if (sc.closed) await page.waitForTimeout(1500);
        r.inspector = await page.evaluate(() => ({
          inspector_open: !!document.querySelector('#surface-library [data-rd-ana]'),
          renumbered: document.querySelector('#surface-library [data-cut="renumbered"]')?.innerText || '',
          undecided: document.querySelector('#surface-library [data-cut="undecided"]')?.innerText || '',
        }));
        r.toasts_before_handoff = await page.evaluate(() => window.__toasts.slice());
        const nBefore = r.toasts_before_handoff.length;
        await page.click('#surface-library [data-rd="lyrics"]');
        await page
          .waitForFunction(() => !location.hash.startsWith('#library'), null, { timeout: 20000 })
          .catch(() => {});
        await page.waitForTimeout(1500);
        r.hash = await page.evaluate(() => location.hash);
        r.envelope_declarations = await page.evaluate(() =>
          (window.__envelopes || []).map((e) => ({ scope: e.payload.scope, declarations: e.payload.declarations }))
        );
        r.lyrics = await page.evaluate(() => {
          const o = (typeof app !== "undefined" ? app : undefined)?.lyricMeta?.libraryOrigin;
          return {
            origin_declarations: o ? o.declarations : '(no libraryOrigin)',
            origin_keys: o ? Object.keys(o) : [],
            draft_has_setup_rows: /\[SETUP\]/i.test((typeof app !== "undefined" ? app : undefined)?.lyrics || ''),
            draft_first_line: String((typeof app !== "undefined" ? app : undefined)?.lyrics || '').split('\n')[0],
            surface_text: document.querySelector('#surface-lyrics')?.innerText || '',
          };
        });
        r.drafts_db = await page.evaluate(
          () =>
            new Promise((resolve) => {
              const q = indexedDB.open('codex-musica-library-drafts', 1);
              q.onerror = () => resolve({ error: String(q.error) });
              q.onsuccess = () => {
                const d = q.result;
                if (!d.objectStoreNames.contains('drafts')) return resolve({ stores: [...d.objectStoreNames] });
                const all = d.transaction('drafts').objectStore('drafts').getAll();
                all.onsuccess = () =>
                  resolve(
                    all.result.map((x) => ({
                      draftId: x.draftId,
                      declarations: x.meta?.libraryOrigin?.declarations,
                    }))
                  );
              };
            })
        );
        // History tab (source history) text.
        const hist = await page.$('#surface-lyrics [data-ui="ly-tab"][data-id="history"]');
        if (hist) {
          await hist.click().catch(() => {});
          await page.waitForTimeout(500);
        }
        r.history_text = await page.evaluate(
          () => document.querySelector('[data-ui="ly-panel-history"], #ly-panel-history')?.innerText || ''
        );
        // Export source details: the downloaded file.
        const btn = await page.$('[data-ui="ly-library-provenance"]');
        if (btn && (await btn.isVisible())) {
          const [dl] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
            btn.click(),
          ]);
          if (dl) {
            const p = await dl.path();
            const j = JSON.parse(fs.readFileSync(p, 'utf8'));
            r.export_source_details = {
              declarations: j.libraryOrigin?.declarations,
              mentions_undecided: /undecided|legacy_declarations|token_cut|--and/.test(JSON.stringify(j)),
            };
          } else r.export_source_details = 'no download event';
        } else r.export_source_details = 'button not visible';
        r.library_record_after = await page.evaluate(
          (key) =>
            new Promise((resolve) => {
              const q = indexedDB.open('codex-musica-library-v1', 1);
              q.onsuccess = () => {
                const g = q.result.transaction('state').objectStore('state').get(key);
                g.onsuccess = () => resolve(g.result);
              };
            }),
          KEY
        );
        r.toasts_after_handoff = await page.evaluate((n) => window.__toasts.slice(n), nBefore);
        const all = [r.lyrics.surface_text, r.history_text, ...r.toasts_after_handoff].join('\n');
        r.omission_mentioned_in_lyrics = {
          decision: /decision|undecided|set aside|left out|omitted|not carried|not sent/i.test(all),
          pronunciation_choice: /pronunciation choice|saved choice/i.test(all),
          dash_word: /--and/.test(all),
        };
      } catch (e) {
        r.exception = String(e && e.stack ? e.stack : e).slice(0, 600);
      }
      out.scenarios[name] = r;
      console.log('##', name, JSON.stringify({ ...r, lyrics: { ...r.lyrics, surface_text: (r.lyrics?.surface_text || '').slice(0, 200) }, history_text: (r.history_text || '').slice(0, 300) }));
      await context.close();
    }
  } finally {
    await browser.close();
    await srv.close();
    fs.writeFileSync(args.out, JSON.stringify(out, null, 1));
  }
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
