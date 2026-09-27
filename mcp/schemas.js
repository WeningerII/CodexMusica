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
import {
  RECIPE_CHAR_CEILING,
  CHAIN_STAGE_IDS,
  CHAIN_MULTI_STAGE_IDS,
  ENV_FIELDS,
  LIST_TRADITIONS_MAX,
  OPTION_KINDS,
} from './engine.js';

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

// ── size ceilings ────────────────────────────────────────────────────────────
//
// The contract had no size bounds at all, and "no bound" on a public,
// unauthenticated, single-process endpoint is a denial-of-service primitive
// rather than a generosity. Measured before these existed: one start_recipe
// carrying all 2,503 tradition ids ran 18.7 SECONDS of synchronous CPU and
// built a 13,432-card, 8.2 MB workspace — and since the engine is synchronous
// and the instance is one process, that is 18.7 seconds during which /health,
// /chat and every other MCP caller get nothing. It cost the caller one small
// POST, and nothing stopped them sending it in a loop.
//
// The numbers are chosen against what a recipe can actually SAY, not against
// what the machine can survive. A recipe is capped at 1,000 characters; a
// workspace of 16 traditions already overruns that ceiling by a wide margin, so
// a caller asking for 17 is not being served worse by the refusal — they were
// never going to see the 17th in the output. Same for cards: the largest single
// tradition seeds 17, so 512 is roughly thirty maximal traditions' worth and
// still an order of magnitude below where the renderer gets slow.
//
// These are the per-request half of the defense. ratelimit.js is the other half
// (how OFTEN a caller may ask); neither substitutes for the other.
export const MAX_TRADITIONS_PER_CALL = 16;
export const MAX_EDITS_PER_CALL = 64;
export const MAX_WORKSPACE_CARDS = 512;

export const workspaceSchema = z
  .object({
    // z.any() on the elements is deliberate and unchanged: a card is the
    // engine's own shape, threaded back verbatim, and re-describing it here
    // would create a second definition to drift. The LENGTH, though, is not the
    // engine's business to trust — the array arrives from the network.
    cards: z.array(z.any()).max(MAX_WORKSPACE_CARDS),
  })
  // Threading is described HERE and only here. A tool's main description is
  // published on every surface, including the session endpoint where the server
  // carries the workspace and this parameter is optional or absent; this
  // parameter's description is published only where the caller holds the state.
  .describe(
    'The `workspace` returned by the previous recipe call (start_recipe, edit_recipe or render_recipe), passed back unchanged. Every recipe call returns the next one.'
  );

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
      'move_instrument',
    ])
    .describe('Which edit to apply.'),
  tradition: z
    .string()
    .optional()
    .describe(
      'Tradition id — for add_tradition / remove_tradition, or as context for add_instrument.'
    ),
  instrument: z.string().optional().describe('Instrument id — for add_instrument.'),
  before: z
    .string()
    .optional()
    .describe(
      'Card reference for move_instrument: the card is placed just before this one. Omit to move it to the front, ' +
        'which puts its tradition first in the header; the environment follows only if that card has one (the recipe ' +
        'renders the environment of the first card that has any). Existing settings are preserved.'
    ),
  card: z
    .string()
    .optional()
    .describe(
      'Card reference (the `card` id from a prior response, or an instrument id) — for remove_instrument / set_variant / ' +
        'set_preface / move_instrument. OPTIONAL for set_environment, and usually best omitted: the recipe renders one ' +
        'environment, taken from render_scope.environment_card, and an omitted card writes there — "record the whole thing ' +
        'in X" is one edit. Naming another card stores a setting no format renders.'
    ),
  part: z.string().optional().describe('Part id — for set_variant (see get_instrument).'),
  variant: z
    .string()
    .optional()
    .describe(
      'Variant id — for set_variant (see get_instrument). The part is set and pinned (never reverted). As in the app, ' +
        'an auto-derived preface label is re-derived from the new sound; a material part (woods, strings and other ' +
        'shared materials) may also move other parts of that card toward the preface. Room, tuning and chain never move.'
    ),
  preface: z
    .string()
    .optional()
    .describe(
      "Preface id — for set_preface (see search_prefaces). Deterministically re-derives the card's parts, room, tuning and " +
        'chain toward it, then labels it verbatim. On the environment card this replaces an environment set earlier, so ' +
        'put set_environment after set_preface.'
    ),
  room: z
    .string()
    .optional()
    .describe('Room id — for set_environment (search_catalog types=["room"]).'),
  tuning: z
    .string()
    .optional()
    .describe('Tuning id — for set_environment (search_catalog types=["tuning"]).'),
  // Clearing needs a field of its own because the id fields cannot say "none":
  // a null would publish a type union (anyOf), outside the schema subset. An enum
  // list is plain JSON Schema, and it is also how a multi-select stage is emptied
  // or replaced, which a one-id-per-edit `chain` value cannot express.
  clear: z
    .array(z.enum(ENV_FIELDS))
    .max(ENV_FIELDS.length)
    .optional()
    .describe(
      'For set_environment: settings to unset before this edit applies its own values — room, tuning, or a chain stage ' +
        '(a multi-select stage is emptied). {"clear":["fx"],"chain":{"fx":"<id>"}} leaves exactly that one effect.'
    ),
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
  // must come back as "Unknown chain stage", not as nothing happening. The
  // message is set here because this refusal happens at the schema, before the
  // engine's own "Unknown chain stage" could name the stages.
  //
  // Every stage takes ONE id, including the multi-select ones — the SSOT lifts a
  // bare id into the list. A union of string|array would publish anyOf and buy
  // nothing: z.record(z.string(), z.string()) never accepted an array either, so
  // no caller loses a shape it could previously send. Several effects are
  // several edits, each adding one; `clear` empties the list.
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
                  ? ' (multi-select stage: each edit ADDS one id to the list; clear it with clear:["' +
                    stage +
                    '"])'
                  : '')
            ),
        ])
      ),
      {
        error: (issue) =>
          issue.code === 'unrecognized_keys'
            ? `Unknown chain stage ${issue.keys.map((k) => `"${k}"`).join(', ')}. Stages: ${CHAIN_STAGE_IDS.join(', ')}. ` +
              'search_catalog types=["chain"] returns each chain id with the stage that takes it.'
            : undefined,
      }
    )
    .optional()
    .describe(
      `Chain stage settings — for set_environment, e.g. {"mic":"<id>","medium":"<id>"}. ` +
        `Stages: ${CHAIN_STAGE_IDS.join(', ')}. Ids from search_catalog types=["chain"], which returns each id with ` +
        'the stage that takes it.'
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
      .max(MAX_TRADITIONS_PER_CALL)
      .describe(
        'Tradition ids, resolved with search_catalog. ORDER IS MEANINGFUL: the first is named first in ' +
          'the header and is the last to lose material if the recipe reaches the character ceiling. ' +
          `At most ${MAX_TRADITIONS_PER_CALL} per call — well past what a ${RECIPE_CHAR_CEILING}-character recipe can name.`
      ),
    ...renderShape,
  }),
  edit_recipe: z.object({
    workspace: workspaceSchema,
    edits: z
      .array(editSchema)
      .min(1)
      .max(MAX_EDITS_PER_CALL)
      .describe(`Edits applied in order (at most ${MAX_EDITS_PER_CALL} per call).`),
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
    query: z
      .string()
      .optional()
      .describe('Keep traditions whose id or name contains this text (case-insensitive).'),
    family: z
      .string()
      .optional()
      .describe(
        'Keep one family, by its exact id (list_options kind="tradition_families"); case-insensitive.'
      ),
    limit: z
      .number()
      .int()
      .positive()
      .max(LIST_TRADITIONS_MAX)
      .optional()
      .describe(`Rows per page (default 50, max ${LIST_TRADITIONS_MAX}).`),
    offset: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Rows to skip; pass the previous response's next_offset for the next page."),
  }),
  list_options: z.object({
    kind: z
      .enum(OPTION_KINDS)
      .describe(
        'Which list to enumerate. rooms and tunings are ids set_environment takes; chain_sections are the stage ' +
          'names of its `chain`; tradition_families filter list_traditions; the rest are reference only.'
      ),
  }),
};
