#!/usr/bin/env node
/* global document, requestAnimationFrame, window */ // inside page.evaluate
'use strict';
// Acceptance of the connection views on the production route, in Chromium:
// the real Library page, the reader, the analysis chunk's mount, the adapter,
// views, marks and bindings, against a stubbed Library API serving the
// committed AnalysisSession capture (scripts/fixtures/connection-backend.json)
// as verified pages. What a reader can do and hear, end to end:
//
//   directed   a→b roles kept as asked, including a later-to-earlier binding,
//              never reversed or collapsed into an unordered pair; and, once
//              directed holds are drawn as arcs (the arrowhead patch), each
//              arc runs from a to b and carries its direction
//   keyboard   poem Tab order (words in reading order before any arc), Enter
//              inspects, Esc layers (sheet, then selection) keep focus on the
//              word, matrix arrows stay inside the grid
//   stale      a link from another reading is refused, shown and said; a
//              valid link restores its selection
//   paging     unloaded evidence is never a negative; the final page brings
//              the holds, keeps the view and the address, and sends no new
//              computation
//   auth       losing the session (404) or expiry (410) tears the views down
//
// Reuses check_library_page.js's own harness (build, server, page, stubs) by
// reading that file up to its runner, so both drive the identical route; if
// the harness changes shape this script fails loudly at load, not silently.
//
//   node scripts/check_connection_acceptance_browser.js [--dark] [--require-arrows]
//        [--section=directed|keyboard|stale|paging|auth] [--width=1280|390]
//
// --require-arrows turns "directed holds are not drawn as arcs yet" from a
// PENDING note into a failure: use it once the arrowhead patch is integrated.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const HARNESS = path.join(__dirname, 'check_library_page.js');
const src = fs.readFileSync(HARNESS, 'utf8');
const cut = src.indexOf('\n(async () => {\n  const dir = build();');
if (cut < 0) throw Error('check_library_page.js runner not found: update the harness hook');
const mine = new Set(['dark', 'require-arrows', 'reader-mode']);
const pick = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || '';
const argv = process.argv.slice(2);
process.argv.splice(
  2,
  argv.length,
  ...argv.filter((a) => !mine.has(a.replace(/^--/, '')) && !/^--(section|width)=/.test(a))
);
const harness = new Module(HARNESS, module);
harness.filename = HARNESS;
harness.paths = Module._nodeModulePaths(__dirname);
harness._compile(
  src.slice(0, cut) +
    '\nmodule.exports = { build, link, chunksIn, start, openPage, go, settled, check, results,' +
    ' API, EPI_A, EPI_B, failures: () => failures };',
  HARNESS
);
const H = harness.exports;
const DARK = argv.includes('--dark');
const REQUIRE_ARROWS = argv.includes('--require-arrows');
// --reader-mode: run every section inside the reader's full-width Connections
// mode (the Sound lens's Connections button, conn=1 in the hash route).
const READER_MODE = argv.includes('--reader-mode');
const ONLY_SECTION = pick('section');
const ONLY_WIDTH = Number(pick('width')) || 0;
const pending = [];
// The reader is ready, in whichever mode its address asked for: the reader
// landmark attached first, then the surface that mode shows -- the poem lines,
// or (conn=1 in the hash route, where the paper is hidden) the mode's bar.
// Never a comma selector, which can settle on the hidden paper (3PO).
async function readerSettled(page) {
  await page.waitForSelector('#surface-library .rd', { state: 'attached', timeout: 20000 });
  const conn = await page.evaluate(() => /[?&]conn=1\b/.test(window.location.hash));
  return H.settled(
    page,
    'reader',
    conn ? '#surface-library .rd.rd-conn .rd-connbar' : '#surface-library .rd-paper .rd-line'
  );
}
const notes = [];

const crypto = require('crypto');
const FIXTURE = require('./fixtures/connection-backend.json');
const canonical = (v) =>
  v && typeof v === 'object'
    ? Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
          .join(',') +
        '}'
    : JSON.stringify(v);
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
const CI = require('../src/connection-interaction.js');

// A selection key with every id decoded, so keys compare by meaning, never by
// their percent-encoding: "method|a=<id>,b=<id>" for a binding.
function decodeKey(key) {
  const sel = CI.selectionFromKey(key || '');
  if (!sel || sel.kind !== 'binding') return null;
  return `${sel.method_id}|${sel.members.map((m) => `${m.role}=${m.entity_id}`).join(',')}`;
}
// Every holding binding the capture supplies for a role-ordered method, as
// decodeKey writes it: the complete set the views must offer and draw.
function expectedBindings(records) {
  const ordered = new Set(
    records
      .filter((r) => r.kind === 'method_result' && r.domain?.ordering === 'role_ordered')
      .map((r) => r.method_id)
  );
  return records
    .filter(
      (r) => r.kind === 'relation_instance' && r.verdict === 'true' && ordered.has(r.method_id)
    )
    .map((r) => `${r.method_id}|a=${r.a.token_ids[0]},b=${r.b.token_ids[0]}`)
    .sort();
}
const sameSet = (got, want) =>
  got.length === want.length && [...got].sort().every((k, i) => k === want[i]);
// The alliteration hold the capture supplies (watch L1 w1 → woods L1 w2), and
// the cell the matrix draws for it.
const HOLD_KEY = CI.selectionKey({
  kind: 'binding',
  method_id: 'schema:85d0a9d89593c874a7ac0fab',
  members: [
    { role: 'a', entity_id: 'line:0:token:0' },
    { role: 'b', entity_id: 'line:0:token:1' },
  ],
});
// Its negative in the same domain (cat L2 w1 → hat L2 w2): false in the
// capture, so "does not hold" once the census is complete.
const FALSE_KEY = CI.selectionKey({
  kind: 'binding',
  method_id: 'schema:85d0a9d89593c874a7ac0fab',
  members: [
    { role: 'a', entity_id: 'line:1:token:0' },
    { role: 'b', entity_id: 'line:1:token:1' },
  ],
});
const cellLabel = (page, key) =>
  page
    .locator(`.cv-desktop-matrix [data-selection="${key}"]`)
    .first()
    .getAttribute('aria-label')
    .catch(() => null);

// An AUTHORED role-swapped replay of the capture, not a newly computed verdict:
// the watch → woods record is rewritten by hand as woods (a) → watch (b), so
// the views can be shown a later-to-earlier binding and must keep it as given.
// No engine produced this record; it tests the views' handling of roles only.
function reversed() {
  const records = JSON.parse(JSON.stringify(FIXTURE.records));
  const r = records.find(
    (x) => x.kind === 'relation_instance' && x.a.token_ids[0] === 'line:0:token:0'
  );
  [r.a, r.b] = [r.b, r.a];
  if (r.compared && r.compared.a && r.compared.b)
    [r.compared.a, r.compared.b] = [r.compared.b, r.compared.a];
  return records;
}

// The Library API as the analysis chunk reads it: one job, a manifest and its
// pages (tokens and results first, the relation instances on page 2).
async function serve(page, records = FIXTURE.records) {
  const payloads = [
    records.filter((r) => r.kind !== 'relation_instance'),
    records.filter((r) => r.kind === 'relation_instance'),
  ].map((instances) => JSON.stringify({ instances }));
  const hashes = payloads.map(digest);
  const state = { posts: 0, status: 200, job: null, manifest: null, hash: null };
  await page.route(H.API + '/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname.slice('/library/v1'.length);
    const reply = (value, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: typeof value === 'string' ? value : JSON.stringify(value),
      });
    if (p === '/analyses' && req.method() === 'POST') {
      const body = JSON.parse(req.postData());
      state.posts++;
      state.job = {
        id: `acceptance-${state.posts}`,
        state: 'running',
        identity: {
          reading_unit_id: body.reading_unit_id,
          reading_revision: body.reading_revision,
          requested_methods: body.requested_methods || [],
        },
        progress: { completed: 1, total: 2 },
      };
      state.manifest = JSON.stringify({
        job_id: state.job.id,
        identity_hash: digest(canonical(state.job.identity)),
        partial: false,
        page_count: 2,
        evidence_count: records.length,
      });
      state.hash = digest(state.manifest);
      return reply({ job: state.job }, 202);
    }
    const job = state.job;
    if (job && p === `/jobs/${job.id}`)
      return state.status === 200
        ? reply({ job: { ...job, state: 'complete', manifest_hash: state.hash } })
        : reply({ error: { code: state.status === 410 ? 'EXPIRED' : 'NOT_FOUND' } }, state.status);
    if (job && p === `/jobs/${job.id}/manifests/${state.hash}`) return reply(state.manifest);
    if (job && p === `/jobs/${job.id}/manifests/${state.hash}/pages`) {
      const i = Number(url.searchParams.get('offset'));
      return reply({
        manifest_hash: state.hash,
        page_refs: [{ sha256: hashes[i] }],
        next_offset: i === 0 ? 1 : null,
      });
    }
    const i = job ? hashes.findIndex((h) => p === `/jobs/${job.id}/pages/${h}`) : -1;
    if (i >= 0) return reply(payloads[i]);
    return route.fallback();
  });
  return state;
}

// The reader's controls: at phone width they sit behind the reader's sheet
// button, which may already be open after a reload.
async function analyze(page) {
  const run = page.locator('[data-act="analyze"]');
  if (!(await run.isVisible())) {
    const sheet = page.locator('#surface-library [data-rd="sheet"]');
    if (await sheet.isVisible()) await sheet.click({ timeout: 5000 }).catch(() => {});
  }
  await run.click();
}
// Reader on a reading, sound lens, analysis run, views mounted.
async function open(page, base, reading, { complete = false } = {}) {
  await H.go(page, base, `/read/${reading}?lens=sound`);
  await H.settled(page, 'reader', '#surface-library .rd-paper .rd-line');
  await analyze(page);
  await page.waitForSelector('.cv-root', { timeout: 20000 });
  if (READER_MODE) {
    const mode = page.locator('#surface-library button[aria-pressed]', {
      hasText: /^\s*Connections\s*$/,
    });
    if (!(await mode.count()))
      throw Error('--reader-mode: no Connections lens button on this head');
    if ((await mode.first().getAttribute('aria-pressed')) !== 'true') await mode.first().click();
    // The reader keeps conn in its hash route (lib.go), beside lens and view;
    // only the views' own cv and sel live in location.search.
    await page.waitForFunction(() => /[?&]conn=1\b/.test(window.location.hash));
  }
  if (complete) {
    await page.click('[data-act="more"]');
    await page.waitForFunction(() =>
      document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
    );
  }
}
const live = (page) => page.textContent('.lib-cb-live');
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a.tagName,
      key: a.dataset?.selection || '',
      visible: a !== document.body && a.getClientRects().length > 0,
    };
  });
const nativeLabels = (page) =>
  page.$$eval('.cv-native button', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ')));
const closeSheet = async (page) => {
  if (await page.isVisible('.lib-cb-sheet-body')) await page.keyboard.press('Escape');
};

// The poem's directed arcs against `want` (decodeKey form). `what` names the
// records in the check text. With no directed arc keyed at all the check is
// PENDING (or fails under --require-arrows), but an arc marked directed with
// no binding key is a regression and always fails.
async function arrowChecks(page, tag, want, what) {
  await page.click('.cv-root [data-view="poem"]');
  await settle(page);
  // Read each drawn arc: its selection, its arrowhead's vertices, and every
  // endpoint of its route and stems. The head's path is "M tip L corner L
  // corner Z" (marks.arrowhead), so its tip and base never depend on how the
  // route is drawn. ends() reads the first and last coordinate pairs, which
  // assumes absolute commands; a relative path makes reaches* fail, never pass.
  const drawn = await page.evaluate(() => {
    const nums = (d) => (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    const ends = (d) => {
      const n = nums(d);
      return n.length >= 2
        ? [
            [n[0], n[1]],
            [n[n.length - 2], n[n.length - 1]],
          ]
        : [];
    };
    const ports = {};
    for (const c of document.querySelectorAll('.cv-poem g[data-selection^="o:"] circle'))
      ports[c.closest('[data-selection]').dataset.selection] = [
        +c.getAttribute('cx'),
        +c.getAttribute('cy'),
      ];
    const arcs = [...document.querySelectorAll('.cv-poem .lib-mk-arc')].map((g) => {
      const owner = g.closest('[data-selection]') || g;
      const head = g.querySelector('path.lib-mk-head');
      const v = head ? nums(head.getAttribute('d')) : [];
      return {
        key: owner.dataset.selection || '',
        directed: g.dataset.directed === 'true',
        headCount: g.querySelectorAll('path.lib-mk-head').length,
        tip: v.length >= 6 ? [v[0], v[1]] : null,
        base: v.length >= 6 ? [(v[2] + v[4]) / 2, (v[3] + v[5]) / 2] : null,
        ends: [...g.querySelectorAll('path:not(.lib-mk-head):not(.lib-mk-gap)')].flatMap((p) =>
          ends(p.getAttribute('d') || '')
        ),
      };
    });
    return { ports, arcs };
  });
  const portOf = (id) => drawn.ports[CI.selectionKey({ kind: 'occurrence', entity_id: id })];
  const directedArcs = drawn.arcs.filter((a) => a.key.startsWith('b:'));
  const markedDirected = drawn.arcs.filter((a) => a.directed).length;
  if (!directedArcs.length) {
    H.check(
      `${tag} directed (${what}): no arc is marked directed without a binding key`,
      markedDirected === 0,
      JSON.stringify(drawn.arcs)
    );
    const note = `${tag} directed (${what}): directed holds are not drawn as poem arcs yet (arrowheads pending)`;
    if (REQUIRE_ARROWS) H.check(note, false);
    else pending.push(note);
    return;
  }
  const keys = directedArcs.map((a) => decodeKey(a.key));
  H.check(
    `${tag} directed (${what}): the poem draws exactly the supplied directed bindings`,
    keys.every(Boolean) && sameSet(keys, want) && markedDirected === directedArcs.length,
    JSON.stringify({ keys, want, markedDirected })
  );
  H.check(
    `${tag} directed (${what}): every directed arc carries one ink arrowhead (.lib-mk-head)`,
    directedArcs.every((a) => a.directed && a.headCount === 1 && a.tip),
    JSON.stringify(directedArcs)
  );
  const dist = (p, q) => (p && q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : Infinity);
  const runs = directedArcs.map((a) => {
    const sel = CI.selectionFromKey(a.key);
    const role = (r) => sel.members.find((m) => m.role === r).entity_id;
    const pa = portOf(role('a')),
      pb = portOf(role('b'));
    // The head points at b: base → tip runs toward b's port, within 60°.
    let aims = false;
    if (a.tip && a.base && pb) {
      const u = [a.tip[0] - a.base[0], a.tip[1] - a.base[1]],
        w = [pb[0] - a.base[0], pb[1] - a.base[1]];
      const cos = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w) || Infinity);
      aims = cos >= 0.5 && dist(a.base, pb) > dist(a.tip, pb);
    }
    return {
      key: decodeKey(a.key),
      toB: dist(a.tip, pb),
      toA: dist(a.tip, pa),
      aims,
      reachesA: a.ends.some((e) => dist(e, pa) < 2),
      reachesB: a.ends.some((e) => dist(e, pb) < 2),
    };
  });
  H.check(
    `${tag} directed (${what}): each arrowhead sits at its b word and points into it`,
    runs.every((r) => r.toB <= 12 && r.toB < r.toA && r.aims),
    JSON.stringify(runs)
  );
  H.check(
    `${tag} directed (${what}): each route (with its stems) joins the asked a and b ports`,
    runs.every((r) => r.reachesA && r.reachesB),
    JSON.stringify(runs)
  );
}

const SECTIONS = {
  async directed({ page, base, tag }) {
    let state = await serve(page);
    await open(page, base, H.EPI_A, { complete: true });
    let labels = await nativeLabels(page);
    H.check(
      `${tag} directed: each asked binding is listed a → b as asked`,
      labels.some((l) => /a: watch[^→]*→ b: woods/.test(l)) &&
        labels.some((l) => /a: cat[^→]*→ b: hat/.test(l)),
      JSON.stringify(labels)
    );
    const want = expectedBindings(FIXTURE.records);
    const offered = (
      await page.$$eval('.cv-native button[data-selection]', (bs) =>
        bs.map((b) => b.dataset.selection)
      )
    ).map(decodeKey);
    H.check(
      `${tag} directed: the native list offers exactly the supplied directed bindings`,
      offered.every(Boolean) && sameSet(offered, want),
      JSON.stringify({ offered, want })
    );
    await page.click('.cv-native button >> nth=0');
    await closeSheet(page);
    const sel = new URL(page.url()).searchParams.get('sel') || '';
    H.check(
      `${tag} directed: the selection is a role-ordered binding, never an unordered pair`,
      decodeKey(sel) === 'schema:85d0a9d89593c874a7ac0fab|a=line:0:token:0,b=line:0:token:1',
      sel
    );
    H.check(
      `${tag} directed: the inspector names the roles a → b`,
      /a: watch[^→]*→ b: woods/.test(await page.textContent('.cv-inspector')),
      (await page.textContent('.cv-inspector')).slice(0, 200)
    );
    // Arrows: once directed holds are drawn in the poem, each arc runs from
    // its a word to its b word and carries its direction.
    await page.click('.cv-root [data-view="matrix"]');
    await settle(page);
    H.check(
      `${tag} directed: the supplied hold reads as holding in its own matrix cell`,
      /· holds$/.test((await cellLabel(page, HOLD_KEY)) || ''),
      await cellLabel(page, HOLD_KEY)
    );
    H.check(`${tag} directed: opening and selecting sends no computation`, state.posts === 1);
    await arrowChecks(page, tag, want, 'capture');
    H.check(`${tag} directed: capture viewing sends no computation`, state.posts === 1);
    // A binding asked later-to-earlier stays that way round.
    await page.context().clearCookies();
    await page.unroute(H.API + '/**');
    state = await serve(page, reversed());
    await open(page, base, H.EPI_A, { complete: true });
    labels = await nativeLabels(page);
    H.check(
      `${tag} directed: an authored role-swapped replay keeps its roles as given (a: woods → b: watch)`,
      labels.some((l) => /a: woods[^→]*→ b: watch/.test(l)) &&
        !labels.some((l) => /a: watch[^→]*→ b: woods/.test(l)),
      JSON.stringify(labels)
    );
    // Once arcs are drawn, the replay's arrow must run into watch (its b).
    await arrowChecks(page, tag, expectedBindings(reversed()), 'role-swapped replay');
    H.check(`${tag} directed: viewing sends no computation`, state.posts === 1);
  },

  async keyboard({ page, base, tag, width }) {
    await serve(page);
    await open(page, base, H.EPI_A, { complete: true });
    await page.click('.cv-root [data-view="poem"]');
    await settle(page);
    // Tab through the poem: words in reading order, then any arcs.
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.cv-poem [tabindex="0"]')].map(
        (n) => n.dataset.selection || ''
      )
    );
    const words = order.filter((k) => k.startsWith('o:'));
    const firstArc = order.findIndex((k) => !k.startsWith('o:'));
    H.check(
      `${tag} keyboard: poem words come first, in reading order`,
      words.join(' ') ===
        [
          'o:line%3A0%3Atoken%3A0',
          'o:line%3A0%3Atoken%3A1',
          'o:line%3A1%3Atoken%3A0',
          'o:line%3A1%3Atoken%3A1',
        ].join(' ') &&
        (firstArc < 0 || firstArc === words.length),
      JSON.stringify(order)
    );
    await page.focus('.cv-poem [data-selection="o:line%3A0%3Atoken%3A0"][tabindex="0"]');
    await page.keyboard.press('Enter');
    await settle(page);
    H.check(
      `${tag} keyboard: Enter on a word selects it and says so`,
      /watch .*selected/.test(await live(page)),
      await live(page)
    );
    // The sheet follows the layout the views actually get (their container
    // query), not the viewport: in the Library's analysis column a desktop
    // viewport can still be phone layout.
    const phone = await page.evaluate(
      () => window.getComputedStyle(document.querySelector('.cv-layout')).display === 'block'
    );
    if (width <= 600)
      H.check(`${tag} keyboard: at phone width the views use the phone layout`, phone);
    if (phone) {
      const inSheet = await page.evaluate(
        () => !!document.activeElement.closest('.lib-cb-sheet-body')
      );
      H.check(`${tag} keyboard: in phone layout the inspector sheet takes focus`, inSheet);
      await page.keyboard.press('Escape');
      await settle(page);
      const back = await active(page);
      H.check(
        `${tag} keyboard: the first Esc closes the sheet and returns to the word`,
        back.key === 'o:line%3A0%3Atoken%3A0' && back.visible,
        JSON.stringify(back)
      );
    }
    await page.keyboard.press('Escape');
    await settle(page);
    const cleared = await active(page);
    H.check(
      `${tag} keyboard: Esc clears the selection and focus stays on the word`,
      !new URL(page.url()).searchParams.get('sel') &&
        cleared.key === 'o:line%3A0%3Atoken%3A0' &&
        cleared.visible,
      JSON.stringify(cleared)
    );
    H.check(
      `${tag} keyboard: clearing is said`,
      /cleared/i.test(await live(page)),
      await live(page)
    );
    if (phone) {
      const host = await page.evaluate(() =>
        Math.round(document.querySelector('.cv-root').getBoundingClientRect().width)
      );
      notes.push(
        `${tag} keyboard: the views are in phone layout here (view width ${host} px), so the desktop matrix and its arrow keys are not reachable at this viewport`
      );
    } else {
      await page.click('.cv-root [data-view="matrix"]');
      await settle(page);
      const grid = await page.$$eval('.cv-desktop-matrix [data-row][data-col]', (bs) => ({
        cells: bs.map((b) => `${b.dataset.row},${b.dataset.col}`),
        n: bs[0].closest('table').querySelectorAll('tr').length - 1,
      }));
      await page.locator('.cv-desktop-matrix [data-row="0"][data-col="1"]').focus();
      // Where each key must land, from the interaction module's own rule; a
      // move onto a cell that doesn't exist leaves focus where it is.
      let at = { row: 0, col: 1 };
      const steps = [];
      for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
        const to = CI.matrixMove(at, key, grid.n);
        if (grid.cells.includes(`${to.row},${to.col}`)) at = to;
        await page.keyboard.press(key);
        const got = await page.evaluate(() => {
          const a = document.activeElement;
          return a.closest('.cv-desktop-matrix') ? `${a.dataset.row},${a.dataset.col}` : null;
        });
        steps.push({ key, want: `${at.row},${at.col}`, got });
      }
      H.check(
        `${tag} keyboard: each matrix arrow lands focus on the expected cell`,
        steps.every((x) => x.got === x.want),
        JSON.stringify(steps)
      );
    }
  },

  async stale({ page, base, tag }) {
    await serve(page);
    await open(page, base, H.EPI_A, { complete: true });
    await page.click('.cv-native button >> nth=0');
    await closeSheet(page);
    const link = page.url();
    // The same link opened fresh (a real load, not a fragment navigation, so
    // no earlier mount survives) on the same reading restores its selection.
    // goto + reload, as check_library_page does: an about:blank hop races the
    // favicon fetch and logs a CORS error (found by Jony Ives).
    // Settle after goto and again after reload: a reload while the reader's
    // head.json.gz is still in flight makes the old document log the cancelled
    // fetch (3PO, #637 6547480945).
    await page.goto(link);
    await readerSettled(page);
    await page.reload();
    await readerSettled(page);
    await analyze(page);
    await page.waitForSelector('.cv-root');
    await page.click('[data-act="more"]');
    await page.waitForFunction(() =>
      document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
    );
    H.check(
      `${tag} stale: a link on its own reading restores the selection`,
      new URL(page.url()).searchParams.get('sel') === new URL(link).searchParams.get('sel') &&
        !(await page.$('.cv-notice')),
      page.url()
    );
    // The same selection opened on another reading is refused, shown and said.
    const other = new URL(link);
    other.hash = `#library/read/${H.EPI_B}?lens=sound`;
    // The hash change opens the other reading in place: wait until it is
    // drawn (its first line, not the old one's) before reloading.
    const was = await page.textContent('#surface-library .rd-paper .rd-line');
    await page.goto(other.href);
    await page.waitForFunction((old) => {
      const line = document.querySelector('#surface-library .rd-paper .rd-line');
      return line && line.getClientRects().length > 0 && line.textContent !== old;
    }, was);
    await readerSettled(page);
    await page.reload();
    await readerSettled(page);
    await analyze(page);
    await page.waitForSelector('.cv-notice');
    await settle(page);
    H.check(
      `${tag} stale: another reading's link is refused and shown`,
      /no longer exists/.test(await page.textContent('.cv-notice'))
    );
    H.check(`${tag} stale: the refusal is said`, /no longer exists/.test(await live(page)));
    H.check(
      `${tag} stale: nothing is selected in its place`,
      !(await page.$('.cv-root .cv-selected, .cv-root .lib-mk-select'))
    );
  },

  async paging({ page, base, tag }) {
    const state = await serve(page);
    await open(page, base, H.EPI_A);
    await page.click('.cv-root [data-view="matrix"]');
    const early = await cellLabel(page, HOLD_KEY);
    H.check(
      `${tag} paging: before the final page the supplied hold's cell reads not yet computed`,
      /· not yet computed$/.test(early || ''),
      early
    );
    const labels = await page
      .locator('.cv-root [data-selection]')
      .evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label') || ''));
    H.check(
      `${tag} paging: before the final page nothing reads as a negative`,
      !labels.some((l) => /does not hold/.test(l)),
      JSON.stringify(labels.filter((l) => /hold/.test(l)).slice(0, 4))
    );
    await page.locator('.cv-root [data-selection]:visible').first().click();
    await closeSheet(page);
    const address = page.url();
    await page.click('[data-act="more"]');
    await page.waitForFunction(() =>
      document.querySelector('.cv-root')?.textContent.includes('all pages loaded')
    );
    const late = await cellLabel(page, HOLD_KEY);
    H.check(
      `${tag} paging: the final page turns that cell into a hold`,
      /· holds$/.test(late || ''),
      late
    );
    const negative = await cellLabel(page, FALSE_KEY);
    H.check(
      `${tag} paging: and the supplied negative into does not hold`,
      /· does not hold$/.test(negative || ''),
      negative
    );
    H.check(
      `${tag} paging: the view and the address are kept`,
      (await page.getAttribute('.cv-root [data-view="matrix"]', 'aria-current')) === 'true' &&
        page.url() === address,
      page.url()
    );
    const focus = await active(page);
    H.check(
      `${tag} paging: focus lands somewhere visible after the page loads`,
      focus.visible,
      JSON.stringify(focus)
    );
    H.check(`${tag} paging: loading pages sends no new computation`, state.posts === 1);
  },

  async auth({ page, base, tag }) {
    for (const [status, word] of [
      [410, 'expired'],
      [404, 'session'],
    ]) {
      const state = await serve(page);
      await open(page, base, H.EPI_A, { complete: true });
      state.status = status;
      await page.click('[data-rd="lens"][data-id="form"]');
      await page.click('[data-rd="lens"][data-id="sound"]');
      await page.waitForFunction(
        (w) => document.querySelector('.la-root')?.textContent.toLowerCase().includes(w),
        word,
        { timeout: 20000 }
      );
      H.check(
        `${tag} auth: a ${status} tears the connection views down`,
        !(await page.$('.cv-root')),
        (await page.textContent('.la-root')).slice(0, 160)
      );
      await page.unroute(H.API + '/**');
    }
  },
};

(async () => {
  const dir = H.build();
  H.link(dir);
  const chunks = H.chunksIn(dir);
  for (const c of ['analysis', 'connection-views', 'connection-bindings', 'marks', 'reader'])
    if (!chunks.has(c)) throw Error(`chunk not in this build: ${c}`);
  const srv = await H.start({ root: dir, port: 0 });
  const { chromium } = require('playwright');
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  });
  const combos = [];
  for (const theme of DARK ? ['light', 'dark'] : ['light'])
    for (const width of [1280, 390])
      if (!ONLY_WIDTH || width === ONLY_WIDTH) combos.push({ theme, width });
  try {
    for (const [name, fn] of Object.entries(SECTIONS).filter(
      ([n]) => !ONLY_SECTION || n === ONLY_SECTION
    ))
      for (const combo of combos) {
        const tag = `[${combo.theme} ${combo.width}]`;
        const { context, page, errors } = await H.openPage(browser, srv.url, combo);
        try {
          await fn({ page, base: srv.url, tag, width: combo.width });
        } catch (e) {
          H.check(`${tag} ${name}: ran to the end`, false, String(e.message).slice(0, 300));
        }
        H.check(`${tag} ${name}: no page errors`, errors.length === 0, errors.join(' | '));
        await context.close();
      }
  } finally {
    await browser.close();
    await srv.close();
  }
  for (const r of H.results) console.log(r);
  for (const p of pending) console.log(`PENDING ${p}`);
  for (const n of notes) console.log(`NOTE ${n}`);
  const n = H.results.length;
  const failed = H.failures();
  console.log(
    `CONNECTION ACCEPTANCE: ${failed ? 'FAIL' : 'PASS'} — ${n - failed}/${n} checks` +
      (pending.length ? `, ${pending.length} pending (arrowheads)` : '')
  );
  process.exit(failed ? 1 : 0);
})();
