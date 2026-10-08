/* exported CMLibraryImport */
/* global module */
/* Library working-copy transport. No source edits, grading, recipe work or
   network dispatch. Acknowledgements follow a durable, atomic draft commit. */
(function (root) {
  const PROTOCOL = 'codex-musica.library-import';
  const VERSION = 1;
  const SITE_ORIGIN = 'https://codex-musica-corpus.tonybolognamacaroni.chatgpt.site';
  const HANDSHAKE_MS = 60000;
  const TRANSFER_BYTES = 8 * 1024 * 1024;
  const TYPES = {
    ready: 'codex-musica.library.ready',
    transfer: 'codex-musica.library.transfer',
    ack: 'codex-musica.library.ack',
    error: 'codex-musica.library.error',
  };
  const fail = (message) => {
    throw new Error(message);
  };
  const plain = (x) => !!x && Object.prototype.toString.call(x) === '[object Object]';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const id = (x) => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(x);
  const hex = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
  function canonical(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
      return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (!plain(value)) return fail('Import must contain JSON values only.');
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => {
          if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('Unsafe import field.');
          return JSON.stringify(key) + ':' + canonical(value[key]);
        })
        .join(',') +
      '}'
    );
  }
  async function sha256(value, cryptoApi = root.crypto) {
    if (!cryptoApi?.subtle) fail('Secure import verification is unavailable.');
    const bytes = new TextEncoder().encode(value);
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function signedEnvelope(envelope) {
    return {
      protocol: envelope.protocol,
      version: envelope.version,
      handoffId: envelope.handoffId,
      draftId: envelope.draftId,
      createdAt: envelope.createdAt,
      payload: envelope.payload,
    };
  }
  async function envelopeDigest(envelope, cryptoApi) {
    return sha256(canonical(signedEnvelope(envelope)), cryptoApi);
  }
  async function validateEnvelope(raw, cryptoApi) {
    if (!plain(raw) || raw.protocol !== PROTOCOL || raw.version !== VERSION)
      fail('Unsupported Library import version.');
    const permitted = new Set([
      'protocol',
      'version',
      'handoffId',
      'draftId',
      'createdAt',
      'payload',
      'digest',
    ]);
    if (Object.keys(raw).some((key) => !permitted.has(key)))
      fail('Unexpected Library envelope field.');
    if (!id(raw.handoffId) || !id(raw.draftId)) fail('Invalid Library draft identity.');
    if (typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt)))
      fail('Invalid Library import timestamp.');
    const p = raw.payload;
    if (!plain(p) || typeof p.text !== 'string' || !p.text.trim())
      fail('Library reading text is missing.');
    if (p.text.includes('\u0000')) fail('Library reading contains a null character.');
    if (typeof p.title !== 'string' || typeof p.language !== 'string')
      fail('Library title and language are required.');
    if (!['whole', 'excerpt'].includes(p.scope)) fail('Library reading scope is missing.');
    if (!plain(p.provenance)) fail('Library provenance is missing.');
    for (const key of ['snapshotId', 'unitId', 'workId', 'editionId', 'revisionId'])
      if (!id(p.provenance[key])) fail('Library provenance identity is missing: ' + key + '.');
    if (!Array.isArray(p.lineage) || !Array.isArray(p.declarations))
      fail('Library coordinate lineage and declarations are required.');
    // The payload is an import contract, not a private job or writer snapshot.
    const fields = new Set([
      'text',
      'title',
      'language',
      'scope',
      'provenance',
      'lineage',
      'declarations',
    ]);
    if (Object.keys(p).some((key) => !fields.has(key))) fail('Unexpected Library payload field.');
    canonical(raw); // Also rejects prototype keys and non-JSON values.
    if (!hex(raw.digest) || (await envelopeDigest(raw, cryptoApi)) !== raw.digest)
      fail('Library import digest does not match its content.');
    return clone(raw);
  }
  function originAllowed(origin, devOrigin) {
    if (origin === SITE_ORIGIN) return true;
    if (!devOrigin || origin !== devOrigin) return false;
    try {
      const u = new URL(devOrigin);
      return (
        u.origin === devOrigin &&
        u.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
      );
    } catch {
      return false;
    }
  }
  function eligibleForWriter(text, language) {
    const reasons = [];
    const rows = text.split(/\r\n?|\n/);
    if (language !== 'eng' && language !== 'en' && !language.startsWith('en-'))
      reasons.push(
        'The existing writing workflow grades English text; this reading stays editable without native grading.'
      );
    if (rows.length > 463)
      reasons.push(
        'This reading exceeds the writing workflow’s 463-row limit. Choose an eligible excerpt explicitly.'
      );
    if (rows.some((line) => line.length > 200))
      reasons.push('At least one row exceeds the writing workflow’s 200-character limit.');
    if (
      rows.some((line) => {
        if (!line.trim() || /^\[[^\]]*\]$/.test(line.trim())) return false;
        const words = (
          line.replace(/\([^)]*\)/g, ' ').match(/(?:[A-Za-zÀ-ɏḀ-ỿ]|['’‘-])+/g) || []
        ).filter((word) => /[A-Za-zÀ-ɏḀ-ỿ]/.test(word));
        return words.length < 2 || words.length > 12;
      })
    )
      reasons.push(
        'The writing workflow accepts 2–12 sung words per line. The full reading is retained.'
      );
    return { eligible: reasons.length === 0, reasons };
  }
  function importedDraft(envelope, now) {
    const p = envelope.payload;
    const context =
      p.provenance.workingCopy?.version === 1 ? p.provenance.workingCopy.metadata || {} : {};
    return {
      draftId: envelope.draftId,
      text: p.text,
      title: p.title,
      savedAt: now,
      meta: {
        version: 1,
        brief: typeof context.brief === 'string' ? context.brief : '',
        notes: plain(context.notes) ? clone(context.notes) : {},
        drafts: plain(context.drafts) ? clone(context.drafts) : {},
        ui: plain(context.ui) ? clone(context.ui) : {},
        draftId: envelope.draftId,
        libraryOrigin: {
          version: 1,
          handoffId: envelope.handoffId,
          digest: envelope.digest,
          importedAt: now,
          adapted: false,
          title: p.title,
          language: p.language,
          scope: p.scope,
          provenance: clone(p.provenance),
          lineage: clone(p.lineage),
          declarations: clone(p.declarations),
          writingEligibility: eligibleForWriter(p.text, p.language),
        },
      },
      writer: null,
      pageReview: null,
      originalText: p.text,
    };
  }
  async function makeWorkingCopyEnvelope(text, meta, cryptoApi = root.crypto) {
    const origin = meta?.libraryOrigin;
    if (origin?.version !== 1) fail('This draft has no versioned Library source bundle.');
    const envelope = {
      protocol: PROTOCOL,
      version: VERSION,
      handoffId: 'handoff:' + cryptoApi.randomUUID(),
      draftId: 'draft:' + cryptoApi.randomUUID(),
      createdAt: new Date().toISOString(),
      payload: {
        text,
        title: origin.title || 'Library working copy',
        language: origin.language,
        scope: origin.scope,
        provenance: {
          ...clone(origin.provenance),
          workingCopy: {
            version: 1,
            adapted: !!origin.adapted,
            importedFromHandoffId: origin.handoffId,
            sourceDigest: origin.digest,
            lineageBasis: 'Imported reading before edits',
            declarations: clone(origin.declarations || []),
            metadata: {
              brief: meta.brief || '',
              notes: clone(meta.notes || {}),
              drafts: clone(meta.drafts || {}),
              ui: clone(meta.ui || {}),
            },
          },
        },
        lineage: clone(origin.lineage || []),
        // Coordinates and performance declarations are retained as source
        // history, but no longer bind changed sung text automatically.
        declarations: origin.adapted ? [] : clone(origin.declarations || []),
      },
    };
    envelope.digest = await envelopeDigest(envelope, cryptoApi);
    return validateEnvelope(envelope, cryptoApi);
  }
  function prepareCommit(envelope, previous, receipt, existingDraft, now, binding, usedHandshake) {
    if (
      usedHandshake &&
      (usedHandshake.handoffId !== envelope.handoffId ||
        usedHandshake.digest !== envelope.digest ||
        usedHandshake.origin !== binding?.origin)
    )
      fail('This Library handshake was already used. Open in Lyrics again.');
    if (receipt) {
      if (receipt.digest !== envelope.digest || receipt.draftId !== envelope.draftId)
        fail('This handoff identity was already used for different content.');
      if (!existingDraft) fail('The committed Library draft is unavailable.');
      return { duplicate: true, receipt, draft: existingDraft };
    }
    if (existingDraft || previous?.draftId === envelope.draftId)
      fail('The imported draft identity is already in use.');
    if (!previous || !id(previous.draftId) || typeof previous.text !== 'string')
      fail('The current Lyrics draft could not be preserved.');
    const draft = importedDraft(envelope, now);
    return {
      duplicate: false,
      previous: clone(previous),
      draft,
      receipt: {
        handoffId: envelope.handoffId,
        digest: envelope.digest,
        draftId: envelope.draftId,
        preservedDraftId: previous.draftId,
        committedAt: now,
        binding: binding || null,
      },
      active: { draftId: envelope.draftId, handoffId: envelope.handoffId, pending: true },
    };
  }
  function createIndexedDBStore(indexedDB = root.indexedDB) {
    let dbPromise;
    function open() {
      if (!indexedDB)
        return Promise.reject(
          new Error(
            'Permanent draft storage is unavailable. Download the import bundle and retry when storage is available.'
          )
        );
      if (!dbPromise)
        dbPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open('codex-musica-library-drafts', 1);
          request.onupgradeneeded = () => {
            for (const name of ['drafts', 'receipts', 'active', 'handshakes'])
              if (!request.result.objectStoreNames.contains(name))
                request.result.createObjectStore(name);
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(request.error || new Error('Draft storage failed to open.'));
          request.onblocked = () =>
            reject(new Error('Close older Codex Musica tabs to enable draft storage.'));
        });
      return dbPromise;
    }
    async function transaction(names, mode, operation) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(names, mode);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () =>
          reject(tx.error || new Error('Draft storage did not commit.'));
        try {
          operation(
            tx,
            (value) => {
              result = value;
            },
            (error) => {
              tx.abort();
              reject(error);
            }
          );
        } catch (error) {
          tx.abort();
          reject(error);
        }
      });
    }
    const get = (store, key) =>
      transaction([store], 'readonly', (tx, done) => {
        const request = tx.objectStore(store).get(key);
        request.onsuccess = () => done(request.result || null);
      });
    return {
      async commitImport(envelope, previous, binding) {
        return transaction(
          ['drafts', 'receipts', 'active', 'handshakes'],
          'readwrite',
          (tx, done, abort) => {
            const receipts = tx.objectStore('receipts'),
              drafts = tx.objectStore('drafts');
            const handshakes = tx.objectStore('handshakes');
            const handshake = handshakes.get(binding?.nonce || 'file-import');
            handshake.onsuccess = () => {
              const request = receipts.get(envelope.handoffId);
              request.onsuccess = () => {
                const receipt = request.result;
                const lookup = drafts.get(envelope.draftId);
                lookup.onsuccess = () => {
                  try {
                    const commit = prepareCommit(
                      envelope,
                      previous,
                      receipt,
                      lookup.result,
                      Date.now(),
                      binding,
                      handshake.result
                    );
                    if (!commit.duplicate) {
                      drafts.put(commit.previous, commit.previous.draftId);
                      drafts.put(commit.draft, commit.draft.draftId);
                      receipts.put(commit.receipt, commit.receipt.handoffId);
                      tx.objectStore('active').put(commit.active, 'current');
                    }
                    if (binding)
                      handshakes.put(
                        {
                          handoffId: envelope.handoffId,
                          digest: envelope.digest,
                          origin: binding.origin,
                          committedAt: Date.now(),
                        },
                        binding.nonce
                      );
                    done(commit);
                  } catch (error) {
                    abort(error);
                  }
                };
              };
            };
          }
        );
      },
      getDraft: (draftId) => get('drafts', draftId),
      getReceipt: (handoffId) => get('receipts', handoffId),
      getHandshake: (nonce) => get('handshakes', nonce),
      async pendingActivation() {
        const active = await get('active', 'current');
        return active?.pending ? get('drafts', active.draftId) : null;
      },
      async markActivated(draftId) {
        return transaction(['active'], 'readwrite', (tx) => {
          const store = tx.objectStore('active'),
            request = store.get('current');
          request.onsuccess = () => {
            if (request.result?.draftId === draftId)
              store.put({ ...request.result, pending: false }, 'current');
          };
        });
      },
      async saveDraft(draft) {
        return transaction(['drafts'], 'readwrite', (tx) =>
          tx.objectStore('drafts').put(clone(draft), draft.draftId)
        );
      },
      async listDrafts() {
        return transaction(['drafts'], 'readonly', (tx, done) => {
          const request = tx.objectStore('drafts').getAll();
          request.onsuccess = () => done(request.result || []);
        });
      },
    };
  }
  function createReceiver({
    window: win = root,
    store,
    captureCurrent,
    releaseCurrent = () => {},
    activate,
    onError = () => {},
    devOrigin,
    now = Date.now,
  }) {
    let tail = Promise.resolve();
    const params = new URL(win.location.href).searchParams;
    const origin = params.get('cm_library_origin'),
      nonce = params.get('cm_library_nonce');
    const source = win.opener;
    const validHandshake = originAllowed(origin, devOrigin) && hex(nonce) && !!source;
    let started = now();
    if (validHandshake) {
      try {
        const key = 'codex-musica-library-handshake:' + nonce;
        const saved = win.sessionStorage.getItem(key);
        if (saved) started = Number(saved);
        else win.sessionStorage.setItem(key, String(started));
      } catch {
        /* No session storage: expiry remains bounded to this page load. */
      }
    }
    const ack = (receipt) => ({
      type: TYPES.ack,
      version: VERSION,
      nonce,
      handoffId: receipt.handoffId,
      digest: receipt.digest,
      draftId: receipt.draftId,
    });
    async function importEnvelope(raw, binding = null) {
      const envelope = await validateEnvelope(raw);
      try {
        const previous = await captureCurrent();
        const commit = await store.commitImport(envelope, previous, binding);
        if (!commit.duplicate) {
          const result = await activate(commit.draft, {
            imported: true,
            preservedDraftId: commit.previous.draftId,
          });
          if (result?.persisted !== false) await store.markActivated(commit.draft.draftId);
        } else {
          const pending = await store.pendingActivation();
          if (pending?.draftId === commit.draft.draftId) {
            const result = await activate(pending, { recovered: true });
            if (result?.persisted !== false) await store.markActivated(pending.draftId);
          }
        }
        return commit;
      } finally {
        releaseCurrent();
      }
    }
    async function receive(event) {
      if (!validHandshake || event.origin !== origin || event.source !== source) return false;
      const data = event.data;
      if (
        !plain(data) ||
        data.type !== TYPES.transfer ||
        data.version !== VERSION ||
        data.nonce !== nonce
      )
        return false;
      try {
        if (new TextEncoder().encode(JSON.stringify(data)).byteLength > TRANSFER_BYTES)
          fail('This reading needs the downloadable import bundle.');
        if (now() - started >= HANDSHAKE_MS) {
          const receipt = await store.getHandshake(nonce);
          if (
            !receipt ||
            receipt.handoffId !== data.envelope?.handoffId ||
            receipt.origin !== origin
          )
            fail('The Library handshake expired. Open in Lyrics again or import its bundle.');
        }
        const commit = await importEnvelope(data.envelope, { nonce, origin });
        source.postMessage(ack(commit.receipt), origin);
        return true;
      } catch (error) {
        onError(error);
        source.postMessage(
          { type: TYPES.error, version: VERSION, nonce, message: error.message },
          origin
        );
        return false;
      }
    }
    function queueReceive(event) {
      tail = tail.then(
        () => receive(event),
        () => receive(event)
      );
      return tail;
    }
    async function recover() {
      const draft = await store.pendingActivation();
      if (draft) {
        const result = await activate(draft, { recovered: true });
        if (result?.persisted !== false) await store.markActivated(draft.draftId);
      }
    }
    return {
      receive: queueReceive,
      importEnvelope(raw) {
        const result = tail.then(
          () => importEnvelope(raw),
          () => importEnvelope(raw)
        );
        tail = result.catch(() => {});
        return result;
      },
      async start() {
        await recover();
        win.addEventListener('message', queueReceive);
        if (validHandshake)
          source.postMessage({ type: TYPES.ready, version: VERSION, nonce }, origin);
      },
      stop() {
        win.removeEventListener('message', queueReceive);
      },
    };
  }
  const api = {
    PROTOCOL,
    VERSION,
    SITE_ORIGIN,
    HANDSHAKE_MS,
    TRANSFER_BYTES,
    TYPES,
    canonical,
    sha256,
    envelopeDigest,
    validateEnvelope,
    originAllowed,
    eligibleForWriter,
    importedDraft,
    makeWorkingCopyEnvelope,
    prepareCommit,
    createIndexedDBStore,
    createReceiver,
  };
  root.CMLibraryImport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
