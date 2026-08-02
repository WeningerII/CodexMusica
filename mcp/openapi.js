// openapi.js — the OpenAPI document, GENERATED from the same Zod objects the MCP
// tools validate against.
//
// It is generated rather than written because a hand-maintained spec is a second
// description of the same contract, and this repo has already paid for that kind
// of duplication once: two renderers drifted for months across three of four
// formats while every gate stayed green. There is no drift to detect here because
// there is only one description — mcp/tools.js TOOL_SCHEMAS — and both adapters
// project from it.
//
// Two documents are served. 3.1.0 is the current standard and a true superset of
// JSON Schema. 3.0.3 exists because several action-importers still reject 3.1;
// zod's own `target: 'openapi-3.0'` emits the dialect they accept (no `$schema`,
// no `propertyNames`, no boolean `exclusiveMinimum`), so the compatibility
// document costs one argument rather than a translation layer that could rot.

import { z } from 'zod';
import { TOOL_SCHEMAS } from './tools.js';
import { counts, RECIPE_CHAR_CEILING } from './engine.js';

function schemaFor(name, target) {
  return z.toJSONSchema(TOOL_SCHEMAS[name], target === '3.0.3' ? { target: 'openapi-3.0' } : {});
}

// Query parameters are flat strings on the wire, so the numeric ones are
// advertised as integers with their real bounds and the adapter coerces before
// validating. The bounds come from the shared schema, not from a second opinion.
function paramsFrom(name, target, only) {
  const js = schemaFor(name, target);
  const props = js.properties || {};
  const required = new Set(js.required || []);
  return Object.entries(props)
    .filter(([k]) => (only ? only.includes(k) : true))
    .map(([k, v]) => ({
      name: k,
      in: 'query',
      required: required.has(k),
      description: v.description,
      schema: (() => {
        const s = { ...v };
        delete s.description;
        return s;
      })(),
    }));
}

const EDIT_DESCRIPTION =
  'One edit, applied in order. Repeat this parameter once per edit — the parameter itself is the ' +
  'boundary, so there is nothing to quote or close. Form: `<action>;<field>=<value>;…`, chain stages ' +
  'as `chain.<stage>=<id>`. Actions: add_tradition;tradition=… · remove_tradition;tradition=… · ' +
  'add_instrument;instrument=…[;tradition=…] · remove_instrument;card=… · ' +
  'set_variant;card=…;part=…;variant=… · set_environment;card=…[;room=…][;tuning=…][;chain.<stage>=…] · ' +
  'set_preface;card=…;preface=… . Resolve every id with /v1/catalog first; ids are never guessed for you.';

export function buildOpenApi(version = '3.1.0') {
  const recipeParams = [
    {
      name: 'traditions',
      in: 'query',
      required: true,
      description:
        'Tradition ids, comma-joined or repeated. ORDER IS MEANINGFUL: the first is named first in the ' +
        'header and is the last to lose material at the character ceiling. Resolve with /v1/catalog.',
      schema: { type: 'string' },
    },
    {
      name: 'edit',
      in: 'query',
      required: false,
      description: EDIT_DESCRIPTION,
      schema: { type: 'array', items: { type: 'string' } },
      explode: true,
      style: 'form',
    },
    {
      name: 'n',
      in: 'query',
      required: false,
      description:
        'Optional declared edit count. Every prefix of an edit list is itself a valid edit list, so a URL ' +
        'truncated in transit would otherwise return a different recipe with no error. Send n and a ' +
        'truncated request fails loudly instead.',
      schema: { type: 'integer', minimum: 0 },
    },
    ...paramsFrom('start_recipe', version, ['format', 'max_chars']),
    {
      name: 'include',
      in: 'query',
      required: false,
      description: 'Set to "workspace" to also return the raw workspace object.',
      schema: { type: 'string', enum: ['workspace'] },
    },
  ];

  const recipeResponse = {
    description: 'The recipe, its state, and how to refine it.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            recipe: { type: 'string', description: 'The deliverable. Present verbatim.' },
            recipe_chars: { type: 'integer' },
            present_verbatim: { type: 'boolean' },
            state: {
              type: 'object',
              description: 'The full state. Re-send it with one more edit appended to refine.',
              properties: {
                traditions: { type: 'array', items: { type: 'string' } },
                edits: { type: 'array', items: { type: 'string' } },
              },
            },
            cards: { type: 'array', items: { type: 'object' } },
            guidance: { type: 'string' },
            self: { type: 'string', description: 'Canonical URL of this exact recipe.' },
            next: { type: 'object' },
          },
          required: ['recipe', 'recipe_chars', 'state', 'self'],
        },
      },
    },
  };

  const errorResponse = {
    description:
      'Invalid request. The body names the offending field and the correct shape. When an id cannot be ' +
      'resolved it points at /v1/catalog — it never proposes a corrected id, because a plausible ' +
      'substitution returns a confident recipe for a word nobody asked for.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                status: { type: 'integer' },
                message: { type: 'string' },
                issues: { type: 'array', items: { type: 'object' } },
              },
              required: ['status', 'message'],
            },
            docs: { type: 'string' },
          },
          required: ['error'],
        },
      },
    },
  };

  const doc = {
    openapi: version,
    info: {
      title: 'Codex Musica',
      version: '2.0.0',
      description:
        `Turn a plain-language musical intent into a precise recording recipe over ${counts.traditions} ` +
        `music traditions, ${counts.instruments} instruments (each decomposed into swappable per-part ` +
        `variants) and ${counts.prefaces} named moods.\n\n` +
        'A recipe is a pure function of its URL: choose traditions, then append one `edit` parameter per ' +
        'change. There is no session — refine by re-sending the same request with one more edit. ' +
        'Everything is read-only; nothing on the server is ever modified.\n\n' +
        'THE DEFAULT SEED IS SCAFFOLDING, NOT THE ANSWER. If the user gave any stylistic words — a mood, ' +
        'a material, a piece of gear, a space, an era — resolve them with /v1/catalog and apply them as ' +
        'edits before presenting. Present the returned `recipe` string verbatim.',
      license: { name: 'See repository LICENSE', url: 'https://github.com/WeningerII/CodexMusica' },
    },
    servers: [{ url: 'https://codex-musica-mcp.onrender.com' }],
    paths: {
      '/v1/recipe': {
        get: {
          operationId: 'getRecipe',
          summary: 'Build a recipe from traditions plus an ordered list of edits',
          description:
            'Seeds from the given traditions and applies each `edit` in order. Safe and idempotent: the ' +
            'server computes, it does not store. The same URL always returns the same recipe.',
          parameters: recipeParams,
          responses: { 200: recipeResponse, 400: errorResponse },
        },
        post: {
          operationId: 'postRecipe',
          summary: 'Same as GET, with the edits as a JSON array',
          description:
            'Identical semantics and identical response. Use this when the edit list would make the URL ' +
            'unwieldy; a JSON array is also self-delimiting, so truncation cannot parse.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: z.toJSONSchema(
                  TOOL_SCHEMAS.edit_recipe,
                  version === '3.0.3' ? { target: 'openapi-3.0' } : {}
                ),
              },
            },
          },
          responses: { 200: recipeResponse, 400: errorResponse },
        },
      },
      '/v1/catalog': {
        get: {
          operationId: 'searchCatalog',
          summary: 'Resolve words to ids, or enumerate an option space',
          description:
            'With `q`: free-text search, ranked by where the term hit — an exact id or name outranks a ' +
            'mention in descriptor prose. With `type=preface` and `q`: returns each mood plus its token ' +
            'profile, which is what distinguishes near-synonyms. With `type` and no `q`: enumerates that ' +
            'space. ALWAYS resolve here before composing an edit; ids are never guessed for you.',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: false,
              description: 'Words from the request.',
              schema: { type: 'string' },
            },
            {
              name: 'type',
              in: 'query',
              required: false,
              description:
                'Restrict or enumerate. Searchable: tradition, instrument, variant, room, tuning, ' +
                'arrangement, aesthetic, preface, chain. Enumerable with no q: rooms, tunings, ' +
                'chain_sections, archetypes, aesthetics, arrangements, instrument_families, ' +
                'tradition_families, axes.',
              schema: { type: 'string' },
            },
            ...paramsFrom('search_catalog', version, ['limit']),
            { name: 'family', in: 'query', required: false, schema: { type: 'string' } },
            {
              name: 'offset',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 0 },
            },
          ],
          responses: {
            200: {
              description: 'Matching records.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            400: errorResponse,
          },
        },
      },
      '/v1/catalog/{type}/{id}': {
        get: {
          operationId: 'getRecord',
          summary: 'One record: an instrument with its knobs, or a tradition',
          description:
            'For an instrument this is the part→variant map you need before composing set_variant. Wide ' +
            'parts are sampled against a shared budget and report `variant_count` with `truncated`; narrow ' +
            'with `part` or `q` rather than raising `limit`. The default variant is always included.',
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['instrument', 'tradition'] },
            },
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ...paramsFrom('get_instrument', version, ['part', 'query', 'limit']).map((p) =>
              p.name === 'query' ? { ...p, name: 'q' } : p
            ),
          ],
          responses: {
            200: {
              description: 'The record.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            400: errorResponse,
          },
        },
      },
    },
  };

  // 3.0.3 has no top-level $schema and no webhooks; keep the document minimal so
  // strict importers have nothing to trip on.
  if (version === '3.1.0') doc.jsonSchemaDialect = 'https://json-schema.org/draft/2020-12/schema';
  void RECIPE_CHAR_CEILING;
  return doc;
}
