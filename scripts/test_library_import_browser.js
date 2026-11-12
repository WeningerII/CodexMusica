/* Local browser fixture: one origin, real IndexedDB; no provider. Imports
   arrive in-page (importEnvelope), as the Library tab and the file import
   hand them over; there is no window handoff (#659). */
/* global window, receiver, store, current, activations, IDBObjectStore */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { chromium } = require('playwright');
const api = require('../src/library-import.js');

test('real browser import commits atomically and a repeat after reload is a duplicate', async () => {
  const helper = fs.readFileSync(path.join(__dirname, '../src/library-import.js'), 'utf8');
  const server = http.createServer((request, response) => {
    if (request.url === '/library-import.js') {
      response.setHeader('Content-Type', 'text/javascript;charset=utf-8');
      response.end(helper);
      return;
    }
    if (request.url === '/lyric-tokens.js') {
      response.setHeader('Content-Type', 'text/javascript;charset=utf-8');
      response.end(fs.readFileSync(path.join(__dirname, '../src/lyric-tokens.js'), 'utf8'));
      return;
    }
    response.setHeader('Content-Type', 'text/html;charset=utf-8');
    response.end(`<!doctype html><title>Lyrics receiver fixture</title><script src="/lyric-tokens.js"></script><script src="/library-import.js"></script><script>
      window.current=JSON.parse(localStorage.getItem('current')||'null')||{draftId:'draft:old',text:'My original song',meta:{version:1,brief:'Keep this'},writer:{continuationId:'private-existing-run',pending:{request_id:'request-existing'}},savedAt:1};
      window.activations=[];window.errors=[];window.store=CMLibraryImport.createIndexedDBStore();
      window.receiver=CMLibraryImport.createReceiver({store,captureCurrent:()=>current,activate:async(draft)=>{current=draft;activations.push(draft.draftId);localStorage.setItem('current',JSON.stringify(draft));}});
      receiver.start().then(()=>window.started=true).catch(error=>errors.push(error.message));
    </script>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const context = await browser.newContext(),
      page = await context.newPage();
    page.on('pageerror', (error) => console.error('receiver fixture:', error.message));
    await page.goto(origin + '/codex.html#lyrics');
    await page.waitForFunction(() => window.started || window.errors?.length);
    assert.deepEqual(await page.evaluate(() => window.errors), []);
    const envelope = {
      protocol: api.PROTOCOL,
      version: 1,
      handoffId: 'handoff:browser',
      draftId: 'draft:browser',
      createdAt: '2026-10-08T00:00:00Z',
      payload: {
        text: 'Alone\nOne two three four five six seven eight nine ten eleven twelve thirteen\nReturns the song',
        title: 'Browser reading',
        language: 'eng',
        scope: 'whole',
        provenance: {
          snapshotId: 'snapshot:browser',
          unitId: 'unit:browser',
          workId: 'work:browser',
          editionId: 'edition:browser',
          revisionId: 'revision:browser',
          rights: { notices: ['Mandatory source credit'] },
        },
        lineage: [{ row: 1, sourceLine: 12 }],
        declarations: [],
      },
    };
    envelope.digest = await api.envelopeDigest(envelope, webcrypto);
    const first = await page.evaluate(async (envelope) => {
      const commit = await receiver.importEnvelope(envelope);
      return {
        duplicate: commit.duplicate,
        drafts: await store.listDrafts(),
        current,
        activations,
      };
    }, envelope);
    assert.equal(first.duplicate, false);
    assert.equal(first.drafts.length, 2);
    assert.equal(
      first.drafts.find((draft) => draft.draftId === 'draft:old').writer.continuationId,
      'private-existing-run'
    );
    assert.equal(first.current.writer, null);
    assert.equal(first.current.text, envelope.payload.text);
    assert.deepEqual(first.current.meta.libraryOrigin.writingEligibility, {
      eligible: true,
      reasons: [],
    });
    assert.deepEqual(first.current.meta.libraryOrigin.provenance.rights.notices, [
      'Mandatory source credit',
    ]);
    assert.deepEqual(first.activations, ['draft:browser']);

    // After a reload, start() finds nothing pending, and the same envelope
    // again is the committed copy: no second draft, no reactivation.
    await page.reload();
    await page.waitForFunction(() => window.started);
    const repeat = await page.evaluate(async (envelope) => {
      const commit = await receiver.importEnvelope(envelope);
      return {
        duplicate: commit.duplicate,
        drafts: (await store.listDrafts()).length,
        current: current.draftId,
        activations,
      };
    }, envelope);
    assert.deepEqual(repeat, {
      duplicate: true,
      drafts: 2,
      current: 'draft:browser',
      activations: [],
    });

    // Inject a put error into a REAL IndexedDB readwrite transaction after
    // two writes; all earlier writes must roll back together.
    const next = { ...envelope, handoffId: 'handoff:fault', draftId: 'draft:fault' };
    next.digest = await api.envelopeDigest(next, webcrypto);
    const rollback = await page.evaluate(async (envelope) => {
      const put = IDBObjectStore.prototype.put;
      let writes = 0,
        message;
      IDBObjectStore.prototype.put = function (...args) {
        if (++writes === 3) throw new Error('Injected real transaction failure');
        return put.apply(this, args);
      };
      try {
        await store.commitImport(envelope, { ...current, text: 'Must roll back this replacement' });
      } catch (error) {
        message = error.message;
      } finally {
        IDBObjectStore.prototype.put = put;
      }
      return {
        message,
        receipt: await store.getReceipt(envelope.handoffId),
        draft: await store.getDraft(envelope.draftId),
        current: await store.getDraft('draft:browser'),
      };
    }, next);
    assert.match(rollback.message, /Injected real transaction/);
    assert.equal(rollback.receipt, null);
    assert.equal(rollback.draft, null);
    assert.equal(rollback.current.text, envelope.payload.text);
    await context.close();
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
