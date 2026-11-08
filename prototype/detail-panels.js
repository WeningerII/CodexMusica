// Shell lifecycle for the unavailable-photo lane and the on-demand metadata
// sheet. The caller supplies reviewed lane registrations and immutable records.
// No transport, production source, image fallback or metadata is invented here.
export function detailPanels({ createHost, createOnDemand, photos, metadata, warn }) {
  const records = new Map();
  const sheet = createOnDemand(metadata.panel);
  let sheetRevision = 0;
  let releaseSignal = () => {};
  const closeSheet = () => {
    sheetRevision++;
    releaseSignal();
    releaseSignal = () => {};
    try {
      sheet.close();
    } catch (error) {
      warn(error);
    }
  };
  let route = null;
  let ended = false;
  function clear(entry) {
    entry.revision++;
    entry.abort?.abort();
    entry.abort = null;
    if (entry.host) {
      try {
        entry.host.unmount();
      } catch (error) {
        warn(error);
      }
    }
    entry.host = null;
  }
  async function refresh(entry) {
    clear(entry);
    if (ended || route !== entry.route) return;
    const id = entry.selection.current();
    if (!id) return;
    const revision = entry.revision;
    const abort = new AbortController();
    entry.abort = abort;
    const host = createHost(
      {
        ...entry.lane,
        closable: true,
        context: async () => {
          const value = await entry.load(id, { signal: abort.signal });
          if (abort.signal.aborted || entry.revision !== revision)
            throw new DOMException('Photo selection ended.', 'AbortError');
          return {
            photos: Object.freeze([
              Object.freeze({ id, name: value.name, kind: entry.kind, image: value.photo }),
            ]),
            media: entry.media,
            overlay: entry.overlay,
          };
        },
      },
      entry.panel
    );
    entry.host = host;
    // Automatic selection changes must not take focus from the active control.
    await host.show();
  }
  for (const spec of photos) {
    const entry = { ...spec, revision: 0, host: null, abort: null };
    entry.stop = spec.selection.subscribe(() => {
      void refresh(entry);
    });
    records.set(spec.route, entry);
  }
  return {
    show(next) {
      if (ended || route === next) return;
      route = next;
      closeSheet();
      for (const entry of records.values()) void refresh(entry);
    },
    openMetadata(record, { returnFocus, signal } = {}) {
      if (ended || route !== 'library' || signal?.aborted) return Promise.resolve(false);
      if (!record || !Object.isFrozen(record))
        return Promise.reject(new TypeError('Metadata needs an immutable record.'));
      closeSheet();
      const mine = sheetRevision;
      const cancel = () => {
        if (sheetRevision === mine) closeSheet();
      };
      const detach = () => signal?.removeEventListener('abort', cancel);
      releaseSignal = detach;
      signal?.addEventListener('abort', cancel, { once: true });
      return sheet.open(
        {
          ...metadata.lane,
          closable: true,
          context: async ({ signal: life }) => {
            life.addEventListener('abort', detach, { once: true });
            return { record };
          },
        },
        { returnFocus }
      );
    },
    unmount() {
      ended = true;
      closeSheet();
      for (const entry of records.values()) {
        entry.stop();
        clear(entry);
      }
    },
  };
}
