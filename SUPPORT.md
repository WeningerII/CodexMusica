# Support — CodexMusica connector

## Contact

- **Issues / bugs:** <https://github.com/WeningerII/CodexMusica/issues>

We aim to acknowledge reports within a few business days. This is a maintained
project; response times are best-effort.

## Status & health

- **Endpoint:** `https://mcp.codexmusica.com/mcp`
- **Health check:** `https://mcp.codexmusica.com/health` → `{ "ok": true }`

If the connector seems unresponsive, it may be restarting for a deploy (a
disk-backed service stops briefly while it redeploys) — retry after a few
seconds. A `429` means the per-IP request limit was reached; its `Retry-After`
header says when to try again.

## What to include in a report

- What you asked your AI host (the request), and the recipe, lyrics or error you
  got back.
- The tool involved if you know it (e.g. `start_recipe`, `edit_recipe`,
  `lyric_grade`). Leave out session, operation and run identifiers — they are
  private capabilities.
- Whether you added the connector via a custom URL or the Connectors Directory.

## Scope

CodexMusica is a recording-recipe engine over a fixed catalog plus a separate
lyrics planning and grading pipeline. Good things to report:

- A tool error, a malformed/empty recipe, or a recipe over the 1,000-char cap.
- A preface that won't apply, or a requested id your host can't resolve.
- A lyric verdict that looks wrong, or a refusal that doesn't say what to do next.
- A catalog data issue (an instrument variant, room, tuning, or tradition that
  looks wrong).

It does **not** access your files or accounts, and it changes nothing outside its
own short-lived working state (recipe workspaces, lyric sessions and recovery
receipts, which expire on their own). Through the connector your host writes
every lyric line; no connector call reaches a model provider.

## Privacy

See [PRIVACY.md](./PRIVACY.md) and [mcp/PRIVACY.md](./mcp/PRIVACY.md): no accounts;
working state and recovery receipts are retained for a bounded time.
