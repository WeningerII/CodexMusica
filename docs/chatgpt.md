# Codex Musica in ChatGPT

The ChatGPT integration reuses the maintained connector, recipe engine, lyric
graders and kitchen writer. Its extra layer stores exact workspaces and lyric
workflow receipts, so ChatGPT carries short session capabilities between calls.
Long lyric calls run as operations that can be read after the MCP connection closes.

This is a source implementation and acceptance plan. Merging the code does not
deploy the routes, register a ChatGPT connection or publish a plugin. Local MCP
tests do not establish native ChatGPT behavior or a successful live kitchen run.

## Access policy

Sign-in is optional for Codex Musica. The website, its built-in Gemini chat and
all public MCP endpoints work without a user account, including the unified ChatGPT
route below. Users can choose the website, a compatible MCP client or an
optional host integration. No OpenAI account is required to use the service.

There is currently no Codex Musica account system. Any future account features
must retain guest access and provide a sign-in method independent of OpenAI.
Session and operation IDs are temporary capabilities for recovering work; they
do not enroll the user in an account or select an identity provider.

The registration instructions below concern the optional connection inside a
ChatGPT account. That host's sign-in and workspace policies do not introduce a
login requirement for Codex Musica. Configure the connection with no endpoint
authentication; do not add an OpenAI login gate to the website or MCP service.

## Endpoints and contracts

| Endpoint | Tools | State and results |
| --- | --- | --- |
| `https://mcp.codexmusica.com/mcp/chatgpt` | All 18 music tools plus `begin_lyrics`, `get_operation` and `resume_operation` | One connection handles both workflows. Each keeps its own latest session ID; shared recovery tools resolve the saved task automatically. |

The earlier `/mcp/chatgpt/recipe` and `/mcp/chatgpt/lyrics` routes remain compatible,
but new ChatGPT installations use the single combined endpoint. The model selects
which tools the request needs; users do not select a recipe or lyrics connection.

The raw `/mcp`, `/mcp/recipe` and `/mcp/lyrics` surfaces retain their existing
workspace and continuation contracts. Task-scoped raw HTTP now honors all four
advertised recipe formats. Native clients can still pin their own task format.

Stateful tools return a typed `structuredContent` envelope. `tool_result` contains
the underlying output with private workspace/state fields removed; its text
blocks are also delivered as MCP content. The actual recipe and song text and
grader qualifications remain the output authority. `completed` means the call
returned, not that a song is certified. The envelope's `resumable` describes an
interrupted operation; a completed lyric tool's own verdict describes whether its
revision can continue through `lyric_revise`.

Creation executes sweep → screen → plan → exact-draft grade → revise through
the maintained client. The server persists executed receipts and rejects skipped
steps or fabricated state. Edit phase is for user-supplied existing lyrics.
Kitchen is the default writer, matching the website; interview remains an
explicit alternative. ChatGPT handles conversation and initial drafting, while
kitchen repairs use the service's configured Gemini model and accounting.

## Recovery and runtime

- Use the newest session ID. The same parent and identical arguments return its
  existing operation. Different arguments against an advanced session refuse;
  read the parent's `successor_id` and follow it. A session has one successor.
- Poll pending operations with `get_operation`, respecting `retry_after_seconds`.
  Disconnecting the MCP request does not cancel admitted work. A process restart
  marks unfinished work interrupted and does not automatically redispatch it.
- Explicit `resume_operation` is allowed only with a safe retained checkpoint.
  Original replay input stays distinct from accepted lyrics. Unknown provider
  outcomes, changed scoring semantics, finished journals and exhausted journal
  capacity cannot replay a proposal. Recover the accepted draft and disclose the
  stop. Regrading a changed draft and starting a new run is a separate action.
- Sessions use the existing private `JobStore` and share its storage limits with
  `/chat`: by default 8,192 metadata records, 128 retained payloads and 256 MB.
  Completed/interrupted metadata expires after 24 hours without a work update;
  full payloads can retire sooner, superseded and completed receipts first. An
  interrupted operation that holds accepted lyrics is never retired for space,
  only by expiry. A session is temporary working state, not a permanent song
  archive. IDs grant access to that state without an account login.
- The adapter admits at most 16 active operations across its endpoints. The
  existing serialized Python queue and tool deadlines still apply. Each operation
  uses the existing shared paid ledger, with `CHAT_MAX_TURN_USD` and
  `CHAT_DAILY_USD` allowances. Unknown usage remains charged. Kitchen sessions
  refuse without durable recovery storage; beginning a session makes no paid call.
- Keep one Node process on one instance with the mounted runtime directory and
  stable signing key. Multiple replicas require a transactional shared store.
  See [runtime requirements](../mcp/LYRICS_RUNTIME.md) and
  [privacy policy](../mcp/PRIVACY.md).

Deploy the changed service through the repository's existing tested-image release
and production qualification workflow. Preserve its runtime assets, persistent
mount, signing material, provider configuration and ledger. This change needs no
new dependency or hosting service. Do not apply the legacy Blueprint as a shortcut
around the image promotion checks. After deployment, verify the served commit,
`/ready`, and initialization/tools on the unified route. The server card lists them
under `chatgptEndpoints`.

## Register and package

OpenAI's [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)
documents the current developer-mode flow (checked September 13, 2026):

1. Enable Developer mode under ChatGPT Settings → Security and login, subject to
   account and workspace policy.
2. At [ChatGPT Plugins](https://chatgpt.com/plugins), use the plus button to register
   the public HTTPS endpoint above. Name it Codex Musica and use no
   authentication, matching this service's current policy.
3. Inspect the discovered tools, schemas and annotations. Test each connection in
   a new conversation. Refresh the connection metadata after endpoint changes.

The source package is `plugins/codex-musica/`. It contains a supported
`.codex-plugin/plugin.json` manifest, `.mcp.json` HTTP definitions and two skills:
`recording-recipes` and `lyric-workflows`. No UI widget is needed for this tool-use
scope. No production connection IDs are invented in source.

For ChatGPT Work's installed plugin, register the unified endpoint first and obtain its
actual `plugin_asdk_app...` technical ID. In the installed copy, use plugin-creator
to link that registration through `.app.json` and the manifest's `apps` field,
then install the package with its skills from the available local/team source.
The `.mcp.json` file supports hosts accepting direct MCP configuration; it alone
does not establish a registered ChatGPT connection. Follow OpenAI's
[packaging guide](https://developers.openai.com/plugins/build/plugins) for the
host-specific binding and installation. Test the complete installed plugin after
testing its MCP connection. Public directory submission is a later step under
the [submission process](https://developers.openai.com/plugins/deploy/submission).

## Acceptance

Live endpoint acceptance passed on September 14, 2026 against deployed commit
`42f020e6831581bd24235a4887e00b0910430d0d` (PR #266). All calls used the public
endpoints without user credentials. Eleven checks covered readiness, recipe
edits after reconnect, duplicate/stale submissions, exact engine output in all
four formats, lyric creation order, declared pronunciation, interview continuation
and a bounded kitchen operation. The interview continuation finished with exit
code 0. The kitchen check used one round and one attempt, recorded two provider
calls costing USD 0.0008405 with no unknown spend, and stopped with open lines
(exit code 3); it verifies dispatch, recovery and accounting, not a finished song.
Final health and readiness checks reported the same deployed commit and healthy
durable storage.

ChatGPT account registration, installation of the bundled skills and native
conversation acceptance remain unverified. These live SDK checks establish
endpoint behavior only. Registration was paused when the browser required a
ChatGPT sign-in; the public website and endpoints remain usable without it.

Run `npm run test:chatgpt` after installing root/MCP dependencies and staging the
same lyric runtime assets used by CI. The new suite is also part of
`test:production:offline`. The HTTP contract test exercises the actual new routes,
raw-format regression and a lyric operation retrieved through a fresh connection.
Other session tests cover exact engine output, stored creation receipts, stale
submissions, safe resume, uncertain spend and storage failures without provider calls.

Before claiming native ChatGPT parity, record results from the deployed,
installed plugin for these conversations:

| Request or event | Acceptance evidence |
| --- | --- |
| “Blend delta blues with dream pop; give the voice a worn sound.” | Catalog IDs resolved; both traditions retained; requested voice edits appear in the exact engine recipe and warnings are read. |
| “Make that prose,” then change the shared room or move the primary instrument. | Same session/workspace continues; explicit view and edits match the browser engine; output stays at most 1,000 characters in all four formats. |
| Create a new song with stated structural wants. | Actual sweep, successful screen, plan, exact-draft grade and revision receipts; declarations preserved across calls. |
| Check/revise supplied existing lyrics. | Edit phase; actual coverage and stop/certification reported; the chosen writer remains fixed. |
| Disconnect while lyric work is pending, then reconnect. | Poll retrieves the same operation without repeating a paid proposal; latest session continues the task. |
| Restart after a safe checkpoint or an unknown provider outcome. | Safe explicit resume preserves accepted work; unknown outcome exports the draft and blocks replay. |
| Indirect recipe wording and a request that needs neither tool family. | Appropriate tool selection and skill triggering; recipe requests do not start lyrics. |

Paid kitchen acceptance should use the established bounded qualification setup.
Record actual tool traces and delivered artifacts; a text claim by the model or
a passing local transport test is not evidence that the deployed workflow passed.


## Unified connection rollout

The unified endpoint and source plugin replace the two-connection installation
plan. Earlier live acceptance above tested the split endpoints only and does not
establish deployment or native acceptance of this combined endpoint. Refresh the
installed connection after deployment and verify both workflows in one conversation.
