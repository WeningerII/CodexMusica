# Live pronunciation-coverage probe (BB8, 2026-10-18, about 16:05 UTC)

This is one raw-engine `lyric_check` through the hosted connector (`mcp.codexmusica.com`), with no session. It is read-only and calls no model. Live commit: `health_commit.txt`.

**Draft:** 12 lines written by BB8, scheme `AABBCCDDEEAA`. Line 11 deliberately repeats line 1. The lines include contractions and slang (gonna, rollin', y'all, you'd, it's), a brand (Chevrolet), a proper name (Patsy), and a British spelling (rumour).

**Result:**
- 10/10 mandated pairs judged, 0 refused, 0 unreadable, `certified: true`. Lexicon supplement v2 (`bec6e6dd…`).
- 3 flags:
  - CLICHE_PAIR heart/apart (lines 7–8).
  - REPEAT_IN_VERSE and SCHEME_VIOLATION on L1/L11. These are the writer's own declaration error: an identical returning line belongs in `returns`, not in the rhyme scheme.
- `reader_scheme: "v2"` and `comparator_fingerprint: "51316f79…"` are in the result, so the live harness reads v2 and is still the pre-#577 comparator.
- Wall time 37.4 s. The reply is 270,272 bytes, of which `schema_instance_evidence` is 262,571 (97%).
