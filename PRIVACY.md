# Privacy Policy — CodexMusica connector

_Last updated: 2026-06-15_

CodexMusica is a **read-only, stateless** Model Context Protocol (MCP) server. It
turns musical requests into recording recipes from a fixed, bundled catalog. This
policy describes what it does and does not do with data.

## What we collect

**No personal data, and no accounts.** The connector requires no sign-in, sets no
cookies, and stores no user profiles. It accesses no private data on your behalf.

When Claude calls a tool, the server receives the structured arguments for that
call (e.g. a tradition id, an instrument id, or a search phrase you asked Claude
to look up). The server:

- is **stateless** — it creates a fresh handler per request and keeps no session,
  database, or persistent store of requests or responses;
- writes a minimal **operational log** line per call containing the JSON-RPC
  method and the tool name (e.g. `tools/call start_recipe`) plus a timestamp,
  for uptime and error monitoring. It does **not** log tool arguments or the
  recipe text;
- makes **no outbound network calls** — every response is computed from the
  immutable catalog shipped with the server (closed-world; zero runtime
  dependencies).

## What we do not do

- We do not sell, rent, or share data with third parties.
- We do not use request content for analytics, advertising, profiling, or model
  training.
- We do not store the content of your requests or the recipes returned.

## Hosting & transit

The service is hosted on Render (United States) and reached over HTTPS. Requests
reach the server via your Claude client and Anthropic's connector
infrastructure, each governed by their own terms and privacy policies. Render may
retain standard infrastructure logs (request timestamps, tool names, error
traces) under its own retention policy; these contain no request content.

## Data retention

The server persists nothing itself. The only retained data is the ephemeral
host-level operational logs described above.

## Your choices

Because no account or personal data is involved, there is nothing to delete on the
server. You can remove the connector from Claude at any time via
**Settings → Connectors**.

## Changes

We may update this policy; material changes will be reflected by the "Last
updated" date above.

## Contact

Questions about this policy or the service: open an issue at
<https://github.com/WeningerII/CodexMusica/issues>.

---

CodexMusica and its catalog data are proprietary. See `LICENSE`.
