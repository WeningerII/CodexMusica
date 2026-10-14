#!/usr/bin/env node
'use strict';
// Stale-tab hazard: the candidate page (codex.html) and the retained OLD
// generation shell (codex-old.html = main's codex.html, loading the retained
// chunk library/code/analysis.71b110b249.js) on ONE origin, sharing IndexedDB.
// usage: BB8_TREE=<wt-678> node repro_stale_tab.js <mixroot> <out.json>
const fs = require('fs');
const L = require('./repro_lib.js');
const ROOT = process.argv[2], OUT = process.argv[3];
const OO = 'Oh--oh, oh, oh my love';
const OH = 'Oh--oh, oh my love';
(async () => {
  const server = await L.start({ root: ROOT });
  const browser = await L.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const res = { steps: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const log = [];
    await context.route(/^https:\/\/mcp\.codexmusica\.com\//, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': route.request().headers().origin || '*', 'access-control-allow-credentials': 'true' }, body: '{"ok":true,"enabled":true}' }));
    await context.route(`${L.API}/**`, L.stub(log));
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await page.goto(`${server.url}/robots.txt`);
    const seed = { declarations: { pronunciations: [L.row(OO, 2, 'oh')] } };
    await L.idb(page, 'put', seed);
    const hash = `#library/read/${L.EPI_A}?lens=sound`;
    const push = async (label, extra = {}) => res.steps.push({ label, ...(await L.snapshot(page, log)), ...extra });
    // 1. new page migrates the legacy record
    await page.goto(`${server.url}/codex.html${hash}`); await L.inspector(page);
    await push('new-page-load (migrates)');
    res.steps.push({ label: 'new-page-analyze', ...(await L.analyze(page, log)) });
    // 2. the old-generation shell in the same origin: confirm which chunk ran
    await page.goto(`${server.url}/codex-old.html${hash}`); await L.inspector(page);
    const chunks = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /library\/code\/analysis/.test(n)));
    await push('old-page-load', { analysis_chunk_loaded: chunks });
    res.steps.push({ label: 'old-page-analyze', ...(await L.analyze(page, log)) });
    await L.applyInterpretation(page); // old chunk: device.set(key, { declarations: v })
    await push('old-page-after-apply');
    // 3. back on the new page
    await page.goto(`${server.url}/codex.html${hash}`); await L.inspector(page);
    const chunks2 = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /library\/code\/analysis/.test(n)));
    await push('new-page-reload-after-old-save', { analysis_chunk_loaded: chunks2 });
    res.steps.push({ label: 'new-page-analyze-after-old-save', ...(await L.analyze(page, log)) });
    res.errors = errs;
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
  for (const s of res.steps) {
    console.log('--', s.label, s.analysis_chunk_loaded ? JSON.stringify(s.analysis_chunk_loaded.map((n) => n.split('/').pop())) : '');
    if (s.cut && s.cut.length) console.log('  cut:', JSON.stringify(s.cut));
    if (s.idb) console.log('  idb:', JSON.stringify({ token_cut: s.idb.token_cut, rows: s.idb.declarations.pronunciations.map((r) => [r.line, r.token]), keys: Object.keys(s.idb) }));
    if ('sent_declaration_set' in s) console.log('  SENT:', JSON.stringify(s.sent_declaration_set && s.sent_declaration_set.pronunciations.map((r) => [r.line, r.token])), 'alerts:', JSON.stringify(s.alerts_after));
  }
  console.log('errors', JSON.stringify(res.errors));
})().catch((e) => { console.error(e); process.exit(1); });
