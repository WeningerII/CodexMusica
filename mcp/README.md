# CodexMusica MCP server

This drives the CodexMusica **deterministic workspace** as callable tools for AI
agents — the same canvas a human edits in the browser app, headless. An agent
seeds a tradition's default cards (identical to the app's "Current Recipe"), then
edits them: re-pick an instrument's **preface** (which deterministically re-derives
its variants/tuning/room/chain), swap a part variant, override room/chain/tuning,
add or remove instruments, add or remove traditions. State is passed in and out —
each recipe call returns the `workspace` to thread into the next. There is **no
scoring search and no auto-staple**: the recipe is reproducible and equal to what a
human sees in the app.

It reuses the shared SSOT modules in-process (`scripts/_workspace_ops.js` →
`_seed_workspace.js` / `_recipe_stack.js` / `_inverse_configure.js`, the catalog in
`references/`); it adds no new music logic.

## Tools

Native clients should use `connectConnector` in `client.js`; new lyrics default
to enforced creation order with host-owned execution receipts. Keep the connection
or privately persist its `snapshot()` for reconnecting. The CLI uses the same
client and requires `--session-file=FILE` for creation calls. An explicit host
`phase: 'edit'` (`--phase=edit` in the CLI) selects an existing-song task.
See [session workflow repairs](../docs/session-workflow-repairs.md) for continuation,
verification evidence, and the limitations of independent raw MCP calls.

Recipe edits include `move_instrument`, which preserves a card's settings while
changing its position (`before` omitted means first). Rich compression prioritizes
explicitly pinned descriptors; inspect `render_warnings` for explicit words absent
from the result and `render_scope` for which shared environment is represented.

| Tool | What it does |
|---|---|
| `start_recipe` | Seed a recipe from one or more `traditions` (first = primary, rest = explicit staples). Returns the recipe, a per-card summary, and the `workspace` to thread on. |
| `edit_recipe` | Apply an ordered `edits` list to a `workspace`: `set_preface` (re-derive an instrument toward a mood, labeled verbatim), `set_variant` (sets one part, then reshapes the rest of that card toward its preface with your part pinned — the same cascade the app runs), `set_environment`, `add_instrument` / `remove_instrument`, `add_tradition` / `remove_tradition`. |
| `render_recipe` | Re-render a `workspace` (e.g. different `format` or `max_chars`) without editing it. |
| `search_catalog` | Free-text search → ids, across traditions, instruments, variants, rooms, tunings, arrangements, aesthetics, prefaces, chain. Resolve words before guessing. |
| `search_prefaces` | Mood/feel words → preface ids for `set_preface`. |
| `get_instrument` | The **knob catalog** — every part and the variant ids you pass to `set_variant`. |
| `get_tradition` / `list_traditions` | Full tradition record (incl. axis profile + default instruments); browse/filter traditions. |
| `list_options` | Enumerate override spaces: `rooms`, `tunings`, `chain_sections`, `archetypes`, `aesthetics`, `arrangements`, `instrument_families`, `tradition_families`, `axes`. |

**The lyric family** is a disjoint songwriting pipeline over the
[lyric harness](../lyric-harness/): planning, grading, writing and revision. It
shares no state with the recipe workspace. The connector reaches the harness CLI
through a serialized Python worker. Planning and grading use local code and
staged lexical data; `lyric_revise` can maintain a run and, with `writer: kitchen`,
call Google's Gemini API to propose lyric repairs. Revision is stateful and the
kitchen's output is not deterministic. See [LYRICS_RUNTIME.md](./LYRICS_RUNTIME.md)
for time budgets, paid-work accounting, run recovery and deployment requirements.

| Tool | What it does |
|---|---|
| `lyric_screen` | Screen 2–12 candidate end words: every pair judged by the song grader itself — CLEAN, BANNED (`HOMEOTELEUTON` / `MODAL_RHYME`), an honest non-rhyme, or the grader's own refusal. Use BEFORE writing. |
| `lyric_plan` | A declared integer seed → a complete, reproducible song shape: sections with bars/meter/pickup, rhyme plan, verbatim returns, hook slot, and a writer brief. Writes no words. Optional declarations — `relation`, `functions`, `title` — are CARRIED, never sampled. |
| `lyric_grade` | The whole-song verdict: re-derives the plan from the same seed AND the same declarations (a declaration dropped here grades a different plan), fills it with the draft, grades rhyme/returns/meter/functions/floor, and returns the rendered song (performance order, bracket headers) + the report. |
| `lyric_check` | Grade pasted lyrics without a plan: declare a letter scheme (`ABAB`) or line-number groups (`1,3;2,4`), optional verbatim-return classes, an optional `relation`, and an optional per-group `structures` declaration (`B:kalevala-alliteration`) whose uncalibrated disclosure rides in the verdict. |
| `lyric_sweep` | Find seeds whose shape matches a declared want (`lines>=16`, `uses=bridge`, `before=verse,chorus`) over a bounded window of consecutive seeds. Returns seeds in SEED ORDER and does not rank; three counts never summed; windows compose, so continue from `next_seed_from`. |
| `lyric_revise` | Revise a draft under its declared plan or mandate. The interview writer returns questions; the kitchen writer proposes and verifies repairs through Gemini. Retain the returned state/checkpoint and opaque `run_id`; a seed is not a run capability. |
| `lyric_verify` | Did this revision earn it? Hand it a draft BEFORE and AFTER under the same mandate and it reports what the change FIXED and INTRODUCED. Read `accepted`, not `exit_code` — both verdicts exit 0. A DIFF, not a grade: it cannot report banned pairs that survived the change. |
| `lyric_types` | The 9-axis rhyme-type coordinate for one word pair (taxonomy; for usable-or-banned use `lyric_screen`). |

## Quick start

```sh
cd mcp
npm ci          # install (or: npm install)
npm test        # engine checks against the deterministic workspace (server build needs the SDK)
```

### Local use (stdio — runs on your machine, zero hosting)

```sh
npm run stdio
```

Wire it into a desktop MCP client. Example client config entry:

```json
{
  "mcpServers": {
    "codex-musica": {
      "command": "node",
      "args": ["/absolute/path/to/CodexMusica/mcp/server_stdio.js"]
    }
  }
}
```

Inspect it interactively:

```sh
npm run inspect   # opens the MCP Inspector against the stdio server
```

### Hosted use (the Connectors menu)

This is what makes "CodexMusica" appear in Claude's **Connectors** list with its own
toggle. Deploy `server_http.js` to any Node host (Render, Fly, Railway, a VPS):

```sh
npm start         # serves Streamable HTTP on http://localhost:3000/mcp  (PORT overridable)
```

Then in Claude → **Add connectors → custom** → paste your public `https://…/mcp` URL.

#### Deploy to Render (one step)

A `render.yaml` blueprint is included at the repo root:

1. Render dashboard → **New + → Blueprint** → connect `WeningerII/CodexMusica` → **Apply**. It builds `mcp/Dockerfile` and probes `/health`.
2. Your endpoint is `https://<service-name>.onrender.com/mcp`.
3. Claude → **Add connectors → custom** → paste that `…/mcp` URL.

**Client timeout.** Lyrics grading and revision can take minutes. The MCP SDK's
60-second default can expire before a legitimate grading call completes; configure
an appropriate client timeout. The server's shared Python queue includes queue
wait in the call deadline and propagates cancellation. A disconnect or timeout
still does not prove whether an already dispatched model request executed. Keep
returned checkpoints and follow [the recovery protocol](./LYRICS_RUNTIME.md).

The Blueprint selects the Standard plan and a persistent lyrics disk, deploys from
`main`, and disables Render's automatic deployment. Applying the Blueprint
provisions billable storage; committing it does not apply or deploy it.

- **No account login is required.** Public recipe tools are deterministic compute.
  Lyrics revision can mutate run state and spend model credit. The server applies
  request limits and shares one model-accounting ledger across chat and kitchen
  calls, including kitchen calls made directly through `/mcp`.
- `GET /health` reports liveness, commit, source/configuration fingerprints and
  recovery-store status. It does not prove a successful kitchen run.
- **Scaling:** durable receipts, signing and accounting currently require one Node
  process on one instance with mounted storage. Multiple processes or replicas
  require a transactional shared store; recipe state passing does not make the
  lyrics runtime horizontally stateless.
- The full lyrics runtime requires Node, Python subprocesses and the configured
  storage. Changing the MCP transport alone does not port it to a worker-only
  hosting environment.

## Cost

Recipe tools use deterministic local computation and make no model calls. Local
lyrics planning and grading also use no model inference, but can require
substantial CPU and memory. Both `/chat` and `lyric_revise` with `writer: kitchen`
use the service's Gemini key, including kitchen calls through `/mcp`.

Paid calls share the declared **$25 daily allowance** and **$2.50 per chat turn or
direct MCP operation allowance**, configurable through `CHAT_DAILY_USD` and
`CHAT_MAX_TURN_USD`. Admission reserves estimated cost before dispatch and settles
reported usage, including thinking tokens. Unknown usage retains a charge; these
engineering allowances are not an invoice guarantee. See the
[accounting limits](./LYRICS_RUNTIME.md#what-the-money-limits-establish).

## `/chat` — driving the tools for a caller with no MCP client

The published catalog page is static and cannot hold a model key, so its chat bar
posts here and this service calls Gemini. Chat can drive either the recipe tools
or the separate lyrics pipeline.

- `POST /chat` accepts `{message, history?, workspace?, lyric?, sig?, request_id?}`
  and returns the reply, tool trace and signed continuation envelope. The caller
  threads `history`, `workspace`, `lyric` and `sig` into the next turn. The HMAC
  prevents fabricating an envelope; it is not an account login.
- Supplying a cryptographically random `request_id` enables retained request,
  checkpoint and response recovery through `GET /chat/jobs/<request_id>`. This
  identifier is a bearer capability. The battery uses it on every attempt; an
  ordinary request without it has no recoverable request receipt.
- `GET /chat/status` reports model availability, declared pricing, usage and
  outstanding reservations against the shared daily allowance.

The durable deployment retains request content and lyric progress; it is not
stateless. See [LYRICS_RUNTIME.md](./LYRICS_RUNTIME.md) for receipt retention and
[BATTERY_RECOVERY.md](./BATTERY_RECOVERY.md) for safe battery continuation.

The workspace is **removed from the function declarations** rather than reformatted: it
is a part-id → variant-id map over 4051 part ids and cannot be typed, so it reaches the
wire as an empty node, which restricted function-calling clients reject. The server holds
it and injects it. `mcp/gemini_tools.js` carries the arithmetic; `connector-gemini-legal`
gates the result off a live `tools/list`.

Configuration (the Blueprint pins deployed values):

| Env | Default or deployment value | What it controls |
|---|---|---|
| `GEMINI_API_KEY` | Unset | Required for `/chat` and the kitchen writer; recipe tools and local lyrics analysis need no model key. |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Chat model; it must have declared pricing. |
| `LYRIC_PROPOSER_MODEL` | `gemini-3.5-flash-lite` in the Blueprint | Kitchen writer model. |
| `LYRIC_RUNTIME_DIR` | Unset locally; `/data/lyrics` in the Blueprint | Mounted storage for request receipts, signing key and accounting. |
| `CHAT_SECRET` | Persisted generated key when runtime storage is configured; otherwise random per boot | Explicit envelope-signing override. Keep it stable to preserve signed continuations. |
| `CHAT_IP_RPM` / `CHAT_IP_RPH` | 4 / 30 | Per-IP chat request limits. |
| `CHAT_CONCURRENCY` | 2 | Simultaneous chat turns. |
| `CHAT_DAILY_USD` | 25 | Shared chat/kitchen daily model allowance, tracked with reservations and reported usage. |
| `CHAT_MAX_TURN_USD` | 2.5 | Chat-turn or direct MCP operation model allowance. |
| `CHAT_MAX_TURNS` | 12 | Messages per conversation. |

With correctly mounted runtime storage, counters, pending reservations and the
signing key survive restarts. Without it, local operation is process-local and
`/health.recovery.durable` is false. For storage overrides and failure handling,
see [LYRICS_RUNTIME.md](./LYRICS_RUNTIME.md).

## Privacy & support

See [PRIVACY.md](./PRIVACY.md). No account login is required. Lyrics and chat
content may be retained for recovery and sent to Gemini when a model is invoked.
Receipt identifiers, run identifiers and signed envelopes grant access to working
state; keep them and decrypted battery artifacts private. The battery workflow
requires a dedicated `BATTERY_RECOVERY_KEY` before paid work and uploads only
encrypted recovery data; see [archive setup](./BATTERY_RECOVERY.md#encrypted-workflow-artifacts).

- **Privacy policy:** https://github.com/WeningerII/CodexMusica/blob/main/mcp/PRIVACY.md
- **Support:** https://github.com/WeningerII/CodexMusica/issues

## Connectors Directory readiness

For submission to Anthropic's [Connectors Directory](https://claude.com/docs/connectors/building/submission), assess the current tool surface by operation:

- Recipe tools use local deterministic computation and carry
  `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`.
- `lyric_revise` carries `readOnlyHint: false`, `idempotentHint: false`,
  `openWorldHint: true`: it changes run state and its kitchen writer calls an
  external model. Do not describe every tool as read-only or deterministic.
- Lyrics calls can take minutes and return substantial state. Directory timing
  and payload requirements need separate verification; the recipe tools' speed
  does not establish lyrics compliance.
- The public endpoint requires no account login, but retained working state uses
  opaque capabilities and signed envelopes. Privacy policy and support are linked
  above. Use the deployed tool schemas and [runtime documentation](./LYRICS_RUNTIME.md)
  when describing these capabilities.

## Files

- `engine.js` — the deterministic workspace surface (start/edit/render + discovery) over `scripts/_workspace_ops.js`; validation + state-passing response shaping.
- `tools.js` — MCP tool definitions (zod schemas) + `buildServer()`.
- `server_stdio.js` — stdio entry (local).
- `server_http.js` — Streamable HTTP entry (hosted connector) + the `/chat` mount.
- `gemini_tools.js` — live `tools/list` → Gemini function declarations (pure; no SDK).
- `lyric_tools.js` — the disjoint lyric family and Python bridge: plan, grade, screen and stateful revision through interview or kitchen writers.
- `gemini_agent.js` — one conversational turn: the tool loop, usage and measured cost.
- `chat.js` — the `/chat` router: admission, shared model accounting and signed envelopes.
- `job_store.js` — retained request receipts, signed checkpoint recovery and build identity.
- `paid_budget.js` — shared chat/kitchen reservations, usage settlement and Python admission broker.
- `test.mjs` — `npm test`.

### Explicit pronunciation choices

`lyric_grade` and `lyric_check` return `pronunciation_options` from the actual
English dictionary, with exact line text, one-based sung-token positions,
pronunciations, syllable counts, stress, and all matching line numbers. Select
what the word means in the lyric; do not choose a reading merely to remove a flag.
For example, the noun *record* in this chorus is declared as:

```json
{
  "pronunciations": [{
    "line": "Cut that record; let the bass shake glass",
    "token": 3,
    "word": "record",
    "phones": ["R", "EH1", "K", "ER0", "D"],
    "basis": "dictionary",
    "source": "Writer: record means the disc being played."
  }]
}
```

Pass the choices when grading, then revise. The maintained creation client and
Gemini workflow restore omitted graded pronunciation/fallback/voices settings.
A conflicting setting requires another grade. Suspended runs freeze these
settings; changing them requires regrading and starting `new_run: true`.

A choice applies to every verbatim occurrence of its exact line, including
chorus returns. It never becomes a global dictionary entry. Editing the line
removes that binding; an unused declaration is reported as stale and prevents
certification. For independently performed variants of an identical line, this
API requires different line text; it does not offer separate repeat-instance
readings. Unsung asides follow `voices` and cannot shift sung-token indices.

`basis: "dictionary"` verifies the exact phones against CMUdict.
`basis: "declared"` accepts supplied ARPABET for a name, dialect, or performance
reading, with a required source. The source is a caller declaration, not proof
that the pronunciation was independently verified. Both choices and their
provenance appear in authenticated grading/finished results and coverage.
Unselected words retain each assessment layer's existing reading/fallback policy.

The Python equivalents are `--pronunciations=<JSON>` on `song`, `finish`, `brief`,
`revise`, `verify`, and `recover`. Limits are 128 choices, 128 phones per choice,
4000 characters per bound line, and 1000 characters per source. Existing writer
line/count/work limits still apply; supplied syllables count toward work limits.
Run `npm run test:pronunciations` and `npm run qualify:session:workflow` to verify.
