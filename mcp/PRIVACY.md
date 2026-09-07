# Privacy Policy — CodexMusica MCP server

_Last updated: 2026-09-07_

CodexMusica provides deterministic recording-recipe tools and a separate lyrics
pipeline. Lyrics revision and chat can call an external model and retain working
content for recovery. The service does not require an account login.

## What it does

Recipe tools receive music-catalog parameters and return a deterministic recording
recipe. Lyrics tools plan, analyze and revise lyrics. Local planning and grading
use code and staged lexical data; the kitchen writer calls Google's Gemini API to
propose repairs. The `/chat` surface also calls Gemini to interpret messages and
drive the tools.

## What it collects and retains

- **Submitted content.** Chat messages and lyrics can contain whatever information
  the caller supplies, including personal information. They are not limited to
  public catalog identifiers.
- **Recovery receipts.** When a caller supplies `request_id` to `/chat`, the
  application records the request body, a digest, implementation identity,
  checkpoints, worker progress, proposal-accounting events and the final response.
  These records can contain messages, conversation history, lyric drafts, tool
  results and signed continuation envelopes. The configured runtime directory
  stores them on the server; without durable storage, they remain process-local.
  A request without `request_id` has no recoverable request receipt.
- **Retention.** Completed or interrupted receipt metadata becomes eligible for
  expiration 24 hours after its last work update and is removed when store cleanup
  runs. Full request/response payloads may be retired sooner to
  keep storage bounded; retirement leaves an identifier/digest record without
  the draft, checkpoint or response. Active pending records do not expire while
  work remains active. This is not a promise that every response body remains
  available for 24 hours.
- **Lyric run cache.** The tools also keep a bounded in-memory run cache, accessed
  through an opaque `run_id`. It can expire after six hours, be evicted earlier,
  or be lost on restart. A seed or song title is not an access credential.
- **Signing and accounting.** The durable deployment retains its signing key and
  shared chat/kitchen spending ledger across restarts. These files are separate
  from the 24-hour receipt policy. Accounting records contain usage, cost and
  outstanding reservations rather than full lyric prompts.
- **Operational logs.** The hosting provider and application may record timestamps,
  IP/forwarded addresses, HTTP method and URL, user-agent/referrer headers, tool
  names, status, duration, disconnect information and error traces for reliability,
  security and abuse prevention. The application's inbound HTTP logger does not
  log request bodies and redacts receipt capabilities in recovery URLs. These
  logs are not used to build user profiles and are not sold or shared for
  advertising.

Recipe tools themselves do not retain a recipe session. If used through chat,
their inputs or outputs can still appear in the conversation and its recovery
receipt.

## Access to retained state

A `request_id` is a bearer capability: anyone who possesses it can retrieve its
retained receipt. A lyric `run_id` grants access to the corresponding cached run,
and signed envelopes authorize continuation of the state they carry. These are
not account identities. Keep them private, along with draft content.

The manual battery workflow encrypts transcripts, request journals, signed
checkpoints and full driver logs with a dedicated `BATTERY_RECOVERY_KEY` before
uploading them as GitHub Actions artifacts, with a configured 30-day retention.
Only the authenticated encrypted archive and a nonsecret manifest are uploaded;
public logs receive allowlisted aggregate counts and outcome labels. The workflow
requires the key before paid work or resume. Decrypted and caller-held copies are
outside the server's receipt-retention policy; protect those copies and the key
as private working data rather than publishing them in an issue.

## What it shares

- Nothing is sold or shared with third parties for marketing or advertising.
- The hosting provider processes requests, stored runtime files and operational
  metadata to deliver the service.
- `/chat` sends the message, relevant conversation history and tool exchanges to
  Google's Gemini API. The recipe workspace is withheld from the model as a
  separate state object and injected into local tools; recipe information can
  nevertheless appear in tool results or the conversation.
- A lyrics kitchen call sends the relevant lyric draft/context, constraints and
  repair prompt to Gemini. This also applies when the kitchen is invoked
  directly through `/mcp`. Google processes submitted text under its own terms.
- Recipe tools and local lyrics analysis do not themselves invoke an external
  model. The caller's own MCP client or model provider can also process content
  under that caller's separate arrangement.

## Configuration and recovery details

[LYRICS_RUNTIME.md](./LYRICS_RUNTIME.md) describes mounted storage, permissions,
retention, signing, accounting and recovery failure behavior.
[BATTERY_RECOVERY.md](./BATTERY_RECOVERY.md) describes measurement artifacts and
continuation. A configured path alone does not prove that the hosting provider
mounted durable storage; deployments must supply that mount.

## Changes

This policy may be updated; the "Last updated" date above will change. Material
changes will be reflected in the repository history.

## Contact

Questions or requests: open an issue at
<https://github.com/WeningerII/CodexMusica/issues>. Do not include private drafts,
receipt identifiers, run capabilities or signed envelopes in a public issue.
