# Privacy Policy — CodexMusica connector

_Last updated: 2026-08-03_

CodexMusica is a **read-only, stateless** Model Context Protocol (MCP) server. It
turns musical requests into recording recipes from a fixed, bundled catalog. This
policy describes what it does and does not do with data.

## What we collect

**No accounts, and no user profiles.** The connector requires no sign-in, sets no
cookies, and builds no profile of anyone. It accesses no private data on your
behalf. The one thing it does record about a caller is the ordinary network
metadata of the HTTP request itself — see **Request logging** below.

When Claude calls a tool, the server receives the structured arguments for that
call (e.g. a tradition id, an instrument id, or a search phrase you asked Claude
to look up). The server:

- is **stateless** — it creates a fresh handler per request and keeps no session,
  database, or persistent store of requests or responses;
- writes one **request log** line per inbound HTTP request, described in full
  under **Request logging** below, plus a second line for MCP calls carrying the
  JSON-RPC method and the tool name (e.g. `tools/call start_recipe`), for uptime
  and error monitoring. Neither line contains a request body, so MCP tool
  arguments and the recipe text are not logged;
- makes **no outbound network calls to serve an MCP tool call** — every tool
  response is computed from the immutable catalog shipped with the server
  (closed-world; zero runtime dependencies).

That last point is scoped to the MCP surface deliberately, because the same
deployment also serves a chat bar that does call out. See **The chat bar** below.

## The chat bar (`/chat`) — this one does call out

The published web page carries a chat bar, and its backend is mounted on this
same service. It is a **separate surface** from the MCP connector, and it does
not share the connector's no-egress property:

- **Your message and the conversation history are sent to Google** — specifically
  to the Gemini API, which turns what you type into tool calls against the local
  engine. Nothing else in this service sends anything anywhere; this endpoint
  does, on every turn.
- Google processes that text under **its own terms and privacy policy**, not
  this one. The request is made with our API key, so it is not tied to any
  account of yours.
- **Your workspace is withheld from the model.** The recipe workspace travels in
  the request envelope and is passed straight to the engine; it is never placed
  in the model's context.
- This server still stores none of it. The conversation lives in your browser and
  is posted back each turn; the process keeps no transcript and no session — only
  server-level counters (rate-limit buckets, a spend total) that describe the
  service rather than any user.

If you use only the MCP connector — the tools Claude calls — no part of your
request reaches Google or any other third party.

## Request logging

Every inbound HTTP request is written as one line to the server's standard
output, which the hosting platform captures as the service log. This exists for a
specific reason: the claim that some agent or crawler fetched one of our URLs
should be checkable against the server's own record instead of taken on trust.

Each line holds a timestamp, the HTTP method, the requested path **including its
query string**, the response status code, how long the request took, and the
three headers that identify the caller — `user-agent`, `referer` and
`x-forwarded-for`. One of those is worth spelling out:

- **`x-forwarded-for` carries an IP address** — the calling network's, as
  reported by the proxy in front of the service.

**Request bodies are never logged.** MCP tool arguments travel in the body, so
they are not recorded, and neither is any response or recipe text.

## What we do not do

- We do not sell or rent data to anyone. The one third party that receives
  content is Google, and only for the chat bar described above — never for an
  MCP tool call, and never for advertising or marketing.
- We do not use request content for analytics, advertising, profiling, or model
  training.
- We do not store request bodies or the recipes returned.

## Hosting & transit

The service is hosted on Render (United States) and reached over HTTPS. Requests
reach the server via your Claude client and Anthropic's connector
infrastructure, each governed by their own terms and privacy policies. Render
captures the service's standard output — the request log described above — along
with its own infrastructure logs and error traces, and retains them under its
own policy.

## Data retention

The server writes no database, no file and no cache; it persists nothing itself.
The only data that outlives a request is the log lines above, held by the hosting
platform for whatever window its policy allows. We can tell you exactly what we
write and what we refuse to write; we cannot make a retention promise on Render's
behalf, so this document does not make one.

## Your choices

Because there is no account and the server stores nothing itself, there is no
profile to delete; the only trace of a call is the platform-held log line
described above, which ages out on the host's schedule. You can remove the
connector from Claude at any time via **Settings → Connectors**.

## Changes

We may update this policy; material changes will be reflected by the "Last
updated" date above.

## Contact

Questions about this policy or the service: open an issue at
<https://github.com/WeningerII/CodexMusica/issues>.

---

CodexMusica and its catalog data are proprietary. See `LICENSE`.
