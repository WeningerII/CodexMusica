#!/usr/bin/env node
// check_rest_parity.js — the REST adapter and the MCP connector answer the same,
// and REFUSE the same.
//
// @covers: adapter-parity
//
// WHY BOTH HALVES. Proving two adapters agree on RESULTS is the obvious gate and
// the insufficient one. engine.js validates nothing — it trusts its caller — so
// the only thing standing between a malformed argument and the renderer is the
// Zod check each adapter runs at its own edge. If REST were to drop that check,
// results parity would still pass on every well-formed request while
// `format: "RICH"` quietly rendered prose (358 chars where "rich" gives 998) and
// `max_chars: -1` returned 26. That is the same shape as the bug where the
// compact format silently dropped the room the user asked for: a confident wrong
// answer, no error. So this gate asserts REJECTION parity too — a request one
// adapter refuses, the other must refuse.
//
// The third assertion has nothing to do with adapters. The REST edit grammar uses
// ';' and '=' as delimiters, which is only safe because no catalog id contains a
// URL delimiter. That is a measured property of today's data, not a law, so it is
// re-measured here against the live catalog: the day someone mints an id with a
// comma in it, this fails loudly instead of the URLs failing quietly.
//
// Usage: node scripts/check_rest_parity.js [--verbose]
// Exit 0 if every pair agrees, 1 otherwise.

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

// The adapters are ES modules; run the comparison in one child so both load once.
const script = `
import * as E from '${path.join(ROOT, 'mcp', 'engine.js')}';
import { TOOL_SCHEMAS } from '${path.join(ROOT, 'mcp', 'tools.js')}';
import { handleRecipe, handleCatalog, handleRecord, parseEdit, formatEdit, RestError } from '${path.join(ROOT, 'mcp', 'rest.js')}';
import C from '${path.join(ROOT, 'scripts', '_loader.js')}';

const req = { headers: { host: 'x' }, protocol: 'http', originalUrl: '/', query: {} };
const results = { pass: 0, fail: 0, notes: [] };
const fail = (what, detail) => { results.fail++; results.notes.push('FAIL ' + what + ' :: ' + detail); };
const pass = (what) => { results.pass++; if (${VERBOSE}) results.notes.push('ok   ' + what); };

// ── 1. RESULTS PARITY ────────────────────────────────────────────────────────
// Same request through both adapters must produce the same recipe string.
const CASES = [
  { t: ['delta_blues'], e: [] },
  { t: ['country'], e: ['set_preface;card=voice;preface=worn'] },
  { t: ['country'], e: ['set_preface;card=voice;preface=worn', 'set_environment;card=voice;room=carpeted_bedroom'] },
  { t: ['afrobeat'], e: ['add_instrument;instrument=trumpet'] },
  { t: ['detroit_techno','industrial'], e: ['set_preface;card=voice;preface=bitter'] },
  { t: ['gagaku'], e: ['set_environment;card=voice;tuning=twelve_tet'] },
  { t: ['qawwali'], e: ['remove_instrument;card=voice'] },
  { t: ['fado'], e: ['add_tradition;tradition=chanson_classique'] },
];
// Compare OUTCOMES, not just successes. A case both adapters refuse is agreement
// and must be asserted as such — bailing out when REST throws would silently
// shrink the gate to whatever happens to succeed, which is how a parity check
// ends up proving nothing. (Some fixtures deliberately reference a card the
// tradition does not have: gagaku and qawwali carry no \`voice\` card.)
const outcome = (fn) => {
  try { return { ok: true, value: fn() }; }
  catch (err) { return { ok: false, error: (err && err.message) || String(err) }; }
};
for (const fmt of ['rich', 'tags', 'prose', 'compact']) {
  for (const c of CASES) {
    const label = 'results ' + fmt + ' ' + c.t.join('+') + ' [' + c.e.length + ' edits]';
    const rest = outcome(() =>
      handleRecipe({ ...req, query: {} }, { traditions: c.t.join(','), edit: c.e, format: fmt }).recipe);
    const mcp = outcome(() => {
      const seed = E.startRecipe({ traditions: c.t, format: fmt });
      return c.e.length === 0 ? seed.recipe
        : E.editRecipe({ workspace: seed.workspace, edits: c.e.map((s, i) => parseEdit(s, i)), format: fmt }).recipe;
    });
    if (rest.ok !== mcp.ok) {
      fail(label, 'REST ' + (rest.ok ? 'succeeded' : 'threw') + ' but MCP ' + (mcp.ok ? 'succeeded' : 'threw') +
        ' :: ' + (rest.error || mcp.error));
    } else if (!rest.ok) {
      // Both refused. The MESSAGES must match too, or one adapter is explaining
      // a different problem than the other for the same input.
      if (rest.error === mcp.error) pass(label + ' (both refuse, same reason)');
      else fail(label, 'both refused but differently: REST "' + rest.error + '" vs MCP "' + mcp.error + '"');
    } else if (rest.value === mcp.value) pass(label);
    else fail(label, 'REST ' + rest.value.length + ' chars != MCP ' + mcp.value.length + ' chars');
  }
}

// ── 2. REJECTION PARITY ──────────────────────────────────────────────────────
// A value one adapter refuses, the other must refuse. These are exactly the
// inputs engine.js accepts and mis-renders when nothing validates.
const BAD = [
  { tool: 'start_recipe', args: { traditions: ['country'], format: 'RICH' },   q: { traditions: 'country', format: 'RICH' } },
  { tool: 'start_recipe', args: { traditions: ['country'], format: 'bogus' },  q: { traditions: 'country', format: 'bogus' } },
  { tool: 'start_recipe', args: { traditions: ['country'], format: '' },       q: { traditions: 'country', format: '' } },
  { tool: 'start_recipe', args: { traditions: ['country'], max_chars: 0 },     q: { traditions: 'country', max_chars: '0' } },
  { tool: 'start_recipe', args: { traditions: ['country'], max_chars: -1 },    q: { traditions: 'country', max_chars: '-1' } },
  { tool: 'start_recipe', args: { traditions: ['country'], max_chars: 99999 }, q: { traditions: 'country', max_chars: '99999' } },
  { tool: 'start_recipe', args: { traditions: [] },                            q: { traditions: '' } },
];
for (const b of BAD) {
  const label = 'rejection ' + JSON.stringify(b.q);
  const mcpRejects = !TOOL_SCHEMAS[b.tool].safeParse(b.args).success;
  let restRejects = false;
  try { handleRecipe({ ...req, query: b.q }, b.q); } catch { restRejects = true; }
  if (mcpRejects === restRejects && mcpRejects) pass(label);
  else if (mcpRejects !== restRejects)
    fail(label, 'MCP ' + (mcpRejects ? 'rejects' : 'ACCEPTS') + ' but REST ' + (restRejects ? 'rejects' : 'ACCEPTS'));
  else fail(label, 'neither adapter rejected it — engine.js would render it silently');
}

// ── 3. THE DELIMITER PRECONDITION ────────────────────────────────────────────
// The edit grammar is only unambiguous while no id contains a URL delimiter.
const ids = new Set();
const add = (x) => { if (typeof x === 'string' && x) ids.add(x); };
for (const t of C.TRADITIONS || []) add(t.id);
for (const i of C.INSTRUMENTS || []) { add(i.id);
  for (const p of i.parts || []) { add(p.id); for (const v of p.variants || []) add(v.id); } }
for (const r of C.ROOMS || []) add(r.id);
for (const t of C.TUNINGS || []) add(t.id);
for (const p of C.PREFACE_LEXICON || []) add(p.id);
for (const s of C.CHAIN_SECTIONS || []) { add(s.id); add(s.stage); for (const it of s.items || []) add(it.id); }
for (const a of C.ARRANGEMENTS || []) add(a.id);
for (const a of C.PRODUCTION_AESTHETICS || []) add(a.id);
for (const a of C.CHAIN_ARCHETYPES || []) add(a.id);
const offenders = [...ids].filter((id) => /[;,=&?#+%\\s]/.test(id));
if (offenders.length === 0) pass('delimiter precondition (' + ids.size + ' ids clean)');
else fail('delimiter precondition',
  offenders.length + ' id(s) contain a URL delimiter and would break the edit grammar: ' + offenders.slice(0, 5).join(', '));

// ── 4. ROUND TRIP ────────────────────────────────────────────────────────────
// Anything the parser accepts must re-serialise to something the parser accepts
// and that means the same thing — otherwise the canonical URL in \`self\` is a lie.
const FORMS = [
  'set_preface;card=voice;preface=worn',
  'set_preface,card=voice,preface=worn',
  'set_variant;card=pedal_steel;part=pedal_steel_strings;variant=nickel_wound',
  'set_environment;card=voice;room=carpeted_bedroom;chain.mic=sm57',
  'add_instrument;instrument=trumpet;tradition=afrobeat',
];
// Compare CONTENT, not key order. formatEdit emits a fixed field order so the
// canonical URL is stable; parseEdit records fields in encounter order. Those
// differ as objects and are identical as edits, which is what matters.
const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
for (const f of FORMS) {
  const once = parseEdit(f, 0);
  const twice = parseEdit(formatEdit(once), 0);
  if (norm(once) === norm(twice)) pass('round trip ' + f.slice(0, 40));
  else fail('round trip ' + f, norm(once) + ' != ' + norm(twice));
}

// ── 5. DISCOVERY SURFACES RESOLVE ────────────────────────────────────────────
try {
  const cat = handleCatalog({ ...req, query: {} }, { q: 'country', type: 'tradition' });
  if ((cat.items || []).length > 0) pass('catalog search returns items'); else fail('catalog search', 'no items');
  const rec = handleRecord({ ...req, query: {} }, 'instrument', 'voice');
  if ((rec.parts || []).length > 0) pass('record lookup returns parts'); else fail('record lookup', 'no parts');
} catch (err) { fail('discovery', err.message); }

console.log(JSON.stringify(results));
`;

let out;
try {
  out = execFileSync('node', ['--input-type=module', '-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (e) {
  console.error('=== REST/MCP adapter parity ===');
  console.error(
    'FAIL — the comparison harness itself did not run:\n' + (e.stdout || '') + (e.stderr || '')
  );
  process.exit(1);
}

const line = out.trim().split('\n').pop();
const results = JSON.parse(line);

console.log('=== REST/MCP adapter parity ===');
for (const n of results.notes) console.log('  ' + n);
console.log(`  ${results.pass} assertion(s) passed, ${results.fail} failed`);

// Refuse to pass vacuously: a harness that asserted nothing would otherwise mint
// a green result, which is exactly the failure class this repo keeps finding.
if (results.pass === 0) {
  console.error('FAIL — no assertions ran; refusing to pass vacuously');
  process.exit(1);
}
if (results.fail > 0) {
  console.error(
    'FAIL — REST and MCP disagree. They share engine.js and TOOL_SCHEMAS; a divergence'
  );
  console.error(
    '       means one adapter is validating or dispatching differently from the other.'
  );
  process.exit(1);
}
console.log('PASS — both adapters agree on what they answer AND on what they refuse.');
process.exit(0);
