# Lyrics computation audit — 2026-09-14

Audited from `d12108fe8deb95d2315431b29fb720991c394bee` (main).
Scope: lyrics input, mathematical declarations, planning and fitting algorithms,
phonetic comparisons, statistical diagnostics, floor measurements, recovery,
and the revision/verification handoffs exposed through the CLI and MCP.
The recipe engine is outside this audit.

## Confirmed findings and repairs

| Finding | Consequence | Repair and evidence |
|---|---|---|
| Word indices restarted on each line but timing comparisons treated them as global identities | Different words on different lines were excluded from observed and null rhyme comparisons | Identity is now `(line, word index)` in runtime and supporting diagnostics; cross-line counterexample, exhaustive candidate oracle, and cached/runtime parity pass |
| BH resolution guard treated `q/n` as necessary for any discovery | Valid collective discoveries were refused; diagnostics then described a different correction | Guard uses the largest available scored rank; ordinary step-up handles discovery and metadata reports BH cuts. Two p-values of 0.03 at q=0.05 are the independent counterexample |
| Sidak arithmetic lost precision and mishandled integer boundaries | Tiny cuts could round to zero; equality and some inverse family sizes were wrong | Stable `log1p`/`expm1` calculation and integer boundary search against the forward cut; equality, tiny-probability and multiple-family tests |
| Several direct computational declarations admitted invalid values | Fractional subdivisions were silently truncated; invalid windows, sample counts and probabilities reached calculations | Explicit validation before computation; tests exercise fractions, booleans, nonfinite values and invalid ranges |
| Typographic apostrophes and decomposed Latin text changed word identity | Identical words received different token counts, lexical statistics or rhyme predictability | Shared apostrophe folding and NFC normalization; all affected calibration populations remeasured |
| Recovery read different text from grading and described unreadable syllables as exact counts | Editorial rows or bracket notation could change recovered sections; unknown pronunciations masqueraded as complete measurements | Recovery consumes the normalized sung rows while retaining physical positions; incomplete syllable counts are explicitly lower bounds with refused exact-count provenance |
| Empty automatic chain inference invented line zero | Empty input could raise an index error | Empty input returns no chains |
| Repeated scans in runtime statistics and candidate generation | Unnecessary work grew with text and window size | Sliding word-frequency counts for MATTR, one frequency count for anaphora, and bounded start-position searches; output order and bit-level MATTR equivalence are tested |
| Stanza reference values had drifted; the old sonnet predictability cutoff did not reproduce even before the token fix | Correct arithmetic could still be judged against stale reference numbers | Recomputed full human/generated stanza populations. Sonnet predictability's actual human 95th percentile is 1.0; its inability to flag is disclosed rather than presented as discrimination |
| Curve validation checked coefficients and population size but not the measured length endpoints | A stale applicability boundary could pass validation | The gate now rejects both widened and narrowed stale boundaries; regression exercises each case |

An incidental test-isolation defect was also repaired: the missing-memory-counter
test now simulates an unavailable counter instead of depending on the runner's
actual cgroup. The production memory calculation was not changed.

## Independent verification

The original core baseline passed 22 suites and the connector baseline passed
50 tests. Nevertheless, 12 methods in the first 22-test counterexample suite
failed or errored on the original commit. The raw failures, including subtests,
are retained in `counterexamples-before.json`.

The new suite contains 24 methods. It includes independent exhaustive oracles
for section partitions, prominence placement and weighted consonant alignment,
plus candidate enumeration and arithmetic boundary checks. Wolfram Language
independently checked Bell numbers, restricted composition counts, completion
counts, the Sidak equality boundary and the BH collective-discovery example.
`wolfram-oracles.json` records those calculations. They are mathematical checks,
not claims that Wolfram inspected the entire repository.

`validation.json` records completed checks and their exact log files. The full
offline production chain passes 104 Node tests and 96 Python tests. Further
focused suites cover planning, grid/fit, recovery, floor, revision, loop,
pronunciation, replay and statistical diagnostics. Source syntax and whitespace
checks are included. Archived log trailing whitespace is normalized, with original
and archived hashes recorded in `log-normalization.json`. Earlier failed attempts remain identified as earlier
attempts, not relabelled as final passes.

## Calibration adoption

All 8,545 nonempty English song works over 1,296 files were remeasured with
11,437 exact phonetic fields. The corpus bytes did not change. Verified rows and
their input fingerprint sidecar are archived here. The cold rebuild completed
in 1,311 seconds on this environment; this is not a deployment performance claim.

The token fix changes token counts in 1,230 works, MATTR in 1,249,
function-word ratio in 1,254 and predictability in 257. Repeated titles are
retained as separate occurrences in the comparison. The measured maximum
length moves from 3,245 to 3,244 tokens; 540 works are at or below the 50-token
MATTR window. The runtime applicability boundary and TTR population match those
measurements.

The full 200 author/file-held-out 50/50 splits pass all five checks in all 21
length bins. The unchanged selection rule chooses C1 for MATTR and
function-word ratio, C2 for anaphora and knot interpolation for line-length CV.
Predictability retains the previously adopted knot model exception to the
vacuous constant ceiling; it also passes every bin. All fitted coefficients,
knots and main-profile held-out percentages are preserved at full precision.
The pooled median rate of at least one flag on held-out human works is
18.6062%; it is not a correctness score or evidence of artistic quality.

The historical song and short bands were also rerun under their original rules:
200–400 tokens / 2,231 works, and 50–150 tokens / 3,650 works, respectively.
They remain superseded by the main lyric profile. The stanza profiles were
remeasured over all 152 human and 40 generated sonnets and their first three
quatrains. Their central length ranges become 105–123 and 28–36 tokens.
Stanza AUCs are descriptive class comparisons, not held-out validation.
Because the planner derives its envelope from these measurements, its whole-song
line-count reach becomes 1–463 instead of 1–447; the sampling rules are unchanged.

The timing null-band guard was recalibrated using its unchanged rule,
twice the maximum over the first 30 Shakespeare sonnets: `2 * 0.0562 = 0.1124`.
The saturated fixture is a control, not an input used to choose that threshold.

These results supersede older numerical statements for the affected source
coordinates. Older documents and source notes retained as history describe
those earlier measurements; they are not evidence for the corrected tokenizer.

## Reproduction

Run from the `lyric-harness` directory with the repository's declared CMUdict and NLTK
assets staged. This measurement used Python 3.12 and NLTK 3.10.3.

```sh
npm run test:lyrics:math
npm run test:production:offline
python3 quality/time_attainable.py --verify
python3 quality/fwer_family.py --calibrate
python3 quality/length_curve_calibration.py check --rows quality/results/computational_audit_2026-09-14/current-calibration-rows.tsv
python3 quality/calibration_rebuild.py --output-dir /tmp/lyrics-audit-calibration --workers 6
python3 quality/length_curve_calibration.py fit /tmp/lyrics-audit-calibration/current-calibration-rows.tsv --seeds 200 --workers 6 --picks predictability=CK --report /tmp/lyrics-audit-calibration/curves.json
python3 quality/results/computational_audit_2026-09-14/measure-bands.txt --cache /tmp/lyrics-audit-calibration/current-predictability.tsv --report /tmp/lyrics-audit-calibration/bands.json
```

`measure-stanzas.txt` additionally accepts `--field-cache`,
`--baseline-features` and `--report`. Supply the SQLite checkpoint produced by
the rebuild and `quality/features.py` from the baseline commit for the isolated
before/after token comparison. The checkpoint is reproducible and is not
committed. The reader, comparator, tagger and corpus identities accompany the
measurements; the stanza record also hashes its actual source files.

## Limits of the conclusion

The confirmed defects are repaired and the affected reference values have been
remeasured. This is not a proof that every possible lyric will work, that every
algorithm is globally optimal, or that the musical judgments are universally
valid. The timing model's dependence assumptions and limited discriminatory
power remain explicit research limitations. Short-text predictability can be
unresolvable; the sonnet percentile currently reaches the statistic ceiling.
No live external writer, hosted deployment, paid battery or new production
capacity qualification is claimed. The changes are supplied for review and
have not been merged or deployed.
