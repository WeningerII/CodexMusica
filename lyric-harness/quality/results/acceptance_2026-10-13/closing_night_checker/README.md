# Receipt checker for the "Closing Night" acceptance run (BB8, 2026-10-18)

`receipt_check.py` makes BB8's two checks under agreement v2 (#519, 6252518112 and 6252637399):

- **Item 5, recovery.** `recover` compares two `lyric_revise recover_only: true` exports, read
  just before an interruption and just after the resume.
  - With no accepted edit, every identity field must be equal: wire sha256 and bytes, cursor seal,
    scorer and digest, semantic identity, `checksum_verified`, `reader_scheme`.
  - With `--accepted-edit --changed=…`, only the named lines may change, a new answer must be on
    record, the scorer must be kept, and every other line must stay byte-identical.
- **Item 6, final song.** `final` checks that the song the host showed equals the final receipt's
  song byte for byte. It also prints `reader_scheme` and `comparator_fingerprint` for item 3.

It reads captured results only and calls nothing. Don checks the same evidence by his own method,
without this script, so the two results can be compared.

## Tested before use (17:12 UTC)

The input was the real `recover_only` export from the straddle test's pre-deploy half (16:35 UTC,
live `df11e3b7`), plus copies broken on purpose. The inputs stay in BB8's scratchpad because their
wrappers carry private session ids.

| case | expected | exit |
|---|---|---|
| export vs itself | PASS | 0 |
| L3 changed, no edit expected | FAIL, names L3 | 1 |
| L5 changed with a new answer, `--accepted-edit --changed=5,7` | PASS, L5 edit and wire move reported | 0 |
| scorer changed, no new answer | FAIL on both | 1 |
| shown song equal to `final_draft` | PASS; sha256 `0e7d4595…` equals the baseline's `draft_sha256` | 0 |
| shown song with one apostrophe dropped | FAIL, names line 8 | 1 |
| a text file given as the receipt | unreadable | 2 |

The export carries no `comparator_fingerprint`: the comparator is on the check and revise results,
not on a `recover_only` export. So item 3 reads it from the final `get_operation` receipt.
