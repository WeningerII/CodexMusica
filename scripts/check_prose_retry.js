#!/usr/bin/env node
'use strict';
// Exercise the actual Catalog closure without loading the recipe engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function checkProseRetry() {
  const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const start = source.indexOf('const Catalog = (() => {');
  const end = source.indexOf('\n})();', start) + '\n})();'.length;
  assert(start >= 0 && end > start, 'Catalog closure must exist');
  const rows = ['starter', 'received', 'missing'].map((id) => ({ id, name: id }));
  rows[0].description = 'Starter description';
  const prose = (id) => ({ id, description: `${id} description`, lineage: `${id} lineage` });
  let requests = 0;
  const online = [];
  const context = vm.createContext({
    normalizeSearch: (s) => s.toLowerCase(),
    console: {
      warn() {},
      error(e) {
        throw e;
      },
    },
    window: {
      addEventListener(event, callback) {
        if (event === 'online') online.push(callback);
      },
    },
    fetch: async () => {
      requests++;
      return {
        ok: true,
        json: async () => ({
          items: requests === 1 ? [prose('received')] : [prose('received'), prose('missing')],
        }),
      };
    },
  });
  const catalog = vm.runInContext(source.slice(start, end) + '\nCatalog;', context);
  catalog.bootFromIndex({ items: rows }, 'api/');
  const row = catalog.get('received');
  const extras = catalog.ext('received');
  let complete = false;
  const settled = catalog.whenProse().then(() => {
    complete = true;
  });
  await assert.rejects(catalog.loadProse(), /incomplete/);
  assert.equal(requests, 1);
  assert.equal(catalog.proseLoaded(), false);
  assert.equal(catalog.proseFailed(), true);
  assert.equal(complete, false, 'partial data must not resolve whenProse');
  assert.equal(catalog.proseState('starter'), 'here');
  assert.equal(catalog.proseState('received'), 'here');
  assert.equal(catalog.proseState('missing'), 'failed');
  assert.equal(catalog.get('received'), row);
  assert.equal(catalog.ext('received'), extras);
  assert.equal(extras.description, 'received description');
  assert(
    catalog.searchIndex().every((r) => r.description === ''),
    'partial search remains names-only'
  );
  catalog.needProse();
  await Promise.resolve();
  assert.equal(requests, 1, 'a read must not silently retry');
  assert.equal(online.length, 1, 'partial failure enables the existing online retry');
  const retry = catalog.loadProse();
  assert.equal(catalog.loadProse(), retry, 'concurrent Retry requests are coalesced');
  await retry;
  await settled;
  assert.equal(requests, 2);
  assert.equal(catalog.proseLoaded(), true);
  assert.equal(catalog.proseFailed(), false);
  assert.equal(catalog.proseState('missing'), 'here');
  assert.equal(catalog.ext('missing').description, 'missing description');
  assert.equal(catalog.get('received'), row);
  assert.equal(catalog.ext('received'), extras);
  assert(catalog.searchIndex().some((r) => r.description === 'missing description'));
  await catalog.loadProse();
  assert.equal(requests, 2, 'a complete catalog is not fetched again');
}

module.exports = checkProseRetry;
if (require.main === module) {
  checkProseRetry().then(
    () => console.log('partial prose Retry: PASS'),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
