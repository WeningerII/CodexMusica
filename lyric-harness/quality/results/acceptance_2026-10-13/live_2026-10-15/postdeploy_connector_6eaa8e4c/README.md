# Live H1 after the connector deploy of `6eaa8e4c`, 2026-10-16, 02:01–02:05 UTC

`mcp.codexmusica.com/health` reports `commit: 6eaa8e4c…`, `release_id …:38826388725:1:lyrics-image`, lyrics ready (`connector_health.json`), at 02:01. Production qualification run 38830385318 for `6eaa8e4c` finished SUCCESS (29/29 jobs) at 01:58.

The calls were raw `lyric_check` (no session, no provider), the same as `../postdeploy_5ad10a62/` step 1:

| Call | 21:27 on `b887` | 02:02 on `6eaa8e4c` |
|---|---|---|
| `Read--read, read it again` / `the bed is made for me`, `1.T2,2.T2`, `perfect rhyme`, `numbering v2`, default supplement `v2` | **refused**, `SCHEME_UNREADABLE`, `certified: false` | **answered**, `certified: true`, no refused obligation (`h1_read_v2.json`) |
| same, `Lead--lead, lead the way` | refused | **answered**, `certified: true` (`h1_lead_v2.json`) |
| `Read--read`, supplement `none` | answered | answered (`h1_read_none.json`) |
| control `I 2 love you love` / `the dove above`, unmarked `1.T3,2.end` | refused (ambiguous token 3, asks for numbering) | **refused**, same message |

**H1 live: PASS.** The saved JSON omits the 90 KB `schema_instance_evidence` sibling and the report text.

**Observation, logged rather than acted on:** each raw `lyric_check` reply on this two-line draft is now about 93 KB (93,028, 92,795 and 92,747 characters). Nearly all of it is the `schema_instance_evidence` sibling, which is capped at 262,144 bytes by its own `limits`. My own client couldn't show it inline. A caller with a tight response budget may hit the same limit.
