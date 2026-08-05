// tools.js — registers the CodexMusica deterministic workspace as MCP tools.
//
// The connector is the human app's canvas, headless: start_recipe seeds a
// tradition's deterministic default cards (== the app's "Current Recipe"), and
// edit_recipe applies human-style edits (re-pick a preface — which deterministically
// re-derives that instrument's settings — swap a part variant, override room/
// chain/tuning, add/remove instruments, add/remove traditions). State is passed
// in and out: every recipe call returns the `workspace` to thread into the next.
// No hill-climb search, no auto-staple — the recipe is reproducible and equal to
// what a human sees in the app.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as E from './engine.js';
import { TOOL_SCHEMAS } from './schemas.js';

// Re-exported so existing importers keep working; the definitions live in
// schemas.js, which does not import the MCP SDK.
export { renderShape, workspaceSchema, editSchema, TOOL_SCHEMAS } from './schemas.js';

// No tool declares an outputSchema and none returns structuredContent, so this
// text block is opaque to the protocol — a client is entitled to assume nothing
// about its whitespace, which is what makes the formatting free to change.
//
// It is not merely cosmetic. The payload carries the `recipe` string the caller
// is asked to reproduce verbatim, and indenting the JSON around it spent about a
// quarter of the response on leading spaces — context competing with the one
// part of the answer that has to survive intact. Pretty-printing only ever
// helped a human reading a transcript; the model is the only real consumer.
function jsonResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

// Every tool is read-only, idempotent, and closed-world: state-passing and
// deterministic (no server-side mutation), and derived entirely from the bundled
// catalog (no external calls). Annotate accordingly — this is the metadata the
// connector directory weighs most. Per-tool overrides win if a config sets its own.
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

function tool(server, name, config, fn) {
  const withAnnotations = {
    ...config,
    annotations: { ...READ_ONLY_ANNOTATIONS, ...(config.annotations || {}) },
  };
  server.registerTool(name, withAnnotations, async (args) => {
    try {
      return jsonResult(await fn(args ?? {}));
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });
}

export function registerTools(server) {
  // ── Recipe (the deterministic workspace) ────────────────────────────────

  tool(
    server,
    'start_recipe',
    {
      title: 'Start a recipe from tradition(s)',
      description:
        'Seed a recording recipe from any number of traditions — deterministic default cards, identical to what a human sees in the ' +
        'app ("Current Recipe"). This is the SCAFFOLD, not the finished answer: when the user gave any stylistic words (a mood, ' +
        'gear, a space, an era), follow with edit_recipe to realize them before presenting. First tradition is primary; any ' +
        "others are explicit staples (NOT auto-added). Returns the recipe string, a per-card summary (with each instrument's " +
        'preface), and the `workspace` to thread into edit_recipe. Resolve tradition names to ids with search_catalog first.',
      inputSchema: TOOL_SCHEMAS.start_recipe.shape,
    },
    (a) => E.startRecipe(a)
  );

  tool(
    server,
    'edit_recipe',
    {
      title: 'Edit the recipe (the main tool)',
      description:
        "The main tool — push the scaffold toward the user's words with an ordered batch of edits in ONE call. Edits: set_preface " +
        "(mood/aesthetic words land here — re-derives that instrument's variants/tuning/room/chain toward the preface, then labels " +
        'it verbatim; apply per instrument, not just once), set_variant (set one part — material, build, technique — which then ' +
        'RESHAPES the rest of that card toward its preface, exactly as picking a variant does in the app; your part is pinned and ' +
        'never reverted, but the other axes may move, so set_preface FIRST if you want to steer where they land), ' +
        'set_environment (any room/tuning/chain — freely across eras and regions; no combination is fenced), add_instrument / ' +
        'remove_instrument (any instrument into any tradition), add_tradition / remove_tradition. Pass the `workspace` from the ' +
        'previous call; get back the edited workspace + new recipe. Iterate until the recipe reflects every word the user said, ' +
        'then present the final `recipe` string VERBATIM.',
      inputSchema: TOOL_SCHEMAS.edit_recipe.shape,
    },
    (a) => E.editRecipe(a)
  );

  tool(
    server,
    'render_recipe',
    {
      title: 'Re-render the workspace',
      description:
        'Render an existing workspace again — e.g. a different format or max_chars — without editing it.',
      inputSchema: TOOL_SCHEMAS.render_recipe.shape,
    },
    (a) => E.renderRecipe(a)
  );

  // ── Discovery (resolve words → ids; see the knobs) ──────────────────────

  tool(
    server,
    'search_catalog',
    {
      title: 'Search the catalog',
      description:
        'Free-text search across traditions, instruments, part-variants, rooms, tunings, arrangements, aesthetics, prefaces, and ' +
        'chain items. Use it to turn the CONCRETE words in a request into real ids — a genre, an instrument, a piece of gear, a ' +
        'material, a space, an era — and never guess an id. For MOOD and FEEL adjectives reach for search_prefaces instead: it ' +
        'searches the same prefaces but returns their token profiles, which is what you need to choose between near-synonyms. ' +
        'Hits on an id or name outrank hits in descriptor prose, and matching every term outranks matching some.',
      inputSchema: TOOL_SCHEMAS.search_catalog.shape,
    },
    (a) => E.searchCatalog(a)
  );

  tool(
    server,
    'search_prefaces',
    {
      title: 'Search prefaces (intent → preface id)',
      description:
        'Search the named prefaces (aesthetic/technique/delivery signatures: satirical, keening, brooding, …) by mood/feel words. ' +
        'Reach for this whenever the user says ANY stylistic adjective — then realize the winning id on each relevant instrument ' +
        'via edit_recipe set_preface. Any preface can target any instrument.',
      inputSchema: TOOL_SCHEMAS.search_prefaces.shape,
    },
    (a) => E.searchPrefaces(a)
  );

  tool(
    server,
    'get_instrument',
    {
      title: 'Get one instrument (the knob catalog)',
      description:
        'The parts of one instrument and the variant ids valid for set_variant, with labels and which is ' +
        'the default. Wide parts are SAMPLED, not dumped — a few instruments inherit a 655-entry materials ' +
        'table, so each part reports its full `variant_count` and sets `truncated` when you are seeing a ' +
        'slice. Narrow it rather than raising `limit`: `query` filters variants by name and descriptor ' +
        '("mahogany", "phosphor bronze"), `part` focuses one part. The default variant is always included.',
      inputSchema: TOOL_SCHEMAS.get_instrument.shape,
    },
    (a) => E.getInstrument(a)
  );

  tool(
    server,
    'get_tradition',
    {
      title: 'Get one tradition',
      description:
        'Full record for one tradition: name, family, lineage, axis profile, default instruments, raw row.',
      inputSchema: TOOL_SCHEMAS.get_tradition.shape,
    },
    (a) => E.getTradition(a)
  );

  tool(
    server,
    'list_traditions',
    {
      title: 'List / browse traditions',
      description:
        'List or substring-filter traditions (by id/name and/or family). Paginated. For free-text use search_catalog.',
      inputSchema: TOOL_SCHEMAS.list_traditions.shape,
    },
    (a) => E.listTraditions(a)
  );

  tool(
    server,
    'list_options',
    {
      title: 'Enumerate an override space',
      description:
        'Valid ids for an override space: rooms, tunings, chain_sections, archetypes, aesthetics, arrangements, instrument_families, tradition_families, axes.',
      inputSchema: TOOL_SCHEMAS.list_options.shape,
    },
    (a) => E.listOptions(a)
  );
}

export function buildServer() {
  const server = new McpServer(
    { name: 'codex-musica', version: '2.1.0' },
    {
      instructions:
        `CodexMusica turns plain-language musical intent into a precise recording recipe over ${E.counts.traditions} ` +
        `traditions, ${E.counts.instruments} instruments (each decomposed into swappable per-part variants), and ` +
        `${E.counts.prefaces} prefaces (named mood/technique signatures). THE DEFAULT SEED IS SCAFFOLDING, NOT THE ` +
        `ANSWER: start_recipe returns a tradition's stock cards, and if the user expressed ANY preference — a mood, an ` +
        `adjective, a piece of gear, a material, a space, an era — follow with edit_recipe before presenting. Map ` +
        `intent to edits: mood/feel/aesthetic words → search_prefaces, then set_preface on EACH instrument it should ` +
        `color (this re-derives that instrument's physical settings toward the word); specific gear/material/technique ` +
        `→ get_instrument, then set_variant; space/era/medium → set_environment (any room, tuning, or chain stage); ` +
        `roster → add/remove_instrument and add/remove_tradition (any instrument fits any tradition). There are NO ` +
        `coherence fences: nothing is anachronistic, out-of-region, or physically impossible here — the catalog's ` +
        `period-accurate defaults are flavor to keep or override, and every id-valid combination renders. Batch ` +
        `several edits in one edit_recipe call; thread the returned 'workspace' into the next call; resolve every word ` +
        `to an id with search_catalog / search_prefaces (never guess ids). Deterministic and reproducible — identical ` +
        `to what a human sees in the app. Present the FINAL recipe string to the user verbatim (exact characters) — ` +
        `final meaning after your edits, not the untouched default.`,
    }
  );
  registerTools(server);
  return server;
}
