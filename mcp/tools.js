// tools.js — registers the CodexMusica engine as MCP tools + a workflow prompt.
//
// IMPORTANT: claude.ai (web) silently drops the server-level `instructions`
// field — the model only ever sees TOOL DESCRIPTIONS. So each description below
// is written workflow-first (routing + when-to-use-vs-siblings), not as terse
// docs. The `compose_recipe` prompt is a supplemental, user-invoked guide.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as E from './engine.js';

const CORPUS_TYPES = ['tradition', 'instrument', 'variant', 'room', 'tuning', 'arrangement', 'aesthetic', 'preface', 'chain'];

// Customization knobs shared by the recipe-generating tools.
const customizationShape = {
  exclude_instruments: z.array(z.string()).optional()
    .describe('Instrument ids to drop (trim a blend, or "afrobeat without saxophone"). Find ids via search_catalog.'),
  add_instruments: z.array(z.string()).optional()
    .describe('Instrument ids to add beyond the tradition roster (guest/hybrid instruments).'),
  swap_variants: z.array(z.string()).optional()
    .describe('Set specific part variants; each is "instrument:part:variant". Get these from apply_preface (to hit a mood) or get_instrument (to see options).'),
  ensemble: z.enum(['lean', 'full']).optional()
    .describe('lean (DEFAULT): use only the PRIMARY tradition\'s instruments — keeps blends small and coherent. full: merge every tradition\'s roster (bigger, can sprawl).'),
  max_instruments: z.number().int().positive().optional()
    .describe('Cap ensemble size; drops secondary/low-scoring instruments first, never the voice. Use for intimate/solo pieces.'),
  arrangement: z.string().optional()
    .describe('Arrangement archetype id (search_catalog types=["arrangement"]).'),
  room: z.string().optional()
    .describe('Override the room/space id (search_catalog types=["room"]).'),
  tuning: z.string().optional()
    .describe('Override the tuning id (search_catalog types=["tuning"]).'),
  chain: z.record(z.string(), z.string()).optional()
    .describe('Override signal-chain stages, e.g. {"mic":"<id>","medium":"<id>"}. Stages: mic/pre/console/comp/eq/amp/medium. Find item ids via search_catalog types=["chain"]. Overriding the chain makes it render in the recipe string.'),
  staple_mode: z.enum(['full', 'lineage']).optional()
    .describe('Advanced: how staples merge. `ensemble` sets this for you; only set directly to override.'),
  max_chars: z.number().int().positive().optional()
    .describe('Recipe length ceiling in characters (default 1000).'),
  include_affordances: z.boolean().optional()
    .describe('Include the "knobs you can still turn" + leak flags. Default true.'),
};

function jsonResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

// Wrap an engine call: EngineError → clean isError result the model can self-
// correct from. Every tool is read-only, deterministic, closed-world; mirror the
// `title` into annotations (the Connectors Directory requires it).
function tool(server, name, config, fn) {
  const cfg = {
    ...config,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false, title: config.title, ...(config.annotations || {}) },
  };
  server.registerTool(name, cfg, async (args) => {
    try {
      return jsonResult(await fn(args ?? {}));
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });
}

export function registerTools(server) {
  // ── Discovery: the front door ───────────────────────────────────────────

  tool(server, 'search_catalog', {
    title: 'Search the whole catalog',
    description:
      'Free-text search across the ENTIRE catalog — traditions (including their lineage prose), instruments, every part-variant, ' +
      'rooms, tunings, arrangements, aesthetics, and 649 "prefaces" (aesthetic/technique/delivery signatures). ALWAYS use this to turn a request\'s words ("outlaw", ' +
      '"gut string", "ballad", "gothic", "midnight") into real ids — never guess ids. Multi-word queries rank records by how many ' +
      'terms match; filter with `types`. Returns {type, id, name, matched_on}; feed ids into generate_recipe, get_instrument, or ' +
      'apply_preface. Paginate with the returned cursor.',
    inputSchema: {
      query: z.string().describe('Words from the request, e.g. "gothic americana outlaw gut string".'),
      types: z.array(z.enum(CORPUS_TYPES)).optional().describe(`Restrict to these record types: ${CORPUS_TYPES.join(', ')}.`),
      limit: z.number().int().positive().optional().describe('Max results (default 20, max 50).'),
      cursor: z.string().optional().describe('Opaque cursor from a previous response for the next page.'),
    },
  }, (a) => E.searchCatalog(a));

  tool(server, 'search_prefaces', {
    title: 'Search prefaces',
    description:
      'Search the 649 "prefaces" — named aesthetic / technique / delivery signatures (satirical, keening, jhala-cascading, ' +
      'inshad-cantillating, brooding), each a descriptor-token set — by free text. Prefaces express INTENT (how it should sound) as opposed to instruments (what plays). ' +
      'Returns ranked prefaces with their token signatures. Take a preface id to apply_preface to physically realize it on an instrument.',
    inputSchema: {
      query: z.string().describe('Mood/feel words, e.g. "worn bitter struggling".'),
      limit: z.number().int().positive().optional().describe('Max results (default 15).'),
    },
  }, (a) => E.searchPrefaces(a));

  tool(server, 'apply_preface', {
    title: 'Apply a preface to an instrument',
    description:
      'Bend ONE instrument toward a descriptive preface (intent → physical settings). Given a tradition (for context), an instrument ' +
      'id, and a preface id, the engine re-picks that instrument\'s part-variants, tuning, room, and signal chain to maximize match ' +
      'with the preface. Returns `generate_recipe_overrides` (swap_variants + room/tuning/chain) ready to spread into generate_recipe. ' +
      'E.g. voice + "worn" → cassette/lo-fi chain; voice + "satirical" → twangy staccato heightened-speech. Find preface ids with search_prefaces.',
    inputSchema: {
      tradition: z.string().optional().describe('Tradition id for starting context (recommended; the recipe\'s primary tradition).'),
      instrument: z.string().describe('Instrument id to reshape (e.g. "voice"). Find via search_catalog types=["instrument"].'),
      preface: z.string().describe('Target preface id (from search_prefaces).'),
    },
  }, (a) => E.applyPreface(a));

  // ── Recipe generation (the engine) ──────────────────────────────────────

  tool(server, 'generate_recipe', {
    title: 'Generate a recording recipe',
    description:
      'Generate a recording recipe from tradition ids (first = primary, the rest blended in). WORKFLOW: use search_catalog to turn ' +
      'the user\'s words into real ids (do not guess), and search_prefaces + apply_preface to turn moods (worn, sparse, bitter) into ' +
      'concrete swap_variants/room/tuning/chain overrides. Blends are LEAN by default (primary\'s instruments only) so they stay ' +
      'coherent — pass ensemble:"full" for a big cross-genre band, max_instruments for intimate/solo, exclude_instruments to trim. ' +
      'The response flags instruments a secondary tradition injected (affordances.injected). Re-call to iterate.',
    inputSchema: {
      traditions: z.array(z.string()).min(1)
        .describe('Tradition ids; first is primary, rest are blended in. Resolve with search_catalog.'),
      ...customizationShape,
      include_why: z.boolean().optional().describe('Include the scoring/search breakdown explaining the picks.'),
    },
  }, (a) => E.generateRecipe(a));

  tool(server, 'blend_traditions', {
    title: 'Weighted blend of two traditions',
    description:
      'Weighted two-tradition blend on a dial: `weight` is B\'s share (0 = pure A, 0.5 = max blend default, 1 = pure B); the primary ' +
      '(owner of room/tuning/genre header) flips past 0.5. LEAN by default; ensemble:"full" merges both rosters. For 3+ traditions ' +
      'use generate_recipe instead. Accepts the same customization knobs (swap_variants, exclude/add_instruments, room/tuning/chain, max_instruments).',
    inputSchema: {
      a: z.string().describe('First tradition id.'),
      b: z.string().describe('Second tradition id.'),
      weight: z.number().min(0).max(1).optional().describe('B\'s share in [0,1]. 0=A, 0.5=max blend (default), 1=B.'),
      ...customizationShape,
    },
  }, (a) => E.blendTraditions(a));

  tool(server, 'recipe_from_axis', {
    title: 'Recipe from an axis profile',
    description:
      'Find the best-fit tradition for a target point in the catalog\'s 13-axis space, then emit its recipe. Use when you know the ' +
      'qualities you want (harmonic complexity, density, intensity, …) but not which genre. See list_options kind="axes" for axis ids. ' +
      'Accepts the same customization knobs as generate_recipe.',
    inputSchema: {
      axis_target: z.union([z.string(), z.record(z.string(), z.number())])
        .describe('Axis profile as "harm:1,density:2,intensity:2" or {"harm":1,"density":2}.'),
      ...customizationShape,
    },
  }, (a) => E.recipeFromAxis(a));

  // ── Targeted lookups ────────────────────────────────────────────────────

  tool(server, 'get_instrument', {
    title: 'Get one instrument (the knob catalog)',
    description:
      'Full record for one instrument: every part and the variant ids you can pass to swap_variants, with labels and which is the ' +
      'default. Use to see exact swap options before customizing. (For a mood-driven choice, prefer apply_preface.)',
    inputSchema: { id: z.string().describe('Instrument id (from search_catalog types=["instrument"]).') },
  }, (a) => E.getInstrument(a));

  tool(server, 'get_tradition', {
    title: 'Get one tradition',
    description: 'Full record for one tradition: name, family, lineage, 13-axis profile, and the raw catalog row.',
    inputSchema: { id: z.string().describe('Tradition id (from search_catalog types=["tradition"]).') },
  }, (a) => E.getTradition(a));

  tool(server, 'find_similar_traditions', {
    title: 'Find similar traditions',
    description: 'Nearest traditions to a given one by 13-axis distance — useful for picking what to blend in next.',
    inputSchema: {
      id: z.string().describe('Tradition id to find neighbors of.'),
      limit: z.number().int().positive().optional().describe('How many neighbors (default 8).'),
    },
  }, (a) => ({ id: a.id, items: E.findSimilarTraditions(a.id, a.limit || 8) }));

  tool(server, 'list_options', {
    title: 'Enumerate an option space',
    description:
      'List valid ids for an override space: rooms, tunings, chain_sections, archetypes, aesthetics, arrangements, instrument_families, ' +
      'tradition_families, or axes. (For free-text search prefer search_catalog.)',
    inputSchema: {
      kind: z.enum([
        'rooms', 'tunings', 'chain_sections', 'archetypes', 'aesthetics',
        'arrangements', 'instrument_families', 'tradition_families', 'axes',
      ]).describe('Which option space to enumerate.'),
    },
  }, (a) => E.listOptions(a));

  // ── Plain enumeration (search_catalog is usually better) ────────────────

  tool(server, 'list_traditions', {
    title: 'List / filter traditions',
    description: 'Enumerate traditions, optionally filtered by substring or family. For fuzzy / lineage-aware search use search_catalog instead.',
    inputSchema: {
      query: z.string().optional().describe('Case-insensitive substring match on id or name.'),
      family: z.string().optional().describe('Restrict to a tradition family (list_options kind="tradition_families").'),
      limit: z.number().int().positive().optional().describe('Max results (default 50).'),
      offset: z.number().int().nonnegative().optional().describe('Pagination offset.'),
    },
  }, (a) => E.listTraditions(a));

  tool(server, 'list_instruments', {
    title: 'List / filter instruments',
    description: 'Enumerate instruments, optionally filtered by substring or family. For fuzzy search use search_catalog instead.',
    inputSchema: {
      query: z.string().optional().describe('Case-insensitive substring match on id or name.'),
      family: z.string().optional().describe('Restrict to an instrument family (list_options kind="instrument_families").'),
      limit: z.number().int().positive().optional().describe('Max results (default 50).'),
      offset: z.number().int().nonnegative().optional().describe('Pagination offset.'),
    },
  }, (a) => E.listInstruments(a));
}

// User-invoked workflow guide (survives even though claude.ai drops server
// instructions). Surfaces as /mcp__codex-musica__compose_recipe.
function registerPrompts(server) {
  server.registerPrompt(
    'compose_recipe',
    {
      title: 'Compose a recipe from a vibe',
      description: 'Step-by-step workflow for turning a free-text musical request into a CodexMusica recipe via the connector tools.',
      argsSchema: { request: z.string().optional().describe('The musical request / vibe to compose (optional).') },
    },
    ({ request } = {}) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text:
            'Compose a CodexMusica recording recipe. The connector takes STRUCTURED inputs, not prose — you are the translator. Loop:\n' +
            '1. Split the request into (a) genre/instrument/scene words and (b) mood/feel words.\n' +
            '2. Resolve (a) to real ids with search_catalog (traditions, instruments, variants, rooms). Never guess ids.\n' +
            '3. For (b), find moods with search_prefaces; for each instrument that should carry a mood, call apply_preface(tradition, instrument, preface) and collect its generate_recipe_overrides.\n' +
            '4. Call generate_recipe with the traditions + merged overrides (swap_variants/room/tuning/chain) + exclude_instruments for anything unwanted. Keep it LEAN by default; use max_instruments for intimate/solo pieces, ensemble:"full" only for an intentionally big band.\n' +
            '5. Read affordances.injected and drop anything a secondary tradition added that the user didn\'t ask for. Iterate.\n' +
            'Remember: a preface IS the engine\'s intent→settings interpreter — apply_preface re-derives an instrument\'s variants, tuning, room, and chain to realize it, and the rendered recipe names each instrument\'s preface. Lean on the engine for character; it is not merely a gear-and-room list. (Scene framing and lyrics are still yours to add.)' +
            (request ? `\n\nRequest to compose: ${request}` : ''),
        },
      }],
    }),
  );
}

// Build a fully-wired server instance. (A fresh instance is created per request
// by the stateless HTTP transport; the heavy catalog loads once via the engine
// module's require cache.)
export function buildServer() {
  const server = new McpServer(
    { name: 'codex-musica', version: '2.0.0' },
    {
      instructions:
        `CodexMusica turns words into recording recipes over ${E.counts.traditions} traditions, ${E.counts.instruments} instruments, ` +
        `and ${E.counts.prefaces} "prefaces" (named aesthetic/technique/delivery signatures, each a descriptor-token set). Workflow: ` +
        `search_catalog (resolve words→ids, never guess) → search_prefaces + apply_preface (intent→physical settings: re-derives an ` +
        `instrument's variants/tuning/room/chain) → generate_recipe (blends are LEAN by default; ensemble:"full"/max_instruments to ` +
        `resize; exclude_instruments to trim). The rendered recipe names each instrument's preface. Responses carry affordances ` +
        `(knobs left to turn) + injected (leak flags). The /compose_recipe prompt has the full loop.`,
    },
  );
  registerTools(server);
  registerPrompts(server);
  return server;
}
