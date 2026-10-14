// BB8 scratch sections for routes 3 and 4, plugged into a patched copy of
// scripts/check_library_page.js (r34_page.js). Env:
//   MODE=make   (main build): legacy record -> whole-reading bundle download,
//               then a Lyrics working copy carrying a v1 [SETUP — reading] row
//   MODE=import (candidate build): import those files, inspect what binds
//   MODE=handoff (candidate build): legacy record -> in-page handoff -> Lyrics
//   OUT=<dir>   where bundles and observations are written
/* global document, indexedDB, app, lyDraft, lyParse, lyDeclarationsOf, UI_PAGE_ACTIONS, location */
'use strict';
const fs = require('fs');
const path = require('path');

const LINE = 'Oh--oh, oh my love';
const choice = (line, token, word) => ({
  line,
  token,
  word,
  phones: ['AA1'],
  basis: 'declared',
  source: 'the singer',
});

module.exports = function sections({ EPI_A, go, settled, check }) {
  const OUT = process.env.OUT;
  const obs = {};
  const save = () => fs.writeFileSync(path.join(OUT, `obs_${process.env.MODE}${process.env.EXTRA ? '_extra' : ''}.json`), JSON.stringify(obs, null, 2));
  const idb = (page, op, key, value) =>
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
  const openInspector = async (page) => {
    await settled(page, 'reader', '#surface-library .rd-paper .rd-line');
    if (await page.isVisible('#surface-library [data-rd="sheet"]').catch(() => false))
      await page.click('#surface-library [data-rd="sheet"]');
    return page
      .waitForSelector('#surface-library [data-act="analyze"]', { timeout: 15000 })
      .catch(() => null);
  };
  // Put a legacy (unmarked, v1-numbered) record on the reading's interpretation key.
  const seedLegacy = async (page, base, tag) => {
    await go(page, base, `/read/${EPI_A}?lens=sound`);
    if (!check(`${tag} inspector mounted`, !!(await openInspector(page)))) return null;
    await page.click('#surface-library [data-act="decl"]');
    await page.waitForSelector('#surface-library .la-decl [data-act="save"]', { timeout: 10000 });
    await page.click('#surface-library .la-decl [data-act="save"]');
    await page.waitForTimeout(400);
    const written = await idb(page, 'list', `interpretation:${EPI_A}:`);
    const key = Object.keys(written)[0];
    obs.firstWritten = written;
    if (!check(`${tag} an interpretation record exists`, !!key)) return null;
    const legacy = { declarations: { pronunciations: process.env.EXTRA ? [choice(LINE, 2, 'oh'), choice('ways:--and the road', 2, '--and')] : [choice(LINE, 2, 'oh')] } };
    await idb(page, 'put', key, legacy);
    await page.reload();
    await page.waitForSelector('#surface-library', { state: 'attached', timeout: 20000 });
    if (!check(`${tag} inspector remounted`, !!(await openInspector(page)))) return null;
    await page.waitForTimeout(1200); // let loadInterpretation settle
    obs.afterReload = await idb(page, 'list', key);
    return key;
  };
  const wholeHandoffButton = async (page) => {
    // the "Open in Lyrics" button of the reading (data-rd="lyrics")
    const sel = '#surface-library [data-rd="lyrics"]';
    if (!(await page.isVisible(sel).catch(() => false))) {
      for (const s of ['[data-rd="info"]', '[data-rd="more"]', '[data-rd="sheet"]']) {
        if (await page.isVisible(`#surface-library ${s}`).catch(() => false)) {
          await page.click(`#surface-library ${s}`);
          if (await page.isVisible(sel).catch(() => false)) break;
        }
      }
    }
    return sel;
  };

  return {
    async make({ page, base, tag }) {
      const key = await seedLegacy(page, base, `${tag} main`);
      if (!key) return save();
      // 1) the whole-reading bundle, as main's own reader writes it when the
      //    in-page handoff fails (forced) -> uiDownload('codex-musica-library-import.json')
      await page.evaluate(() => {
        window.uiOpenInLyrics = async () => {
          throw new Error('BB8 forced download fallback');
        };
      });
      const sel = await wholeHandoffButton(page);
      obs.buttonVisible = await page.isVisible(sel).catch(() => false);
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.click(sel),
      ]);
      obs.downloadName = dl.suggestedFilename();
      const bundlePath = path.join(OUT, 'main-bundle', dl.suggestedFilename());
      fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
      await dl.saveAs(bundlePath);
      const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
      obs.bundleDeclarations = bundle.payload.declarations;
      obs.bundleDigest = bundle.digest;
      check(
        `${tag} main bundle carries the legacy token-2 choice verbatim`,
        JSON.stringify(bundle.payload.declarations) ===
          JSON.stringify([{ pronunciations: [choice(LINE, 2, 'oh')] }]),
        JSON.stringify(bundle.payload.declarations)
      );
      // 2) a Lyrics working copy made on main: import that bundle into main's
      //    Lyrics, add a sung line and a v1 [SETUP — reading] row on it, and
      //    download "text and sources".
      await page.goto(`${base}/codex.html#lyrics`);
      await page.waitForSelector('#lyrics-draft', { state: 'attached', timeout: 20000 });
      await page.setInputFiles('#ly-file', bundlePath);
      await page.waitForFunction(() => !!app.lyricMeta?.libraryOrigin, null, { timeout: 15000 });
      const text = await page.evaluate((LINE) => {
        const row = `[SETUP — reading — token 2 "oh" in "${LINE}" — AA1 — declared — source: the singer]`;
        return `${row}\n\n${LINE}\nThe evening wind returns\n` + lyDraft().value;
      }, LINE);
      await page.evaluate((text) => {
        const d = lyDraft();
        d.value = text;
        d.dispatchEvent(new Event('input', { bubbles: true }));
      }, text);
      await page.waitForTimeout(800);
      obs.mainWorkingDraftHead = (await page.evaluate(() => lyDraft().value)).split('\n').slice(0, 4);
      obs.mainSentDeclarations = await page.evaluate(() =>
        JSON.stringify(lyDeclarationsOf(lyParse(lyDraft().value)))
      );
      const [dl2] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.evaluate(() => UI_PAGE_ACTIONS['ly-download']()),
      ]);
      const wcPath = path.join(OUT, 'main-bundle', dl2.suggestedFilename());
      await dl2.saveAs(wcPath);
      obs.workingCopyName = dl2.suggestedFilename();
      const wc = JSON.parse(fs.readFileSync(wcPath, 'utf8'));
      obs.workingCopyTextHead = wc.payload.text.split('\n').slice(0, 4);
      obs.workingCopyDeclarations = wc.payload.declarations;
      save();
    },

    async import({ page, base, tag }) {
      const dir = path.join(OUT, 'main-bundle');
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      for (const f of files.sort()) {
        const p = path.join(dir, f);
        const bundle = JSON.parse(fs.readFileSync(p, 'utf8'));
        const sha = require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        await page.goto(`${base}/codex.html#lyrics`);
        await page.waitForSelector('#lyrics-draft', { state: 'attached', timeout: 20000 });
        const toasts = [];
        await page.evaluate(() => {
          window.__bb8Toasts = [];
          const t = document.getElementById('toast');
          const t0 = performance.now();
          new MutationObserver(() =>
            window.__bb8Toasts.push({
              ms: Math.round(performance.now() - t0),
              text: t.textContent,
              show: t.classList.contains('show'),
            })
          ).observe(t, { childList: true, subtree: true, characterData: true, attributes: true });
        });
        await page.setInputFiles('#ly-file', p);
        const ok = await page
          .waitForFunction(
            (d) => app.lyricMeta?.libraryOrigin?.digest === d,
            bundle.digest,
            { timeout: 15000 }
          )
          .then(() => true)
          .catch(() => false);
        await page.waitForTimeout(1200);
        const r = await page.evaluate(() => {
          const ctx = window.uiLyricContext ? window.uiLyricContext('lyrics-edit') : null;
          const toastsNow = [...document.querySelectorAll('.cm-toast, [role="status"], [role="alert"]')]
            .map((e) => e.innerText)
            .filter((t) => t && t.trim());
          return {
            origin: app.lyricMeta?.libraryOrigin
              ? {
                  digest: app.lyricMeta.libraryOrigin.digest,
                  adapted: app.lyricMeta.libraryOrigin.adapted,
                  declarations: app.lyricMeta.libraryOrigin.declarations,
                }
              : null,
            draftHead: lyDraft().value.split('\n').slice(0, 4),
            sent: JSON.stringify(lyDeclarationsOf(lyParse(lyDraft().value))),
            ctx: ctx ? JSON.stringify(ctx).slice(0, 3000) : null,
            toasts: toastsNow.slice(0, 8),
            review: (document.querySelector('#surface-lyrics')?.innerText || '').slice(0, 0),
          };
        });
        r.toastSequence = await page.evaluate(() => {
          const seen = [];
          for (const x of window.__bb8Toasts || [])
            if (!seen.length || seen[seen.length - 1].text !== x.text) seen.push(x);
          return seen;
        });
        obs[f] = { fileSha256: sha, digest: bundle.digest, imported: ok, ...r };
        check(`${tag} ${f}: imported unchanged (digest verified, file not rewritten)`, ok, JSON.stringify(r.toasts));
        if (/library-import/.test(f)) {
          check(
            `${tag} ${f}: legacy choice kept verbatim as source history`,
            JSON.stringify(r.origin?.declarations) ===
              JSON.stringify([{ pronunciations: [choice(LINE, 2, 'oh')] }]),
            JSON.stringify(r.origin?.declarations)
          );
          check(`${tag} ${f}: nothing sent binds it`, !/AA1|the singer/.test(r.sent + (r.ctx || '')), r.sent);
        }
        // the Review tab text, where per-row notices appear
        await page.evaluate(() => document.querySelector('[data-ui="ly-tab"][data-id="review"]')?.click());
        await page.waitForTimeout(500);
        obs[f].reviewText = await page.evaluate(
          () => (document.querySelector('#surface-lyrics')?.innerText || '').slice(0, 4000)
        );
      }
      save();
    },

    async stale({ page, base, tag }) {
      // Route 2 visibility: a job the server paused STALE_READING (as
      // reader_scheduler.pump does across a release), as this page shows it.
      const API = 'https://mcp.codexmusica.com/library/v1';
      const JOB = 'job_0123456789abcdef0123456789abcdef';
      let created = null;
      await page.route(`${API}/analyses`, async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        created = {
          id: JOB, state: 'running', attempt: 1, generation: 1,
          identity: { reading_unit_id: body.reading_unit_id, reading_revision: body.reading_revision, snapshot_id: 'snapshot-check-library-page', engine_commit: '8b1d2ad2c0000000000000000000000000000000' },
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        return route.fulfill({ status: 202, headers: { 'content-type': 'application/json', 'access-control-allow-origin': route.request().headers().origin || '*', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ contract_version: 1, job: created }) });
      });
      await page.route(`${API}/jobs/**`, async (route) => {
        const h = { 'content-type': 'application/json', 'access-control-allow-origin': route.request().headers().origin || '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type, idempotency-key, if-match', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h, body: '' });
        if (/\/resume$/.test(new URL(route.request().url()).pathname))
          return route.fulfill({ status: 409, headers: h, body: JSON.stringify({ error: { code: 'STALE_READING', message: 'Source, declarations or engine/resource identity changed; start a separate analysis.', remedy: 'Reload the reading: it was updated, and analysis runs on the current revision.' } }) });
        const job = { ...created, state: 'paused', reason: { code: 'STALE_READING', message: 'Source or engine identity changed; create a new reader job.' } };
        return route.fulfill({ status: 200, headers: h, body: JSON.stringify({ contract_version: 1, job }) });
      });
      await go(page, base, `/read/${EPI_A}?lens=sound`);
      if (!check(`${tag} stale: inspector mounted`, !!(await openInspector(page)))) return save();
      await page.click('#surface-library [data-act="analyze"]');
      await page.waitForFunction(() => /paused/i.test(document.querySelector('#surface-library .la-section[aria-live]')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
      obs.pausedStatus = await page.evaluate(() => document.querySelector('#surface-library .la-section[aria-live]')?.innerText || '');
      check(`${tag} stale: paused job shows STALE_READING reason`, /STALE_READING|identity changed/i.test(obs.pausedStatus), obs.pausedStatus.slice(0, 300));
      if (await page.isVisible('#surface-library [data-act="resume"]').catch(() => false)) {
        await page.click('#surface-library [data-act="resume"]');
        await page.waitForTimeout(800);
        obs.afterResume = await page.evaluate(() => document.querySelector('#surface-library .la-section[aria-live]')?.innerText || '');
      }
      save();
    },
    async handoff({ page, base, tag }) {
      const key = await seedLegacy(page, base, `${tag} cand`);
      if (!key) return save();
      obs.statusText = await page.evaluate(
        () => document.querySelector('#surface-library .la-section[aria-live]')?.innerText || ''
      );
      // capture the envelope the in-page handoff hands to Lyrics
      await page.evaluate(() => {
        const real = window.uiOpenInLyrics;
        window.__bb8Envelopes = [];
        window.uiOpenInLyrics = async (env) => {
          window.__bb8Envelopes.push(JSON.parse(JSON.stringify(env)));
          return real(env);
        };
      });
      const sel = await wholeHandoffButton(page);
      await page.click(sel);
      await page
        .waitForFunction(() => location.hash.startsWith('#lyrics'), null, { timeout: 20000 })
        .catch(() => {});
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({
        hash: location.hash,
        envelopes: (window.__bb8Envelopes || []).map((e) => ({
          digest: e.digest,
          declarations: e.payload.declarations,
          scope: e.payload.scope,
        })),
        origin: app.lyricMeta?.libraryOrigin ? app.lyricMeta.libraryOrigin.declarations : null,
        sent: JSON.stringify(lyDeclarationsOf(lyParse(lyDraft().value))),
        ctx: window.uiLyricContext ? JSON.stringify(window.uiLyricContext('lyrics-edit')).slice(0, 2000) : null,
      }));
      obs.handoff = r;
      check(`${tag} handoff reached Lyrics`, /lyrics/.test(r.hash), r.hash);
      check(
        `${tag} handoff envelope carries the rebound token-3 row, never token 2`,
        /"token":3/.test(JSON.stringify(r.envelopes)) && !/"token":2/.test(JSON.stringify(r.envelopes)),
        JSON.stringify(r.envelopes)
      );
      check(`${tag} nothing sent binds the imported choice`, !/AA1|the singer/.test(r.sent + (r.ctx || '')), r.sent);
      obs.afterHandoffRecord = await idb(page, 'list', key);
      save();
    },
  };
};
