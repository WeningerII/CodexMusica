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
