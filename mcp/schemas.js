// schemas.js — the validation contract, and nothing else.
//
// These objects define what a valid request looks like for all nine operations.
// They live apart from tools.js because tools.js imports the MCP server SDK, and
// a caller that only needs to VALIDATE has no business dragging in a whole MCP
// server to do it. Keeping the contract in a module whose only dependency is zod
// is what lets such a caller exist.
//
// engine.js validates nothing — it trusts its caller — so whatever calls it must
// parse against these first. Skipping that does not throw, it degrades silently:
// `format: "RICH"` falls through the format dispatch and renders 358 characters
// of prose where "rich" gives 998, and `max_chars: -1` returns 26. Both come back
// as ordinary successful answers.

import { z } from 'zod';
import { RECIPE_CHAR_CEILING, CHAIN_STAGE_IDS, CHAIN_MULTI_STAGE_IDS } from './engine.js';

export const renderShape = {
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
    .max(RECIPE_CHAR_CEILING)
    .optional()
    .describe(
      `Trim the recipe to at most this many characters. ${RECIPE_CHAR_CEILING} is the hard product-wide recipe ceiling (the app's Current Recipe cap) — both the default and the maximum; pass a smaller value only to shorten. Values above ${RECIPE_CHAR_CEILING} are rejected.`
    ),
};

export const workspaceSchema = z
  .object({ cards: z.array(z.any()) })
  .describe('The workspace returned by the previous recipe call. Thread it through unchanged.');

export const editSchema = z.object({
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
  // Named stages, not an open record.
  //
  // z.record compiles to propertyNames + additionalProperties, both outside the
  // schema subset a restricted function-calling client can represent — so the
  // one parameter that most needs describing was the one such a client could not
  // read. The stage set is closed and small, so enumerating it publishes plain
  // `properties` instead, and the ids come from the catalog (see engine.js) so
  // this cannot drift from what the workspace actually accepts.
  //
  // strictObject, deliberately, at the cost of one additionalProperties:false.
  // A plain z.object SILENTLY STRIPS an unrecognised key, so `{"mick":"<id>"}`
  // would reach the engine as `{}` — a no-op the model is never told about. That
  // is the same silent class as the fx-corruption this schema sat above; a typo
  // must come back as "Unknown chain stage", not as nothing happening.
  //
  // Every stage takes ONE id, including the multi-select ones — the SSOT lifts a
  // bare id into a list. A union of string|array would publish anyOf and buy
  // nothing: z.record(z.string(), z.string()) never accepted an array either, so
  // no caller loses a shape it could previously send.
  chain: z
    .strictObject(
      Object.fromEntries(
        CHAIN_STAGE_IDS.map((stage) => [
          stage,
          z
            .string()
            .optional()
            .describe(
              `${stage} id` +
                (CHAIN_MULTI_STAGE_IDS.includes(stage)
                  ? ' (multi-select stage; one id per call)'
                  : '')
            ),
        ])
      )
    )
    .optional()
    .describe(
      `Chain stage overrides — for set_environment, e.g. {"mic":"<id>","medium":"<id>"}. ` +
        `Stages: ${CHAIN_STAGE_IDS.join(', ')}. Ids from list_options or search_catalog types=["chain"].`
    ),
});

// THE VALIDATION BOUNDARY, shared by every adapter.
//
// engine.js validates nothing — it trusts its caller. Today the only thing
// standing between a malformed argument and the renderer is the Zod check the MCP
// SDK runs inside its CallTool handler, ABOVE the stored tool callback. Anything
// that reaches engine.js by another road inherits none of it, and the renderer
// fails silently rather than loudly: `format: "RICH"` falls through the format
// dispatch to prose and returns 358 characters where "rich" returns 998, with no
// error; `max_chars: -1` returns 26. That is the same shape as the bug where the
// compact format quietly dropped the room the user asked for.
//
// So the schemas are exported rather than inlined at their registration sites:
// anything that calls the engine parses against THESE objects first. One
// definition, so a second caller can never drift from what the connector accepts.
export const TOOL_SCHEMAS = {
  start_recipe: z.object({
    traditions: z
      .array(z.string())
      .min(1)
      .describe(
        'Tradition ids, resolved with search_catalog. ORDER IS MEANINGFUL: the first is named first in ' +
          'the header and is the last to lose material if the recipe reaches the character ceiling.'
      ),
    ...renderShape,
  }),
  edit_recipe: z.object({
    workspace: workspaceSchema,
    edits: z.array(editSchema).min(1).describe('Edits applied in order.'),
    ...renderShape,
  }),
  render_recipe: z.object({ workspace: workspaceSchema, ...renderShape }),
  search_catalog: z.object({
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
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe('Max results (default 20, max 50).'),
  }),
  search_prefaces: z.object({
    query: z.string().describe('Mood/feel words, e.g. "worn bitter struggling".'),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe('Max results (default 15, max 50).'),
  }),
  get_instrument: z.object({
    id: z.string().describe('Instrument id (see search_catalog).'),
    part: z
      .string()
      .optional()
      .describe('Show only this part. Use when you already know which knob you are turning.'),
    query: z
      .string()
      .optional()
      .describe('Filter variants by name/descriptor words, e.g. "mahogany" or "nylon gut".'),
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .optional()
      .describe('Max variants per part (default: a shared budget across the parts; max 200).'),
  }),
  get_tradition: z.object({ id: z.string().describe('Tradition id (see search_catalog).') }),
  list_traditions: z.object({
    query: z.string().optional(),
    family: z.string().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
  }),
  list_options: z.object({
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
  }),
};
