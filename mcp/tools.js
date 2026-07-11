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
import { z } from 'zod';
import * as E from './engine.js';

const renderShape = {
  format: z
    .enum(['rich', 'tags', 'prose', 'compact'])
    .optional()
    .describe(
      'Recipe view. Default "rich" — the app\'s Current Recipe (preface label + full descriptor stack).'
    ),
  max_chars: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe(
      'Trim the recipe to at most this many characters. 1000 is the canonical Current Recipe length — both the default and the hard maximum; pass a smaller value only to shorten. Values above 1000 are rejected.'
    ),
};

const workspaceSchema = z
  .object({ cards: z.array(z.any()) })
  .describe('The workspace returned by the previous recipe call. Thread it through unchanged.');

const editSchema = z.object({
  action: z
    .enum([
      'add_tradition',
      'remove_tradition',
      'add_instrument',
      'remove_instrument',
      'set_variant',
      'set_environment',
      'set_preface',
    ])
    .describe('Which edit to apply.'),
  tradition: z
    .string()
    .optional()
    .describe(
      'Tradition id — for add_tradition / remove_tradition, or as context for add_instrument.'
    ),
  instrument: z.string().optional().describe('Instrument id — for add_instrument.'),
  card: z
    .string()
    .optional()
    .describe(
      'Card reference (the `card` id from a prior response, or an instrument id) — for remove_instrument / set_variant / set_environment / set_preface.'
    ),
  part: z.string().optional().describe('Part id — for set_variant (see get_instrument).'),
  variant: z.string().optional().describe('Variant id — for set_variant (see get_instrument).'),
  preface: z
    .string()
    .optional()
    .describe(
      "Preface id — for set_preface (see search_prefaces). Deterministically re-derives the card's settings toward it, then labels it verbatim."
    ),
  room: z.string().optional().describe('Room id — for set_environment.'),
  tuning: z.string().optional().describe('Tuning id — for set_environment.'),
  chain: z
    .record(z.string(), z.string())
    .optional()
    .describe('Chain stage overrides — for set_environment, e.g. {"mic":"<id>","medium":"<id>"}.'),
});

function jsonResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
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
        'Seed a recording recipe from one or more traditions — deterministic default cards, identical to what a human sees in the ' +
        'app ("Current Recipe"). This is the SCAFFOLD, not the finished answer: when the user gave any stylistic words (a mood, ' +
        'gear, a space, an era), follow with edit_recipe to realize them before presenting. First tradition is primary; any ' +
        "others are explicit staples (NOT auto-added). Returns the recipe string, a per-card summary (with each instrument's " +
        'preface), and the `workspace` to thread into edit_recipe. Resolve tradition names to ids with search_catalog first.',
      inputSchema: {
        traditions: z
          .array(z.string())
          .min(1)
          .describe('Tradition ids; first is primary. Resolve with search_catalog.'),
        ...renderShape,
      },
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
        'it verbatim; apply per instrument, not just once), set_variant (swap one part: material, build, technique), ' +
        'set_environment (any room/tuning/chain — freely across eras and regions; no combination is fenced), add_instrument / ' +
        'remove_instrument (any instrument into any tradition), add_tradition / remove_tradition. Pass the `workspace` from the ' +
        'previous call; get back the edited workspace + new recipe. Iterate until the recipe reflects every word the user said, ' +
        'then present the final `recipe` string VERBATIM.',
      inputSchema: {
        workspace: workspaceSchema,
        edits: z.array(editSchema).min(1).describe('Edits applied in order.'),
        ...renderShape,
      },
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
      inputSchema: { workspace: workspaceSchema, ...renderShape },
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
        "chain items. ALWAYS use this to turn a request's words into real ids — never guess. Multi-word queries rank by how many " +
        'terms match; filter with `types`.',
      inputSchema: {
        query: z.string().describe('Words from the request, e.g. "garage rock fuzz".'),
        types: z
          .array(
            z.enum([
              'tradition',
              'instrument',
              'variant',
              'room',
              'tuning',
              'arrangement',
              'aesthetic',
              'preface',
              'chain',
            ])
          )
          .optional()
          .describe('Restrict to these record types.'),
        limit: z.number().int().positive().optional().describe('Max results (default 20, max 50).'),
      },
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
      inputSchema: {
        query: z.string().describe('Mood/feel words, e.g. "worn bitter struggling".'),
        limit: z.number().int().positive().optional().describe('Max results (default 15).'),
      },
    },
    (a) => E.searchPrefaces(a)
  );

  tool(
    server,
    'get_instrument',
    {
      title: 'Get one instrument (the knob catalog)',
      description:
        'Every part and the variant ids valid for set_variant, with labels and which is the default.',
      inputSchema: { id: z.string().describe('Instrument id (see search_catalog).') },
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
      inputSchema: { id: z.string().describe('Tradition id (see search_catalog).') },
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
      inputSchema: {
        query: z.string().optional(),
        family: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
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
      inputSchema: {
        kind: z
          .enum([
            'rooms',
            'tunings',
            'chain_sections',
            'archetypes',
            'aesthetics',
            'arrangements',
            'instrument_families',
            'tradition_families',
            'axes',
          ])
          .describe('Which option space to enumerate.'),
      },
    },
    (a) => E.listOptions(a)
  );
}

export function buildServer() {
  const server = new McpServer(
    { name: 'codex-musica', version: '2.0.0' },
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
