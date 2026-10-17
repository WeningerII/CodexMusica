// G4(a) UI-only check (scratch, not committed). BB8 for Jony, 2026-10-17.
//
// The real offline transport is used unchanged (scripts/lyrics_inspection_transport_fixture.mjs:
// the real chat router, tools and Python; only the model's tool choice is stubbed). The ONLY change is
// a page-level route that swaps the reply's schema_instance_evidence.records for two hand-built records
// on the real engine's own pair endpoints:
//     LABEL = "G4 controlled disagreement — synthetic, not engine evidence"
// The request binding, identity and source projection stay exactly as the engine sent them.
// The real engine never emits verdict "false" or a schema named plain "rhyme" for this pair (checked
// separately), so this tests the page's rendering of a disagreement, not the engine.
//
// usage: (cwd = a checkout) TEST_ROOT=. node g4a_ui_check.mjs OUTDIR
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = path.resolve(process.env.TEST_ROOT || '.');
const { createOfflineChat } = await import(path.join(root, 'scripts/lyrics_inspection_transport_fixture.mjs'));
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const out = path.resolve(process.argv[2] || 'g4a-out');
fs.mkdirSync(out, { recursive: true });
const LABEL = 'G4 controlled disagreement — synthetic, not engine evidence';
const text = '[SETUP — rhyme groups — 1,2]\nthe cat\nthe bad';
const backend = await createOfflineChat({ args: { lines: ['the cat', 'the bad'], groups: '1,2' } });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
try {
  for (const [vw, vh] of [[1440, 900], [390, 844]]) {
    const tag = `${vw}`;
    const record = { viewport: `${vw}x${vh}` };
    const context = await browser.newContext({ viewport: { width: vw, height: vh } });
    const pageErrors = [];
    let swapped = null;
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname === 'mcp.codexmusica.com') {
        if (url.pathname === '/chat' && request.method() === 'POST') {
          const response = await backend.fetch(backend.url + '/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: request.postData() });
          const payload = JSON.parse(await response.text());
          const ev = payload.tools?.find((t) => t.schema_instance_evidence)?.schema_instance_evidence;
          assert(ev?.request_binding, 'real reply carries authenticated evidence');
          const real = ev.records.find((r) => r.kind === 'relation_instance' && r.schema_name === 'assonance');
          assert(real, 'real engine reports assonance on this pair (its endpoints are reused)');
          const base = { kind: 'relation_instance', a: real.a, b: real.b, method_id: LABEL, synthetic: LABEL };
          ev.records = [
            { ...base, id: 'g4-synthetic-rhyme-false', schema_name: 'rhyme', verdict: 'false' },
            { ...base, id: 'g4-synthetic-assonance-true', schema_name: 'assonance', verdict: 'true' },
          ];
          swapped = { real_records_replaced: true, endpoints_from: real.id, records: ev.records.map((r) => `${r.schema_name}=${r.verdict}`) };
          return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(payload) });
        }
        return route.fulfill({ json: { ok: true, enabled: true } });
      }
      if (url.hostname === '127.0.0.1') {
        const file = url.pathname === '/codex.html' ? path.join(root, 'codex.html') : path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
        return route.fulfill({ status: 404 });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    try {
      await page.goto('http://127.0.0.1/codex.html#lyrics');
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && LY.model);
      await page.evaluate((t) => { lyDraft().value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); LY_ACTIONS['ly-tab']('review'); }, text);
      await page.locator('#ly-panel-review [data-ui="ly-run-review"]').click();
      await page.waitForFunction(() => !chatState.busy && !!LY.run, null, { timeout: 180000 });
      record.swapped = swapped;
      record.freshness = await page.evaluate(() => {
        const s = LY.run.relationEvidence;
        return lyRelationEvidenceView(s?.evidence, { requestId: s?.requestId, binding: s?.binding,
          document: { semanticId: lyIdentity(LY.model), text: LY.model.text, readerScheme: LY_TOKEN_SCHEME, voices: LY.model.voices } }).freshness;
      });
      // Rhymes tool
      const narrow = vw < 600;
      if (narrow) await page.locator('[data-ui="ly-mobile"][data-id="tools"]').click();
      else await page.evaluate(() => LY_ACTIONS['ly-tab']('tools'));
      const rhymesRow = page.locator('[data-ui="ly-tool"][data-id="rhymes"]:visible').first();
      await rhymesRow.waitFor({ timeout: 15000 });
      record.rhymes_row_text = (await rhymesRow.innerText()).replace(/\s+/g, ' ').trim();
      await rhymesRow.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `rhymes-${tag}.png`), fullPage: false });
      // Relations
      if (narrow) await page.locator('[data-ui="ly-mobile"][data-id="song"]').click();
      else await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      if (!(await page.locator('[data-ui="ly-relations"]:visible').count())) {
        record.narrow_visible_controls = await page.$$eval('[data-ui]', (ns) => [...new Set(ns.filter((n) => n.offsetParent).map((n) => n.dataset.ui))]);
        await page.screenshot({ path: path.join(out, `review-${tag}.png`) });
        record.dock_present = await page.evaluate(() => { const d = document.getElementById('ly-relation-dock'); return d ? { html: d.innerHTML.slice(0, 200), visible: !!d.offsetParent } : null; });
      }
      await page.locator('[data-ui="ly-relations"]:visible').first().click();
      const all = page.locator('[data-ui="ly-relation-source"][data-id=""]:visible');
      if (await all.count()) await all.first().click();
      const expand = page.locator('[data-ui="ly-relation-expand"]:visible');
      if (await expand.count()) await expand.first().click();
      const section = page.locator('section[aria-label="Relations"]:visible').first();
      await section.waitFor({ timeout: 15000 });
      record.relation_rows = await section.locator('li[data-relation-id]').evaluateAll((ns) => ns.map((n) => ({ id: n.dataset.relationId, text: n.querySelector('p')?.innerText.trim() })));
      record.relations_text = (await section.innerText()).replace(/\s+\n/g, '\n').slice(0, 1500);
      await page.screenshot({ path: path.join(out, `relations-${tag}.png`), fullPage: false });
      record.horizontal_overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      // assertions Jony asked for
      record.checks = {
        rhymes_says_declared_rhyme_links: /Declared rhyme links/.test(record.rhymes_row_text),
        rhyme_not_confirmed_row: record.relation_rows.some((r) => /^rhyme · Not confirmed$/.test(r.text)),
        assonance_confirmed_row: record.relation_rows.some((r) => /^assonance · Confirmed$/.test(r.text)),
        both_on_one_row: record.relation_rows.some((r) => /rhyme · Not confirmed/.test(r.text) && /assonance · Confirmed/.test(r.text)),
        evidence_still_current: record.freshness === 'current',
        no_page_errors: pageErrors.length === 0,
        no_horizontal_overflow: !record.horizontal_overflow,
      };
      record.pageErrors = pageErrors;
    } catch (e) {
      record.error = e.stack;
    }
    results.push(record);
    await context.close();
  }
} finally {
  await browser.close();
  await backend.close();
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ label: LABEL, results }, null, 2));
for (const r of results) console.log(r.viewport, JSON.stringify(r.checks || r.error?.split('\n')[0]), JSON.stringify(r.relation_rows || []));
