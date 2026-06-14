// tools.js — registers the CodexMusica engine as MCP tools.
//
// One McpServer, the full surface. Recipe generation is the headline (blend,
// exclude/add instruments, swap variants, axis-target, weighted A→B, room and
// arrangement overrides); the discovery tools exist so an agent can find the ids
// it needs and SEE every knob before turning it. Every generate/blend result
// also carries an `affordances` block — the knobs still available — so the tool
// behaves like an instrument to play, not a table to read.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as E from './engine.js';

// Customization knobs shared by all three recipe-generating tools. Spreading a
// plain object into each inputSchema keeps the descriptions in one place.
const customizationShape = {
  exclude_instruments: z.array(z.string()).optional()
    .describe('Instrument ids to drop from the ensemble (e.g. "afrobeat without saxophone").'),
  add_instruments: z.array(z.string()).optional()
    .describe('Instrument ids to add beyond the traditions\' default roster (guest/hybrid instruments).'),
  swap_variants: z.array(z.string()).optional()
    .describe('Override auto-picked part variants. Each entry is "instrument:part:variant" — call get_instrument to see valid part and variant ids.'),
  arrangement: z.string().optional()
    .describe('Arrangement archetype id (see list_options kind="arrangements").'),
  room: z.string().optional()
    .describe('Override the recording room/space id (see list_options kind="rooms").'),
  staple_mode: z.enum(['full', 'lineage']).optional()
    .describe('full (default): stapled traditions contribute instruments AND context. lineage: context only; primary keeps its roster.'),
  max_chars: z.number().int().positive().optional()
    .describe('Recipe length ceiling in characters (default 1000).'),
  include_affordances: z.boolean().optional()
    .describe('Include the "knobs you can still turn" payload (swappable variants, similar traditions). Default true.'),
};

function jsonResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

// Wrap an engine call so EngineError (bad id, etc.) comes back as a clean,
// actionable tool error instead of a 500.
function tool(server, name, config, fn) {
  server.registerTool(name, config, async (args) => {
    try {
      return jsonResult(await fn(args ?? {}));
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });
}

export function registerTools(server) {
  // ── Recipe generation (the engine) ──────────────────────────────────────

  tool(server, 'generate_recipe', {
    title: 'Generate a recording recipe',
    description:
      'Generate a compressed recording recipe (how to record a song in a style) for one tradition or a blend of several. ' +
      'The first tradition is primary; any others are stapled in. Customize freely: exclude/add instruments, swap part ' +
      'variants, override room or arrangement. Returns the recipe string, the full structured config, and the knobs you can ' +
      'still turn. This is the live engine, not a lookup of defaults — re-call it with refinements to iterate.',
    inputSchema: {
      traditions: z.array(z.string()).min(1)
        .describe('Tradition ids. First is the primary; the rest are stapled in to blend. See list_traditions.'),
      ...customizationShape,
      include_why: z.boolean().optional().describe('Include the scoring/search breakdown that explains the picks.'),
    },
  }, (a) => E.generateRecipe(a));

  tool(server, 'blend_traditions', {
    title: 'Weighted blend of two traditions',
    description:
      'Blend exactly two traditions on a continuous dial. weight is B\'s share: 0 = pure A, 0.5 = maximum blend (default), ' +
      '1 = pure B. The primary (owner of room, tuning, genre header) flips from A to B past 0.5. Accepts the same ' +
      'customization knobs as generate_recipe.',
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
      'Find the best-fit tradition for a target point in the catalog\'s axis space, then emit its recipe. Use when you know ' +
      'the qualities you want (harmonic complexity, density, intensity, …) but not which genre. See list_options kind="axes".',
    inputSchema: {
      axis_target: z.union([z.string(), z.record(z.string(), z.number())])
        .describe('Axis profile as "harm:1,density:2,intensity:2" or {"harm":1,"density":2}.'),
      ...customizationShape,
    },
  }, (a) => E.recipeFromAxis(a));

  // ── Discovery (find ids, see the knobs) ─────────────────────────────────

  tool(server, 'list_traditions', {
    title: 'List / search traditions',
    description: 'List or search the catalog\'s music traditions. Filter by substring (query) and/or family. Paginated.',
    inputSchema: {
      query: z.string().optional().describe('Case-insensitive substring match on id or name.'),
      family: z.string().optional().describe('Restrict to a tradition family (see list_options kind="tradition_families").'),
      limit: z.number().int().positive().optional().describe('Max results (default 50).'),
      offset: z.number().int().nonnegative().optional().describe('Pagination offset.'),
    },
  }, (a) => E.listTraditions(a));

  tool(server, 'get_tradition', {
    title: 'Get one tradition',
    description: 'Full record for one tradition: name, family, lineage, axis profile, and the raw catalog row.',
    inputSchema: { id: z.string().describe('Tradition id (see list_traditions).') },
  }, (a) => E.getTradition(a));

  tool(server, 'list_instruments', {
    title: 'List / search instruments',
    description: 'List or search the catalog\'s instruments. Filter by substring (query) and/or family. Paginated.',
    inputSchema: {
      query: z.string().optional().describe('Case-insensitive substring match on id or name.'),
      family: z.string().optional().describe('Restrict to an instrument family (see list_options kind="instrument_families").'),
      limit: z.number().int().positive().optional().describe('Max results (default 50).'),
      offset: z.number().int().nonnegative().optional().describe('Pagination offset.'),
    },
  }, (a) => E.listInstruments(a));

  tool(server, 'get_instrument', {
    title: 'Get one instrument (the knob catalog)',
    description:
      'Full record for one instrument: every part and the variant ids you can pass to swap_variants, with labels and which ' +
      'is the default. This is how you discover legal swap_variants values before customizing a recipe.',
    inputSchema: { id: z.string().describe('Instrument id (see list_instruments).') },
  }, (a) => E.getInstrument(a));

  tool(server, 'find_similar_traditions', {
    title: 'Find similar traditions',
    description: 'Nearest traditions to a given one by axis-profile distance — useful for picking what to blend in next.',
    inputSchema: {
      id: z.string().describe('Tradition id to find neighbors of.'),
      limit: z.number().int().positive().optional().describe('How many neighbors (default 8).'),
    },
  }, (a) => ({ id: a.id, items: E.findSimilarTraditions(a.id, a.limit || 8) }));

  tool(server, 'list_options', {
    title: 'Enumerate an option space',
    description:
      'List the valid ids for an override space: rooms, tunings, chain_sections, archetypes, aesthetics, arrangements, ' +
      'instrument_families, tradition_families, or axes.',
    inputSchema: {
      kind: z.enum([
        'rooms', 'tunings', 'chain_sections', 'archetypes', 'aesthetics',
        'arrangements', 'instrument_families', 'tradition_families', 'axes',
      ]).describe('Which option space to enumerate.'),
    },
  }, (a) => E.listOptions(a));
}

// Build a fully-wired server instance. (A fresh instance is created per session
// by the HTTP transport; the heavy catalog is loaded once and shared via the
// engine module's require cache.)
export function buildServer() {
  const server = new McpServer(
    { name: 'codex-musica', version: '1.0.0' },
    {
      instructions:
        `CodexMusica is a recording-recipe engine over ${E.counts.traditions} music traditions and ` +
        `${E.counts.instruments} instruments. Generate a recipe with generate_recipe (blend by passing several ` +
        `traditions), blend_traditions (weighted two-way), or recipe_from_axis. Customize with exclude_instruments, ` +
        `add_instruments, swap_variants, arrangement, and room. Use list_traditions / list_instruments / get_instrument ` +
        `to discover ids and the variant knobs, and list_options for override spaces. Every recipe response includes an ` +
        `'affordances' block listing the knobs you can still turn — iterate by re-calling with refinements rather than ` +
        `treating the first result as final.`,
    },
  );
  registerTools(server);
  return server;
}
