# Privacy

Last updated: 2026-09-08

CodexMusica exposes public recipe tools, a separate lyrics pipeline and a browser
chat service. There is no user account system. Random run and request identifiers
are bearer capabilities: someone who holds one can recover its retained data.
Keep these identifiers and signed continuation envelopes private.

## Processing and storage

Recipe tool operations pass their workspace in and out and do not save a recipe
workspace as a server account. The browser chat protocol can retain that workspace
alongside a conversation receipt. The workspace is passed to the engine outside
the model's prompt.

Direct `lyric_revise` calls retain private run state in a process-local cache
(default: 64 records, six-hour inactivity limit). Returned state and checkpoints
allow explicit recovery after that cache expires, subject to contract compatibility.
The browser and battery `/chat` surface write request intents, accepted worker
progress, responses and signed continuations to the configured runtime directory.
The browser keeps recovery identifiers and may keep a fallback envelope locally.
Clearing browser data removes those local copies; it does not delete retained
server receipts.

The service also persists its conversation signing key and shared model-spend
ledger. These files allow recovery after restart and prevent accounting from
resetting after deployment. `/health` and `/ready` disclose whether recovery is
configured as durable. Local development without persistent storage is temporary.

## External model processing

Browser chat sends conversation text and relevant tool results to Google's Gemini
API. `lyric_revise` with `writer: kitchen` also sends the lyric brief, draft and
revision context to Gemini, including when called directly through MCP. These are
paid model requests made with the service's API key. The `interview` writer uses
answers supplied by the caller instead of invoking the server's kitchen model.
Your connecting AI host may independently process the information you give it.

## Logs

The server logs request time, method, path, status, duration, user-agent, referer,
proxy-reported IP address and whether the connection ended prematurely. Request
capabilities in receipt paths are redacted. Avoid placing private content in URL
query parameters or custom referer headers. Request bodies and response bodies are
not included in this HTTP access log; lyric content is retained separately in the
recovery files described above. The hosting provider can also retain its own
infrastructure logs and error traces.

## Retention

The default receipt metadata retention is 24 hours after its last update. Expiry
and capacity cleanup run when the store is used or loaded, so this is not a
promise of deletion at an exact wall-clock instant. Payload capacity limits can
retire an older completed payload earlier while retaining its identifier to block
accidental redispatch. Pending work is protected from ordinary payload eviction.
Runtime files use private filesystem permissions; they are not encrypted at rest
by this application. Hosting backups and platform logs have their own retention.

Battery recovery archives contain private working data. The maintained Actions
workflow encrypts them with a dedicated recovery key before remote upload. Their
retention follows the workflow artifact settings. Do not publish decrypted
archives, signed envelopes or recovery keys.

## Use and support

CodexMusica does not use request content for advertising or sell request data.
The application does not implement a training or profiling pipeline. External
hosts and model providers apply their own terms to the data they process.

Remove the connector from your AI host to stop future connector access. There is
no public capability-deletion endpoint; recovery data is removed by the retention
and capacity lifecycle above. For questions, open an issue at
<https://github.com/WeningerII/CodexMusica/issues> without including private lyrics,
request identifiers, signed envelopes or API keys.

CodexMusica and its catalog data are proprietary. See `LICENSE`.
