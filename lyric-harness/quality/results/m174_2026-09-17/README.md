# M-174: two-member overhang capacity

Base: `fcebe7066b44943ccc199760b0471e7d2ae4b437` (main, PR #322).
The earlier group-ordering repair was present; the remaining syllable-budget
check was absent. No open PR overlapped at the initial and pre-validation reads.

The repair changes relation selection and the plan's joint gate. Both use one
minimum-syllable calculation: enough one-syllable words to reach every declared
position, plus one syllable for each distinct word required to overhang. Separate
end bindings consume a final word; token aliases share their extra syllable.
Accepted groups consume the same per-line budget before another relation is drawn.
The available ceiling remains `min(line slots after pickup, density ceiling)`.
No calibration threshold, comparator input, corpus text or provenance row changes.

The check is necessary, not sufficient. It does not certify lexical availability,
longer actual anchors, other schemas' syllabic requirements, or completion of a song.
An absence of this finding establishes only that this minimum fits.

Reproduce the focused controls from `lyric-harness`:

```sh
python3 -c 'import sys; from quality import test_plan as t; t.test_the_overhang_group(); sys.exit(bool(t.FAILURES))'
```

`overhang.txt` is the complete output, with trailing spaces removed from
transcript lines (the same normalization is applied to all text receipts). The added controls cover both directions,
text-order sorting, default and per-group relations, bare/end/endword aliases,
numbered positions, cumulative demands, the exact boundary and the density ceiling.
The independent schema and meter checks use `grow` and the fourth word of
`we see it growing tall`: the relation holds, the line has six syllables, and
five slots fail while six fit. The existing sweep still reaches semirhyme.

`draw-mutation.txt` disables only the new candidate filter by replacing its single
`if not _overhang_budget(` with `if False and not _overhang_budget(` in an
in-memory copy of the module. The existing section-17 seed sweep then reaches
`OVERHANG_EXCEEDS_SPAN`: a demand of nine syllables against eight available.
This shows the candidate filter is exercised, independently of the finished-plan
gate. `mutation.txt` removes the extra-syllable charge from the shared predicate;
the new boundary controls must fail. Neither mutation changes files on disk.

The suite receipts use `quality/suite_sweep.py --only` for the named test file. The full planner suite also runs in GitHub CI. The eight record-gate receipts are named
for their instruments. `comparator.txt` is the staged-data comparator check;
its exit-0 fingerprint is `14821a50f63e8ffd3565ba36f1446117b4a6670bb42cc6c7f53970af02bed431`.
No comparator repin or recalibration is owned by this change.

The local receipts ran against the modified working tree before publication.
The suite runner prints the base Git HEAD, not a hash of uncommitted files.
`source-sha256.json` identifies the implementation and regression files actually
checked; GitHub CI verifies the subsequently published commit.
