# CodexMusica — OpenAI plugin directory submission package

Submission material for the **OpenAI plugin directory** (the directory renamed
from "app directory" on 2026-07-09). This document is deliberately narrower than
its Anthropic sibling: `docs/connector-directory-submission.md` already carries
the listing copy, the use cases, the policy attestations and the per-tool
reviewer script, and duplicating 100 lines of it here would guarantee the two
drift. Where that document is already correct, this one points at it. What lives
here is only what is **OpenAI-specific** or what this pass found to be **wrong or
unknown**.

> **READINESS: NOT SUBMITTABLE YET.** Nothing below is a claim that the package
> is complete. Three named blockers and a set of open questions are collected at
> the end; at least one of them (whether an authless MCP server is eligible for
> listing at all) decides whether this submission is a form-filling exercise or
> an engineering project. Do not start the form until that one is answered from a
> page a human has actually opened.

---

## Evidence grading — read this before you trust a requirement below

This section exists because of the specific failure this repo has already paid
for three times: a confident-sounding summary of a document nobody opened, acted
on as if it were the document. Every requirement stated in this file is therefore
graded, and the grades are not decoration.

- **[RAN]** — I executed it in this repo and read the output. Reproducible with
  the exact command given.
- **[READ]** — I read the repository source that makes it true, and the file and
  line are cited.
- **[UNVERIFIED]** — search-index-derived text attributed to an OpenAI URL that
  **no one on this task was able to open**. Every `*.openai.com` host is blocked
  by this session's egress policy at the proxy layer
  (`curl https://developers.openai.com/... -> curl: (56) CONNECT tunnel failed,
  response 403`), and so is the deployed Render host. A summarizer cannot be
  distinguished from a quotation at this distance. Treat every [UNVERIFIED] line
  as a hypothesis to check, never as a requirement to satisfy.

**There is no [PRIMARY] tier in this document, because there are zero primary
reads.** If you find yourself about to write "OpenAI requires X" in a commit
message, a form field, or a conversation, check whether X is [UNVERIFIED] first.

The two ways to convert the [UNVERIFIED] items are: (1) have an administrator
allowlist `developers.openai.com` and `help.openai.com` for the agent proxy, or
(2) open `https://developers.openai.com/plugins/build/auth` and
`https://developers.openai.com/plugins/deploy/submission` in an ordinary browser
outside this session and paste the text back. A third possibility worth one
request if either host becomes reachable:
`https://developers.openai.com/plugins/llms-full.txt` — OpenAI publishes
`llms-full.txt` dumps for at least the apps-sdk tree, so the plugins-tree
equivalent would likely answer everything here as a single primary source. That
URL was inferred by pattern and has never been fetched.

---

## What the plugin is (one paragraph)

CodexMusica converts a plain-language musical request — a genre, an era, a mood,
a named instrument, a piece of gear — into a precise, structured **recording
recipe**: which instruments and part variants, in which room, through which
signal chain and medium, each instrument carrying a named *preface* (an
aesthetic/technique/delivery signature such as `satirical`, `keening`,
`jhala-cascading`) that determines its physical settings. It resolves those words
against a bundled catalog of **1167 recorded-music traditions, 872 instruments,
741 prefaces, 256 rooms and 120 tunings** [RAN: `node -e "import('./mcp/engine.js').then(E=>console.log(E.counts))"`
and `listOptions({kind:'rooms'|'tunings'})`], seeds a tradition's deterministic
default recipe, and then edits it in place — re-picking a preface, swapping a
part variant, overriding the room, chain or tuning, adding or removing
instruments and traditions — returning a descriptor stack capped at 1,000
characters. Every call is pure computation over immutable bundled data: no
outbound network calls, no accounts, no persistence, and the same inputs always
produce the same string [RAN — see test case P5].

**Why this is not something the model can just answer itself.** This matters more
for an OpenAI listing than an Anthropic one, because the guidelines text reported
below sets "functionality not natively supported by the products' built-in
capabilities" as an acceptance bar [UNVERIFIED]. The argument is the catalog and
the determinism, not the prose: a language model asked for "delta blues" produces
a plausible paragraph that differs every time and cites no ids; this returns a
997-character descriptor stack naming `rca-44-bx-ribbon-1938`,
`78-rpm-shellac`, `tin-roofed-shack` and `richter-canonical-10-hole-diatonic-blues`,
byte-identical on repeat, threadable through further edits, and matching what a
human sees in the companion app. That claim is the one to put in the listing copy
and to demonstrate in the positive test cases, because it is checkable by the
reviewer in two calls.

---

## MCP endpoint and transport

| Field                | Value                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| **MCP endpoint**     | `https://codex-musica-mcp.onrender.com/mcp`                                  |
| **Transport**        | Streamable HTTP, **stateless** — `sessionIdGenerator: undefined`, a fresh server and transport per request, no session id issued [READ: `mcp/server_http.js:169-191`] |
| **GET / DELETE `/mcp`** | `405` with a JSON-RPC error body — stateless mode has no server-initiated SSE stream and no session lifecycle [READ: `mcp/server_http.js:194-201`] |
| **Auth**             | **None.** No sign-in, no API key, no OAuth metadata document served          |
| **Health**           | `https://codex-musica-mcp.onrender.com/health` → `{"ok":true,"service":"codex-musica-mcp"}` [READ: `mcp/server_http.js:131`] |
| **Server card**      | `https://codex-musica-mcp.onrender.com/.well-known/mcp.json` — declares `"transport":"streamable-http"`, `"authentication":"none"` [READ: `mcp/server_http.js:144-160`] |
| **Server version**   | `2.0.0` (`mcp/tools.js` `buildServer`, and `package.json`)                    |

Every other URL the form asks for — website, documentation, privacy policy,
support, source repository, icon files — is already tabulated in
`docs/connector-directory-submission.md` under "Paste-ready URLs". Use that table
verbatim; do not maintain a second copy here. One correction to carry across is
noted under "Defects found while assembling this package".

**None of the endpoints above were reached from this session.** The Render host
is blocked by the same egress policy as the OpenAI hosts
(`curl -o /dev/null https://codex-musica-mcp.onrender.com/ -> curl: (56) CONNECT
tunnel failed, response 403`), so every statement in this table is a statement
about the **source in this tree**, not about what the deployed instance is
currently serving. Somebody with unrestricted network access must confirm the
deployed build matches before submitting. That distinction is exactly the one
this repo has previously collapsed.

---

## The nine tools and their annotations

**All nine tools carry identical annotations** — there are no per-tool overrides
in the tree. The values are set once in `mcp/tools.js:28`:

```js
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
```

[RAN — built the server and enumerated the registered tools, confirming nine
tools and that each one's `annotations` object is exactly
`{"readOnlyHint":true,"idempotentHint":true,"openWorldHint":false}`:

```
node -e "import('./mcp/tools.js').then(T=>{const r=T.buildServer()._registeredTools;
  for (const n of Object.keys(r)) console.log(n, JSON.stringify(r[n].annotations));})"
```

]

| Tool              | `title` (as registered)                | `readOnlyHint` | `idempotentHint` | `openWorldHint` | `destructiveHint` |
| ----------------- | -------------------------------------- | -------------- | ---------------- | --------------- | ----------------- |
| `start_recipe`    | Start a recipe from tradition(s)       | `true`         | `true`           | `false`         | **not set**       |
| `edit_recipe`     | Edit the recipe (the main tool)        | `true`         | `true`           | `false`         | **not set**       |
| `render_recipe`   | Re-render the workspace                | `true`         | `true`           | `false`         | **not set**       |
| `search_catalog`  | Search the catalog                     | `true`         | `true`           | `false`         | **not set**       |
| `search_prefaces` | Search prefaces (intent → preface id)  | `true`         | `true`           | `false`         | **not set**       |
| `get_instrument`  | Get one instrument (the knob catalog)  | `true`         | `true`           | `false`         | **not set**       |
| `get_tradition`   | Get one tradition                      | `true`         | `true`           | `false`         | **not set**       |
| `list_traditions` | List / browse traditions               | `true`         | `true`           | `false`         | **not set**       |
| `list_options`    | Enumerate an override space            | `true`         | `true`           | `false`         | **not set**       |

### The `destructiveHint` gap — a real, currently-open item

`destructiveHint` is **not set on any tool**. It does not appear in a single line
of JavaScript in this repository [RAN:
`grep -rn destructiveHint --exclude-dir=node_modules --include='*.js' .` exits 1
with no output]. The only place the identifier occurs at all is a claim that it
is set: `docs/connector-directory-submission.md:175`, the pre-submission
checklist line reading "Every tool has a `title` +
`readOnlyHint`/`destructiveHint` annotation", checked off. Half of that line is
false.

Two separate consequences, and they should not be conflated:

1. **The Anthropic checklist item is checked off and is wrong today.** That is
   true regardless of anything OpenAI requires, and it is worth fixing for its
   own sake.
2. **The reported OpenAI requirement is stricter than "set them"** — the phrasing
   that came back was "explicit `readOnlyHint`, `openWorldHint`, and
   `destructiveHint` values **and a justification for each value** on every MCP
   tool" [UNVERIFIED]. Note that under the MCP specification `destructiveHint` is
   only meaningful when `readOnlyHint` is false, so setting it here is arguably
   redundant — but "arguably redundant" is not a defence to a reviewer working
   from a checklist, and an explicit `destructiveHint: false` costs one line.

Draft justifications, so the form can be filled without re-deriving them:

- `readOnlyHint: true` — no tool writes anything. The server holds no database,
  no file store and no cache; the recipe workspace is passed in and out by the
  caller as an argument, so there is no server-side state for a tool to mutate.
- `idempotentHint: true` — every tool is a pure function of its arguments over an
  immutable bundled catalog. Verified by calling `start_recipe` twice with the
  same arguments and comparing the returned strings for byte equality [RAN, test
  case P5].
- `openWorldHint: false` — the server makes **zero** outbound network calls and
  has zero runtime dependencies; the entire answer space is the catalog compiled
  into the deployed image, so the set of possible responses is closed and
  enumerable.
- `destructiveHint: false` (proposed, not yet in the tree) — implied by
  `readOnlyHint: true`; no tool can delete, overwrite, spend, send, or otherwise
  produce an effect outside its own response body.

### Tool descriptions and summaries

The one-line summaries and the full descriptions are already in
`docs/connector-directory-submission.md` under "Tools", and the authoritative
long-form text is the `description` string on each `registerTool` call in
`mcp/tools.js`. Paste from `mcp/tools.js`, not from either document — the
documents summarize and the registration is what the reviewer's client will
display.

---

## Starter prompts

Five, matching the reported requirement for exactly five positive test cases
[UNVERIFIED] so that each starter prompt has a corresponding runnable test below.
These are written as things a user would type, not as tool calls.

1. "Give me a delta blues recording recipe — what am I actually tracking?"
2. "Make it satirical rather than rasping, and tell me what changed."
3. "Outlaw country, desert blues and a face-melting sitar in one recipe."
4. "What variants can I swap on a solid-body electric guitar with humbuckers?"
5. "Which prefaces sound bitter, and what descriptor tokens does each carry?"

---

## Test cases a reviewer can run verbatim

Every call below was executed against this tree through the engine that the MCP
tools wrap, and the expected shapes are transcriptions of real output rather than
descriptions of intended output. The MCP argument names are the ones in
`mcp/schemas.js` [RAN:
`node -e "import('./mcp/schemas.js').then(S=>{for(const[k,v]of Object.entries(S.TOOL_SCHEMAS))console.log(k,Object.keys(v.shape).join(', '))})"`].

**Read the argument names carefully.** The seeding tool takes `traditions`, not
`tradition_ids`, and an edit's operation field is `action`, not `op`. Both were
established by running the wrong spelling and reading the rejection; see
"Defects found while assembling this package".

### Positive — P1: seed a recipe

**Call:** `start_recipe` with `{"traditions": ["delta_blues"]}`

**Expected shape:** an object with keys `mode`, `recipe`, `recipe_chars`,
`cards`, `workspace`, `guidance`. `recipe` is a single comma-separated descriptor
string of `recipe_chars` = **997** characters beginning `Delta blues, rasping
voice: belt-quality-high-larynx-thick-fold blues-shouter …` and containing
`tin-roofed-shack`, `rca-44-bx-ribbon-1938`, `78-rpm-shellac`. `cards` is an
array of three card objects with ids `card_1` (voice, preface `rasping`),
`card_2` (`acoustic_resonator_steel`, preface `bluesy`), `card_3` (`harmonica`,
preface `moaning`). `workspace` is the opaque state to thread into the next call.

### Positive — P2: edit it toward a mood

**Call:** `edit_recipe` with
`{"workspace": <workspace from P1>, "edits": [{"action": "set_preface", "card": "card_1", "preface": "satirical"}], "max_chars": 300}`

**Expected shape:** keys `recipe`, `recipe_chars`, `cards`, `workspace`.
`cards[0]` gains `"preface": "satirical"` and `"preface_locked": true`, and the
recipe now opens `Delta blues, satirical voice, …` where P1 opened `Delta blues,
rasping voice, …`. **This case also exposes an open defect — see D3 below: the
prefaces on `card_2` and `card_3` shift as a side effect of this edit, from
`bluesy`/`moaning` to `rasping`/`bluesy`.** A reviewer running this verbatim will
see that. It is disclosed here rather than hidden because a reviewer who
discovers an undisclosed surprise reads it as instability, which is the
"inconsistent behavior" acceptance bar [UNVERIFIED].

### Positive — P3: re-render without editing

**Call:** `render_recipe` with `{"workspace": <workspace from P2>, "max_chars": 300}`

**Expected shape:** same four keys; `recipe_chars` = **255**, and `recipe` is the
short form `Delta blues, satirical voice, rasping steel-body-resonator, bluesy
harmonica, twelve-tone-equal-temperament, tin-roofed-shack: tin,
rca-44-bx-ribbon-1938, tube-vintage-character, 78-rpm-shellac: shellac,
colored-vintage-transformer-iron: transformer-iron.` The workspace is unchanged:
this proves the length cap trims presentation, not state.

### Positive — P4: resolve words to ids

**Call:** `search_prefaces` with `{"query": "satirical", "limit": 3}`

**Expected shape:** `{query, total, items}`, where `items[0]` is
`{"id": "satirical", "name": "satirical", "matched": 1, "tokens": [...]}` and
`tokens` is the descriptor signature `["speech-mimicking", "rhythmic-speech",
"heightened-speech-stylized-intonation", "declaimed", "conversational",
"speech-derived", "cutting", "articulate", "punctuated"]`. This is the call that
demonstrates the "not natively supported" argument: the plugin does not have an
opinion about what "satirical" means, it has a fixed token profile for it that
the next `set_preface` will turn into physical settings.

### Positive — P5: determinism, which is the whole product claim

**Call:** `start_recipe` with `{"traditions": ["delta_blues"]}` **twice**, and
compare the two `recipe` strings for exact equality.

**Expected result:** identical strings. Repeat with the P2 edit applied to each:
also identical. [RAN — both comparisons returned `true`.] A reviewer who wants a
one-liner:

```
node -e "import('./mcp/engine.js').then(E=>{const a=E.startRecipe({traditions:['delta_blues']}),
  b=E.startRecipe({traditions:['delta_blues']});console.log(a.recipe===b.recipe)})"
```

### Negative — N1: unknown instrument id

**Call:** `get_instrument` with `{"id": "electric_guitar"}`

**Expected result:** an error, not an empty result and not a silently substituted
instrument. Engine message, verbatim: `Unknown instrument id: "electric_guitar"
(use search_catalog types=["instrument"]).` Through the MCP tool wrapper this
surfaces as `{content: [{type: "text", text: "Error: <message>"}], isError: true}`
[READ: `mcp/tools.js:38-41`].

`electric_guitar` is deliberately the argument here: it is a plausible id that
does not exist. The real ids are `electric_guitar_humbucker` and
`electric_guitar_single_coil`, and the error names the tool that would have found
them. **This is the two-sided half of the test set** — it demonstrates that the
success cases above are not the only thing the server can produce, which is the
difference between a test and a demo.

### Negative — N2: malformed edit

**Call:** `edit_recipe` with a valid workspace and
`{"edits": [{"op": "set_preface", "card": "card_1", "preface": "satirical"}]}` —
note `op` where the schema requires `action`.

**Expected result:** error, verbatim: `edit[0] (?): Unknown edit action
"undefined". Valid: add_tradition, remove_tradition, add_instrument,
remove_instrument, set_variant, set_environment, set_preface.` The index `[0]`
localizes the failure inside a batch and the message enumerates the valid set, so
a model can correct itself without another round trip.

### Negative — N3: unknown option space

**Call:** `list_options` with `{"kind": "microphones"}`

**Expected result:** error, verbatim: `Unknown options kind: "microphones".
Valid: rooms, tunings, chain_sections, archetypes, aesthetics, arrangements,
instrument_families, axes, tradition_families.` Microphones are real objects in
the recipes (`rca-44-bx-ribbon-1938` appears in P1) but they are not a
top-level option space, so this is the precise shape of near-miss a model makes.

Three further verified rejections, available if more negatives are wanted:
`start_recipe {"traditions":["delta_bluez"]}` → `Unknown tradition:
"delta_bluez"`; `edit_recipe … {"action":"set_preface","card":"card_99",…}` →
`edit[0] (set_preface): No card matching "card_99"`; `edit_recipe …
{"action":"set_environment","room":"tin_roofed_shack"}` with no `card` →
`edit[0] (set_environment): edit "set_environment" requires "card"`. All [RAN].

---

## Safety posture

The Anthropic package's seven policy acknowledgments
(`docs/connector-directory-submission.md`, "Policy acknowledgments") are
substantively the same attestations and should be reused. What follows is only
what is specific to this surface.

- **Read-only.** Nine tools, all `readOnlyHint: true`. No tool writes, deletes,
  spends, sends, or calls out. The worst-case output of any tool is
  catalog-derived text.
- **Purely computational and closed-world.** Zero outbound network calls, zero
  runtime dependencies, `openWorldHint: false`. The answer space is the image.
- **No authentication, therefore no credentials to leak.** There is no account,
  no token, no OAuth metadata document, and nothing user-specific for the server
  to expose to the wrong caller — because there is nothing user-specific at all.
- **Nothing persisted about a user.** Stateless per request; the workspace lives
  in the caller's hands. No database, no file store, no cache
  [READ: `mcp/server_http.js:8-13`].
- **Request logging is real, is bounded, and is disclosed.** One JSON line per
  inbound HTTP request holding timestamp, method, URL **including query string**,
  status, duration, and the `user-agent`/`referer`/`x-forwarded-for` headers,
  header values truncated at 300 characters. **Bodies are never logged**, so MCP
  tool arguments — which travel in the body — are not recorded
  [READ: `mcp/server_http.js:60-118`]. `x-forwarded-for` is an IP address, and
  `PRIVACY.md` says so in as many words. Do not describe this plugin as "logs
  nothing" on the form; it logs request metadata deliberately, and the reason is
  documented at `mcp/server_http.js:29-36`.
- **Prompt-injection surface.** A tool result is catalog text. There is no
  outbound action a poisoned instruction could cause the plugin to take, because
  there is no outbound action at all.
- **No monetization.** Nothing is sold, no payment is taken, no link-out to a
  purchase flow exists. Relevant because monetization is reportedly restricted to
  external purchase of physical goods [UNVERIFIED].

---

## Domain verification — the item that touches deployed infrastructure

Reported requirement [UNVERIFIED]: place a verification token at
`https://<challenge-base-host>/.well-known/openai-apps-challenge`, returning
**only that token, as plain text** — not JSON, not HTML, not a list — from the
MCP host or a parent of it.

**No such route exists.** [RAN:
`grep -rn apps-challenge --exclude-dir=node_modules .` matches nothing outside
this document, and the only `.well-known` route registered anywhere in `mcp/` is
`app.get('/.well-known/mcp.json', …)`.] The host
serves `/.well-known/mcp.json` [READ: `mcp/server_http.js:144`] and, since the
recent crawl work, `/robots.txt` and `/sitemap.xml` from `mcp/rest.js`
[READ: `mcp/rest.js:777-786`], so the pattern for adding a static-ish well-known
route on this Express app is established and the change is small.

Two cautions if that route gets written:

- The challenge must return **plain text**. Every other route on this server
  answers with `res.json(...)`, and the two text routes that exist set
  `Content-Type` explicitly. Copying a JSON route would produce a response that
  looks right in a browser and fails the check.
- The catch-all 404 handler is registered on `process.nextTick` specifically so
  it lands after every synchronously-registered route
  [READ: `mcp/rest.js:801-826`]. A challenge route added synchronously in
  `server_http.js` will be reached; one added later will not.

### What is NOT a listing blocker, and why the distinction matters

Three separate mechanisms get conflated in conversation about this project, and
conflating them is what makes the problem look bigger than it is:

1. **Directory listing** is a human review pipeline. Whether a crawler has
   indexed the host is irrelevant to it.
2. **OpenAI's unverified-link gate** checks whether an exact URL has been seen by
   an independent public web index before auto-loading it. This is why the
   formerly unconditional `X-Robots-Tag: noindex` on every REST response mattered
   — it is now scoped to requests that actually carry user edits
   [READ: `mcp/rest.js:706-730`, `carriesEdits`], which is the correct shape.
3. **OAI-SearchBot discoverability** in ChatGPT, addressed by the crawler's own
   group in the served `robots.txt` [READ: `mcp/rest.js:586-620`].

Items 2 and 3 are fixed **in this tree**. Whether they are fixed **on the
deployed host** was not checkable from this session, and the last time this team
assumed those two were the same thing it cost three wrong decisions.

---

## Defects found while assembling this package

These are outside this document's ownership and are reported, not fixed. Each was
found by running the thing, not by reading it.

- **D1 — the Anthropic reviewer script does not run as written.**
  `docs/connector-directory-submission.md:122` instructs a reviewer to call
  `start_recipe` with `tradition_ids: ["delta_blues"]`; the schema field is
  `traditions`. Line 121 instructs `get_instrument electric_guitar`; that id does
  not exist (`electric_guitar_humbucker` / `electric_guitar_single_coil` do).
  Lines 123-124 say `set_environment` "to override the room" without the `card`
  argument the engine requires. A reviewer following that script hits three
  errors in sequence. [RAN — all three.]
- **D2 — stale count in the Anthropic long description.**
  `docs/connector-directory-submission.md` carried a stale preface count against
  the engine's **741**, contradicting its own tools table. FIXED, and the docs
  gate that should have caught it was widened: its pattern anchored on a literal
  space before the noun, so a count wrapped in quotes or markdown emphasis was
  invisible to it. [RAN — gate now fails on the stale value, then passes on the fix.]
- **D3 — `set_preface` mutates prefaces on cards the caller did not name.**
  Seeding `delta_blues` gives `card_1: rasping`, `card_2: bluesy`,
  `card_3: moaning`. Setting `card_1` to `satirical` leaves `card_2: rasping` and
  `card_3: bluesy` — both shifted. Setting `card_2` to `satirical` instead leaves
  `card_1` alone but still moves `card_3` from `moaning` to `bluesy`. The pattern
  is that unlocked cards **after** the edited one get re-drawn. `set_environment`
  does not do this. This is the single most reviewer-visible behaviour in the
  package, since it fires in the very first edit of the very first walkthrough,
  and "inconsistent behavior" is a named rejection criterion [UNVERIFIED]. It
  needs a decision: either it is intended (in which case the tool description
  must say so, because nothing currently does) or it is a bug.
- **D4 — `PRIVACY.md` names only Anthropic.** It says requests arrive "via your
  Claude client and Anthropic's connector infrastructure" and directs users to
  "Settings → Connectors" in Claude. A policy URL submitted to OpenAI that
  describes only a competitor's transport path is a reviewer-visible
  inconsistency between the listing and its own privacy policy. It needs a
  transport-neutral rewrite, not a second file.
- **D5 — retention.** `PRIVACY.md` declines to state a retention window,
  deliberately and with a stated reason (it cannot promise on the host's behalf).
  The reported OpenAI requirement asks for "data retention timelines"
  [UNVERIFIED]. If that is real, the honest fix is to state Render's actual
  documented log-retention window and attribute it, not to invent a number.

---

## OPEN QUESTIONS

Ordered by how much they change the plan. Nothing in this list has been resolved;
each names what evidence would resolve it.

1. **Is an authless MCP server eligible to be LISTED at all?** This is the fork
   between "fill in a form" and "design, build, host and operate an auth layer",
   and it is unresolved. Three independent [UNVERIFIED] signals point at *yes* —
   auth described as conditional on what the server exposes rather than as a
   precondition; the demo-credentials field itself reportedly gated on "if the
   server requires sign-in"; and the official quickstart reportedly shipping a
   read-only tool that "does not require authentication", which OpenAI would be
   unlikely to publish if it were structurally ineligible for the directory. One
   supporting detail did **not** reproduce on re-query: a claimed `noauth` scheme
   identifier. Treat the general answer as likely and the specific identifier as
   unsupported. **Resolve by reading
   `https://developers.openai.com/plugins/build/auth`. Do not spend engineering
   effort on either branch before that page has been read by a human.**
2. **Does `destructiveHint` have to be present, with a per-value justification?**
   [UNVERIFIED]. Currently absent on all nine tools. If yes, this is a one-line
   change in `mcp/tools.js:28` plus the justifications already drafted above. Low
   cost, but it is a code change in a file this document does not own.
3. **Is there a submission fee?** **Unknown, and specifically not "free".** No
   fee was mentioned anywhere in the research, and no page stating that
   submission is free was found either. Absence of evidence is being recorded as
   absence of evidence. Do not write "free" on a plan.
4. **What does individual (non-business) identity verification actually
   require?** Publishing under an individual's own name is reportedly explicitly
   supported [UNVERIFIED], via the OpenAI Platform dashboard's general settings.
   By analogy with API organization verification this is likely a
   government-ID KYC flow through a third-party vendor, and a community thread
   title suggesting solo verification can fail with no self-serve retry was seen
   but could not be opened. **That is a rumour about a thread title, not a
   finding.** Flagged as schedule risk only.
5. **What is the review turnaround?** No committed SLA was found; the reported
   language is that timelines "may vary as OpenAI builds and scales the review
   process" [UNVERIFIED]. Plan for an unbounded wait.
6. **How locked is the tool contract after approval?** Reportedly the submitted
   metadata snapshot is frozen at publication, changes require a new draft
   version and each resubmission starts a new review, while server-only fixes
   that preserve the published contract can ship without re-review [UNVERIFIED].
   If that is right, the nine tool names and their input schemas should be
   considered frozen at first submission, and D3 above should be settled
   **before** submitting rather than after.
7. **Does the deployed Render instance match this tree?** Not checkable from this
   session — the host is behind the same egress block. The `X-Robots-Tag`
   scoping, the `robots.txt`/`sitemap.xml` routes and the inbound request log are
   all present in the source read for this document; whether the running
   container has them is a separate question that requires one `curl` from an
   unrestricted network.
8. **Does the challenge host have to be the MCP host exactly?** The reported
   wording is "the MCP host name or a parent host name" [UNVERIFIED]. If a parent
   is acceptable, `github.io` is not a parent of `onrender.com` and neither
   existing property helps; the practical implication is that the challenge route
   must be served by the Render app itself unless a custom domain is introduced.

---

## Owner actions before the form is opened

- [ ] Resolve open question 1 from a primary source. Everything else is
      contingent on it.
- [ ] Confirm the deployed instance matches this tree (open question 7) with one
      request from an unrestricted network.
- [ ] Decide D3 — intended behaviour or bug — and either document it in the
      `edit_recipe` description or fix it. This is a pre-submission item because
      of open question 6.
- [ ] Fix D1 and D2 in `docs/connector-directory-submission.md`, since this
      document reuses that one by reference and would otherwise inherit both.
- [ ] Rewrite `PRIVACY.md` transport-neutrally (D4) and decide the retention
      question (D5).
- [ ] Add `destructiveHint` if open question 2 resolves to yes.
- [ ] Write and deploy the `/.well-known/openai-apps-challenge` route, plain
      text, registered synchronously — but only after the token is issued, since
      the reported requirement is that it return exactly one specific token.
- [ ] Complete individual identity verification in the OpenAI Platform dashboard.
- [ ] Choose the availability countries deliberately; the report is that this is
      developer-selected and should cover only where support and legal terms are
      actually ready [UNVERIFIED].
