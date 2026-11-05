/* global lyRefresh, LY_ACTIONS, lyDraft, LY, lyDeclarationsOf, lyAnalysis:writable, $ui, window, UI, lyLibraryStore, lyContext, chatState, readListStrict, saveWS, uiAutosave, restoreSavedWorkspace:writable, loadWS, lyLibraryImport, CMLibraryImport, lyMeta, lyLibraryCapture, indexedDB, lyLibraryActivate:writable, uiSaveLyrics */
/* #676 production-browser restore integration; train F, no provider.
 * node scripts/check_p2_return_restore_browser.js
 * CHROMIUM_EXECUTABLE_PATH, TEST_EVIDENCE, LYRIC_PYTHON and optionally
 * P2_TRANSPORT_ROOT (a disposable copy with the SAME mcp/scripts sources and
 * locked npm dependencies) configure the environment. No outcome is fabricated.
 * Reuses the real transport from lyrics_inspection_transport_fixture.mjs and
 * the browser/restore patterns in check_lyrics_page.js steps 9e/J14.
 * Exit 0: all assertions and real review; 1: assertion/setup failure;
 * 2: persistence passed but real review unavailable. JSON retains exact replies.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.TEST_EVIDENCE || '/tmp/p2-return-browser';
const transportRoot = process.env.P2_TRANSPORT_ROOT || root;
const song =
  '[SETUP — returns — 1,3 — cut v2]\n[Verse]\nI hold the light\nWe face the night\nI hold the light\nYou face the night';
const edited = song.replace('I hold the light', 'I guard the light');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const results = [];
const receipts = [];
let backend, browser;
const assertText = (s, text) => {
  assert.equal(
    s.text,
    text,
    'restore must preserve exact text, including one-occurrence divergence'
  );
  assert.equal(s.returns, '1,3', 'restore must preserve the explicit Return');
  assert.deepEqual(s.sung, text.split('\n').slice(2));
};
async function view(p) {
  await p.evaluate(() => {
    lyRefresh(true);
    LY_ACTIONS['ly-tab']('review');
  });
  return p.evaluate(() => ({
    text: lyDraft().value,
    sung: LY.model.sung.map((r) => r.text),
    returns: lyDeclarationsOf(LY.model).returns,
    state: lyAnalysis().state,
    badge: $ui('ly-badge').innerText,
    review: $ui('ly-panel-review').innerText,
    hasRun: !!LY.run,
    reviewEnabled: !$ui('ly-panel-review').querySelector('[data-ui="ly-run-review"]').disabled,
    runBase: LY.run?.baseModel?.text || null,
    runResult: LY.run?.resultModel?.text || null,
    storageBackend: window.storage.backend,
  }));
}
async function setText(p, text) {
  // Genuine textarea input, never a synthetic reviewed outcome.
  await p.locator('#lyrics-draft').fill(text);
  await p.evaluate(() => lyRefresh(true));
}
async function boot() {
  const ctx = await browser.newContext();
  const posts = [],
    replies = [],
    errors = [];
  await ctx.route('**/*', async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (u.hostname === 'mcp.codexmusica.com') {
      if (u.pathname === '/chat' && req.method() === 'POST') {
        const body = JSON.parse(req.postData());
        posts.push(body);
        if (!backend)
          return route.fulfill({
            status: 503,
            json: { error: 'Local real transport unavailable' },
          });
        const response = await backend.fetch(backend.url + '/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const text = await response.text();
        replies.push({ status: response.status, payload: JSON.parse(text) });
        return route.fulfill({
          status: response.status,
          contentType: 'application/json',
          body: text,
        });
      }
      if (u.pathname.startsWith('/chat/') && backend) {
        const response = await backend.fetch(backend.url + u.pathname + u.search, {
          method: req.method(),
        });
        return route.fulfill({
          status: response.status,
          contentType: 'application/json',
          body: await response.text(),
        });
      }
      // Availability probe only, not a grading outcome (same as existing browser helper).
      return route.fulfill({ json: { ok: true, enabled: true } });
    }
    if (u.hostname === '127.0.0.1') {
      const f = path.resolve(root, '.' + decodeURIComponent(u.pathname));
      if (f.startsWith(root + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile())
        return route.fulfill({ path: f });
      return route.fulfill({ status: 404 });
    }
    return route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1/codex.html#lyrics');
  await ready(p);
  return { ctx, p, posts, replies, errors };
}
async function ready(p) {
  await p.waitForFunction(
    () =>
      typeof UI !== 'undefined' &&
      UI.ready &&
      typeof LY !== 'undefined' &&
      LY.model &&
      lyLibraryStore,
    null,
    { timeout: 60000 }
  );
}
async function review(env, stage) {
  const { p, posts, replies } = env;
  const before = await view(p);
  const context = await p.evaluate(() => lyContext(LY.model));
  backend.setArgs({ lines: before.sung, ...context.declarations });
  const n = posts.length;
  await p.locator('#ly-panel-review [data-ui="ly-run-review"]').click();
  await p.waitForFunction(() => !chatState.busy && !!LY.run, null, { timeout: 120000 });
  assert.equal(posts.length, n + 1, 'one real request per review');
  assert.deepEqual(
    posts[n].lyric_context,
    { ...context, intent: 'review' },
    'review carries the restored document and Return'
  );
  const reply = replies.at(-1);
  const after = await view(p);
  assertText(after, before.text);
  const tool = reply?.payload?.tools?.find((t) => t.name === 'lyric_check');
  const record = { stage, before, context, request: posts[n], reply, after };
  receipts.push(record);
  // A genuine not-run/refusal is evidence of a blocker, never a passing review.
  record.checkInvoked = !!tool && !tool.not_run && Number.isInteger(tool.exit_code);
  record.completedCheck = !!tool && [0, 3].includes(tool.exit_code) && !tool.not_run && !tool.error;
  if (record.completedCheck) {
    assert(
      ['assessed_clear', 'assessed_findings', 'input'].includes(after.state),
      'real review must answer the current version'
    );
    assert.equal(
      tool.coverage?.obligations?.find((o) => o.id === 'return:1:3')?.status,
      'answered'
    );
    // The compact tool summary has counts, not structured finding locations.
    // Do not claim an exact Return flag here from a substring in prose.
    // The pre-existing harness characterization owns that semantic assertion.
  }
  return record;
}
async function saveSession(p) {
  return p.evaluate(async () => {
    const before = new Set((await readListStrict()).map((r) => r.key));
    await saveWS('P2 browser restore');
    const added = (await readListStrict()).filter((r) => !before.has(r.key));
    if (added.length !== 1) throw Error('saveWS did not persist one new session');
    const record = JSON.parse((await window.storage.get(added[0].key)).value);
    return { key: added[0].key, record };
  });
}
async function restoreSession(p, key, noOp = false) {
  const sentinel = '[Verse]\nDifferent autosaved document';
  await setText(p, sentinel);
  await p.evaluate(() => uiAutosave());
  await p.reload();
  await ready(p);
  assert.equal(
    await p.locator('#lyrics-draft').inputValue(),
    sentinel,
    'reload must start from a distinct autosave, not the restore target'
  );
  await p.evaluate(
    async ({ key, noOp }) => {
      const original = restoreSavedWorkspace;
      try {
        if (noOp) restoreSavedWorkspace = async () => {};
        await loadWS(key);
        lyRefresh(true);
      } finally {
        restoreSavedWorkspace = original;
      }
    },
    { key, noOp }
  );
}
async function importLibrary(p, text) {
  return p.evaluate(async (text) => {
    const meta = {
      version: 1,
      libraryOrigin: {
        version: 1,
        handoffId: 'handoff:' + crypto.randomUUID(),
        digest: '0'.repeat(64),
        title: 'P2 browser fixture',
        language: 'eng',
        scope: 'whole',
        provenance: {
          snapshotId: 'p2',
          unitId: 'p2',
          workId: 'p2',
          editionId: 'p2',
          revisionId: 'p2',
        },
        lineage: [],
        declarations: [],
      },
    };
    await lyLibraryImport(await CMLibraryImport.makeWorkingCopyEnvelope(text, meta));
    return lyMeta().draftId;
  }, text);
}
async function saveLibrary(p, id) {
  return p.evaluate(async (id) => {
    await lyLibraryStore.saveDraft(lyLibraryCapture());
    // Read via a separate real IndexedDB connection, not the page's cached record.
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('codex-musica-library-drafts', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readonly');
        const req = tx.objectStore('drafts').get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }, id);
}
async function restoreLibrary(p, id) {
  await importLibrary(p, '[Verse]\nA different draft');
  await p.reload();
  await ready(p);
  await p.evaluate(async (id) => {
    await LY_ACTIONS['ly-library-restore'](id);
    lyRefresh(true);
  }, id);
}
async function expectKilled(label, action) {
  try {
    await action();
  } catch (e) {
    if (e.code !== 'ERR_ASSERTION') throw e;
    results.push({ name: label, mutationKilled: true, assertion: e.message });
    return;
  }
  throw Error('Mutation survived: ' + label);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const provenance = {
    node: process.version,
    root,
    transportRoot,
    files: Object.fromEntries(
      [
        'scripts/check_p2_return_restore_browser.js',
        'codex.html',
        'src/app.js',
        'src/pages/lyrics.js',
        'src/library-import.js',
        'scripts/lyrics_inspection_transport_fixture.mjs',
        'mcp/package-lock.json',
      ].map((p) => [p, sha(path.join(root, p))])
    ),
  };
  const assets = spawnSync(
    process.env.LYRIC_PYTHON || 'python3',
    [
      '-B',
      '-c',
      'import sys,json; sys.path.insert(0,"lyric-harness"); import nltk; from quality.release_assets import verify_asset; result={"python":sys.version,"nltk":nltk.__version__,"assets":{}}\nfor name in ["cmudict","tagger_eng"]:\n try: verify_asset(name); result["assets"][name]="verified"\n except Exception as e: result["assets"][name]=str(e)\nprint(json.dumps(result))',
    ],
    { cwd: root, encoding: 'utf8', timeout: 30000 }
  );
  provenance.assetCheck = { status: assets.status, stdout: assets.stdout, stderr: assets.stderr };
  try {
    // Refuse a different helper or MCP source behind an isolated dependency install.
    for (const dir of ['mcp', 'scripts']) {
      for (const file of fs.readdirSync(path.join(root, dir))) {
        if (!/\.(?:js|mjs|json)$/.test(file) || file === path.basename(__filename)) continue;
        const a = path.join(root, dir, file),
          b = path.join(transportRoot, dir, file);
        if (fs.statSync(a).isFile())
          assert.equal(sha(b), sha(a), 'isolated source differs: ' + dir + '/' + file);
      }
    }
    assert.equal(
      sha(path.join(transportRoot, 'mcp/worker.py')),
      sha(path.join(root, 'mcp/worker.py')),
      'isolated Python worker differs'
    );
    assert.equal(
      fs.realpathSync(path.join(transportRoot, 'lyric-harness')),
      fs.realpathSync(path.join(root, 'lyric-harness')),
      'isolated transport must execute this exact harness tree'
    );
    provenance.pythonWorkerSha256 = sha(path.join(root, 'mcp/worker.py'));
    provenance.harnessRealpath = fs.realpathSync(path.join(root, 'lyric-harness'));
    const mod = await import(
      pathToFileURL(path.join(transportRoot, 'scripts/lyrics_inspection_transport_fixture.mjs'))
    );
    backend = await mod.createOfflineChat();
    // The existing helper chooses one tool in a single model hop. A review
    // requires recover THEN check (gemini_agent.js reviewContext guard).
    // Extend only that already-stubbed model selection, in-order within the
    // same hop; the real server supplies both tools' authoritative arguments
    // from the bound page context and consumes the actual recovery result.
    // Never alter a tool result, HTTP reply, request binding or assessment.
    const selectModelTools = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      const response = await selectModelTools(...args);
      return {
        ...response,
        json: async () => {
          const selected = await response.json();
          selected.candidates[0].content.parts = [
            { functionCall: { name: 'lyric_recover', args: {} } },
            { functionCall: { name: 'lyric_check', args: {} } },
          ];
          return selected;
        },
      };
    };
    provenance.transport =
      'Existing offline helper; model selection only expanded to ordered lyric_recover then lyric_check in one hop; real tool/HTTP replies unchanged';
  } catch (e) {
    provenance.transportBlocker = e.stack;
  }
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    provenance.chromium = browser.version();
    for (const { kind, attemptReview } of [
      { kind: 'session', attemptReview: false },
      { kind: 'library', attemptReview: false },
      { kind: 'session', attemptReview: true },
      { kind: 'library', attemptReview: true },
    ]) {
      const label = kind + (attemptReview ? ' after real review attempt' : ' without prior review');
      const env = await boot();
      const { p } = env;
      try {
        let id;
        if (kind === 'library') id = await importLibrary(p, song);
        else await setText(p, song);
        assertText(await view(p), song);
        let initialReview;
        if (attemptReview && backend) initialReview = await review(env, kind + ':original');
        const original = kind === 'session' ? await saveSession(p) : await saveLibrary(p, id);
        assert(original, 'actual storage record exists');
        if (kind === 'session') {
          assert.equal(
            original.record.pageReview,
            undefined,
            'saved sessions do not store page review'
          );
          await restoreSession(p, original.key);
        } else await restoreLibrary(p, id);
        const pristine = await view(p);
        assertText(pristine, song);
        if (kind === 'session') {
          assert.equal(pristine.hasRun, false);
          assert.match(pristine.review, /Not reviewed/);
        } else if (initialReview) {
          assert.equal(pristine.hasRun, true, 'Library restores the genuine prior run');
          assert.equal(pristine.state, initialReview.after.state);
        }
        // For session, obtain a new genuine run before editing; the saved copy itself has none.
        if (attemptReview && kind === 'session' && backend && pristine.reviewEnabled)
          await review(env, 'session:restored-original');
        await setText(p, edited);
        const beforeRestore = await view(p);
        assertText(beforeRestore, edited);
        if (beforeRestore.hasRun) assert.match(beforeRestore.review, /Edited since review/);
        const saved = kind === 'session' ? await saveSession(p) : await saveLibrary(p, id);
        if (kind === 'session') await restoreSession(p, saved.key);
        else await restoreLibrary(p, id);
        const restored = await view(p);
        assertText(restored, edited);
        assert(
          restored.reviewEnabled || /Outcome unknown|Retrieve saved result/.test(restored.review),
          'restored document offers review or explicitly names pending recovery'
        );
        if (kind === 'session') {
          assert.equal(restored.hasRun, false);
          assert.match(restored.review, /Not reviewed/);
        } else if (initialReview) {
          assert.equal(restored.hasRun, true);
          assert.match(restored.review, /Edited since review/);
        }
        if (!attemptReview) {
          assert.equal(restored.hasRun, false);
          assert.match(restored.review, /Not reviewed/);
          assert(restored.reviewEnabled, 'unreviewed restored draft offers Run review');
        }
        results.push({
          name: label + ' actual persistence',
          pass: true,
          pristine,
          beforeRestore,
          restored,
        });
        // Fault-inject the real restore boundary, then run the same oracle.
        // Stored input remains valid: these controls model broken restore code.
        for (const fault of ['lost Return declaration', 'silent resynchronization']) {
          await p.evaluate(
            async ({ kind, key, id, fault }) => {
              const original = kind === 'session' ? restoreSavedWorkspace : lyLibraryActivate;
              const corrupt = async (...args) => {
                await original(...args);
                const d = lyDraft();
                d.value =
                  fault === 'lost Return declaration'
                    ? d.value.replace(/\[SETUP[^\n]+\n/, '')
                    : d.value.replace('I hold the light', 'I guard the light');
                uiSaveLyrics();
                lyRefresh(true);
              };
              try {
                if (kind === 'session') {
                  restoreSavedWorkspace = corrupt;
                  await loadWS(key);
                } else {
                  lyLibraryActivate = corrupt;
                  await LY_ACTIONS['ly-library-restore'](id);
                }
              } finally {
                if (kind === 'session') restoreSavedWorkspace = original;
                else lyLibraryActivate = original;
              }
            },
            { kind, key: saved.key, id, fault }
          );
          await expectKilled(label + ' ' + fault, async () => assertText(await view(p), edited));
          await setText(p, edited);
          if (kind === 'library') await saveLibrary(p, id);
        }
        if (kind === 'library' && initialReview) {
          await p.evaluate(() => {
            window.p2OriginalAnalysis = lyAnalysis;
            lyAnalysis = () => ({
              state: 'assessed_clear',
              label: 'Reviewed for this version',
              tone: 'info',
            });
            lyRefresh(true);
          });
          await expectKilled('Library stale state hidden', async () =>
            assert.match((await view(p)).review, /Edited since review/)
          );
          await p.evaluate(() => {
            lyAnalysis = window.p2OriginalAnalysis;
            delete window.p2OriginalAnalysis;
            lyRefresh(true);
          });
          await p.evaluate(async (id) => {
            window.p2Activate = lyLibraryActivate;
            lyLibraryActivate = async (...args) => {
              await window.p2Activate(...args);
              LY.run = null;
            };
            try {
              await LY_ACTIONS['ly-library-restore'](id);
            } finally {
              lyLibraryActivate = window.p2Activate;
              delete window.p2Activate;
            }
            lyRefresh(true);
          }, id);
          await expectKilled('Library dropped saved review history', async () =>
            assert.equal((await view(p)).hasRun, true)
          );
          await p.evaluate(async (id) => {
            await LY_ACTIONS['ly-library-restore'](id);
            lyRefresh(true);
          }, id);
        }
        if (kind === 'session') {
          await restoreSession(p, saved.key, true);
          await expectKilled(label + ' no-op saved-session restore', async () =>
            assertText(await view(p), edited)
          );
          await restoreSession(p, saved.key);
          assertText(await view(p), edited);
        }
        if (attemptReview && backend && restored.reviewEnabled)
          await review(env, kind + ':restored-divergent');
        assert.deepEqual(env.errors, [], 'no browser exceptions');
      } finally {
        await env.ctx.close();
      }
    }
  } catch (e) {
    results.push({ name: 'integration', pass: false, error: e.stack });
  } finally {
    if (browser) await browser.close();
    if (backend) await backend.close();
    const failed = results.some((r) => r.pass === false);
    const requiredStages = [
      'session:original',
      'session:restored-original',
      'session:restored-divergent',
      'library:original',
      'library:restored-divergent',
    ];
    const reviewStages = requiredStages.map((stage) => ({
      stage,
      complete: receipts.some((r) => r.stage === stage && r.completedCheck),
      attempted: receipts.some((r) => r.stage === stage),
    }));
    const reviewComplete = reviewStages.every((r) => r.complete);
    const report = {
      provenance,
      results,
      receipts,
      reviewStages,
      reviewComplete,
      exitCode: failed ? 1 : reviewComplete ? 0 : 2,
    };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    for (const r of results)
      console.log(
        r.name,
        r.pass === false ? r.error : r.mutationKilled ? 'MUTATION KILLED' : 'PASS'
      );
    console.log(
      'Real review complete:',
      reviewComplete,
      'Evidence:',
      path.join(out, 'results.json')
    );
    process.exitCode = report.exitCode;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
