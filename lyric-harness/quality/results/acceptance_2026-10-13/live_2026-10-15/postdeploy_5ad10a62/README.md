# Live checklist steps 0–2 after the #562 merge, 2026-10-15, 21:25–21:35 UTC

Everything here was read-only. The connector was called only in raw `lyric_check` mode, which reaches no provider. On the page, every `/chat` and `mcp.codexmusica.com` request was recorded and aborted (`completed blocked requests: 0`). See `../../LIVE_CHECKLIST.md`.

## Step 0: what is deployed — the site and the connector are on different builds

| Surface | What it serves | Matches |
|---|---|---|
| `https://codexmusica.com/codex.html` | sha256 `fff0bf2f…`, Last-Modified 20:29:37 GMT | **main `5ad10a62`** (the #562 merge), which carries P-A and H1 |
| `https://mcp.codexmusica.com/health` | `commit: b887e5ef…`, `release_id …:lyrics-image` (`connector_health.json`) | **old `b887e5ef`**, which has neither H1 nor P-A |

"Deploy connector to Render" reported success for `5ad10a62` at 21:00, yet the service still reports `b887`. Production qualification for `5ad10a62` (run 38806557666) was still in progress at 21:27. The one for `f4b84158` failed at the capacity-matrix memory cell. From the outside, the connector image appears to follow Production qualification; I have not verified that from the workflow source.

## Step 1: H1 through the live connector — FAIL (expected while the connector is on `b887`)

`lyric_check` (raw) on `["Read--read, read it again", "the bed is made for me"]`, `groups 1.T2,2.T2`, `relation "perfect rhyme"`, `numbering v2`:

| Supplement | Live | Main's code locally (`raw_check.mjs` against the `f4b84158` tree, which contains H1) |
|---|---|---|
| default `v2` | **refused**, `SCHEME_UNREADABLE`, `certified: false` | **answered**, `certified: true` |
| `none` | answered, `certified: true` | answered, `certified: true` |

`Lead--lead` gives the same refusal live. The H4 control "I 2 love you love" still refuses live, asking for the numbering.

This is the same result as the 15:57 `b887` baseline. The fix is in main and works on main's own connector path. It is **not live**, because the connector still runs `b887`.

## Step 2: P-A on the live page — PASS (refuse branch)

`live_pa.js` (unchanged from the 16:00 run) ran both directions on the legacy row `[SETUP — rhyme groups — 1.T4,2.end]` with `Oh--oh, (ah) oh my love`:
- **0 `/chat` POSTs on either Run review press.** No request binds any word.
- The row is rewritten to `1.T4 (numbered under the earlier cut with no saved setting for sung asides),2.end — numbering v2[+voices] — cut v2`.
- `visible.js` captured the page's live-region text after Run review: *"Nothing was sent. The [SETUP] row on document line 1, 1.T4, has no saved setting for whether parenthesized words were sung. Its number can refer to different occurrences. In Review, choose the occurrence you intended, or remove this declaration."* (`after_run_review.png`).

At 16:00 on `b887`, the same steps sent `1.T5` and bound **my** or **love** wrongly. Now the page refuses and says why, which meets the checklist's PASS rule ("the page … refuses and asks you to declare the numbering").

## Not covered

- #562 on real devices, IME and screen readers;
- live #569, which is not merged;
- a rerun of step 1 after the connector redeploys. That is owed.
