#!/usr/bin/env node
// check_connector_contract.js — the MCP surface is a contract; assert it.
//
// Three promises live here, all read off ONE live listTools()/callTool()
// round-trip against a real in-memory client rather than off a compiled guess:
//
//   published schemas stay representable by a restricted client
// @covers: connector-schema-subset
//   the advertised tool surface and its annotations are what we claim
// @covers: connector-tools-read-only
//   every edit action is visible in the response that reports it
// @covers: connector-edit-visible
//   the derived Gemini declarations carry nothing that client rejects
// @covers: connector-gemini-legal
//   a chain id can be used without guessing which of eight stages takes it
// @covers: chain-id-stage-known
//
// WHY A ROUND-TRIP AND NOT z.toJSONSchema():
// the SDK does not publish what a bare compile produces. It converts through
// mcp/node_modules/@modelcontextprotocol/sdk/.../zod-json-schema-compat.js with
// {target:'draft-7', io:'input'} — draft-07, not draft-2020-12. A gate that
// compiles the schemas itself gates a document the server never sends, which is
// how five separate analyses of this exact code reached conclusions about
// keywords that were not in the advertised output.
//
// CJS so check_promises.js's scripts/*.js scan finds the @covers tags above; it
// reaches the ESM connector through an async import, which resolves zod against
// mcp/node_modules.

const path = require('path');
const { pathToFileURL } = require('url');

let failures = 0;
const check = (label, ok, detail) => {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

// Keywords a restricted function-calling client cannot represent. These are
// STRUCTURAL: they change what shape of argument is legal, so a client that
// drops them sends the wrong thing. Validation refinements (minimum, maximum,
// minItems, exclusiveMinimum) are deliberately NOT here — a client that ignores
// them still sends a well-shaped argument, and the engine re-validates anyway.
const STRUCTURAL = [
  'additionalProperties',
  'propertyNames',
  'patternProperties',
  '$ref',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'dependentSchemas',
];

// The known, justified exceptions. This list may SHRINK freely; anything new
// must be argued for here in writing, which is the point of enumerating them
// rather than loosening STRUCTURAL.
//
//   workspace.cards.items — the workspace is opaque state the model threads
//     back verbatim. Typing the card shape would either strip fields the engine
//     needs (a stripping z.object drops what it does not know) or emit
//     additionalProperties anyway, so the only honest options are an empty node
//     or closing functionality. It stays empty.
//
//     Measured, so this stops being a judgment call anyone re-litigates. A card
//     is {id, instrumentId, parts, tuning, room, chain, traditionId, preface,
//     prefaceAuto, prefaceLock, pinnedParts} — that union is stable across
//     seeding all 2503 traditions and exercising every edit action, and
//     `prefaceLock` appears ONLY after set_preface, which is precisely the field
//     a hand-written type drops on the floor. `pinnedParts` is the same shape of
//     thing: it appears only after set_variant, and it is what makes a pin
//     survive the NEXT edit rather than only the one that set it. Every scalar
//     there is typeable. `chain` is typeable, and is typed (CHAIN_STAGE_IDS,
//     eight named stages).
//
//     `parts` is what makes it impossible: a map from part id to variant id,
//     and the catalog holds 4051 distinct part ids across 1406 instruments.
//     The trick that fixed `chain` — enumerate the stages as named properties
//     derived from the catalog — does not survive four thousand of them, and
//     anything else (z.record, passthrough, catchall) emits the very keywords
//     STRUCTURAL forbids. So the empty node is not a shortcut anyone took; it
//     is the arithmetic. A consumer that cannot read an empty node must carry
//     the workspace itself rather than route it through the model.
//
//   edits.items.chain.additionalProperties — false, from strictObject, and
//     deliberate: a plain z.object silently swallows a typo'd stage, which is
//     the exact silent-failure class the chain validation exists to prevent.
//     One boolean is worth a loud error.
const EXEMPT = new Set([
  'edit_recipe.properties.workspace.properties.cards.items:EMPTY',
  'render_recipe.properties.workspace.properties.cards.items:EMPTY',
  'edit_recipe.properties.edits.items.properties.chain.additionalProperties',
]);

// Exactly the surface we intend to advertise. A tenth tool inflates the schema
// prefix on every request forever, and a vanished tool breaks callers, so the
// set may only change on purpose.
const EXPECTED_TOOLS = [
  'edit_recipe',
  'get_instrument',
  'get_tradition',
  'list_options',
  'list_traditions',
  'render_recipe',
  'search_catalog',
  'search_prefaces',
  'start_recipe',
];

function scanSchema(toolName, schema) {
  const found = [];
  (function walk(node, at, insideProperties) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`, false));
    // Keys directly under `properties` are user-chosen field NAMES, not
    // schema keywords — never flag those.
    if (!insideProperties) {
      for (const key of Object.keys(node)) {
        if (STRUCTURAL.includes(key)) found.push(`${at}.${key}`);
      }
      if (Object.keys(node).length === 0) found.push(`${at}:EMPTY`);
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, `${at}.${key}`, key === 'properties');
    }
  })(schema, toolName, false);
  return found;
}

(async () => {
  const sdk = (m) =>
    import(pathToFileURL(path.join(__dirname, '..', 'mcp', 'node_modules', m)).href);
  const { Client } = await sdk('@modelcontextprotocol/sdk/dist/esm/client/index.js');
  const { InMemoryTransport } = await sdk('@modelcontextprotocol/sdk/dist/esm/inMemory.js');
  const { buildServer } = await import(
    pathToFileURL(path.join(__dirname, '..', 'mcp', 'tools.js')).href
  );

  const server = buildServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'contract-gate', version: '0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  const { tools } = await client.listTools();

  // ── the advertised surface ────────────────────────────────────────────────
  console.log('\n=== Advertised tool surface ===');
  const names = tools.map((t) => t.name).sort();
  check(
    `exactly ${EXPECTED_TOOLS.length} tools advertised`,
    JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS),
    `got ${JSON.stringify(names)}`
  );
  for (const t of tools) {
    const a = t.annotations || {};
    check(
      `${t.name}: readOnly + idempotent + closed-world`,
      a.readOnlyHint === true && a.idempotentHint === true && a.openWorldHint === false,
      JSON.stringify(a)
    );
  }

  // ── schema subset ─────────────────────────────────────────────────────────
  console.log('\n=== Published schema subset (live listTools, draft-07) ===');
  let unexpected = 0;
  let exemptSeen = 0;
  for (const t of tools) {
    for (const hit of scanSchema(t.name, t.inputSchema)) {
      const key = hit.replace(/^([a-z_]+)\./, '$1.');
      if (EXEMPT.has(key)) {
        exemptSeen++;
        continue;
      }
      unexpected++;
      console.log(`  ✗ ${t.name}: ${hit}`);
    }
  }
  check(`no unexempted structural keywords`, unexpected === 0, `${unexpected} found`);
  // Stale exemptions are their own kind of rot: if one stops being needed, the
  // list should lose it rather than quietly cover nothing.
  check(
    `all ${EXEMPT.size} exemptions still apply`,
    exemptSeen === EXEMPT.size,
    `${exemptSeen}/${EXEMPT.size} observed`
  );

  // ── response shape ────────────────────────────────────────────────────────
  console.log('\n=== Response shape ===');
  const call = async (name, args) => {
    const r = await client.callTool({ name, arguments: args });
    return { isError: !!r.isError, text: r.content?.[0]?.text ?? '', type: r.content?.[0]?.type };
  };

  const seeded = await call('start_recipe', { traditions: ['tamil_filmi'] });
  check('start_recipe returns a text block', seeded.type === 'text' && !seeded.isError);
  check('result is single-line JSON (no pretty-print indent)', !seeded.text.includes('\n'));
  let seedPayload = null;
  try {
    seedPayload = JSON.parse(seeded.text);
  } catch {
    // Left null on purpose: the `result parses as JSON` check below reports it.
  }
  check('result parses as JSON', !!seedPayload);
  check(
    'a clean seed carries no `changed` noise',
    (seedPayload?.cards || []).every((c) => !c.changed)
  );

  // ── every edit action is visible ──────────────────────────────────────────
  console.log('\n=== Edit visibility ===');
  const ws = seedPayload.workspace;
  const card = ws.cards[0].id;

  const edited = async (edits) => {
    const r = await call('edit_recipe', { workspace: ws, edits });
    if (r.isError) return { err: r.text };
    return JSON.parse(r.text);
  };

  const envRes = await edited([
    { action: 'set_environment', card, room: 'wooden_barn', chain: { mic: 'ribbon_passive' } },
  ]);
  const envRow = envRes.cards?.find((c) => c.card === card);
  check(
    'set_environment room is reported in `changed`',
    envRow?.changed?.room === 'wooden_barn',
    JSON.stringify(envRow?.changed)
  );
  check(
    'set_environment chain stage is reported in `changed`',
    envRow?.changed?.chain?.mic === 'ribbon_passive',
    JSON.stringify(envRow?.changed)
  );

  const fxRes = await edited([
    { action: 'set_environment', card, chain: { fx: 'fuzz_germanium' } },
  ]);
  const fxRow = fxRes.cards?.find((c) => c.card === card);
  check(
    'a multi-select chain stage is reported as a list, not a string',
    Array.isArray(fxRow?.changed?.chain?.fx) && fxRow.changed.chain.fx[0] === 'fuzz_germanium',
    JSON.stringify(fxRow?.changed?.chain?.fx)
  );

  // Derive a real (card, part, non-default variant) from the catalog rather than
  // naming one. A hardcoded 'guitar' card silently skipped this whole assertion
  // on any tradition without one — a check that quietly does not run is worse
  // than no check, because the row still prints green.
  let variantTarget = null;
  for (const c of ws.cards) {
    const inst = JSON.parse((await call('get_instrument', { id: c.instrumentId })).text);
    for (const p of inst.parts || []) {
      const alt = (p.variants || []).find((v) => !v.default);
      if (alt) {
        variantTarget = { card: c.id, part: p.id, variant: alt.id };
        break;
      }
    }
    if (variantTarget) break;
  }
  check('a non-default variant exists to exercise set_variant', !!variantTarget);
  if (variantTarget) {
    const vRes = await edited([{ action: 'set_variant', ...variantTarget }]);
    const vRow = vRes.cards?.find((c) => c.card === variantTarget.card);
    check(
      'set_variant is reported in `changed.parts`',
      vRow?.changed?.parts?.[variantTarget.part] === variantTarget.variant,
      JSON.stringify(vRow?.changed)
    );
  }

  // set_preface is the action the connector instructions push hardest — every
  // mood word routes through it — and it was the one with no confirmation. It
  // shipped looking covered because a preface usually re-derives parts and the
  // parts diff stood in for it; when it re-derived none, `changed` was absent
  // and the response said "nothing changed" about an edit that landed.
  //
  // The preface id comes from the live search_prefaces round-trip, not a literal
  // and not the local catalog: this gate's whole premise is reading what the
  // server actually serves, and a hardcoded id would rot into a silent no-op the
  // first time the lexicon moved.
  const pfRes = await call('search_prefaces', { query: 'haunted' });
  const prefaceId = pfRes.isError ? null : JSON.parse(pfRes.text).items?.[0]?.id;
  check('search_prefaces yields a preface id to set', !!prefaceId, pfRes.text?.slice(0, 80));
  if (prefaceId) {
    const pRes = await edited([{ action: 'set_preface', card, preface: prefaceId }]);
    const pRow = pRes.cards?.find((c) => c.card === card);
    check(
      'set_preface is reported in `changed`',
      pRow?.changed?.preface === prefaceId,
      JSON.stringify(pRow?.changed)
    );
  }

  // ── the derived Gemini declarations ───────────────────────────────────────
  //
  // The subset scan above asks whether the PUBLISHED schema is representable.
  // This asks the next question, which is the one the chat bar's life depends
  // on: does the document we hand Google actually parse? They are not the same
  // document — the adapter deletes `workspace` and drops every keyword outside
  // Gemini's Schema type — so a schema change can leave the scan above green and
  // still 400 every request. Deriving from `tools` (the live listTools result
  // this gate already holds) is what makes that impossible to miss.
  console.log('\n=== Derived Gemini function declarations ===');
  const { toGeminiDeclarations, scanGeminiIllegal } = await import(
    pathToFileURL(path.join(__dirname, '..', 'mcp', 'gemini_tools.js')).href
  );
  // The literal, NOT the adapter's own WORKSPACE_PROPERTY. Importing that
  // constant made this gate self-consistent instead of correct: point the
  // adapter at a property that does not exist and both sides of the comparison
  // go empty together, so the check agreed with itself while the removal it
  // exists to verify had stopped happening. `workspace` is the name the SERVER
  // publishes — that is the contract, and a contract gate spells it out.
  const WORKSPACE_PROPERTY = 'workspace';
  const { declarations, workspaceTools } = toGeminiDeclarations(tools);
  check(
    `all ${tools.length} tools become declarations`,
    declarations.length === tools.length,
    `${declarations.length}`
  );
  const illegal = scanGeminiIllegal(declarations);
  for (const hit of illegal) console.log(`  ✗ GEMINI-ILLEGAL ${hit}`);
  check(
    'no keyword Gemini rejects survives into the declarations',
    illegal.length === 0,
    `${illegal.length} found`
  );

  // The workspace must be GONE, not merely tolerated. It is the one node that
  // cannot be typed (see EXEMPT above), so if it ever reaches a declaration the
  // adapter has stopped removing it and every call fails at Google.
  const leaked = declarations.filter((d) => d.parameters?.properties?.[WORKSPACE_PROPERTY]);
  check(
    `no declaration exposes \`${WORKSPACE_PROPERTY}\``,
    leaked.length === 0,
    leaked.map((d) => d.name).join(', ')
  );
  // …and the tools that DO take one must still be recognised, or the adapter
  // would silently stop injecting it and every edit would hit an empty recipe.
  const publishWorkspace = tools
    .filter((t) => t.inputSchema?.properties?.[WORKSPACE_PROPERTY])
    .map((t) => t.name)
    .sort();
  check(
    'every workspace-taking tool is flagged for injection',
    JSON.stringify(workspaceTools.slice().sort()) === JSON.stringify(publishWorkspace),
    `${JSON.stringify(workspaceTools)} vs ${JSON.stringify(publishWorkspace)}`
  );

  // ── a chain id is usable, not merely findable ─────────────────────────────
  //
  // Every other id in this catalog is addressed by itself. A chain id is only
  // usable as `chain: {<stage>: <id>}`, so search returning the id alone left a
  // one-in-eight guess at the end of a successful lookup — measured as a 14-call,
  // 93k-token failure loop on a prompt that now resolves in 5 calls.
  console.log('\n=== Chain ids carry the stage that accepts them ===');
  const chainHits = JSON.parse(
    (
      await call('search_catalog', {
        query: 'tape ribbon fuzz underwater',
        types: ['chain'],
        limit: 25,
      })
    ).text
  ).items;
  check('search_catalog returns chain hits to check', chainHits.length > 0, `${chainHits.length}`);
  const sections = JSON.parse((await call('list_options', { kind: 'chain_sections' })).text).items;
  const stageIds = new Set(sections.map((s) => s.id));
  const stageless = chainHits.filter((h) => !h.stage || !stageIds.has(h.stage));
  check(
    'every chain hit names a real stage',
    stageless.length === 0,
    stageless.map((h) => h.id).join(', ')
  );

  // The stage a hit claims must be the stage that actually accepts it — a label
  // that is merely present but wrong is worse than none, because it is believed.
  let stageAccepts = true;
  let stageDetail = '';
  for (const hit of chainHits.slice(0, 6)) {
    const r = await edited([{ action: 'set_environment', card, chain: { [hit.stage]: hit.id } }]);
    if (r.err) {
      stageAccepts = false;
      stageDetail = `${hit.id} → ${hit.stage}: ${r.err}`;
      break;
    }
  }
  check('the stage a hit names is the stage that takes the id', stageAccepts, stageDetail);

  // And the recovery path: a REAL id filed under the wrong stage is the mistake
  // search used to force, so the refusal has to name the stage that would take
  // it rather than say "Unknown" and stop.
  //
  // The pair is SEARCHED FOR rather than named: an id that happens to exist in
  // two stages would be accepted by both, and hardcoding such a pair would print
  // a green row for an assertion that never ran. Finding a pair that genuinely
  // errors is what makes the row mean something.
  let misfiledErr = null;
  let misfiledExpect = null;
  let misfiledLabel = '';
  outer: for (const hit of chainHits) {
    for (const stage of stageIds) {
      if (stage === hit.stage) continue;
      const r = await edited([{ action: 'set_environment', card, chain: { [stage]: hit.id } }]);
      if (r.err) {
        misfiledErr = r.err;
        // Captured here, not re-derived from the label afterwards: looking the
        // hit up again by substring matched whichever OTHER hit's id happened to
        // be a substring of this one, and compared against that one's stage.
        misfiledExpect = hit.stage;
        misfiledLabel = `${stage}:${hit.id} (really ${hit.stage})`;
        break outer;
      }
    }
  }
  check('a misfiled chain id could be exercised at all', !!misfiledErr, 'no rejecting pair found');
  if (misfiledErr) {
    check(
      'a real id in the wrong stage is refused with the stage that would take it',
      misfiledErr.includes(`"${misfiledExpect}" stage`),
      `${misfiledLabel} → ${misfiledErr}`
    );
  }

  // ── a variant id is usable, not merely findable ───────────────────────────
  //
  // The same invariant as the chain block above, for the type that needed it
  // most and did not have it. set_variant takes (card, part, variant), so a
  // variant row without a part is the one-in-4051 version of the chain problem;
  // and because mergeFamilyParts copies the materials table into every string
  // instrument, the old per-tuple rows also repeated one id up to hundreds of
  // times — "mahogany" returned 5,354 rows whose top ten held two distinct ids.
  //
  // Gated here because the chain fix proved the class is real and then this
  // gate only ever checked chains: the invariant was enforced on the type that
  // had already been fixed, and absent on the type still broken.
  console.log('\n=== Variant hits are distinct and carry their parts ===');
  const variantHits = JSON.parse(
    (await call('search_catalog', { query: 'mahogany', types: ['variant'], limit: 25 })).text
  ).items;
  check(
    'search_catalog returns variant hits to check',
    variantHits.length > 0,
    `${variantHits.length}`
  );
  const dupeIds = variantHits.length - new Set(variantHits.map((h) => h.id)).size;
  check('no duplicate variant ids on a page', dupeIds === 0, `${dupeIds} duplicate row(s)`);
  const uncounted = variantHits.filter((h) => !Number.isInteger(h.part_count) || h.part_count < 1);
  check(
    'every variant hit says how many parts accept it',
    uncounted.length === 0,
    uncounted.map((h) => h.id).join(', ')
  );
  // When the row DOES enumerate parts, the list must be the WHOLE list. A
  // truncated list is worse than none: the caller cannot tell that the part
  // their card actually uses was cut, so they pick from a sample and get
  // refused. Either the row answers the question completely or it reports the
  // size and sends the caller to get_instrument — never a plausible-looking
  // prefix.
  const enumerated = variantHits.filter((h) => Array.isArray(h.parts));
  const truncated = enumerated.filter((h) => h.parts.length !== h.part_count);
  check(
    'an enumerated parts list is complete, never a truncated sample',
    truncated.length === 0,
    truncated.map((h) => `${h.id}: ${h.parts.length}/${h.part_count}`).join(', ')
  );

  // ── a borrowed variant says so ────────────────────────────────────────────
  //
  // mergeFamilyParts lends every string material to every string part and every
  // tonewood to every soundbox, deliberately — this catalog synthesizes audio
  // and is not bound by buildability. The consequence is that 96.4% of all
  // (instrument, part, variant) tuples are borrowed rather than authored:
  // 311,908 of 323,709, across 354 instruments.
  //
  // That is fine as a capability and indefensible as an undifferentiated list.
  // get_instrument used to return all 803 of kithara's string variants with
  // `ernie_ball_slinky_bass` and `kithara_gut` shaped identically, so a caller
  // could neither honour the period default nor knowingly override it. The
  // distinction existed in the data and died at the serializer.
  //
  // Gated because it is invisible when it breaks: dropping the flag again would
  // change no count, throw no error, and fail no other check here.
  console.log('\n=== A borrowed variant is marked as one ===');
  const kithara = JSON.parse(
    (await call('get_instrument', { id: 'kithara', part: 'kithara_strings', limit: 6 })).text
  );
  const strings = (kithara.parts || [])[0] || {};
  const vs = strings.variants || [];
  check(
    'the part reports how many variants are curated for this instrument',
    Number.isInteger(strings.curated_count) && strings.curated_count < strings.variant_count,
    `curated_count=${strings.curated_count} variant_count=${strings.variant_count}`
  );
  check(
    'curated variants are listed before borrowed ones',
    vs.length > 1 && !vs[0].borrowed && vs[vs.length - 1].borrowed,
    vs.map((v) => v.id + (v.borrowed ? '[b]' : '')).join(', ')
  );
  check(
    'the borrowed ones carry the flag and the curated ones do not',
    vs.some((v) => v.borrowed) && vs.some((v) => !v.borrowed),
    `${vs.filter((v) => v.borrowed).length} borrowed of ${vs.length} shown`
  );
  const mahogany = JSON.parse(
    (await call('search_catalog', { query: 'mahogany', types: ['variant'], limit: 5 })).text
  ).items;
  check(
    'a search hit separates where it is OFFERED from where it is AUTHORED',
    mahogany.length > 0 &&
      mahogany.every((h) => Number.isInteger(h.instruments) && Number.isInteger(h.curated_for)),
    JSON.stringify(mahogany[0] || null)
  );

  const untouched = envRes.cards?.filter((c) => c.card !== card) || [];
  check(
    'cards nobody edited carry no `changed` key',
    untouched.length > 0 && untouched.every((c) => !c.changed)
  );

  console.log(
    failures === 0
      ? '\nCONNECTOR CONTRACT: PASS — surface, annotations, schema subset and edit visibility all hold.'
      : `\nCONNECTOR CONTRACT: FAIL — ${failures} check(s) above.`
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('\nCONNECTOR CONTRACT: FAIL — gate threw:', e && e.stack ? e.stack : e);
  process.exit(1);
});
