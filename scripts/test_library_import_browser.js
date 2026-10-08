/* Local browser fixture: real postMessage windows and IndexedDB; no provider. */
/* global window, lyricsWindow, messages, store, current, activations, opener, eventsSeen, IDBObjectStore */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { chromium } = require('playwright');
const api = require('../src/library-import.js');

test('real browser transfer commits atomically, binds the opener and safely re-acknowledges after reload', async () => {
  const helper = fs.readFileSync(path.join(__dirname, '../src/library-import.js'), 'utf8');
  const senderServer = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html;charset=utf-8');
    response.end(
      '<!doctype html><title>Library sender fixture</title><script>window.messages=[];addEventListener("message",event=>messages.push(event.data));</script>'
    );
  });
  await new Promise((resolve) => senderServer.listen(0, '127.0.0.1', resolve));
  const senderOrigin = 'http://127.0.0.1:' + senderServer.address().port;
  const receiverServer = http.createServer((request, response) => {
    if (request.url === '/library-import.js') {
      response.setHeader('Content-Type', 'text/javascript;charset=utf-8');
      response.end(helper);
      return;
    }
    response.setHeader('Content-Type', 'text/html;charset=utf-8');
    response.end(`<!doctype html><title>Lyrics receiver fixture</title><script src="/library-import.js"></script><script>
      window.current=JSON.parse(localStorage.getItem('current')||'null')||{draftId:'draft:old',text:'My original song',meta:{version:1,brief:'Keep this'},writer:{continuationId:'private-existing-run',pending:{request_id:'request-existing'}},savedAt:1};
      window.activations=[];window.errors=[];window.eventsSeen=[];addEventListener('message',event=>eventsSeen.push({origin:event.origin,sourceIsOpener:event.source===opener,type:event.data?.type}));window.store=CMLibraryImport.createIndexedDBStore();
      window.receiver=CMLibraryImport.createReceiver({window,store,devOrigin:${JSON.stringify(senderOrigin)},captureCurrent:()=>current,activate:async(draft)=>{current=draft;activations.push(draft.draftId);localStorage.setItem('current',JSON.stringify(draft));},onError:error=>errors.push(error.message)});
      receiver.start().then(()=>window.started=true).catch(error=>errors.push(error.message));
    </script>`);
  });
  await new Promise((resolve) => receiverServer.listen(0, '127.0.0.1', resolve));
  const receiverOrigin = 'http://127.0.0.1:' + receiverServer.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const context = await browser.newContext(),
      sender = await context.newPage();
    await sender.goto(senderOrigin);
    const nonce = 'a'.repeat(64);
    const url =
      receiverOrigin +
      '/codex.html?cm_library_origin=' +
      encodeURIComponent(senderOrigin) +
      '&cm_library_nonce=' +
      nonce +
      '#lyrics';
    const popupPromise = sender.waitForEvent('popup');
    await sender.evaluate((url) => {
      window.lyricsWindow = window.open(url);
    }, url);
    const receiver = await popupPromise;
    receiver.on('pageerror', (error) => console.error('receiver fixture:', error.message));
    await receiver.waitForFunction(() => window.started || window.errors?.length);
    assert.deepEqual(await receiver.evaluate(() => window.errors), []);
    await sender.waitForFunction(() =>
      window.messages.some((message) => message.type === 'codex-musica.library.ready')
    );
    const envelope = {
      protocol: api.PROTOCOL,
      version: 1,
      handoffId: 'handoff:browser',
      draftId: 'draft:browser',
      createdAt: '2026-10-08T00:00:00Z',
      payload: {
        text: 'The evening wind\nReturns the song',
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
    const message = { type: api.TYPES.transfer, version: 1, nonce, envelope };
    await sender.evaluate(({ message, origin }) => lyricsWindow.postMessage(message, origin), {
      message,
      origin: receiverOrigin,
    });
    await sender.waitForFunction(() =>
      messages.some((message) => message.type === 'codex-musica.library.ack')
    );
    const stored = await receiver.evaluate(async () => ({
      drafts: await store.listDrafts(),
      current,
      activations,
    }));
    assert.equal(stored.drafts.length, 2);
    assert.equal(
      stored.drafts.find((draft) => draft.draftId === 'draft:old').writer.continuationId,
      'private-existing-run'
    );
    assert.equal(stored.current.writer, null);
    assert.deepEqual(stored.current.meta.libraryOrigin.provenance.rights.notices, [
      'Mandatory source credit',
    ]);
    assert.deepEqual(stored.activations, ['draft:browser']);

    // Reload preserves the WindowProxy that the opener is bound to. Its
    // persistent handoff receipt safely acknowledges an identical retry.
    await receiver.reload();
    await receiver.waitForFunction(() => window.started);
    await sender.evaluate(({ message, origin }) => lyricsWindow.postMessage(message, origin), {
      message,
      origin: receiverOrigin,
    });
    await sender.waitForFunction(
      () => messages.filter((message) => message.type === 'codex-musica.library.ack').length === 2
    );
    assert.equal(await receiver.evaluate(async () => (await store.listDrafts()).length), 2);
    assert.equal(await receiver.evaluate(() => current.draftId), 'draft:browser');
    assert.deepEqual(await receiver.evaluate(() => activations), []);

    // Same origin, different window: source identity must still reject.
    const roguePromise = sender.waitForEvent('popup');
    await sender.evaluate((origin) => {
      window.rogueWindow = window.open(origin);
    }, senderOrigin);
    const rogue = await roguePromise;
    await rogue.waitForLoadState();
    await rogue.evaluate(
      ({ message, origin }) => opener.lyricsWindow.postMessage(message, origin),
      { message, origin: receiverOrigin }
    );
    await receiver.waitForFunction(() =>
      eventsSeen.some(
        (event) => !event.sourceIsOpener && event.type === 'codex-musica.library.transfer'
      )
    );
    assert.equal(
      await sender.evaluate(
        () => messages.filter((message) => message.type === 'codex-musica.library.ack').length
      ),
      2
    );
    assert.equal(await receiver.evaluate(async () => (await store.listDrafts()).length), 2);

    // Inject a put error into a REAL IndexedDB readwrite transaction after
    // two writes; all earlier writes must roll back together.
    const next = { ...envelope, handoffId: 'handoff:fault', draftId: 'draft:fault' };
    next.digest = await api.envelopeDigest(next, webcrypto);
    const rollback = await receiver.evaluate(async (envelope) => {
      const put = IDBObjectStore.prototype.put;
      let writes = 0,
        message;
      IDBObjectStore.prototype.put = function (...args) {
        if (++writes === 3) throw new Error('Injected real transaction failure');
        return put.apply(this, args);
      };
      try {
        await store.commitImport(
          envelope,
          { ...current, text: 'Must roll back this replacement' },
          null
        );
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
    await new Promise((resolve) => senderServer.close(resolve));
    await new Promise((resolve) => receiverServer.close(resolve));
  }
});
