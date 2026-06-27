# Security Policy

CodexMusica is a read-only service: a static catalog site (GitHub Pages) and a
stateless MCP connector that performs deterministic, in-memory computation. It
stores no user data, requires no authentication, and has no database or
persistent state (see [PRIVACY.md](PRIVACY.md)).

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

- The MCP connector at `https://codex-musica-mcp.onrender.com/mcp`
- The static site at `https://weningerii.github.io/CodexMusica`
- Source code in this repository

Out of scope:

- Volumetric denial-of-service against the public endpoint — it is intentionally
  open and unauthenticated; rate-limiting is handled at the edge.
- Findings that require an already-compromised host or browser.
