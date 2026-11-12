// One same-process, all-or-nothing load shared by public and private callers.
// Health is observational. Only load() starts work; a failed attempt is never
// cached as a usable store or reused by a later explicit request.
export function createLibraryStoreLoader(factories) {
  let stores = null;
  let pending = null;
  let state = Object.keys(factories).length ? 'not_loaded' : 'absent';
  let failures = [];
  let corpus = 'absent';
  return {
    health: () => ({ state, failures: [...failures], corpus }),
    get stores() {
      return stores;
    },
    load() {
      if (pending) return pending;
      if (stores) return Promise.resolve(stores);
      state = 'loading';
      failures = [];
      corpus = factories.corpus ? 'verifying' : 'absent';
      pending = Promise.resolve()
        .then(async () => {
          const candidate = {};
          for (const [name, factory] of Object.entries(factories)) {
            try {
              candidate[name] = await factory();
              if (!candidate[name]) throw new Error('Missing configured store');
            } catch {
              failures.push(name);
            }
          }
          if (!failures.length) {
            const snapshots = Object.values(candidate).map((s) => s.snapshotId);
            if (snapshots.some((id) => id !== snapshots[0])) failures.push('snapshot');
          }
          if (candidate.corpus) {
            try {
              const bad = await candidate.corpus.verify();
              if (!Array.isArray(bad) || bad.length) throw new Error('Unverified packages');
              corpus = 'verified';
            } catch {
              corpus = 'failed';
              failures.push('corpus');
            }
          } else if (factories.corpus) corpus = 'failed';
          if (failures.length) {
            for (const candidateStore of Object.values(candidate)) {
              try {
                candidateStore.close?.();
              } catch {
                failures.push('cleanup');
              }
            }
            state = 'failed';
            throw Object.assign(new Error('The Library could not answer.'), {
              code: 'LIBRARY_UNAVAILABLE',
              status: 503,
              remedy: 'Retry explicitly.',
            });
          }
          stores = candidate;
          state = Object.keys(factories).length ? 'ready' : 'absent';
          return stores;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
