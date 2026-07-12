#!/usr/bin/env node
// scripts/ui_reachability_check.js
// Build gate — verifies every `status: reachable` entry in the UI capability
// inventory resolves to ≥ 1 DOM element under its stated precondition.
//
// This is the structural fix for the master-detail refactor's silent capability
// drops. Without this gate, an interactive surface can disappear from the UI
// without any test failing — exactly what happened with the stack-signature
// panel, the tradition-group delete, and the drag-drop interactions. With this
// gate, dropping a surface fails the build.
//
// HOW IT WORKS
//   1. Parse tests/ui_capability_inventory.md via _inventory_parser.js
//   2. Filter to entries with status: reachable
//   3. Group entries by precondition (so setup runs once per group, not per entry)
//   4. For each precondition group:
//      a. Open codex.html in headless Chromium
//      b. Run the precondition's setup function (addCard etc.)
//      c. For each entry, run a page.evaluate that queries the selector
//      d. Record pass / fail / element count
//   5. Print a summary table and exit 0 if all pass, non-zero otherwise.
//
// PRECONDITION SETUPS
//   Defined inline below. Each is a string of JS evaluated in the page context
//   to bring the workspace into the expected state. Match the table in the
//   inventory doc's "Preconditions" section.
//
// USAGE
//   node scripts/ui_reachability_check.js
//   node scripts/ui_reachability_check.js --verbose    # show per-entry pass lines too
//   node scripts/ui_reachability_check.js --html=path  # check a specific codex.html

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseInventory } = require('./_inventory_parser.js');
const { HTML_OUT } = require('./_paths.js');

const args = process.argv.slice(2);
const flags = {};
for (const a of args) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}

const HTML_PATH = flags.html || HTML_OUT;
const VERBOSE = !!flags.verbose;

// The shipped codex.html is the LAZY SHELL (the build_html.js default): it boots
// by fetching api/browse.json. Headless Chromium cannot fetch api/ over a
// file:// origin, so a lazy shell loaded here would only ever render its
// boot-error state and every surface would "fail". UI-surface resolution is a
// property of the shared src/app.js render code, and check_lazy_app.js proves
// the lazy shell reaches a byte-identical rendered DOM — so this gate exercises
// the EMBEDDED variant (tables in the page, no fetch). If --html points at an
// already-embedded file we use it as-is; otherwise (lazy, or nothing built yet)
// we build a fresh embedded codex.html from source to a temp file.
function resolveTestableHtml(htmlPath) {
  if (htmlPath && fs.existsSync(htmlPath)) {
    const txt = fs.readFileSync(htmlPath, 'utf8');
    if (!txt.includes('const CODEX_LAZY_API')) return htmlPath; // already embedded
    console.error(
      'Target is the lazy shell — building an embedded codex.html for the reachability run.'
    );
  } else {
    console.error(
      'No built codex.html found — building an embedded one from source for the reachability run.'
    );
  }
  const tmp = path.join(os.tmpdir(), `codex_reach_embed_${process.pid}.html`);
  execFileSync(
    'node',
    [path.join(__dirname, 'build_html.js'), `--out=${tmp}`, '--embedded', '--quiet'],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  return tmp;
}

// Precondition setup snippets — each runs inside page.evaluate after navigation
// completes and the codex's DOMContentLoaded boot has finished. The snippet
// brings the workspace into the named state. After the snippet runs, the check
// loop verifies each entry's selector resolves to ≥ 1 element.
const PRECONDITIONS = {
  empty: `
    // No setup. Workspace boots empty.
  `,
  '1+ cards': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    renderAll();
  `,
  '2+ cards': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    addCard('acoustic_guitar_dread', { traditionId: 'bluegrass' });
    app.selected = app.cards[0].id;
    renderAll();
  `,
  'editing part': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'parts';
    app.cards[0].editingPart = 'electric_technique';
    renderAll();
  `,
  'viewing env tab': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'env';
    renderAll();
  `,
  'editing env: tuning': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'env';
    app.cards[0].editingEnv = 'tuning';
    renderAll();
  `,
  'editing env: room': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'env';
    app.cards[0].editingEnv = 'room';
    renderAll();
  `,
  'viewing chain tab': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'chain';
    renderAll();
  `,
  'editing chain stage': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'chain';
    app.cards[0].editingChainStage = 'mic';
    renderAll();
  `,
  'viewing parts tab': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'parts';
    renderAll();
  `,
  'viewing preface tab': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'preface';
    renderAll();
  `,
  'drift active': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0].drift = buildDriftCandidates(app.cards[0]);
    renderAll();
  `,
  'pinned card': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0].pinned = true;
    renderAll();
  `,
  'stack panel open': `
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'stack';
    app.cards[0].stackPanel = { format: 'prose' };
    renderAll();
  `,
  'instrument picker open': `
    // Populate the picker BEFORE opening the modal — openModal alone shows
    // the frame but no chips. The user-triggered entry points (sidebar plus,
    // empty-state Browse) always call renderInstPicker first.
    if (typeof renderInstPicker === 'function') renderInstPicker();
    openModal('modal-add');
  `,
  'instrument picker open, filter active': `
    if (typeof renderInstPicker === 'function') renderInstPicker();
    // Activate one axis filter so the clear-all status row renders. Pick
    // any axis id; existence of an active filter is what surfaces the clear
    // button.
    if (app.instrumentAxisFilters && typeof app.instrumentAxisFilters.add === 'function') {
      const pills = document.querySelectorAll('[data-filter-toggle]');
      if (pills.length > 0) app.instrumentAxisFilters.add(pills[0].dataset.filterToggle);
    }
    if (typeof renderInstPicker === 'function') renderInstPicker();
    openModal('modal-add');
  `,
  'tradition picker open': `
    if (typeof renderTradPicker === 'function') renderTradPicker();
    openModal('modal-trad');
  `,
  'tradition picker open, tree expanded': `
    if (typeof renderTradPicker === 'function') renderTradPicker();
    openModal('modal-trad');
    // Expand every visible tree node so leaf-level buttons (Import,
    // Find similar, Add to canvas) render.
    const nodeIds = Array.from(document.querySelectorAll('[data-toggle-tree]')).map(el => el.dataset.toggleTree);
    for (const id of nodeIds) app.treeExpanded.add(id);
    if (typeof renderTradPicker === 'function') renderTradPicker();
  `,
  'recipe stack modal open': `
    // Recipe-stack modal renders nothing without cards on the canvas;
    // its body is "No instruments on the canvas yet" empty-state otherwise.
    addCard('electric_guitar_single_coil', { traditionId: 'outlaw_country' });
    app.selected = app.cards[0].id;
    if (typeof renderRecipeStack === 'function') renderRecipeStack();
    openModal('modal-recipe-stack');
  `,
  'preface just committed with shifts': `
    // Surfaces the shifts panel by running a commit that produces non-empty
    // shifts. delta_blues voice + liturgical reliably yields tuning + room
    // changes via inverseConfigureForPreface (verified empirically). The
    // panel reads from _recentShiftsByCard which commitPrefaceChange populates.
    addCard('voice', { traditionId: 'delta_blues' });
    app.selected = app.cards[0].id;
    app.cards[0]._uiTab = 'preface';
    commitPrefaceChange(app.cards[0], 'liturgical');
  `,
  'instrument picker open, similar drill-down active': `
    // Drill-down mode of the instrument picker — renders similar-instrument
    // cards instead of the family-grouped chip list. Triggered when
    // app.similarInstFor is set to a known instrument id.
    app.similarInstFor = 'voice';
    if (typeof renderInstPicker === 'function') renderInstPicker();
    openModal('modal-add');
  `,
  'saved workspaces list open': `
    // Seed one fixture workspace into the storage mock (installed by RESET
    // since headless Chromium has no window.storage), then open modal-saved
    // and await the async renderSaved. The fixture populates both keys the
    // codex reads: 'codex:list' (the summary list) and 'codex:ws:<id>' (the
    // full workspace payload). Result: one row with Load / Fork / Delete
    // buttons surfaces.
    (async () => {
      await window.storage.set('codex:list', JSON.stringify([
        { key: 'codex:ws:gate-fixture', name: 'Gate Fixture', saved_at: '2026-01-01T00:00:00Z', count: 1 }
      ]));
      await window.storage.set('codex:ws:gate-fixture', JSON.stringify({
        key: 'codex:ws:gate-fixture',
        name: 'Gate Fixture',
        saved_at: '2026-01-01T00:00:00Z',
        cards: [{ id: 'c_fixture', instrumentId: 'voice', parts: {}, chain: {}, traditionId: 'delta_blues' }]
      }));
      openModal('modal-saved');
      await renderSaved();
    })()
  `,
};

// Modal-open preconditions are dynamic (one per modal id). Generator:
function modalOpenSetup(modalId) {
  return `openModal('${modalId}');`;
}

// Resolve a precondition string to its setup snippet. Handles dynamic
// "modal open: <id>" forms.
function resolvePrecondition(spec) {
  if (PRECONDITIONS[spec]) return PRECONDITIONS[spec];
  const mo = spec.match(/^modal open:\s*(\S+)/);
  if (mo) return modalOpenSetup(mo[1]);
  return null; // unknown precondition
}

async function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error(
      'playwright not installed — run: npm install (then: npx playwright install chromium)'
    );
    process.exit(2);
  }
}

async function main() {
  const testHtml = resolveTestableHtml(HTML_PATH);
  if (!fs.existsSync(testHtml)) {
    console.error(`✗ HTML file not found: ${testHtml}`);
    console.error('  Run scripts/build_html.js first.');
    process.exit(2);
  }

  const { entries, errors } = parseInventory('tests/ui_capability_inventory.md');
  if (errors.length) {
    console.error('✗ Inventory parse errors:');
    for (const e of errors) console.error('  ' + e);
    process.exit(2);
  }

  const reachable = entries.filter((e) => e.status === 'reachable');
  console.error(`Checking ${reachable.length} reachable entries against ${testHtml}`);

  // Validate every entry's precondition resolves
  const unknownPreconditions = [];
  for (const e of reachable) {
    if (resolvePrecondition(e.precondition) === null) {
      unknownPreconditions.push(`${e.name}: "${e.precondition}"`);
    }
  }
  if (unknownPreconditions.length) {
    console.error('✗ Unknown preconditions (add to PRECONDITIONS in this script):');
    for (const p of unknownPreconditions) console.error('  ' + p);
    process.exit(2);
  }

  // Group entries by precondition
  const groups = new Map();
  for (const e of reachable) {
    if (!groups.has(e.precondition)) groups.set(e.precondition, []);
    groups.get(e.precondition).push(e);
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  let passes = 0;
  let fails = 0;
  const failures = [];

  // State reset between precondition groups — much cheaper than reloading
  // the 5.7 MB script per group. The reset snippet brings the page back to
  // fresh-boot state (empty workspace, no modals open, no editing flags set).
  const RESET = `
    // Close any open modals
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
    // Reset workspace state
    app.cards = [];
    app.selected = null;
    app.workspaceName = 'Untitled session';
    app.sidebarFilter = '';
    app.collapsedTraditionGroups = new Set();
    app.tradSearch = '';
    app.pickerSearch = '';
    app.similarFor = null;
    app.similarInstFor = null;
    app._dragCardId = null;
    app._dragTraditionId = null;
    app._stapleIdx = 0;
    // Reset transient picker state that some preconditions mutate. Without
    // these, state leaks across groups (filter pills stuck active, tree
    // nodes stuck expanded) — harmless when all groups still resolve, but
    // unsafe to assume Map iteration order.
    if (app.instrumentAxisFilters) app.instrumentAxisFilters.clear();
    if (app.treeExpanded) app.treeExpanded.clear();
    // Install storage mock if not present. Claude.ai provides window.storage
    // as a host API at runtime; the standalone site installs a browser-backed
    // shim (tagged _local_shim) so Save persists in real Chromium. Either way,
    // for gate isolation we swap in a deterministic in-memory mock: treat both
    // "absent" and "our own shim" as replaceable, but NEVER clobber a real
    // host store (no _local_shim / _gate_mock tag) so fixture preconditions
    // can't pollute real data (they only ever write through the mock).
    if (!window.storage || window.storage._local_shim) {
      window.storage = {
        _gate_mock: true,
        _data: new Map(),
        async get(key) { return this._data.has(key) ? { key, value: this._data.get(key), shared: false } : null; },
        async set(key, value, shared) { this._data.set(key, value); return { key, value, shared: !!shared }; },
        async delete(key) { const had = this._data.delete(key); return { key, deleted: had, shared: false }; },
        async list() { return { keys: Array.from(this._data.keys()), prefix: null, shared: false }; },
      };
    } else if (window.storage._gate_mock) {
      window.storage._data.clear();
    }
    if (typeof renderAll === 'function') renderAll();
  `;

  try {
    // One page for the whole check — reloading per group is expensive (5.7 MB
    // script parse per reload). Reset script between groups instead.
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      console.error(`  ! page error: ${err.message}`);
    });
    await page.goto('file://' + testHtml, { waitUntil: 'load' });

    for (const [precondition, groupEntries] of groups) {
      // Reset state, then run precondition setup
      try {
        await page.evaluate(RESET);
      } catch (e) {
        console.error(`✗ state reset failed before "${precondition}": ${e.message}`);
        fails += groupEntries.length;
        for (const ge of groupEntries) failures.push({ entry: ge, reason: 'state reset failed' });
        continue;
      }

      const setup = resolvePrecondition(precondition);
      if (setup && setup.trim()) {
        try {
          await page.evaluate(setup);
        } catch (e) {
          console.error(`✗ Precondition "${precondition}" setup failed: ${e.message}`);
          fails += groupEntries.length;
          for (const ge of groupEntries)
            failures.push({ entry: ge, reason: 'precondition setup failed: ' + e.message });
          continue;
        }
      }

      // Verify each entry in this group
      for (const entry of groupEntries) {
        let result;
        try {
          result = await page.evaluate((sel) => {
            // Some selectors (e.g. 'document', 'n/a') are sentinels for non-DOM
            // surfaces like keyboard shortcuts. They don't resolve to elements;
            // we treat them as always-pass here. The reachability gate's job is
            // DOM presence; keyboard wiring is verified by integration tests.
            if (sel === 'document' || sel === 'n/a' || sel.startsWith('n/a')) return 1;
            // eslint-disable-next-line no-undef -- runs in the browser via page.evaluate
            return document.querySelectorAll(sel).length;
          }, entry.selector);
        } catch {
          result = -1; // invalid selector
        }

        if (result >= 1) {
          passes++;
          if (VERBOSE) console.error(`  ✓ ${entry.name} (${result} matches)`);
        } else {
          fails++;
          const reason =
            result === 0
              ? 'selector resolved to 0 elements'
              : `invalid selector (querySelectorAll threw)`;
          failures.push({ entry, reason });
          console.error(`  ✗ ${entry.name} — ${reason}`);
          console.error(`      selector: ${entry.selector}`);
          console.error(`      surface:  ${entry.surface}`);
          console.error(`      impl:     ${entry.implementation}`);
        }
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

  console.error('');
  console.error(
    `Reachability: ${passes} pass / ${fails} fail (out of ${reachable.length} checked)`
  );
  if (fails > 0) {
    console.error('');
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`  ${f.entry.name}: ${f.reason}`);
    }
    console.error('');
    console.error('Fix the missing surfaces or flip the affected entries to `status: pending`');
    console.error('in tests/ui_capability_inventory.md if the drop is intentional.');
    process.exit(1);
  }
  console.error('UI REACHABILITY: all reachable entries resolve.');
}

main().catch((e) => {
  console.error('✗ Reachability check crashed:', e);
  process.exit(2);
});
