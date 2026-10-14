// Library working-copy path for the same S1 song (candidate only): does the
// card name the orphan readings' lines? Scratch only.
'use strict';
const fs = require('fs');
const path = require('path');
process.argv[2] = process.argv[2] || 'cand';
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-0');
const src = fs.readFileSync(path.join(OUT, 'v.js'), 'utf8');
// Reuse v.js's helpers and songs without its main block.
const helpers = src.slice(0, src.indexOf('(async () => {'));
const m = { exports: {} };
new Function('require', 'module', 'process', helpers + '\nmodule.exports={serve,newCtx,open,review,toasts,draftOf,S1,ORPHAN,ORPHAN2,chromium,TREE};')(require, m, process);
const H = m.exports;
(async () => {
  const errs = [];
  const server = H.serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await H.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: H.TREE };
  try {
    const ctx = await H.newCtx(browser);
    const page = await H.open(ctx, url, errs);
    const env = await page.evaluate(async (t) => {
      const meta = { version: 1, brief: '', notes: {}, drafts: {}, ui: {}, libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title: 'Skeptic Lib', language: 'eng', scope: 'whole', provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] } };
      return CMLibraryImport.makeWorkingCopyEnvelope(t, meta);
    }, H.S1);
    const file = path.join(OUT, `v_lib_${H.TREE}_working_copy.json`);
    fs.writeFileSync(file, JSON.stringify(env, null, 2));
    await page.setInputFiles('#ly-file', file);
    await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const r = await H.review(page);
    out.review = r;
    out.toasts = await H.toasts(page);
    console.log('LIB card text:', r.card ? r.card.text : null);
    console.log('LIB card meta:', JSON.stringify(r.meta));
    console.log('LIB pane contains ORPHAN line text:', r.pane.includes(H.ORPHAN), '| ORPHAN2:', r.pane.includes(H.ORPHAN2));
    await ctx.close();
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errs;
    fs.writeFileSync(path.join(OUT, `v_lib_${H.TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
