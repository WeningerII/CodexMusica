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

// XML text escaping for sitemap.xml. The catalog half of every URL needs none of
// this — the same measurement that lets ';' and '=' be delimiters also proves no
// id contains '&' or '<' — but the ORIGIN half comes from the Host /
// X-Forwarded-Host request header, which is caller-supplied and covered by no
// such guarantee. scripts/build_discovery.js escapes only '&' because it builds
// from a hardcoded BASE; this file cannot, so it escapes the whole string. A
// hostile Host header should at worst produce a sitemap pointing somewhere
// useless, never one that is not well-formed XML.
const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
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

// Hoisted out of indexDocument because the unknown-path handler serves it too. A
// caller that guessed a path wrong and a caller that guessed nothing at all need
// the identical table, and two copies of it would drift the first time a query
// parameter is added to one of them.
const ENDPOINTS = {
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
};

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
    endpoints: ENDPOINTS,
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

// ─────────────────────────── the crawlable surface ───────────────────────────

// WHY THIS HOST HAS TO BE FINDABLE. A model reaches this API by being handed a
// URL, and OpenAI runs an "unverified link" gate in front of that: before it will
// auto-load an address it checks whether that EXACT address has been seen by an
// independent public web index, and refuses or warns on one that has not. Being
// absent from the public index is therefore not merely a marketing problem here
// — it is a functional one, because the index is what decides whether a model is
// allowed to follow our own links. That is the standard this file's crawl
// declarations are written against.

// The query-parameter aliases handleRecipe reads for the edit list. Named once,
// because two places now depend on the same answer — whether a request carries
// the user's own words — and a list that drifts would silently start indexing
// them.
const EDIT_PARAMS = ['edit', 'edits', 'e'];

// PRESENCE, not truthiness, and not a value check. `?edit=` with an empty value
// is a malformed edit rather than the absence of one: parseEdit turns it into a
// 400 whose body still echoes the caller's own string back. hasOwnProperty is
// called off Object.prototype rather than off the object, because Express 5's
// default query parser hands back a null-prototype object on which `q.hasOwnProperty`
// is not a function.
export function carriesEdits(req) {
  for (const src of [req.query, req.body]) {
    if (!src || typeof src !== 'object') continue;
    for (const k of EDIT_PARAMS) {
      if (Object.prototype.hasOwnProperty.call(src, k)) return true;
    }
  }
  return false;
}

// robots.txt for THIS host — the instance that actually serves /v1/recipe. It is
// unrelated to the repo-root robots.txt that scripts/build_discovery.js writes
// for the GitHub Pages docs site: different origin, different paths, and neither
// one can speak for the other. Until this route existed the Render host served no
// robots.txt at all, while the Pages sitemap listed 2045 URLs and named this
// origin zero times — so the half of the product that does the editing was
// declared nowhere.
//
// OAI-SearchBot gets its own group because OpenAI documents that content is not
// discoverable in ChatGPT if that crawler is blocked, and because robots.txt
// groups are NOT additive: a crawler obeys only the most specific group matching
// its name, so the group has to repeat every rule rather than inherit from `*`.
const CRAWL_RULES = [
  'Allow: /',
  // Disallowed by PARAMETER, not by path: a bare seed and a fully edited recipe
  // are both /v1/recipe and differ only in the query string, so there is no path
  // prefix that separates them. Longest-match wins over `Allow: /` for the URLs
  // that match. The `?`/`&` anchor on the `e` alias is load-bearing: `type=` ends
  // in the literal substring `e=`, so an unanchored `/*e=` would match
  // `/v1/catalog?type=tradition` and disallow the entire catalog.
  'Disallow: /*?edit=',
  'Disallow: /*&edit=',
  'Disallow: /*?edits=',
  'Disallow: /*&edits=',
  'Disallow: /*?e=',
  'Disallow: /*&e=',
];

export function robotsTxt(req) {
  return (
    [
      '# Codex Musica — the live recipe API. AI agents and crawlers welcome on the',
      '# teaching surface: the index, the OpenAPI documents, the catalog, and the',
      '# unedited seed recipe for every tradition are all public, deterministic data.',
      '#',
      '# The edit surface is not. A URL carrying edit= is a transcription of what a',
      '# user said they wanted, in the address itself, and must not enter a public',
      '# index. See rest.js for why the header and these rules are scoped the same way.',
      '',
      'User-agent: OAI-SearchBot',
      ...CRAWL_RULES,
      '',
      'User-agent: *',
      ...CRAWL_RULES,
      '',
      `Sitemap: ${absolute(req, '/sitemap.xml')}`,
      '',
    ].join('\n') + '\n'
  );
}

// The enumerable half of /v1/catalog, derived from the route's own OPTION_KINDS
// rather than re-listed here, so a kind the route learns to serve cannot go
// missing from the sitemap. 'tradition' is prepended because handleCatalog serves
// it through listTraditions on a separate branch and it is not an options kind.
const ENUMERABLE_TYPES = ['tradition', ...new Set(Object.values(OPTION_KINDS))];

// Built from the engine's in-memory tables, never from disk: this runs on the
// hosted instance, where the repo-root sitemap.xml is both absent and about a
// different origin. Origins come from the same forwarded-host logic as every
// `self` link, so a sitemap entry is byte-identical to the canonical URL the
// endpoint itself reports — a crawler and a caller cannot end up with two
// spellings of one recipe.
export function sitemapUrls(req) {
  const urls = [absolute(req, '/'), absolute(req, '/openapi.json')];
  // /v1 and /openapi-3.0.json are deliberately absent: both are second spellings
  // of a URL already listed, and a sitemap that offers a crawler two addresses
  // for one document is asking it to pick a canonical for us.
  for (const type of ENUMERABLE_TYPES) urls.push(absolute(req, `/v1/catalog?type=${type}`));
  // limit is pinned to the live tradition count because listTraditions pages at
  // 50 by default, and a truncated sitemap is worse than a missing one: it ships
  // 50 of 1167 traditions and is indistinguishable from a complete document.
  const { items } = E.listTraditions({ limit: E.counts.traditions });
  // encodeValue, not raw interpolation — three ids carry an accented letter, and
  // it is the same encoder recipeSelf uses, which is what keeps the two spellings
  // identical.
  for (const t of items) urls.push(absolute(req, `/v1/recipe?traditions=${encodeValue(t.id)}`));
  return urls;
}

// NO <lastmod>, for the same reason scripts/build_discovery.js dropped it: a wall
// clock in a generated artifact makes the artifact a function of the day it was
// produced. Here nothing is committed, but the property still earns its keep —
// the document is a pure function of the catalog and the request host, so two
// instances behind the same load balancer cannot disagree about it.
export function sitemapDocument(req) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapUrls(req)
      .map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`)
      .join('\n') +
    '\n</urlset>\n'
  );
}

// ─────────────────────────── mounting ───────────────────────────

// The nine MCP tool names are the nine most likely wrong paths for a caller that
// read the connector docs, so they redirect instead of 404ing. Any OTHER unknown
// path gets the endpoint table and a link to the index in the body of a 404 — a
// caller that guessed wrong ends up taught, not stuck.
//
// That second sentence used to be a comment describing nothing. The only fallback
// in this file was the alias loop below, which is scoped to these nine names, so
// `/v1/recipes` — one plausible plural — fell through to Express's bare HTML 404
// and a model got back no grammar at all, from the one server whose entire design
// premise is that it teaches its own grammar on any hop. The catch-all at the end
// of mountRest is what makes the claim true.
//
// It stays a 404 rather than serving the index at 200. A host that answers 200 on
// every path is a soft-404: it tells a crawler that the 1179 URLs in sitemap.xml
// and every typo anyone ever makes are equally real pages, and it tells a caller
// that its guess was a valid endpoint, which is the same class of quiet lie as
// substituting an id nobody asked for.
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
  // X-Robots-Tag is scoped to the requests that actually carry the user's words.
  // It used to be unconditional, one line, on every response — which meant the
  // teaching index at `/`, both OpenAPI documents and every catalog page told
  // every crawler to ignore them. That is self-defeating twice over: it kept the
  // one document that explains this API out of search, and it kept our own
  // addresses out of the public index that OpenAI's unverified-link gate consults
  // before it will let a model auto-load them. We were pointing models at a host
  // we had asked the world not to look at.
  //
  // The header is scoped rather than deleted because the edit surface genuinely
  // must not be indexed: state-is-the-URL means
  // `?traditions=country&edit=set_preface;card=voice;preface=worn` is a
  // transcription of something a person said they wanted, sitting in an address.
  // Making every refinement shareable must not make it public.
  //
  // The decision cannot be keyed on the route. A seed and a fully edited recipe
  // are the same route and differ only by whether the caller attached edits, so
  // it is decided per request — and on the request BODY as well as the query,
  // because a POST /v1/recipe answer carries a `self` link that spells the edits
  // back out in a URL.
  const send = (handler) => (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=600');
      res.set('Referrer-Policy', 'no-referrer');
      if (carriesEdits(req)) res.set('X-Robots-Tag', 'noindex');
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

  // Both served from here rather than from a static file, because the only host
  // these documents describe is the one answering the request: the origin is read
  // off the forwarded headers, and the tradition list is the engine's own. A
  // checked-in file would have to hardcode an origin and would go stale against
  // the catalog on the first tradition added.
  app.get('/robots.txt', (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(robotsTxt(req));
  });

  app.get('/sitemap.xml', (req, res) => {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(sitemapDocument(req));
  });

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

  // The catch-all has to be last in the WHOLE app's stack, and mountRest is not
  // the last thing that runs. server_http.js calls it partway down and then
  // registers /.well-known/mcp.json and the /mcp transport underneath it; an
  // app.use() appended here and now would match those paths first and answer the
  // connector's initialize POST with a 404 teaching document. The MCP connector —
  // the reason this server exists — would go dark, and it would go dark silently,
  // because a 404 with a helpful JSON body looks like a working endpoint in a log.
  //
  // process.nextTick is what buys the ordering without reaching into a module
  // this file does not own. Node drains the nextTick queue after the current
  // synchronous run finishes and BEFORE the event loop dispatches any I/O, so
  // this lands after every route the entry point registers synchronously and
  // still before the first request can possibly be routed. Registering it inside
  // mountRest keeps the promise in the comment above PATH_ALIASES true for any
  // caller, including one that never reads this far.
  process.nextTick(() => {
    app.use(
      send((req) => {
        throw new RestError(404, `No endpoint at "${req.path}".`, {
          endpoints: ENDPOINTS,
          start_here: absolute(req, '/v1/recipe?traditions=delta_blues'),
          resolve_a_word: absolute(req, '/v1/catalog?q=<words>'),
        });
      })
    );
  });
}
