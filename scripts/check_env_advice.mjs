#!/usr/bin/env node
// check_env_advice.mjs — following ENVIRONMENT_NOT_RENDERED's advice ends it,
// in every tradition where the warning can be raised.
//
// ENVIRONMENT_NOT_RENDERED says a setting a set_environment wrote on a card the
// environment does not render from does not set the rendered environment, and
// advises "Repeat the edit without `card`". A warning whose advice, followed
// exactly, never clears it is a defect: before the settle rule 236 of 236
// reachable traditions in a sample looped (#671, BB8 6685465828 point 1). The
// settle rule (settleEnvRecords in scripts/_workspace_ops.js) ends it; this
// shows it over the whole catalog, where mcp/test_session_repairs.mjs shows it
// on every surface for one tradition.
//
// For every tradition with a second card, through the connector engine
// (mcp/engine.js, which every surface runs). The field written rotates over
// room, tuning, a single-select chain stage and fx, so the catalog covers each
// kind in each scenario:
//
//   misdirected  set_environment with `card` on a card that is not the
//                environment card (ENVIRONMENT_NOT_RENDERED, `edit` 0); then the
//                advice: the same edit without `card`.
//   moved        a set_environment without `card` (on the environment card),
//                then another card moved to the front, so what it wrote is left
//                on a card that no longer renders (a standing
//                ENVIRONMENT_NOT_RENDERED on that edit, with ENVIRONMENT_MOVED
//                unless the new environment card holds the same value: the
//                sequence that looped); then the advice both give, the
//                set_environment again without `card`.
//
// Every 16th of them also runs the documented order the loop was found in
// (set_preface on every card before the set_environment) and a render_recipe in
// all four formats after the advice. A render's warning is the same function of
// the workspace the edit response's is (only `edit` comes from the call), so the
// rest stop at the edit response; the edits use the compact format, the
// cheapest, since the warning does not depend on the format.
//
// A case is reachable when its first step raises the warning with that advice.
// The check fails if a reachable case still warns after the advice, if the
// documented order warns at all, or if a scenario reached too few traditions to
// mean anything. Full catalog: about two and a half minutes on one core.
//
// Usage: node scripts/check_env_advice.mjs [--limit=N]   (first N traditions)
// Exit 0 when no case loops, 1 otherwise.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('./_loader.js');
const W = require('./_workspace_ops.js');
const { envCardOf } = require('./_recipe_stack.js');
const E = await import('../mcp/engine.js');

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const SAMPLE = 16;
const FORMATS = ['rich', 'tags', 'prose', 'compact'];
const NR = 'ENVIRONMENT_NOT_RENDERED';
const ADVICE = 'Repeat the edit without `card`';
const unrendered = (r) => r.render_warnings.filter((w) => w.code === NR);
const edit = (workspace, edits) => E.editRecipe({ workspace, edits, format: 'compact' });

const sections = C.CHAIN_SECTIONS || [];
const single = sections.find((s) => !s.multiSelect && (s.items || []).length > 1);
const multi = sections.find((s) => s.multiSelect && (s.items || []).length > 1);
const ids = (list) => (list || []).map((x) => x.id);
// A value other than the card's own, so every write is a change (a write of the
// same value is a write too, but a change is what a caller asking for one means).
const other = (list, now) => list.find((id) => id !== now);
const KINDS = [
  ['room', (c) => ({ room: other(ids(C.ROOMS), c.room) })],
  ['tuning', (c) => ({ tuning: other(ids(C.TUNINGS), c.tuning) })],
  [
    single.id,
    (c) => ({ chain: { [single.id]: other(ids(single.items), (c.chain || {})[single.id]) } }),
  ],
  [
    multi.id,
    (c) => ({
      chain: { [multi.id]: other(ids(multi.items), ((c.chain || {})[multi.id] || [])[0]) },
    }),
  ],
];
// The edit's own fields as W.setEnvironment takes them.
const patchOf = ({ room, tuning, chain }) => ({ room, tuning, chain });

const tally = {};
const bump = (k) => (tally[k] = (tally[k] || 0) + 1);
const loops = [];
const t0 = Date.now();
let multiCard = 0;

const traditions = C.TRADITIONS.map((t) => t.id).slice(0, LIMIT);
for (const [n, t] of traditions.entries()) {
  const ws = W.seed([t]);
  if (ws.cards.length < 2) continue;
  const sampled = multiCard++ % SAMPLE === 0;
  const env = envCardOf(ws.cards);
  const x = ws.cards.find((c) => c.id !== env.id);
  const [kind, patch] = KINDS[n % KINDS.length];
  const looped = (scenario, ...rs) => {
    const left = rs.flatMap(unrendered);
    if (!left.length) return;
    bump(`${scenario}.LOOPED`);
    loops.push({ tradition: t, scenario, warnings: left });
  };

  // misdirected: the write with `card`, then the same edit without it.
  const write = { action: 'set_environment', card: x.id, ...patch(x) };
  const wrote = edit(ws, [write]);
  const raised = unrendered(wrote).filter((w) => w.card === x.id);
  if (raised.length && raised.every((w) => w.edit === 0 && w.meaning.includes(ADVICE))) {
    const scenario = `misdirected ${kind}`;
    bump(`${scenario}.reachable`);
    const { card: _card, ...advice } = write;
    const followed = edit(wrote.workspace, [advice]);
    const renders = sampled
      ? FORMATS.map((format) => E.renderRecipe({ workspace: followed.workspace, format }))
      : [];
    looped(scenario, followed, ...renders);
  } else bump(`misdirected ${kind}.unreachable`);

  // moved: written on the environment card, another card to the front, then
  // the advice. Sampled: in the documented order, set_preface on every card first.
  const set = { action: 'set_environment', ...patch(env) };
  let written;
  if (sampled) {
    const ordered = edit(ws, [
      ...ws.cards.map((c) => ({ action: 'set_preface', card: c.id, preface: 'drowning' })),
      set,
    ]);
    bump('documented order.ran');
    if (unrendered(ordered).length) {
      bump('documented order.WARNED');
      loops.push({ tradition: t, scenario: 'documented order', warnings: unrendered(ordered) });
    }
    written = ordered.workspace;
  } else written = W.setEnvironment(ws, null, patchOf(set));
  const front = edit(written, [{ action: 'move_instrument', card: x.id }]);
  const left = unrendered(front).filter((w) => w.card === env.id);
  const scenario = `moved ${kind}`;
  if (
    front.render_scope.environment_card !== env.id &&
    left.length === 1 &&
    !('edit' in left[0]) &&
    left[0].meaning.includes(ADVICE)
  ) {
    bump(`${scenario}.reachable`);
    // ENVIRONMENT_MOVED too, unless the card now in front holds the same value.
    if (front.render_warnings.some((w) => w.code === 'ENVIRONMENT_MOVED' && w.card === env.id))
      bump(`${scenario}.moved`);
    const followed = edit(front.workspace, [set]);
    const renders = sampled
      ? FORMATS.map((format) => E.renderRecipe({ workspace: followed.workspace, format }))
      : [];
    looped(scenario, followed, ...renders);
  } else bump(`${scenario}.unreachable`);
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `${traditions.length} tradition(s), ${multiCard} with a second card (${secs}s). Following ENVIRONMENT_NOT_RENDERED's advice:`
);
const scenarios = ['misdirected', 'moved'].flatMap((s) => KINDS.map(([k]) => `${s} ${k}`));
for (const s of scenarios)
  console.log(
    `  ${s.padEnd(20)} ${String(tally[`${s}.reachable`] || 0).padStart(5)} reachable, ` +
      `${tally[`${s}.LOOPED`] || 0} still warned after it` +
      (s.startsWith('moved') ? ` (${tally[`${s}.moved`] || 0} with ENVIRONMENT_MOVED) ` : ' ') +
      `(${tally[`${s}.unreachable`] || 0} not reachable)`
  );
console.log(
  `  documented order     ${String(tally['documented order.ran'] || 0).padStart(5)} sampled, ` +
    `${tally['documented order.WARNED'] || 0} warned`
);
for (const l of loops.slice(0, 5)) console.log('  ✗', JSON.stringify(l).slice(0, 400));

// A scenario that reached almost nothing proves nothing. On the full catalog
// each one reaches over 1,500 traditions; a --limit run scales the floor.
const floor = Math.min(500, Math.floor(multiCard / KINDS.length / 2));
const thin = scenarios.filter((s) => (tally[`${s}.reachable`] || 0) < floor);
if (thin.length || !tally['documented order.ran']) {
  console.log(
    `\nENV ADVICE: FAIL — too few cases reached in ${thin.join(', ') || 'the sample'} (floor ${floor}).`
  );
  process.exit(1);
}
if (loops.length) {
  console.log(`\nENV ADVICE: FAIL — ${loops.length} case(s) still warn.`);
  process.exit(1);
}
console.log(
  '\nENV ADVICE: PASS — in every reachable case, repeating the edit without `card` ends ENVIRONMENT_NOT_RENDERED.'
);
