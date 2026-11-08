#!/usr/bin/env node
'use strict';
// jsdom integration: actual detail controller, host, storage and lane modules.
// Selection/load fixtures stand in for transport. No real browser/clipboard/AT.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const moduleURL = (p) =>
  url(
    read(p).replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.join(root, p)).href))
  );
const tick = () => new Promise((r) => setImmediate(r));
async function exercise(source) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM(
    '<p id="proto-status"></p><section id="genre"><h1 tabindex="-1">Genre</h1><button id="opener">Open</button></section><section id="library"><h1 tabindex="-1">Library</h1><button id="meta">Source record</button></section>',
    { url: 'https://prototype.example/prototype/', virtualConsole }
  );
  const { document } = dom.window;
  const old = {};
  for (const k of ['window', 'document', 'AbortController', 'DOMException', 'localStorage']) {
    old[k] = global[k];
    global[k] = dom.window[k];
  }
  let panels;
  try {
    const host = await import(
      url(
        read('prototype/host.js').replace(
          "'./storage.js'",
          JSON.stringify(moduleURL('prototype/storage.js'))
        )
      )
    );
    const { detailPanels } = await import(url(source));
    const lightbox = await import(moduleURL('prototype/features/media/lightbox.js'));
    const metadata = await import(moduleURL('prototype/features/library-metadata/sheet.js'));
    const listeners = new Set(),
      loads = [],
      warnings = [];
    let selected = null;
    const select = (id) => {
      selected = id;
      for (const fn of listeners) fn();
    };
    const panel = document.getElementById('genre');
    let metadataLoad = () => Promise.resolve(metadata);
    panels = detailPanels({
      ...host,
      warn: (e) => warnings.push(e),
      photos: [
        {
          route: 'genre',
          panel,
          selection: {
            current: () => selected,
            subscribe(fn) {
              listeners.add(fn);
              return () => listeners.delete(fn);
            },
          },
          load: (id, { signal }) =>
            new Promise((resolve, reject) => loads.push({ id, signal, resolve, reject })),
          kind: 'tradition',
          media: Object.freeze({ resolve: () => null }),
          overlay: Object.freeze({
            open() {
              throw Error('unavailable photos must not open');
            },
          }),
          lane: {
            id: 'detailphotos',
            label: 'Photos',
            load: async () => lightbox,
            unloaded: 'Photo load failed.',
          },
        },
      ],
      metadata: {
        panel: document.getElementById('library'),
        lane: {
          id: 'librarymetadata',
          label: 'Source record',
          load: () => metadataLoad(),
          unloaded: 'Metadata load failed.',
        },
      },
    });
    panels.show('genre');
    select('old');
    await tick();
    select('new');
    await tick();
    assert.equal(loads.length, 2);
    assert.ok(loads[0].signal.aborted, 'old load aborted');
    const opener = document.getElementById('opener');
    opener.focus();
    loads[1].resolve({ name: 'New', photo: ['remote', '', '', '', 1] });
    await tick();
    loads[0].resolve({ name: 'Old', photo: null });
    await tick();
    assert.match(panel.textContent, /Photo unavailableNew/);
    assert.doesNotMatch(panel.textContent, /Old/);
    assert.equal(document.activeElement, opener, 'selection does not steal focus');
    assert.equal(panel.querySelector('img'), null, 'no image request');
    select('bad');
    await tick();
    loads[2].reject(Error('offline'));
    await tick();
    assert.match(panel.textContent, /Photo load failed/);
    select('late');
    await tick();
    panels.show('library');
    assert.ok(loads[3].signal.aborted);
    loads[3].resolve({ name: 'Late', photo: null });
    await tick();
    assert.equal(panel.querySelector('[data-feature-host]'), null, 'route ends photo host');
    const button = document.getElementById('meta');
    button.focus();
    const record = Object.freeze({
      reading_unit_id: 'fixture',
      availability: 'held',
      title: 'Fixture',
    });
    await panels.openMetadata(record, { returnFocus: button });
    let sheet = document.querySelector('.lm-sheet');
    assert.ok(sheet);
    assert.match(sheet.textContent, /Fixture/);
    sheet.querySelector('[data-lm-close]').click();
    assert.equal(document.querySelector('.lm-sheet'), null);
    assert.equal(document.activeElement, button, 'host restores opener');
    await panels.openMetadata(record, { returnFocus: button });
    sheet = document.querySelector('.lm-sheet');
    sheet.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(document.querySelector('.lm-sheet'), null, 'Escape closes');
    let resolveOld;
    metadataLoad = () =>
      new Promise((r) => {
        resolveOld = r;
      });
    const oldSignal = new AbortController();
    const pending = panels.openMetadata(record, { signal: oldSignal.signal });
    await tick();
    metadataLoad = async () => metadata;
    await panels.openMetadata(record, { returnFocus: button });
    oldSignal.abort();
    resolveOld(metadata);
    await pending;
    assert.equal(
      document.querySelectorAll('.lm-sheet').length,
      1,
      'stale abort cannot close replacement'
    );
    panels.show('genre');
    assert.equal(document.querySelector('.lm-sheet'), null, 'route ends metadata');
    assert.equal(await panels.openMetadata(record), false, 'wrong route refuses');
    panels.show('library');
    const aborted = new AbortController();
    aborted.abort();
    assert.equal(await panels.openMetadata(record, { signal: aborted.signal }), false);
    await assert.rejects(panels.openMetadata({ reading_unit_id: 'mutable' }), /immutable/);
    const mountedSignal = new AbortController();
    await panels.openMetadata(record, { signal: mountedSignal.signal, returnFocus: button });
    mountedSignal.abort();
    assert.equal(document.querySelector('.lm-sheet'), null, 'mounted abort closes sheet');
    metadataLoad = async () => {
      throw Error('offline');
    };
    await panels.openMetadata(record, { returnFocus: button });
    assert.match(
      document.getElementById('library').textContent,
      /Source record isn’t part of this build/
    );
    panels.unmount();
    assert.equal(listeners.size, 0);
    assert.equal(document.querySelector('[data-feature-host]'), null);
    assert.equal(await panels.openMetadata(record), false);
    assert.equal(errors.length, 0, 'no uncaught DOM errors');
  } finally {
    panels?.unmount();
    dom.window.close();
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete global[k];
      else global[k] = v;
    }
  }
}
async function check() {
  const source = read('prototype/detail-panels.js');
  await exercise(source);
  const mutants = [
    ['missing cancellation', 'entry.abort?.abort();', ''],
    ['missing host close capability', 'closable: true,', 'closable: false,'],
    ['mounted abort ignored', "signal?.addEventListener('abort', cancel, { once: true });", ''],
    ['route leaves sheet', '      closeSheet();\n      for (const entry', '      for (const entry'],
  ];
  for (const [label, from, to] of mutants) {
    assert.ok(source.includes(from), label);
    await assert.rejects(exercise(source.replaceAll(from, to)), undefined, label);
  }
  console.log(
    `detail panels: actual host/lane DOM integration passed; ${mutants.length} causal mutants rejected; fixture transport, no browser/AT`
  );
}
module.exports = { check };
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
