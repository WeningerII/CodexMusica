# Privacy Policy — CodexMusica MCP server

_Last updated: 2026-06-14_

The CodexMusica MCP server is a **stateless compute service** over a fixed,
public catalog of music-production data. It is designed to collect and store as
little as possible.

## What it does

It receives tool calls containing **music parameters** (tradition ids,
instrument ids, part/variant ids, axis targets, etc.), computes a recording
"recipe" deterministically, and returns it. That's the entire function.

## What it collects

- **No accounts. No authentication. No personal data.** The server asks for
  none and requires none. Tool inputs are music-catalog identifiers, not user
  information.
- **No request content is persisted by the application.** Tool inputs and
  outputs are processed in memory to answer the request and are not written to a
  database or stored by the application — there is no database.
- **Operational logs.** The hosting provider and the application may record
  standard operational metadata (timestamps, IP address, status codes, error
  traces) for reliability, security, and abuse prevention. These are not used to
  build user profiles and are not sold or shared for advertising.

## What it shares

- **Nothing is sold or shared** with third parties for marketing or advertising.
- The only third party involved is the **hosting provider** that runs the
  server, which processes requests solely to deliver the service.

## Data location & determinism

All "intelligence" is in the static catalog compiled at build time; outputs are
deterministic functions of the inputs and the published dataset. The service
makes no outbound calls to other services to fulfill a request.

## Changes

This policy may be updated; the "Last updated" date above will change. Material
changes will be reflected in the repository history.

## Contact

Questions or requests: open an issue at
<https://github.com/WeningerII/CodexMusica/issues>.
