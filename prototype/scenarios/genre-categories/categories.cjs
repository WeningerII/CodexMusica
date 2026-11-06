#!/usr/bin/env node
'use strict';
// Standalone lane DOM proof, not host integration or current engine parity.
// Fixtures below are committed here; no production source/catalog reads.
// Discovery fixture contract: #668 6665819883, host 12837971b2;
// inclusive <=720 panel rule is shell-owned, corrected at a0e8f4694b / 6665885557.
// This scenario supplies narrow snapshots, not a second pixel breakpoint.
// node prototype/scenarios/genre-categories/categories.cjs
// --browser checks sandboxed Chromium availability; never disables its sandbox.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../../..');
const filename = path.join(root, 'prototype/features/genre-categories/categories.js');
let source = fs.readFileSync(filename, 'utf8');
const mutations = {
  roots: ['snapshot.roots.slice(0, 10)', 'snapshot.roots.slice(0, 9)'],
  order: ['for (const record of records)', 'for (const record of [...records].reverse())'],
  cross: ['if (cross)', 'if (false)'],
  revision: ['ctx.categories.openBranch(id, revision)', 'ctx.categories.openBranch(id, -1)'],
  focus: ["if (action === 'back') focus(", 'if (false) focus('],
  cleanup: ['for (const unsubscribe of unsubscribers) unsubscribe();', ''],
  disclosure: ['content.hidden = state.narrow && !state.open;', 'content.hidden = false;'],
  'discovery-focus': [
    'if (content.hidden && wasInList) focus(disclosure);',
    'if (false) focus(disclosure);',
  ],
  'discovery-revision': [
    'ctx.discovery.setOpen(!state.open, state.revision)',
    'ctx.discovery.setOpen(!state.open, -1)',
  ],
  'target-label': ['const applied = ctx.targets.current().applied;', 'const applied = 0;'],
  optimistic: ['pending = true;', 'ctx.categories.current().allRoots = true; pending = true;'],
};
const mutation = process.argv.find((s) => s.startsWith('--mutate='))?.slice(9);
if (mutation) {
  assert.ok(mutations[mutation], 'known mutation');
  const [from, to] = mutations[mutation];
  assert.ok(source.includes(from), 'mutation target exists');
  source = source.replace(from, to);
}
const FIXTURES = {
  provenance: {
    commit: 'c7f7883de07e3a67a5e815852c144474b05959e9',
    treeBlob: 'a95229bda61077ede344f5a96a04615c8e8d6381',
    catalogBlob: '80c531e657e8115c638a5026c31075c02ff1feab',
    membershipBlob: '47078396261039a6d18e97edbe1c242d2b440f80',
    note: 'Historical recorded canonical order/counts, not current engine parity. SVGs and non-null parent branch are explicit test doubles.',
  },
  roots: [
    {
      id: 'droneModal',
      name: 'Drone and modal ornament',
      count: 339,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'functionalSong',
      name: 'Functional song-form',
      count: 1877,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'improvOnFrame',
      name: 'Improvisation on a frame',
      count: 475,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'distortedRock',
      name: 'Amplified rock and metal',
      count: 1557,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'mcRhythm',
      name: 'Rhythmic verse over beats',
      count: 730,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'groovePercussion',
      name: 'Percussion-led dance',
      count: 500,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'artMusic',
      name: 'Through-composed art music',
      count: 788,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'balladPoetry',
      name: 'Ballad and song-poetry',
      count: 930,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'ritualDevotional',
      name: 'Sacred and devotional',
      count: 825,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'bassSystem',
      name: 'Bass-soundsystem',
      count: 223,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'electronicDance',
      name: 'Cyclical electronic dance',
      count: 524,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'experimentalElec',
      name: 'Experimental electronic',
      count: 445,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'lullaby',
      name: 'Lullaby',
      count: 58,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'wedding',
      name: 'Wedding music',
      count: 137,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'funeralLament',
      name: 'Funeral lament and dirge',
      count: 80,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'seaShanty',
      name: 'Sea shanty and maritime work song',
      count: 26,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'fieldWork',
      name: 'Field-work and harvest song',
      count: 107,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'domesticRhythm',
      name: 'Domestic rhythm and craft-work song',
      count: 48,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'huntingSong',
      name: 'Hunting and tracking song',
      count: 29,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'nurseryRhyme',
      name: "Nursery rhyme and children's play-song",
      count: 39,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'drinkingSong',
      name: 'Drinking song and tavern song',
      count: 71,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'carnivalProcessional',
      name: 'Carnival and festival processional music',
      count: 199,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'praiseSong',
      name: 'Praise song and naming-honor song',
      count: 110,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'protestSong',
      name: 'Protest song and topical song',
      count: 105,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    {
      id: 'spokenWord',
      name: 'Spoken word and voice media',
      count: 88,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
  ],
  branch: {
    node: {
      id: 'droneModal',
      name: 'Drone and modal ornament',
      count: 339,
      glyphs: [
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture function',
          kind: 'fn',
        },
        {
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
          label: 'Fixture region',
          kind: 'region',
        },
      ],
    },
    parent: { id: 'parent-fixture', name: 'Parent fixture' },
    cross: 186,
    children: [
      {
        id: 'droneModal.vocal',
        name: 'Drone-vocal traditions',
        count: 138,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
      {
        id: 'droneModal.string',
        name: 'Drone-string traditions',
        count: 82,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
      {
        id: 'droneModal.modalElectric',
        name: 'Modal electric strings',
        count: 23,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
      {
        id: 'droneModal.overtone',
        name: 'Overtone and throat singing',
        count: 24,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
      {
        id: 'droneModal.windPipe',
        name: 'Drone winds and pipes',
        count: 70,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
      {
        id: 'droneModal.appalachian',
        name: 'Appalachian and old-time mountain',
        count: 9,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
      {
        id: 'droneModal.heterophonic',
        name: 'Heterophonic drone-modal',
        count: 22,
        glyphs: [
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture function',
            kind: 'fn',
          },
          {
            url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
            label: 'Fixture region',
            kind: 'region',
          },
        ],
      },
    ],
  },
};
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
async function main() {
  if (process.argv.includes('--browser')) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      headless: true,
      chromiumSandbox: true,
    });
    await browser.close();
    console.log(
      'Sandboxed Chromium available; DOM scenario below is still jsdom, not browser acceptance.'
    );
  }
  const dom = new JSDOM(
    '<!doctype html><button id="outside">Outside</button><main id="host"></main>',
    {
      url: 'http://localhost/',
      runScripts: 'outside-only',
    }
  );
  const { window } = dom,
    doc = window.document;
  const errors = [];
  window.addEventListener('error', (event) => errors.push(event.error));
  const factory = window.Function(
    "'use strict';\n" +
      source
        .replace('export function mount', 'function mount')
        .replace(
          'import.meta.url',
          JSON.stringify('http://localhost/prototype/features/genre-categories/categories.js')
        ) +
      '\nreturn mount;'
  );
  const mount = factory(),
    host = doc.getElementById('host');
  let snapshot = freeze({
    status: 'ready',
    error: null,
    revision: 0,
    total: 7755,
    allRoots: false,
    rootCount: 25,
    roots: FIXTURES.roots,
    branch: null,
  });
  const revisionChecks = [];
  let discovery = freeze({ open: false, narrow: false, revision: 0 });
  let targets = freeze({ applied: 0 });
  const discoveryListeners = new Set(),
    targetListeners = new Set(),
    discoveryCalls = [];
  let discoveryHold = null,
    discoveryRefusal = null;
  const setDiscovery = (patch) => {
    discovery = freeze({ ...discovery, ...patch, revision: discovery.revision + 1 });
    for (const fn of [...discoveryListeners]) fn(discovery);
  };
  const setTargets = (applied) => {
    targets = freeze({ applied });
    for (const fn of [...targetListeners]) fn(targets);
  };
  const listeners = new Set(),
    calls = [],
    announcements = [];
  let refusal = null,
    hold = null;
  const set = (patch) => {
    snapshot = freeze({ ...snapshot, ...patch, revision: snapshot.revision + 1 });
    for (const fn of [...listeners]) fn(snapshot);
  };
  async function change(name, args, revision) {
    calls.push({ name, args, revision });
    revisionChecks.push([revision, snapshot.revision]);
    assert.equal(revision, snapshot.revision, 'command uses current revision');
    if (refusal) throw Object.assign(new Error(refusal), { code: refusal });
    if (hold) await hold;
    if (name === 'openBranch') set({ branch: FIXTURES.branch });
    if (name === 'back')
      set({ branch: snapshot.branch.parent ? { ...FIXTURES.branch, parent: null } : null });
    if (name === 'allGenres') set({ branch: null });
    if (name === 'toggleRoots') set({ allRoots: !snapshot.allRoots });
    return { revision: snapshot.revision };
  }
  const controller = new window.AbortController();
  const ctx = Object.freeze({
    signal: controller.signal,
    announce: (text) => announcements.push(text),
    targets: Object.freeze({
      current: () => targets,
      subscribe: (fn) => {
        targetListeners.add(fn);
        return () => targetListeners.delete(fn);
      },
    }),
    discovery: Object.freeze({
      current: () => discovery,
      subscribe: (fn) => {
        discoveryListeners.add(fn);
        return () => discoveryListeners.delete(fn);
      },
      async setOpen(open, revision) {
        discoveryCalls.push({ open, revision, expected: discovery.revision });
        if (revision !== discovery.revision || discoveryRefusal)
          throw Object.assign(new Error('STALE'), { code: 'STALE' });
        setDiscovery({ open });
        const result = { revision: discovery.revision };
        if (discoveryHold) await discoveryHold;
        return result;
      },
    }),
    categories: Object.freeze({
      current: () => snapshot,
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      openBranch: (id, r) => change('openBranch', [id], r),
      back: (r) => change('back', [], r),
      allGenres: (r) => change('allGenres', [], r),
      toggleRoots: (r) => change('toggleRoots', [], r),
    }),
  });
  const handle = mount(host, ctx);
  const get = (action) => host.querySelector('[data-category-action="' + action + '"]');
  const ids = () =>
    [...host.querySelectorAll('[data-category-action="branch"]')].map((b) => b.dataset.categoryId);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const click = async (action) => {
    const b = get(action);
    assert.ok(b, 'button ' + action);
    b.focus();
    b.click();
    await tick();
  };
  const toggle = host.querySelector('[data-discovery-toggle]');
  const listWrapper = doc.getElementById('genre-categories-more');
  assert.equal(toggle.getAttribute('aria-controls'), 'genre-categories-more proto-genre-targets');
  assert.equal(toggle.hidden, true, 'wide toggle hidden');
  assert.equal(listWrapper.hidden, false, 'wide list visible even closed');
  get('branch').focus();
  setDiscovery({ narrow: true });
  assert.equal(listWrapper.hidden, true, 'narrow closed list hidden');
  assert.equal(doc.activeElement, toggle, 'narrowing returns list focus to toggle');
  doc.getElementById('outside').focus();
  handle.focus();
  assert.equal(doc.activeElement, toggle, 'host retry focus reaches closed disclosure');
  for (const open of [true, false, true, false]) {
    toggle.click();
    await tick();
    assert.equal(
      discoveryCalls.at(-1).revision,
      discoveryCalls.at(-1).expected,
      'discovery command revision'
    );
    assert.equal(discovery.open, open, 'repeated host disclosure command');
    assert.equal(toggle.getAttribute('aria-expanded'), String(open));
    assert.equal(listWrapper.hidden, !open, 'disclosure projects latest state');
    assert.equal(doc.activeElement, toggle, 'toggle retains focus');
  }
  for (const call of discoveryCalls)
    assert.equal(call.revision, call.expected, 'discovery command revision');
  setTargets(1);
  assert.match(toggle.textContent, /1 target\)/, 'one target label');
  setTargets(2);
  assert.match(toggle.textContent, /2 targets\)/, 'target count subscription');
  set({ branch: FIXTURES.branch });
  assert.equal(
    toggle.textContent,
    'Categories & find a sound (Drone and modal ornament, 2 targets)'
  );
  set({ branch: null });
  setTargets(0);
  assert.equal(toggle.textContent, 'Categories & find a sound');
  doc.getElementById('outside').focus();
  setDiscovery({ open: true });
  setDiscovery({ open: false });
  assert.equal(doc.activeElement.id, 'outside', 'external focus preserved on close');
  setDiscovery({ open: true });
  toggle.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(discovery.open, true, 'Escape remains shell-owned');
  get('branch').focus();
  setDiscovery({ open: false });
  assert.equal(doc.activeElement, toggle, 'closing returns list focus to toggle');
  toggle.focus();
  setDiscovery({ narrow: false });
  assert.equal(
    doc.activeElement,
    get('all'),
    'widening moves hidden toggle focus into visible list'
  );
  setDiscovery({ narrow: true });
  assert.equal(discovery.open, false, 'resize does not rewrite open state');
  assert.equal(doc.activeElement, toggle);
  discoveryRefusal = 'STALE';
  toggle.click();
  await tick();
  assert.equal(discovery.open, false, 'STALE does not optimistically open');
  assert.match(host.querySelector('.pgc-message').textContent, /Discovery changed/);
  assert.equal(doc.activeElement, toggle, 'STALE preserves toggle focus');
  discoveryRefusal = null;
  let finishDiscovery;
  discoveryHold = new Promise((resolve) => {
    finishDiscovery = resolve;
  });
  toggle.click();
  setDiscovery({ open: false }); // Newer shell action while the earlier result is deferred.
  doc.getElementById('outside').focus();
  finishDiscovery();
  await tick();
  discoveryHold = null;
  assert.equal(discovery.open, false, 'late result cannot replace newer discovery state');
  assert.equal(
    toggle.getAttribute('aria-expanded'),
    'false',
    'late result ARIA uses current snapshot'
  );
  assert.equal(doc.activeElement.id, 'outside', 'late disclosure result does not steal focus');
  setDiscovery({ narrow: false });
  assert.deepEqual(
    ids(),
    FIXTURES.roots.slice(0, 10).map((n) => n.id),
    'first ten canonical roots'
  );
  assert.match(get('all').textContent, /7,755/, 'catalog total');
  assert.equal(
    host.querySelector('link').getAttribute('href'),
    'http://localhost/prototype/features/genre-categories/categories.css'
  );
  assert.equal(host.querySelectorAll('img').length, 20, 'glyph pair per root');
  assert.ok(
    [...host.querySelectorAll('.pgc-glyphs')].every(
      (el) => el.getAttribute('aria-hidden') === 'true'
    )
  );
  await click('roots');
  assert.deepEqual(
    ids(),
    FIXTURES.roots.map((n) => n.id),
    'all roots canonical order'
  );
  assert.equal(doc.activeElement, get('roots'), 'root toggle focus');
  assert.equal(get('roots').getAttribute('aria-expanded'), 'true');
  await click('roots');
  await click('branch');
  assert.equal(calls.at(-1).args[0], FIXTURES.roots[0].id, 'branch command id');
  for (const [actual, expected] of revisionChecks)
    assert.equal(actual, expected, 'command revision received by host');
  assert.deepEqual(
    ids(),
    FIXTURES.branch.children.map((n) => n.id),
    'canonical child order'
  );
  assert.match(
    host.textContent,
    /Includes 186 cross-listed from other branches\./,
    'cross-listed sentence'
  );
  assert.match(host.querySelector('.pgc-current').textContent, /339/, 'branch count');
  await click('back');
  assert.equal(doc.activeElement, get('back'), 'Back focus at parent');
  await click('back');
  assert.equal(doc.activeElement, get('all'), 'Back focus at roots');
  await click('all');
  assert.equal(calls.at(-1).name, 'allGenres', 'All genres uses host command');
  for (const code of ['STALE', 'BUSY', 'NOT_FOUND']) {
    refusal = code;
    const before = snapshot;
    await click('branch');
    assert.equal(snapshot, before, 'refusal never changes snapshot');
    assert.ok(!host.querySelector('.pgc-message').hidden, 'visible refusal');
    assert.equal(doc.activeElement, get('branch'), 'refusal retains initiating focus');
    assert.deepEqual(
      ids(),
      FIXTURES.roots.slice(0, 10).map((n) => n.id)
    );
  }
  refusal = null;
  set({ status: 'loading' });
  assert.match(host.textContent, /Loading categories/);
  assert.equal(get('branch'), null);
  set({ status: 'error', error: { code: 'OFFLINE', message: 'Offline fixture' } });
  assert.match(host.textContent, /Offline fixture/);
  set({ status: 'ready', error: null, branch: { ...FIXTURES.branch, cross: 0, children: [] } });
  assert.ok(!host.textContent.includes('cross-listed'), 'zero cross note omitted');
  assert.equal(ids().length, 0, 'leaf has no invented children');
  set({ branch: null });
  let release;
  hold = new Promise((resolve) => {
    release = resolve;
  });
  const beforeCalls = calls.length;
  get('branch').click();
  get('branch').click();
  assert.equal(calls.length, beforeCalls + 1, 'no concurrent independent writer');
  doc.getElementById('outside').focus();
  release();
  await tick();
  hold = null;
  assert.equal(doc.activeElement.id, 'outside', 'completion cannot steal outside focus');
  assert.equal(announcements.length, 0, 'no lane-owned navigation announcements');
  assert.equal(host.querySelector('[aria-live], [role="status"], [role="alert"]'), null);
  assert.equal(listeners.size, 1);
  assert.equal(discoveryListeners.size, 1);
  assert.equal(targetListeners.size, 1);
  set({ branch: null });
  hold = new Promise((resolve) => {
    release = resolve;
  });
  get('branch').click();
  setDiscovery({ narrow: true, open: true });
  discoveryHold = new Promise((resolve) => {
    finishDiscovery = resolve;
  });
  toggle.click();
  controller.abort();
  handle.unmount();
  assert.equal(listeners.size, 0, 'unsubscribe on abort');
  assert.equal(discoveryListeners.size, 0, 'discovery unsubscribe');
  assert.equal(targetListeners.size, 0, 'targets unsubscribe');
  assert.equal(host.children.length, 0, 'remove lane and stylesheet');
  release();
  finishDiscovery();
  await tick();
  set({ branch: null });
  assert.equal(host.children.length, 0, 'no resurrection after teardown');
  assert.deepEqual(errors, [], 'no DOM exceptions');
  dom.window.close();
  console.log(
    'categories: PASS — hermetic category/discovery DOM, revision/refusal, focus and cleanup; not browser or engine parity.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
