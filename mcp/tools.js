import { CONNECTOR_VERSION } from './contract_version.js';
// tools.js — registers the CodexMusica deterministic workspace as MCP tools.
//
// The connector is the human app's canvas, headless: start_recipe seeds a
// tradition's deterministic default cards (== the app's "Current Recipe"), and
// edit_recipe applies human-style edits (re-pick a preface — which deterministically
// re-derives that instrument's settings — swap a part variant, override room/
// chain/tuning, add/remove instruments, add/remove traditions). On this raw
// surface state is passed in and out: every recipe call returns the `workspace`
// to thread into the next. That mechanic is described on the `workspace`
// parameter and in the raw instructions below, never in a tool's main
// description — the shared /mcp endpoint publishes these same descriptions
// behind a session that carries the workspace for the caller. No hill-climb
// search, no auto-staple — the recipe is reproducible and equal to what a human
// sees in the app.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as E from './engine.js';
import { TOOL_SCHEMAS } from './schemas.js';
import { registerLyricTools, lyricInstructions, admitLyricCall } from './lyric_tools.js';
import { withExecutionContext, childExecutionContext } from './execution_context.js';
import { performance } from 'node:perf_hooks';
import { TOOL_BUDGET_MS } from './budget.js';
import {
  assertToolTask,
  toolDomain,
  taskDomain,
  RECIPE_MARKER,
  LYRICS_MARKER,
} from './task_contract.js';
import { runtimeAssets } from './runtime_assets.js';
import { jsonBytes, HTTP_REQUEST_BYTES, assertStateFits } from './payload_limits.js';

// Re-exported so existing importers keep working; the definitions live in
// schemas.js, which does not import the MCP SDK.
export { renderShape, workspaceSchema, editSchema, TOOL_SCHEMAS } from './schemas.js';
import { editSchema, unknownEditKeys } from './schemas.js';

// The nearest declared key to a misspelled one: a prefix either way, or at
// most two edits apart.
function nearestKey(key, keys) {
  const dist = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const keep = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = keep;
      }
    }
    return row[b.length];
  };
  return (
    keys.find((k) => k.startsWith(key) || key.startsWith(k)) || keys.find((k) => dist(key, k) <= 2)
  );
}

// Refuse a call whose arguments carry an undeclared key, and an edit_recipe
// call whose edits do, before the SDK's schema parse strips it (see
// unknownEditKeys). A stripped key was silently dropped: `lyric_sweep` with
// `line: 12` swept with no length. The published schemas cannot say so
// themselves (no additionalProperties: connector-schema-subset). The SDK
// validates input in McpServer.validateToolInput; wrapping it is the one place
// the raw arguments are visible. mcp/test_connector_contracts.mjs fails if
// this hook stops running on either server.
// Keys no surface publishes any more but older callers still send: stripped
// without a refusal, as before. `writer` was retired 2026-09-27 (the caller
// writes every line; test_session_repairs pins that it changes nothing), and
// a client-sent `workflow` (forged creation receipts) is stripped so the
// creation order still refuses the call by name (test_chatgpt).
const TOLERATED_KEYS = new Set(['writer', 'workflow']);

export function guardEditKeys(server) {
  const validate = server.validateToolInput?.bind(server);
  if (!validate)
    throw new Error('The MCP SDK no longer exposes validateToolInput; move the edit-key guard.');
  server.validateToolInput = async (tool, args, toolName) => {
    const declared = Object.keys(tool?.inputSchema?.shape || {});
    if (declared.length && args && typeof args === 'object' && !Array.isArray(args)) {
      const unknown = Object.keys(args).filter(
        (k) => !declared.includes(k) && !TOLERATED_KEYS.has(k)
      );
      if (unknown.length) {
        const hints = unknown
          .map((k) => [k, nearestKey(k, declared)])
          .filter(([, near]) => near)
          .map(([k, near]) => `${near} (for ${k})`);
        throw new Error(
          `Unknown argument(s) for ${toolName}: ${unknown.join(', ')}.` +
            (hints.length ? ` Did you mean ${hints.join(', ')}?` : '') +
            ` Call ${toolName} again with only its arguments: ${declared.join(', ')}. Nothing was run.`
        );
      }
    }
    if (toolName === 'edit_recipe') {
      const unknown = unknownEditKeys(args);
      if (unknown.length)
        throw new Error(
          `Unknown edit field(s): ${unknown.join(', ')}. An edit takes ${Object.keys(editSchema.shape).join(', ')} — check the spelling. Nothing was applied.`
        );
    }
    return validate(tool, args, toolName);
  };
  return server;
}

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

// Recipe tools keep their deterministic annotations. Lyric tools can override
// them: revision mutates a run and its kitchen writer calls an external model.
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

function tool(server, name, config, fn) {
  if (server.task && taskDomain(server.task) !== toolDomain(name)) return;
  const withAnnotations = {
    ...config,
    annotations: { ...READ_ONLY_ANNOTATIONS, ...(config.annotations || {}) },
  };
  server.registerTool(name, withAnnotations, async (args, extra) => {
    try {
      const inputBytes = jsonBytes(args ?? {});
      if (inputBytes > HTTP_REQUEST_BYTES - 1024)
        throw new Error('Tool arguments exceed the encoded request budget.');
      for (const key of ['state', 'checkpoint', 'blueprint'])
        if (typeof args?.[key] === 'string') assertStateFits(args[key], key);
      const inherited = childExecutionContext();
      const task = server.task || inherited.task;
      assertToolTask(task, name, args ?? {});
      if (
        name.startsWith('lyric_') &&
        !(name === 'lyric_revise' && args?.recover_only === true) &&
        process.env.LYRIC_RELEASE_ASSETS_REQUIRED === '1' &&
        !runtimeAssets().ok
      )
        throw new Error(
          'LYRIC_ASSETS_UNAVAILABLE: the installed grading assets failed the release check. The server cannot run lyric tools until it is repaired, and nothing was started. Retry this same call later; lyric_revise with recover_only: true still exports a held journal.'
        );
      // The recognition caps (#677 W5): refused here, before the handler can
      // reach the Python bridge's queue, with RESOURCE_LIMIT and its cause.
      if (name.startsWith('lyric_')) admitLyricCall(name, args ?? {});
      const out = await withExecutionContext(
        childExecutionContext({
          signal: extra?.signal,
          task,
          inputBytes,
          ...(name.startsWith('lyric_')
            ? {
                deadlineAt: performance.now() + TOOL_BUDGET_MS,
              }
            : {}),
        }),
        () => fn(args ?? {}, extra)
      );
      // A handler may return a ready MCP result (multiple content blocks —
      // lyric_grade leads with the SONG as plain text so a client presents
      // it rather than reformatting escaped JSON; the Wide Room screenshot,
      // 2026-08-19, is why). Anything else gets the JSON wrapping.
      if (out && Array.isArray(out.content)) return out;
      return jsonResult(out);
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
        'app ("Current Recipe"); a card with no `changed` field is the stock default. Every tradition you list adds its ' +
        'instruments and the first one leads; no tradition is added that you did not list; a tradition listed twice is ' +
        'refused. Returns the recipe string, a per-card summary (with each ' +
        "instrument's preface) and render_scope (the card the environment renders from, and its settings). An unknown " +
        'id is refused, and the refusal names the lookup that finds a real one.',
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
        'Apply an ordered batch of edits in one call. Edits: set_preface ' +
        "(re-derives that instrument's variants/tuning/room/chain toward the preface, then labels " +
        'it verbatim), set_variant (set one part — material, build, technique; the part is ' +
        'pinned and never reverted. As in the app, an auto-derived preface label re-derives from the new sound, and a material ' +
        "part may also move that card's other parts toward the preface; room, tuning and chain never move), set_environment " +
        '(any room/tuning/chain; no combination is fenced. The recipe renders ONE environment, ' +
        'from render_scope.environment_card; omit `card` and the edit lands there, so one edit sets the whole recording. A chain ' +
        'id on a multi-select stage (fx) is added to its list; `clear` unsets room, tuning or a stage. The environment lives on ' +
        'that card, so removing or moving the card changes what renders (render_warnings: ENVIRONMENT_MOVED), and a ' +
        'set_preface on it after a set_environment overwrites it (ENVIRONMENT_OVERWRITTEN)), add_instrument / remove_instrument (any instrument into any ' +
        'tradition), add_tradition / remove_tradition, move_instrument (preserve the card and its settings; omit before to move ' +
        'it to the front). Explicit part descriptors have priority in Rich compression. An empty `render_warnings` means ' +
        'every requested part, preface and environment word is in the output.',
      inputSchema: TOOL_SCHEMAS.edit_recipe.shape,
    },
    (a) => E.editRecipe(a)
  );

  tool(
    server,
    'render_recipe',
    {
      title: 'Re-render the recipe',
      description:
        'Render the current recipe again — a different format or max_chars — without editing it.',
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
        'chain items, returning real ids. search_prefaces searches the same prefaces, ranked the same way, and also returns ' +
        "each one's note and token profile. " +
        'Hits on an id or name outrank hits in descriptor prose, and matching every term ' +
        'outranks matching some. A chain hit carries the `stage` that takes it. Arrangement and aesthetic hits are reference ' +
        'only — no edit takes those ids.',
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
        "Search the named prefaces (aesthetic, technique or delivery signatures) by mood/feel words from the user's request. " +
        "Ranked like search_catalog: an exact id first, then words in an id, then the preface's note, then its tokens. " +
        'edit_recipe set_preface takes the id. Any preface can target any instrument. A word with no preface hit may name gear or a space ' +
        'instead: try search_catalog.',
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
        'the default. Wide parts are SAMPLED, not dumped — shared materials tables give some parts hundreds ' +
        `of variants (the widest has ${E.WIDEST_PART_VARIANTS}), so each part reports its full \`variant_count\` and sets ` +
        '`truncated` when you are seeing a slice. `query` filters variants by name and descriptor, ' +
        '`part` focuses one part. The default variant is always included.',
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
        'List traditions, optionally filtered: `query` keeps traditions whose id or name contains the text; `family` keeps one exact family (list_options ' +
        `kind="tradition_families"). Paginated, at most ${E.LIST_TRADITIONS_MAX} per page; next_offset continues. For ` +
        'free-text search use search_catalog.',
      inputSchema: TOOL_SCHEMAS.list_traditions.shape,
    },
    (a) => E.listTraditions(a)
  );

  tool(
    server,
    'list_options',
    {
      title: 'Enumerate a catalog list',
      description:
        'Enumerate one catalog list. rooms and tunings are ids set_environment takes. chain_sections are the stage names of ' +
        'set_environment\'s chain, not chain ids — search_catalog types=["chain"] returns those, each with its stage. ' +
        'tradition_families filter list_traditions. archetypes, aesthetics, arrangements, instrument_families and axes are ' +
        'reference only: no edit takes them. Each response says what accepts its ids (accepted_by).',
      inputSchema: TOOL_SCHEMAS.list_options.shape,
    },
    (a) => E.listOptions(a)
  );

  // ── Lyrics (the DISJOINT family — lyric_tools.js; standing rule 1 of
  //    lyric-harness/CLAUDE.md: the recipe engine and the lyrics do not
  //    touch, so the registration is the only line they share) ───────────
  registerLyricTools(server, tool);
}

// `kitchen` is the website chat's switch and nothing else's (owner's rule,
// 2026-09-27): the service's own Gemini writer may answer revise questions only
// where Gemini is writing the whole song. chat.js turns it on for its in-process
// server; every outside surface — /mcp, /mcp/lyrics, the ChatGPT aliases, stdio —
// builds without it, so its lyric_revise publishes no writer choice and the
// caller writes every line.
export function buildServer({ task = null, kitchen = false } = {}) {
  if (task) taskDomain(task);
  const recipeInstructions =
    `CodexMusica turns plain-language musical intent into a precise recording recipe over ${E.counts.traditions} ` +
    `traditions, ${E.counts.instruments} instruments (each decomposed into swappable per-part variants), and ` +
    `${E.counts.prefaces} prefaces (named mood/technique signatures). start_recipe returns a tradition's stock ` +
    `cards; a card with no \`changed\` field is the stock default. edit_recipe changes them; any instrument fits ` +
    `any tradition. There are NO coherence fences: nothing is anachronistic, out-of-region, or physically ` +
    `impossible here — the catalog's period-accurate defaults are flavor to keep or override, and every id-valid ` +
    `combination renders. ${kitchen ? 'The chat carries the recipe workspace between calls for you' : "Thread the returned 'workspace' into the next call"}. ` +
    `search_catalog and search_prefaces resolve words to ids; an unknown id is refused, and the refusal names the ` +
    `lookup that finds a real one. Deterministic and reproducible — identical to what a human sees in the app. ` +
    `Present the final recipe string to the user verbatim (exact characters).`;
  // Single-family endpoints are structural; only a mixed connection states
  // the session's own refusal (#671 B2).
  const common =
    (task ? '' : 'A session refuses the other family (SESSION_SCOPE). ') +
    'Recipe defaults are Rich and at most 1000 characters. External hosts must preserve the selected task and exact artifact. ';
  const instructions =
    common +
    '\n' +
    (!task || taskDomain(task) === 'recipe'
      ? RECIPE_MARKER + '\n' + recipeInstructions + '\n'
      : '') +
    (!task || taskDomain(task) === 'lyrics'
      ? LYRICS_MARKER + '\n' + lyricInstructions({ kitchen }) + '\n'
      : '');
  const server = new McpServer(
    { name: 'codex-musica', version: CONNECTOR_VERSION },
    { instructions }
  );
  Object.defineProperty(server, 'task', {
    value: task ? Object.freeze({ ...(typeof task === 'string' ? { domain: task } : task) }) : null,
  });
  Object.defineProperty(server, 'kitchen', { value: kitchen === true });
  registerTools(server);
  return guardEditKeys(server);
}
