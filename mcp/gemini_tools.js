// gemini_tools.js — turn the LIVE MCP tool list into Gemini function declarations.
//
// Pure: no SDK, no network, no zod. It takes the array `client.listTools()`
// returned and gives back declarations. That direction matters. The SDK does not
// publish what `z.toJSONSchema()` produces — it converts through
// zod-json-schema-compat with {target:'draft-7', io:'input'} — so a module that
// compiled the schemas itself would be adapting a document the server never
// sends. check_connector_contract.js already reads the wire; this reads the same
// wire, and the gate feeds this module the very tools array it just scanned.
//
// TWO EDITS ARE MADE TO THE PUBLISHED SCHEMA, both deliberate:
//
// 1. `workspace` IS REMOVED ENTIRELY (see WORKSPACE_PROPERTY below).
// 2. Everything outside GEMINI_KEYS is dropped, which is what takes
//    `additionalProperties: false` off `edit_recipe`'s `chain`.
//
//    That boolean exists server-side because `chain` is a strictObject: a plain
//    z.object silently swallows a typo'd stage, so `{"mick": "<id>"}` would
//    reach the engine as `{}`. Removing the keyword from the DECLARATION does
//    not remove the strictObject — the server still throws "Unrecognized key",
//    loudly, on the call. All that is lost is Gemini seeing the rule in advance,
//    which is the ordinary convention for this ecosystem.

// The property every recipe tool takes and no model ever writes.
//
// The workspace is a part-id → variant-id map over 4051 distinct part ids across
// 1406 instruments. It cannot be typed — the trick that fixed `chain` (name the
// stages, all eight of them, from the catalog) does not survive four thousand
// part ids, and z.record / passthrough / catchall each emit a keyword Gemini
// rejects. The arithmetic is written out in check_connector_contract.js's EXEMPT
// list. On the wire it is therefore an empty node, `items: {}`, and an empty node
// is itself illegal for Gemini.
//
// So it is not reformatted, it is REMOVED: the adapter (gemini_agent.js) keeps
// the workspace the last recipe call returned and injects it into the next
// outbound edit_recipe / render_recipe. The model neither emits nor reads it.
// This deletes the illegal node rather than negotiating with it, spends fewer
// tokens than any encoding of it would, and makes a corrupted workspace
// impossible — the model cannot mangle a value it never touches.
//
// KNOWN LIMITATION: last-write-wins. One workspace is held per conversation, so
// the model cannot branch — it cannot hold two recipes side by side and edit
// them alternately, because the second start_recipe overwrites the first. Every
// prompt in the probe suite is a single recipe, and the chat bar builds one
// recipe per conversation, so nothing today needs branching. A content-addressed
// handle store would lift the limit and is deliberately NOT built: it would
// break `connector-tools-read-only` ("nothing is stored server-side… no handle
// to hold"), which is a promise gated in CI, not a preference.
export const WORKSPACE_PROPERTY = 'workspace';

// The second carried property, and the same argument one tool over (2026-08-28).
//
// `lyric_revise`'s `state` is the deferred-run record — measured at ~262KB on a
// real 28-line run. The MCP contract says THE CALLER CARRIES IT, and on this
// path the caller is the chat model: the blob would come back in a tool result
// and have to be RE-EMITTED VERBATIM as a function argument on the next call.
// That is ~65k output tokens through an agent whose maxOutputTokens is 2,048 —
// structurally impossible before any question of model quality, and at
// $1.50/M output tokens it would cost more than the whole turn's allowance
// even if it fit. So it takes the workspace treatment: removed from the
// declaration, carried in the signed envelope by the adapter, injected on the
// way out, harvested and hidden on the way back. The model types only
// `answer`, which is bounded at 4,000 chars and fits every cap.
//
// KNOWN LIMITATION, inherited from the workspace: last-write-wins, one revise
// run per conversation. The injection is keyed on the SEED (a different seed
// is a different song, so a fresh run starts clean), but two interleaved runs
// of the SAME seed cannot be held apart. Nothing today needs that.
export const STATE_PROPERTY = 'state';

// The keys Gemini's Schema type accepts. An ALLOWLIST, not a denylist: a
// denylist has to be updated every time the SDK learns a new keyword, and the
// failure mode of forgetting is an opaque 400 from Google at runtime. Forgetting
// to allow a key, by contrast, just drops a hint the engine re-validates anyway.
//
// Absent on purpose, though Gemini nominally accepts it: `anyOf`. Our schemas
// emit none, function-calling support for it has been unreliable, and leaving it
// out means the scan below can treat it as a hard error.
const GEMINI_KEYS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
  'default',
  'propertyOrdering',
]);

// Keywords that make Gemini reject the whole request. `additionalProperties` is
// here even though `false` is what our schema carries: the adapter strips it, so
// seeing one on the far side means the strip failed.
export const GEMINI_FORBIDDEN = [
  'additionalProperties',
  'propertyNames',
  'patternProperties',
  '$ref',
  '$defs',
  '$schema',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'const',
  'dependentSchemas',
];

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Recursively keep only GEMINI_KEYS. Returns null for a node that ends up empty,
// so the caller can drop the property rather than publish `{}` — Gemini rejects
// an empty schema node, and an empty node describes nothing anyway.
function sanitize(node) {
  if (!isPlainObject(node)) return null;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (!GEMINI_KEYS.has(key)) continue;
    if (key === 'properties') {
      const props = {};
      for (const [name, child] of Object.entries(value || {})) {
        const clean = sanitize(child);
        if (clean) props[name] = clean;
      }
      if (Object.keys(props).length) out.properties = props;
      continue;
    }
    if (key === 'items') {
      const clean = sanitize(value);
      // An `items` with no surviving type is exactly the workspace-shaped hole
      // this module exists to avoid publishing. Signal it rather than emit it.
      if (!clean || !clean.type) return null;
      out.items = clean;
      continue;
    }
    out[key] = value;
  }
  // `required` may only name properties that still exist. Anything else points
  // Gemini at a field it cannot see, which is a 400.
  if (Array.isArray(out.required)) {
    const kept = out.required.filter((name) => out.properties && out.properties[name]);
    if (kept.length) out.required = kept;
    else delete out.required;
  }
  // An object with no properties left carries no information; treat it as empty.
  if (out.type === 'object' && !out.properties) return null;
  return Object.keys(out).length ? out : null;
}

// Appended to the description of any tool whose workspace we hold, so the model
// is told why the parameter it might expect is missing. Without it, a model that
// knows the MCP surface can decide the call is malformed and refuse to make it.
const WORKSPACE_NOTE =
  ' The recipe state is carried for you automatically — there is no workspace parameter to pass. ' +
  'Call start_recipe once first; every later call operates on that same recipe.';

// Same sentence, other family. Without it a model that read the server's own
// instructions ("pass `state` back VERBATIM") would conclude the declaration is
// broken and refuse the call — the instructions describe the MCP contract, and
// on this path the adapter fulfils that contract on the model's behalf.
const STATE_NOTE =
  ' The revise state is carried for you automatically — there is no state parameter to pass. ' +
  'Keep seed and the other declarations identical across one song’s calls, and put your ' +
  'proposal in `answer`.';

/**
 * @param {Array<{name:string,description?:string,inputSchema?:object}>} tools
 *   Exactly what `client.listTools()` returned.
 * @returns {{declarations: Array<object>, workspaceTools: string[], stateTools: string[]}}
 *   `workspaceTools` and `stateTools` are derived, not listed: whichever tools
 *   published a top-level `workspace` (or `state`) are the ones the adapter
 *   must inject it into. A tenth tool that takes one is handled without
 *   editing this file.
 */
export function toGeminiDeclarations(tools) {
  const declarations = [];
  const workspaceTools = [];
  const stateTools = [];
  for (const tool of tools) {
    const schema = tool.inputSchema || {};
    const takesWorkspace = !!(schema.properties && schema.properties[WORKSPACE_PROPERTY]);
    if (takesWorkspace) workspaceTools.push(tool.name);
    const takesState = !!(schema.properties && schema.properties[STATE_PROPERTY]);
    if (takesState) stateTools.push(tool.name);

    const stripped = isPlainObject(schema) ? { ...schema } : {};
    if (takesWorkspace || takesState) {
      stripped.properties = { ...stripped.properties };
      if (takesWorkspace) delete stripped.properties[WORKSPACE_PROPERTY];
      if (takesState) delete stripped.properties[STATE_PROPERTY];
      if (Array.isArray(stripped.required)) {
        stripped.required = stripped.required.filter(
          (n) =>
            !(takesWorkspace && n === WORKSPACE_PROPERTY) && !(takesState && n === STATE_PROPERTY)
        );
      }
    }
    const parameters = sanitize(stripped);
    declarations.push({
      name: tool.name,
      description:
        (tool.description || '') +
        (takesWorkspace ? WORKSPACE_NOTE : '') +
        (takesState ? STATE_NOTE : ''),
      // A tool whose every parameter was stripped gets no `parameters` key at
      // all — Gemini rejects `{"type":"object"}` with no properties.
      ...(parameters ? { parameters } : {}),
    });
  }
  return { declarations, workspaceTools, stateTools };
}

/**
 * Find everything Gemini would reject in a declaration set. Used by the contract
 * gate, so a future z.record cannot silently break the chat bar: the gate scans
 * the DERIVED declarations, which is the document Google actually parses.
 * @returns {string[]} dotted paths, empty when the set is legal.
 */
export function scanGeminiIllegal(declarations) {
  const bad = [];
  const walk = (node, at, insideProperties) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`, false));
    if (!isPlainObject(node)) return;
    if (!insideProperties) {
      for (const key of Object.keys(node)) {
        if (GEMINI_FORBIDDEN.includes(key)) bad.push(`${at}.${key}`);
      }
      if (Object.keys(node).length === 0) bad.push(`${at}:EMPTY`);
      // `items` must say what the items ARE. An untyped one is the empty-node
      // failure wearing a different hat.
      if (node.items !== undefined && !(isPlainObject(node.items) && node.items.type)) {
        bad.push(`${at}.items:UNTYPED`);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, `${at}.${key}`, key === 'properties');
    }
  };
  for (const decl of declarations) walk(decl.parameters, decl.name, false);
  return bad;
}
