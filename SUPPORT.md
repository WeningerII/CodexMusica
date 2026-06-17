# Support — CodexMusica connector

## Contact

- **Email:** _(optional — add a non-personal support address)_
- **Issues / bugs:** <https://github.com/WeningerII/CodexMusica/issues>

We aim to acknowledge reports within a few business days. This is a maintained
project; response times are best-effort.

## Status & health

- **Endpoint:** `https://codex-musica-mcp.onrender.com/mcp`
- **Health check:** `https://codex-musica-mcp.onrender.com/health` → `{ "ok": true }`

If the connector seems unresponsive, the host may be cold-starting (it can sleep
on idle) — retry after a few seconds.

## What to include in a report

- What you asked Claude (the request), and the recipe or error you got back.
- The tool involved if you know it (e.g. `generate_recipe`, `apply_preface`).
- Whether you added the connector via a custom URL or the Connectors Directory.

## Scope

CodexMusica is a **read-only** recording-recipe engine over a fixed catalog. Good
things to report:

- A tool error, a malformed/empty recipe, or a recipe over the 1,000-char cap.
- A preface that won't apply, or a requested id Claude can't resolve.
- A catalog data issue (an instrument variant, room, tuning, or tradition that
  looks wrong).

It does **not** access your files, accounts, or any private data, and it makes no
changes anywhere — so there is nothing to undo, and no credentials to rotate.

## Privacy

See [PRIVACY.md](./PRIVACY.md): stateless, no accounts, no personal data stored.
