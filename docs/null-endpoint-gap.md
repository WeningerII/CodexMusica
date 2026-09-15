# Constant endpoint locality statistics — M-46

The null diagnostic could present a same-line fraction of zero as a statistical
result even when the schema could only compare spans on different lines.
This closes the computational part of M-46 from the earlier lyrics audit.

The original proposed fix was too broad. The production mosaic-rhyme judge
accepts `door` against `the door` on the same line of `door the door`.
Both spans end at the same unit, so `both_line_final` does not establish a
minimum line gap. The regression exercises actual candidate enumeration and
judgment, including searched and asymmetric endpoint rules.

The valid bound follows from identical, unsearched endpoint-token rules:
each line supplies at most one span under that rule, and candidate enumeration
excludes a span paired with itself. `forced_gap` now derives a minimum gap of
one in that case. The sweep excludes the resulting constant
`local_fraction@0` statistic and retains the other questions. Multiword,
searched and asymmetric cases keep their possible gap of zero.

The full 77-schema ledger census was measured before and after. Twenty-two
menus lose this statistic, removing 42 derived statistic/null nominations.
Every schema verdict, confirmed and unresolved instance count, capability
refusal and remaining statistic/null nomination is unchanged. The
[measurement receipt](null-endpoint-gap.json) retains each changed menu's
previous and current size, its observed counts and the baseline commit.

Eight historical `MENU_SILENT` rows for the retired statistic are preserved
in the receipt and removed from the active comparison. The remaining deep
null measurements retain their historical scope; this change does not claim
a newly qualified deep panel. No corpus, calibration, relation definition,
candidate enumeration or production lyric grading behavior changes.

The seven new regression checks include a real semirhyme sweep and three
controls against an overly broad rule. Two checks fail against the original
implementation; all seven pass after the repair. Run the maintained suites
from the repository root with its declared Python dependencies and dictionary:

```sh
python3 lyric-harness/quality/test_null_shapes.py
python3 lyric-harness/quality/test_relations_null.py
python3 lyric-harness/quality/relations_null.py --verify
```

Completed validation: 50 null-shape checks and 77 panel checks pass.
The null-shape suite includes the complete current ledger verification.
Counter consistency, register audit, documentation paths, build dependency
closure, JSON formatting, Python compilation and whitespace checks pass.
