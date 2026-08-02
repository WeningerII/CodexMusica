// rest.js — the REST/OpenAPI adapter: the same nine engine functions, reachable
// by anything that can fetch a URL.
//
// WHY THIS EXISTS. The MCP connector is excellent and unreachable by most of the
// world: a client has to be configured before a single call can happen. A large
// share of tool-using software instead consumes an OpenAPI document and calls
// plain HTTP. Without this file those callers can read the precompiled api/ and
// nothing else — the workspace, which is the actual product, is closed to them.
//
// THE SHAPE. Three routes, so the caller's routing decision is a ternary — am I
// making the thing, looking a word up, or reading one record — rather than a
// nine-way choice:
//
//   GET|POST /v1/recipe            startRecipe + editRecipe + renderRecipe
//   GET      /v1/catalog           searchCatalog + searchPrefaces + listTraditions + listOptions
//   GET      /v1/catalog/{type}/{id}   getInstrument + getTradition
//
// `format` is a representation of the same recipe, not a second resource, so
// render_recipe folds into a query parameter rather than a route.
//
// STATE IS THE URL. A recipe is a pure function of `traditions` plus an ordered
// edit list, so the whole conversation lives in the query string and the server
// keeps nothing. That preserves the statelessness server_http.js deliberately
// fought for — an instance restart cannot orphan a session because there are no
// sessions — and it makes every recipe a shareable, bookmarkable, cacheable URL.
//
// EDITING OVER GET IS SAFE, in the precise sense RFC 9110 means: safe is about
// side effects on the server, not about computation. Nothing here mutates. An
// "edit" is a function argument. The response is a pure function of the URI, so
// it is idempotent and genuinely cacheable.
//
// WHY A DELIMITED EDIT STRING IS NOT THE USUAL MISTAKE. Packing structure into a
// query value normally founders on quoting. It cannot here, and that is a
// measured property of this catalog rather than a hope: across all 14,450
// distinct ids — traditions, instruments, parts, variants, rooms, tunings,
// prefaces, chain stages and items, arrangements, aesthetics, archetypes — not
// one contains a comma, semicolon, equals, ampersand, whitespace, '?', '#', '+'
// or '%'. Three carry an accented letter and percent-encode cleanly. So ';' and
// '=' are unambiguous delimiters with no escaping rule to get wrong, and
// scripts/check_rest_parity.js re-proves that against the live catalog so the day
// someone mints an id with a comma in it, this gate fails instead of the URLs.
//
// AND THE BOUNDARY IS HTTP'S, NOT OURS. One `edit=` parameter per edit. The
// element boundary is established by the query parser before this file's grammar
// is read, which makes an entire class of malformed input unrepresentable rather
// than merely rejected: no brackets to leave unclosed, no quotes to curl, no
// trailing commas, no nesting.

import * as E from './engine.js';
import { TOOL_SCHEMAS, editSchema } from './schemas.js';
import { RECIPE_CHAR_CEILING } from './engine.js';

// ─────────────────────────── edit grammar ───────────────────────────

// `<action>;<field>=<value>;<field>=<value>`, chain stages as dotted keys
// (`chain.mic=sm57`). Separators are forgiving on input — ';' or ',' both split,
// because a model that guesses the wrong one is right about everything that
// matters — but only ';' is ever EMITTED, in `state.edits` and in `self`, so a
// caller's second request is canonical without anyone explaining the difference.
const EDIT_FIELDS = new Set([
  'tradition',
  'instrument',
  'card',
  'part',
  'variant',
  'preface',
  'room',
  'tuning',
]);

export function parseEdit(raw, index) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) throw new RestError(400, `edit[${index}] is empty.`, editHelp());

  const segs = text
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length === 0) throw new RestError(400, `edit[${index}] is empty.`, editHelp());

  const action = segs[0].includes('=') ? null : segs.shift();
  if (!action) {
    throw new RestError(
      400,
      `edit[${index}] does not start with an action. Got "${text}".`,
      editHelp()
    );
  }

  const out = { action };
  for (const seg of segs) {
    const eq = seg.indexOf('=');
    if (eq < 0) {
      throw new RestError(
        400,
        `edit[${index}] segment "${seg}" is not <field>=<value>. Every field after the action must be named.`,
        editHelp(action)
      );
    }
    const key = seg.slice(0, eq).trim();
    const value = seg.slice(eq + 1).trim();
    if (key.startsWith('chain.')) {
      const stage = key.slice(6);
      if (!stage)
        throw new RestError(
          400,
          `edit[${index}]: "chain." needs a stage, e.g. chain.mic=sm57.`,
          editHelp('set_environment')
        );
      out.chain = out.chain || {};
      out.chain[stage] = value;
      continue;
    }
    if (!EDIT_FIELDS.has(key)) {
      throw new RestError(
        400,
        `edit[${index}]: unknown field "${key}". Fields: ${[...EDIT_FIELDS].join(', ')}, chain.<stage>.`,
        editHelp(action)
      );
    }
    out[key] = value;
  }
  return out;
}

const EDIT_FORMS = {
  add_tradition: 'add_tradition;tradition=<tradition>',
  remove_tradition: 'remove_tradition;tradition=<tradition>',
  add_instrument: 'add_instrument;instrument=<instrument>[;tradition=<tradition>]',
  remove_instrument: 'remove_instrument;card=<card>',
  set_variant: 'set_variant;card=<card>;part=<part>;variant=<variant>',
  set_environment:
    'set_environment;card=<card>[;room=<room>][;tuning=<tuning>][;chain.<stage>=<id>]',
  set_preface: 'set_preface;card=<card>;preface=<preface>',
};

function editHelp(action) {
  if (action && EDIT_FORMS[action]) return { form: EDIT_FORMS[action] };
  return { forms: EDIT_FORMS };
}

// Emit the canonical spelling. Field order is fixed so the same edit always
// serialises the same way — the URL is a cache key and an identity.
const FIELD_ORDER = [
  'tradition',
  'instrument',
  'card',
  'part',
  'variant',
  'preface',
  'room',
  'tuning',
];

export function formatEdit(e) {
  const parts = [e.action];
  for (const f of FIELD_ORDER) if (e[f] != null) parts.push(`${f}=${e[f]}`);
  for (const [stage, id] of Object.entries(e.chain || {})) parts.push(`chain.${stage}=${id}`);
  return parts.join(';');
}

// ─────────────────────────── errors ───────────────────────────

export class RestError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

// Every error says what was wrong, what shape is right, and — when the failure is
// an unresolvable id — where to go and look it up. It NEVER proposes a corrected
// URL built from a guess. Measured on this catalog: of 23 ids a model plausibly
// invents, 15 produce a confident-looking semantic neighbour, and replaying one
// returns HTTP 200 with a finished, presentable recipe for a word the user never
// said — in one case byte-identical to an untouched seed, so nothing on screen
// reveals the substitution. The server may REORDER what the caller sent. It may
// never SUBSTITUTE what the caller did not send. Candidates are offered as
// labelled search results for the caller to choose from, never as a link that
// silently resolves for them.
function errorBody(err, req) {
  const body = {
    error: {
      status: err.status || 500,
      message: err.message || String(err),
      ...err.extra,
    },
    docs: absolute(req, '/'),
  };
  return body;
}

// ─────────────────────────── validation ───────────────────────────

// Query strings are all strings; the schemas want numbers. Coerce ONLY the
// numeric params, then hand the result to the same Zod object the MCP tool
// validates against. Nothing reaches engine.js unvalidated — engine.js checks
// nothing itself, and its failures are silent (`format: "RICH"` renders 358
// characters instead of 998 and returns no error at all).
const NUMERIC = new Set(['max_chars', 'limit', 'offset']);

function coerce(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (NUMERIC.has(k) && typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? n : v; // let Zod produce the message
      continue;
    }
    out[k] = v;
  }
  return out;
}

function validate(toolName, params) {
  const schema = TOOL_SCHEMAS[toolName];
  const res = schema.safeParse(coerce(params));
  if (res.success) return res.data;
  const issues = res.error.issues.map((i) => ({
    field: i.path.join('.') || '(root)',
    problem: i.message,
  }));
  throw new RestError(400, `Invalid parameters for ${toolName}.`, { issues });
}

// ─────────────────────────── helpers ───────────────────────────

function absolute(req, path) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}${path}`;
}

// Sub-delims are legal unencoded in a query (RFC 3986 §3.4), so the canonical URL
// reads as the caller typed it rather than as %3D soup. A readable URL is one a
// model can copy, edit and re-emit.
function encodeValue(v) {
  return encodeURIComponent(String(v))
    .replace(/%3B/g, ';')
    .replace(/%3D/g, '=')
    .replace(/%2C/g, ',');
}

function list(v) {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr
    .flatMap((x) => String(x).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────── /v1/recipe ───────────────────────────

function recipeSelf(req, { traditions, edits, format, max_chars }) {
  const q = [`traditions=${traditions.map(encodeValue).join(',')}`];
  for (const e of edits) q.push(`edit=${encodeValue(formatEdit(e))}`);
  if (format) q.push(`format=${format}`);
  if (max_chars) q.push(`max_chars=${max_chars}`);
  return absolute(req, `/v1/recipe?${q.join('&')}`);
}

export function handleRecipe(req, input) {
  const traditions = list(input.traditions ?? input.tradition ?? input.t);
  if (traditions.length === 0) {
    throw new RestError(400, 'traditions is required — at least one tradition id.', {
      how: 'GET /v1/recipe?traditions=<id>[,<id>]&edit=<edit>&edit=<edit>',
      resolve: absolute(req, '/v1/catalog?q=<words>&type=tradition'),
    });
  }

  const rawEdits = Array.isArray(input.edit ?? input.edits ?? input.e)
    ? (input.edit ?? input.edits ?? input.e)
    : [input.edit ?? input.edits ?? input.e].filter((x) => x != null);

  // Declared count. Every prefix of an edit list is itself a valid edit list, so
  // a URL truncated in transit would otherwise return a plausible, shorter,
  // DIFFERENT recipe at 200 — measured at 3.5–8.8% of truncations, including
  // `preface=keening` clipping to `keen`, which is also a real preface. `n` turns
  // that silent wrong answer into a loud one. It is a patch on the encoding, not
  // a property of it; POST carries a JSON array, which is self-delimiting and
  // needs no such thing.
  const declared = input.n == null ? null : Number(input.n);

  const parsed = rawEdits.map((raw, i) =>
    typeof raw === 'object' && raw !== null ? editSchema.parse(raw) : parseEdit(raw, i)
  );

  if (declared != null) {
    if (!Number.isInteger(declared) || declared < 0) {
      throw new RestError(
        400,
        `n must be a non-negative integer (the number of edit= parameters). Got "${input.n}".`
      );
    }
    if (declared !== parsed.length) {
      throw new RestError(
        400,
        `n=${declared} but ${parsed.length} edit parameter(s) arrived — the request was truncated or altered in transit.`,
        { declared, received: parsed.length, received_edits: parsed.map(formatEdit) }
      );
    }
  }

  const format = input.format;
  const max_chars = input.max_chars;

  let result;
  if (parsed.length === 0) {
    const args = validate('start_recipe', { traditions, format, max_chars });
    result = E.startRecipe(args);
  } else {
    const seed = validate('start_recipe', { traditions, format, max_chars });
    const started = E.startRecipe(seed);
    const args = validate('edit_recipe', {
      workspace: started.workspace,
      edits: parsed,
      format,
      max_chars,
    });
    result = E.editRecipe(args);
  }

  const self = recipeSelf(req, { traditions, edits: parsed, format, max_chars });
  const body = {
    recipe: result.recipe,
    recipe_chars: result.recipe_chars,
    present_verbatim: true,
    state: { traditions, edits: parsed.map(formatEdit) },
    cards: result.cards,
    self,
    next: {
      how: 'Refine by re-fetching `self` with one more edit= parameter appended. State lives in the URL; there is no session.',
      edit_forms: EDIT_FORMS,
      resolve_a_word: absolute(req, '/v1/catalog?q=<words>'),
      instrument_knobs: absolute(req, '/v1/catalog/instrument/<instrument_id>'),
      formats: ['rich', 'tags', 'prose', 'compact'],
    },
  };
  if (result.guidance) body.guidance = result.guidance;
  if (input.include === 'workspace') body.workspace = result.workspace;
  return body;
}

// ─────────────────────────── /v1/catalog ───────────────────────────

const OPTION_KINDS = {
  room: 'rooms',
  rooms: 'rooms',
  tuning: 'tunings',
  tunings: 'tunings',
  chain: 'chain_sections',
  chain_sections: 'chain_sections',
  archetype: 'archetypes',
  archetypes: 'archetypes',
  aesthetic: 'aesthetics',
  aesthetics: 'aesthetics',
  arrangement: 'arrangements',
  arrangements: 'arrangements',
  instrument_families: 'instrument_families',
  tradition_families: 'tradition_families',
  axes: 'axes',
};

export function handleCatalog(req, input) {
  const q = input.q ?? input.query;
  const types = list(input.type ?? input.types);

  if (q == null || String(q).trim() === '') {
    // No query: enumerate. `type` decides which space.
    if (types.length === 1 && types[0] === 'tradition') {
      const args = validate('list_traditions', {
        query: input.family ? undefined : undefined,
        family: input.family,
        limit: input.limit,
        offset: input.offset,
      });
      return { ...E.listTraditions(args), self: absolute(req, req.originalUrl || '/v1/catalog') };
    }
    const kind = types.length === 1 ? OPTION_KINDS[types[0]] : null;
    if (kind) {
      const args = validate('list_options', { kind });
      return { ...E.listOptions(args), self: absolute(req, req.originalUrl || '/v1/catalog') };
    }
    throw new RestError(
      400,
      'Provide q=<words> to search, or type=<kind> with no q to enumerate.',
      {
        searchable_types: [
          'tradition',
          'instrument',
          'variant',
          'room',
          'tuning',
          'arrangement',
          'aesthetic',
          'preface',
          'chain',
        ],
        enumerable_types: [...new Set(Object.values(OPTION_KINDS))],
      }
    );
  }

  // Mood words want the preface token profiles, which search_catalog does not
  // carry — that is why search_prefaces exists as a separate view rather than a
  // filter. Asking for prefaces here gets both: catalog's field-weighted ranking
  // and the profiles needed to choose between near-synonyms.
  if (types.length === 1 && types[0] === 'preface') {
    const args = validate('search_prefaces', { query: String(q), limit: input.limit });
    return { ...E.searchPrefaces(args), self: absolute(req, req.originalUrl || '/v1/catalog') };
  }

  const args = validate('search_catalog', {
    query: String(q),
    types: types.length ? types : undefined,
    limit: input.limit,
  });
  return { ...E.searchCatalog(args), self: absolute(req, req.originalUrl || '/v1/catalog') };
}

export function handleRecord(req, type, id) {
  if (type === 'instrument') {
    const args = validate('get_instrument', {
      id,
      part: req.query.part,
      query: req.query.q ?? req.query.query,
      limit: req.query.limit,
    });
    return { ...E.getInstrument(args), self: absolute(req, req.originalUrl || '') };
  }
  if (type === 'tradition') {
    const args = validate('get_tradition', { id });
    return { ...E.getTradition(args), self: absolute(req, req.originalUrl || '') };
  }
  throw new RestError(400, `No record type "${type}". Use instrument or tradition.`, {
    search_instead: absolute(req, `/v1/catalog?q=${encodeURIComponent(id)}`),
  });
}

// ─────────────────────────── the teaching hop ───────────────────────────

// A caller that fetched nothing but the host gets the ENTIRE grammar here, so no
// out-of-band documentation is ever required. This is the difference between
// "paste the URL and it works" and "paste the URL and read the docs first".
export function indexDocument(req) {
  return {
    name: 'Codex Musica',
    what: `Turn a plain-language musical intent into a precise recording recipe over ${E.counts.traditions} traditions, ${E.counts.instruments} instruments and ${E.counts.prefaces} named moods.`,
    how_it_works:
      'A recipe is a pure function of its URL: pick traditions, then append one edit= parameter per change. There is no session and no state on the server — refine by re-fetching with one more edit appended. Present the returned `recipe` string to the user verbatim.',
    start_here: absolute(req, '/v1/recipe?traditions=delta_blues'),
    endpoints: {
      'GET /v1/recipe':
        'traditions=<id>[,<id>] (order matters; first is primary) & edit=<edit> (repeatable, applied in order) & format=rich|tags|prose|compact & max_chars=1..' +
        RECIPE_CHAR_CEILING +
        ' & n=<declared edit count, optional> & include=workspace',
      'POST /v1/recipe':
        'Same, as JSON {traditions:[], edits:[], format, max_chars}. No URL length limit.',
      'GET /v1/catalog':
        'q=<words> to search, & type=<t>[,<t>] to filter; or type=<kind> with no q to enumerate.',
      'GET /v1/catalog/{type}/{id}':
        'type is instrument or tradition. For instruments: ?part=, ?q=, ?limit=.',
    },
    edit_forms: EDIT_FORMS,
    worked_example: {
      intent: 'a worn, bitter country song recorded in a small room',
      step_1: absolute(req, '/v1/catalog?q=country&type=tradition'),
      step_2: absolute(req, '/v1/catalog?q=worn%20bitter&type=preface'),
      step_3: absolute(req, '/v1/catalog?q=small%20room&type=room'),
      step_4: absolute(
        req,
        '/v1/recipe?traditions=country&edit=set_preface;card=voice;preface=worn&edit=set_environment;card=voice;room=carpeted_bedroom'
      ),
    },
    rules: [
      'Never invent an id. Resolve every word with /v1/catalog first — the server will not guess one for you.',
      'The default seed is scaffolding, not the answer. If the user gave any stylistic words, edit before presenting.',
      'Present the final `recipe` string verbatim, exactly as returned.',
    ],
    openapi: absolute(req, '/openapi.json'),
    mcp: { endpoint: absolute(req, '/mcp'), card: absolute(req, '/.well-known/mcp.json') },
  };
}

// The engine throws `Unknown tradition: "x"` / `Unknown room: "y"` / `... has no
// part "z"`. Those are the moments a caller most needs a pointer, and most needs
// NOT to be handed a guess: turn each into a search URL it can run itself and
// choose from. The word in the message is echoed back as the query, so the
// caller searches for what it actually meant rather than for whatever the server
// would have picked on its behalf.
const UNRESOLVED = [
  [/Unknown tradition: "([^"]*)"/, 'tradition'],
  [/Unknown room: "([^"]*)"/, 'room'],
  [/Unknown tuning: "([^"]*)"/, 'tuning'],
  [/Unknown preface: "([^"]*)"/, 'preface'],
  [/Unknown instrument: "([^"]*)"/, 'instrument'],
  [/Unknown (\w+) id: "([^"]*)"/, 'chain'],
];

function unresolvedHint(req, err) {
  const msg = (err && err.message) || '';
  for (const [rx, type] of UNRESOLVED) {
    const m = msg.match(rx);
    if (!m) continue;
    const word = m[2] || m[1];
    return {
      resolve: absolute(req, `/v1/catalog?q=${encodeURIComponent(word)}&type=${type}`),
      note: 'Run that search and pick an id yourself. The server will not substitute one — a near-miss returns a confident recipe for a word nobody asked for.',
    };
  }
  const part = msg.match(/has no part "([^"]*)"/);
  if (part) {
    const inst = msg.match(/\b([a-z0-9_]+) has no part/);
    return {
      knobs: absolute(req, `/v1/catalog/instrument/${inst ? inst[1] : '<instrument_id>'}`),
      note: 'That endpoint lists every part and the variant ids valid for set_variant.',
    };
  }
  return {};
}

// ─────────────────────────── mounting ───────────────────────────

// The nine MCP tool names are the nine most likely wrong paths for a caller that
// read the connector docs, so they redirect instead of 404ing. An unknown path
// returns the index rather than a bare error — a caller that guessed wrong should
// end up taught, not stuck.
const PATH_ALIASES = {
  start_recipe: '/v1/recipe',
  edit_recipe: '/v1/recipe',
  render_recipe: '/v1/recipe',
  recipe: '/v1/recipe',
  search_catalog: '/v1/catalog',
  search_prefaces: '/v1/catalog',
  list_traditions: '/v1/catalog',
  list_options: '/v1/catalog',
  catalog: '/v1/catalog',
};

export function mountRest(app, { openapi } = {}) {
  const send = (handler) => (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=600');
      res.set('Referrer-Policy', 'no-referrer');
      res.set('X-Robots-Tag', 'noindex');
      res.json(handler(req));
    } catch (err) {
      const e =
        err instanceof RestError
          ? err
          : new RestError(400, err.message || String(err), unresolvedHint(req, err));
      res.status(e.status).json(errorBody(e, req));
    }
  };

  app.get(
    '/',
    send((req) => indexDocument(req))
  );
  app.get(
    '/v1',
    send((req) => indexDocument(req))
  );

  app.get(
    '/v1/recipe',
    send((req) => handleRecipe(req, req.query))
  );
  app.post(
    '/v1/recipe',
    send((req) => handleRecipe(req, req.body || {}))
  );
  app.get(
    '/v1/catalog',
    send((req) => handleCatalog(req, req.query))
  );
  app.get(
    '/v1/catalog/:type/:id',
    send((req) => handleRecord(req, req.params.type, req.params.id))
  );

  if (openapi) {
    app.get('/openapi.json', (_req, res) => res.json(openapi('3.1.0')));
    app.get('/openapi-3.0.json', (_req, res) => res.json(openapi('3.0.3')));
  }

  for (const [alias, target] of Object.entries(PATH_ALIASES)) {
    for (const p of [`/${alias}`, `/v1/${alias}`]) {
      app.all(p, (req, res) => {
        const qs = req.originalUrl.includes('?')
          ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
          : '';
        res.set('X-Codex-Alias', target);
        res.redirect(308, target + qs);
      });
    }
  }
}
