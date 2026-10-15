# H1 on the live connector (production), 2026-10-15 about 15:58 UTC

BB8 ran this from its own session through the Codex Musica MCP connector, in raw mode (no `session_id`). The call was synchronous and reached no model provider.

**Call:** `lyric_check`
- lines: `["Read--read, read it again", "the bed is made for me"]`
- `groups: "1.T2,2.T2"`, `relation: "perfect rhyme"`, `numbering: "v2"`

| `lexicon_supplement` | Result |
|---|---|
| omitted, so the default: `v2`, sha256 `bec6e6dd…` | `rhyme:1:2:0` **refused**, finding `SCHEME_UNREADABLE` ("the declared relation 'schema:perfect rhyme' has no coordinates in this pair"), `certified: false`, `pairs_judged 0`, `pairs_refused 1`, 6,481 ms |
| `none` | `rhyme:1:2:0` **answered** (HOLDS, with a `MODAL_RHYME` note), `certified: true`, `pairs_judged 1`, 16,881 ms |

**So H1 is live in production.** The connector's default basis refuses a declared rhyme that CMUdict alone judges. This matches the local reproduction at `b887e5ef` (`../review_b887e5ef/repro_pin_guard/`, `../probes/h1_pin_guard/`). Don Norman reports that the live `codex.html` is byte-identical to main `b887e5ef`.

**What this does not establish:** which commit the connector's server runs. That isn't exposed to this call.
