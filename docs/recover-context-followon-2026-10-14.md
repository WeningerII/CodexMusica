# Recovery context follow-on — 2026-10-14

Base: `88fa63a81d8e88e5797780a50a57f0087c24d3bd` (PR #557).
This isolated follow-on changes recovered line-end registry schemas for reader v2
only. Recovery now uses the existing `relation_phonology_for(lex)` adapter, so
selected supplement entries, declared pronunciations, the reader coordinate and
aside/voices context match the supplied lexicon. The adapter retains the registered
relation reader's fallback policy. The v1 recovery path is deliberately preserved,
including its historical omission of supplement-derived registry edges.

Before the fix, the new selected-lexicon regression failed: supplemented
`streetlight/night` lacked nine registry relations, and the selected-context
`perfect rhyme` assertion failed. After the fix, both new tests pass. They use
real registry judges for shipped compound/number entries, plain positive and
negative controls, an unsupported token, a separately identified declared
`king-` pronunciation, aside/voices endpoints, registered fallback policy and an
explicit v2 lexicon inside a v1 process. A frozen v1 web is unchanged inside both
process contexts.

Validation from `lyric-harness/` with Python 3.12.14:

```sh
python -m unittest quality.test_reader.OneCoordinate quality.test_reader.V1Frozen
python quality/test_recover.py
python map/build.py --check
```

Results: 11 unittest tests passed (27.073 seconds); the existing recovery suite
reported ALL PASS; the generated map is current. The map file-size estimate was
regenerated after the production edit. The comparator fingerprint remains
`51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4`.
No calibration rerun, threshold change, provider call or live-service acceptance
claim is part of this local regression evidence. Raw local diagnostic logs are
retained outside the repository; this receipt does not depend on published logs.
