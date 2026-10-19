# The #577 straddle test (John approved, 2026-10-18)

**Question:** does a lyric run saved on one live build survive a deploy to a build carrying #577?
"Survive" has two separate meanings here:
- (1) its stored record is unchanged;
- (2) a targeted revision on it is either carried out under its recorded scorer, or explicitly
  refused.

Session and run ids are private and appear nowhere here.

## The run

- **Saved on:** live `df11e3b7`, 2026-10-18 16:33–16:36 UTC, one free `/mcp` edit session.
- **Draft:** 8 lines, scheme `AABBCCDD`, sha256 `0e7d4595…`.
- **State:** `lyric_revise` exit 4, awaiting a batch answer for L5 and L7, round 1, 0 answers on
  record. Comparator `51316f79`, `reader_scheme: v2`.
- **Re-read on:** live `63e9afc1`, 2026-10-19 03:24 UTC. That build carries #577 plus
  #583–#587; production qualification run 128 passed at 03:08.

## (1) No-edit comparison: PASS

A `recover_only` export after the deploy, compared field by field with the pre-deploy export
(`pre_deploy_public.json` against `post_deploy_public.json`):

| field | equal |
|---|---|
| `original_wire_sha256` (`8811296e…`), `original_wire_bytes` (9,237) | yes |
| cursor `scorer` (`171a2d48…`), cursor `digest` (`cd5fac3b…`) | yes |
| `cursor_seal` (`8b2fe8e1…`) | yes |
| `connector_semantic_identity` and `source_semantic_identity` (`05091700…`) | yes |
| `checksum_verified` (true), `reader_scheme` (v2) | yes |
| `accepted_lines` (all 8) | yes |

## (2) Accepted proposal: explicitly REFUSED, as predicted

Answering the pending batch with Jony's lines:
- L5: "I trace the roads you pencilled on a chart"
- L7: "I keep the porch screen latched, but not too tight"

The connector returned, verbatim:

> CONTINUATION_MIGRATION_REQUIRED: The scorer, its lexical data or its runtime changed after this
> session was recorded, and its receipts cannot be replayed under the new ones. lyric_revise with
> this session_id and recover_only: true exports the lyrics and journal it holds; then call
> begin_lyrics for a new session.

- **Nothing changed:** a second export straight after the refusal is identical on every field
  above, with 0 answers on record. The song text did not change silently, and no answer was
  half-applied.
- **Why it refuses:** any code change under `mcp/` or `lyric-harness/` moves
  `connector_semantic_identity` (`build_identity.js`). A held run then refuses rather than
  replaying under a new scorer (`state_codec.js`).
- **What this proves:** the refusal path is clean, and so is the export.
- **What it doesn't prove:** that targeted revision across a deploy works. By design it can't. A
  held run is resumable only on the build that recorded it. A revision after a deploy starts from
  the exported lyrics in a new session.

## The edit boundary

- **The held run's stored brief** still reads "LINES THAT MUST NOT CHANGE — L3", because the
  question it holds was rendered on `df11e3b7` and is replayed verbatim.
- **The fix:** #585, now live, renders the full protected set (L1–L4, L6, L8) for questions asked
  on this build. It was verified offline in `../verify_585_b51180ce/`.
- **Still to check live:** whether the brief tells the host the complete boundary, in a new
  session created after the deploy.
