# Live checks after the #569 merge (`6eaa8e4c`), 2026-10-16, 00:47–00:55 UTC

Everything here was read-only. Every `/chat` and `mcp.codexmusica.com` request was recorded and aborted, so nothing was sent and nothing was charged.

## Step 0: what is deployed

| Surface | Serves | Matches |
|---|---|---|
| `https://codexmusica.com/codex.html` | sha256 `94dbde6a…`, Last-Modified 23:57:33 GMT | **#569 / main `6eaa8e4c`**, the same page as `f8093986`, which I qualified at 21:10 |
| `https://mcp.codexmusica.com/health` | `commit: b887e5ef…` (`connector_health.json`) | **still the old `b887`** |

Production qualification for `6eaa8e4c` (run 38830385318) was in progress. The one for `5d922d8d` failed.

## Step 1: H1 on the live connector — not rerun

The connector is unchanged at `b887`, so the 21:27 FAIL (`../postdeploy_5ad10a62/`) still stands. A rerun is owed once `/health` reports a newer commit.

## Step 2: P-A on the live redesigned page — PASS (refuse branch)

The redesign moved Run review into the Review panel, so the 21:30 probes' selector (`.ly-head [data-ui=ly-run-review]`) no longer matched. That's a probe change, not a product failure. `visible2.js` clicks the visible `[data-ui="ly-run-review"]` and opens the Review tab first when needed. It ran on the legacy row `[SETUP — rhyme groups — 1.T4,2.end]` with `Oh--oh, (ah) oh my love`, with voices off and with voices sung:

- **0 `/chat` POSTs in both.** No request binds any word.
- The row is rewritten to `1.T4 (numbered under the earlier cut with no saved setting for sung asides),2.end — numbering v2[+voices] — cut v2`.
- The page's live region says: *"Nothing was sent. The [SETUP] row on document line 1, 1.T4, has no saved setting for whether parenthesized words were sung. Its number can refer to different occurrences. In Review, choose the occurrence you intended, or remove this declaration."* (screenshots attached).

The two-direction voices-toggle walk (`live_pa.js`) wasn't rerun on the new layout. The refusal happens at the first send, before any toggle.

## Not covered

- The redesign's I8 header and new wording live: that's the release watch's check;
- devices, IME and screen readers;
- H1 live, which waits on the connector.
