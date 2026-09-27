# Security Policy

CodexMusica is a static catalog site (GitHub Pages), an unauthenticated MCP
connector and a browser chat service. Recipe computation is deterministic. The
connector keeps short-lived working state — recipe workspaces, lyric workflow
sessions, run state and recovery receipts — in a private runtime store, and the
browser chat retains conversation receipts and makes paid Gemini calls. See
[PRIVACY.md](PRIVACY.md) and [mcp/PRIVACY.md](mcp/PRIVACY.md) for what is stored
and for how long. Session, run and request identifiers are bearer capabilities.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue:

- **Preferred:** open a private report via GitHub's
  [Report a vulnerability](https://github.com/WeningerII/CodexMusica/security/advisories/new)
  button (the repository's **Security** tab → **Advisories**).
- Alternatively, open a regular issue **without exploit details** and note that
  you have security information to share privately.

We aim to acknowledge reports within a few business days and will keep you
updated as we investigate. This is a maintained, best-effort project; there is
no paid bug-bounty program.

## Scope

In scope:

- The MCP connector at `https://mcp.codexmusica.com/mcp`
- The static site at `https://codexmusica.com`
- Source code in this repository

Out of scope:

- Volumetric denial-of-service against the public endpoint — it is intentionally
  open and unauthenticated. The server applies per-IP request limits in code
  (`mcp/server_http.js`); there is no separate edge limiter.
- Exhausting the browser chat's daily model allowance through ordinary use; the
  allowance is a deliberate cap (`CHAT_DAILY_USD`).
- Findings that require an already-compromised host or browser.
