# P-A on the live deployed Lyrics page: regression reproduced

This was run on 2026-10-15 at about 16:00 UTC, against the **live deployed page**, in headless Chromium through the environment's proxy with TLS verification on. **Every request to `/chat` or `mcp.codexmusica.com` was recorded and then aborted.** None reached the service (`completed_blocked: 0` in both runs), so nothing was sent to the writer or review service and nothing was charged.

**Build:** the live `codex.html` sha256 is `9b763090…4ec4`, equal to `git show b887e5eff:codex.html`. The document Chromium loaded has the same hash.

**What the word numbers mean on `Oh--oh, (ah) oh my love`**, from the page's own word cuts (`tokens_b887.txt`):
- legacy T4 = love;
- v2 T5 = love;
- v2+voices T5 = **my**, and T6 = love.

| Direction | Send 1 declarations | Send 2 (after the voices change) declarations | Bound by send 2 | Intended |
|---|---|---|---|---|
| voices off → sung | `groups 1.T5,2.end`, `numbering v2` (love) | `groups 1.T5,2.end`, `numbering v2+voices`, `voices: true` | **my** | love |
| voices sung → off | `groups 1.T5,2.end`, `numbering v2+voices` (my) | `groups 1.T5,2.end`, `numbering v2` | **love** | my |

The migration wrote `[SETUP — rhyme groups — 1.T5,2.end — cut v2]` with no numbering mark. Each send then stamped the **current** voices setting onto that row, and nothing refused.

**The UI path was real:**
- type into `#lyrics-draft` and blur;
- click the header Run review;
- set voices with Tools → Repeats & voices → apply;
- click Run review again.

**One page-state call was not a UI step.** Before the second send, the probe cleared the chat shell's "unknown outcome" pending state left by the aborted POST: `chatState.pending = null; chatState.disconnected = null; _chatSave(); lyRefresh(true)`. It touches no editor text or declaration.

**Files:**
- `live_pa.js`: the probe;
- `out/run_*.json`: the captured request bodies and editor rows;
- `out_console.log`: the browser console;
- `live_codex.headers`: the response headers for the live `codex.html`;
- `COMMANDS.txt`: every command.
