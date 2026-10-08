#!/usr/bin/env node
// Retired tradition ids stay aliases of the tradition they were merged into
// (references/_tradition_aliases.json). This gate holds the promise from every
// side a caller can name a tradition from:
//
//   registry  — an alias is never a live id, its target is live, it is gone from
//               every per-tradition table (records, signatures, pins, review
//               lists, atlas routes and threads), and no retired id is reused;
//   engine    — seeding or searching from an alias is seeding from its survivor;
//   connector — start_recipe, add_tradition, remove_tradition and get_tradition
//               accept the alias and answer for the survivor, and a workspace
//               saved with the retired id on its cards renders as the survivor;
//   browser   — importTradition and Catalog.get resolve it, and the recipe the
//               app compiles is byte-identical to the survivor's.
//
// The static API side (api/traditions/{alias}.json = the survivor's record plus
// merged_from, the alias maps in the index files) is checked by check_api.js.
'use strict';
// @covers: retired-ids-resolve
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const C = require('./_loader.js');
const { seedTraditionCards, renderWorkspace } = require('./_seed_workspace.js');
const { seedFromTradition } = require('./search.js');
const { loadApp } = require('./_load_app.js');

const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const aliases = C.TRADITION_ALIASES;
const ids = Object.keys(aliases).sort();
const live = new Set(C.TRADITIONS.map((t) => t.id));
assert(ids.length > 0, 'empty alias registry');

async function main() {
  const E = await import('../mcp/engine.js');

  // ── registry ──
  const geo = json('data/geo.json');
  const meta = json('data/geo-meta.json');
  const sigs = json('references/_tradition_signatures.json');
  const routes = json('data/routes.json').routes;
  const threads = json('data/threads.json').threads;
  const reviewed = new Set([...(meta.reviewed || []), ...(meta.verified || [])]);
  const routeEnds = new Set(routes.flatMap((r) => [r.a, r.b]).filter((x) => typeof x === 'string'));
  const stops = new Set(threads.flatMap((t) => t.stops));
  for (const id of ids) {
    const a = aliases[id];
    assert(!live.has(id), `${id}: retired id is also a live tradition`);
    assert(live.has(a.of), `${id}: merged into "${a.of}", which is not a live tradition`);
    assert(typeof a.name === 'string' && a.name, `${id}: alias has no name`);
    assert(['same', 'slice'].includes(a.verdict), `${id}: verdict "${a.verdict}"`);
    assert.equal(C.resolveTraditionId(id), a.of, `${id}: resolver`);
    assert(!(id in C.TRADITION_EXTRAS), `${id}: still has an extras record`);
    assert(!(id in geo), `${id}: still pinned in data/geo.json`);
    assert(!(id in sigs), `${id}: still has a signature`);
    assert(!reviewed.has(id), `${id}: still on the geo-meta review lists`);
    assert(!routeEnds.has(id), `${id}: still an atlas route endpoint`);
    assert(!stops.has(id), `${id}: still an atlas thread stop`);
  }
  assert.equal(C.resolveTraditionId('__not_a_tradition__'), '__not_a_tradition__');

  // ── engine and connector, every alias ──
  const strip = (cards) => cards.map(({ id: _id, ...rest }) => rest);
  let connector = 0;
  for (const id of ids) {
    const of = aliases[id].of;
    assert.deepEqual(strip(seedTraditionCards(id)), strip(seedTraditionCards(of)), `${id}: seed`);
    assert.deepEqual(seedFromTradition(id), seedFromTradition(of), `${id}: search seed`);
    assert.equal(
      E.startRecipe({ traditions: [id] }).recipe,
      E.startRecipe({ traditions: [of] }).recipe,
      `${id}: start_recipe`
    );
    const t = E.getTradition({ id });
    assert.equal(t.id, of, `${id}: get_tradition id`);
    assert.equal(t.merged_from, id, `${id}: get_tradition merged_from`);
    connector++;
  }

  // Edits and saved workspaces, on a sample (the code path is shared).
  for (const id of ids.slice(0, 12)) {
    const of = aliases[id].of;
    const base = E.startRecipe({ traditions: ['afrobeat'] });
    const added = E.editRecipe({
      workspace: base.workspace,
      edits: [{ action: 'add_tradition', tradition: id }],
    });
    assert(
      added.workspace.cards.some((c) => c.traditionId === of),
      `${id}: add_tradition seeds ${of}`
    );
    const removed = E.editRecipe({
      workspace: added.workspace,
      edits: [{ action: 'remove_tradition', tradition: id }],
    });
    assert(!removed.workspace.cards.some((c) => c.traditionId === of), `${id}: remove_tradition`);
    assert.throws(
      () => E.startRecipe({ traditions: [id, of] }),
      /more than once/,
      `${id}: alias and survivor together must be refused as a repeat`
    );
    const seeded = E.startRecipe({ traditions: [of] });
    const saved = seeded.workspace.cards.map((c) => ({ ...c, traditionId: id }));
    assert.equal(
      E.renderRecipe({ workspace: { cards: saved } }).recipe,
      seeded.recipe,
      `${id}: a workspace saved with the retired id renders as ${of}`
    );
  }

  // ── browser ──
  const app = loadApp();
  let browser = 0;
  for (const id of ids) {
    const of = aliases[id].of;
    assert.equal(app.Catalog.resolve(id), of, `${id}: Catalog.resolve`);
    assert.equal(app.Catalog.get(id).id, of, `${id}: Catalog.get`);
    app.app.cards = [];
    app.app.collapsedTraditionGroups = new Set();
    app.importTradition(id);
    const viaAlias = app.compileRecipeStack(app.app.cards, 'rich', {});
    assert(
      app.app.cards.every((c) => c.traditionId === of),
      `${id}: app cards carry ${of}`
    );
    app.app.cards = [];
    app.app.collapsedTraditionGroups = new Set();
    app.importTradition(of);
    assert.equal(viaAlias, app.compileRecipeStack(app.app.cards, 'rich', {}), `${id}: app recipe`);
    assert.equal(
      viaAlias,
      renderWorkspace(seedTraditionCards(of), { format: 'rich' }),
      `${id}: app ≡ connector`
    );
    browser++;
  }

  console.log(
    `TRADITION ALIASES: PASS — ${ids.length} retired ids into ${new Set(ids.map((i) => aliases[i].of)).size} survivors; ` +
      `${connector} connector and ${browser} browser resolutions match their survivor.`
  );
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
