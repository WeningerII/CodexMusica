# Production data re-adoption, 2026-09-08

Status: data correction and re-adoption are complete. All five selected curves pass every measured bin; final current-source row parity and curve drift checks passed. All 81 certified capacity witnesses were reconstructed and reverified at the retained proof epoch, their reviewed table is published, and the six-adopter corpus snapshot passed its real CLI check. The minimal release assembly passed its byte/decision gate and actual offline CLI checks for all nine language ports. These local data proofs are not an image or hosted-service release approval.

The current calibration population uses `lyric_reader.calibration_items()`. Runtime reading preserves every staged edition. The separate, explicit work policy in `data/calibration_work_editions.json` gives one representative a weight of one and the other reviewed editions zero: 106 work groups, 215 editions. Six original Latin poems remain verse in their sources but are excluded from English calibration. Generic shared titles are not automatically duplicates. The final broader opening/lexical review retained ten candidate pairs as distinct works or separately headed sections; those decisions are recorded in the registry.

`CORPUS_EDITORIAL_REVIEW.json` records every staging correction and the old/new file hashes. Editorial text is retained as `# APPARATUS:`. Corrections include Herrick glossary definitions, Hemans footnotes and stage directions, Lovelace scholarly commentary, and Byron composition datelines. Blake and D'Urfey each contained two distinct works in one staged item; their verse was preserved and the item boundaries restored.

## Current population and measurements

| Measurement | Current result |
|---|---:|
| English source files | 1,297 |
| Weighted TITLE items | 8,546 |
| Nonempty lyric items | 8,545 |
| Files contributing nonempty rows | 1,296 |
| Distinct contributing author labels | 1,293 |
| Sung lines | 279,753 |
| Endword types / occurrences | 13,856 / 248,628 |
| Endword-pair types / occurrences | 23,763 / 190,210 |
| Exact predictability call fields | 11,380 |
| Items with decidable predictability | 8,491 |
| Length range / bins | 4–3,245 tokens / 21 |
| Meter measured lines | 231,750 |
| Meter density / prominence bands | [5,12] / [2,7], unchanged |
| Current D1 candidate pool | 4,392,354 |
| Current D1 judged agreement | 667 / 682 |

The single empty weighted TITLE is Sawyer's `WHEN THIS CRUEL WAR IS OVER`: the staged source contains an editorial essay and no lyric lines. The reader excludes the essay and the nonempty-item denominator excludes that item. It does not invent the missing song. The frequency builder still reports the TITLE denominator, so the two counts differ by exactly one.

The song-band rule now returns 200–450 tokens, 2,438 items and 690 contributing files. The short band remains 50–150 tokens, with 3,641 items and 690 files. Both were measured with all five checks and 200 author-held-out seeds. These historical band profiles remain superseded by the active length-conditioned lyric profile.

The committed 145-file structure-census table is a historical research artifact. It was not silently relabelled as a census of the current tree. Its recorded artifact checks and the current live D1 diagnostic passed. The historical table is excluded from the runtime image.

## Active lyric profile

The unchanged selection rule picks MATTR C1, function-word ratio C2, anaphora C2, and **line-length CV CK**. CV's previous quadratic passes 20 of the current 21 bins; the declared knot-table fallback passes all 21. This is the preregistered fallback, with no widened tolerance. Predictability retains the previously disclosed CK choice instead of the rule's uninformative constant 1.0; CK passes all 21 bins.

| Check | Held-out median % | 5th–95th seed percentile % |
|---|---:|---:|
| MATTR | 4.88 | 3.01–7.95 |
| Function-word ratio | 5.07 | 3.29–7.54 |
| Anaphora | 5.09 | 3.39–7.19 |
| Line-length CV | 5.31 | 4.28–6.72 |
| Predictability | 2.63 | 1.34–4.62 |
| Any of the five | 18.73 | 14.73–23.95 |

These are the complete 200-seed author-file holdouts over 8,545 current items. Predictability remains under-resolved at short lengths: its threshold equals 1.0 through 165 tokens and first falls below the ceiling at 166. Its pooled rate includes that silent region.

A final provenance refusal in the completed fit exposed an introspection defect: Python's `inspect.getsource()` trusted a loaded function's old line number after unrelated earlier lines changed. It then hashed a neighbouring function. `source_identity.definition_source()` now resolves the named declaration in the current module AST. The false hash was reproduced; every fresh current provenance key matched the saved rows; every printed full-precision coefficient and knot was independently re-derived, using the same two-start fits. The completed 200-seed rates were retained at their printed precision, with an explicit recovery proof. No scorer or fit function changed.

## Reproduction and safeguards

With the project dependencies and staged English tagger installed, run:

```sh
python3 quality/calibration_rebuild.py --output-dir /tmp/lyric-adoption --field-cache /tmp/lyric-fields.sqlite --workers 6
python3 quality/length_curve_calibration.py fit /tmp/lyric-adoption/current-calibration-rows.tsv --seeds 200 --workers 6 --picks predictability=CK --report /tmp/lyric-adoption/curve-adoption.json
python3 quality/song_profile_calibration.py --profile song --cache-path /tmp/lyric-adoption/current-predictability.tsv
python3 quality/song_profile_calibration.py --profile short --cache-path /tmp/lyric-adoption/current-predictability.tsv
python3 quality/meter_bands.py --check
python3 quality/structure_census.py --check
```

The predictability CK override retains the previous explicitly disclosed adoption choice; the instrument now refuses an override that fails any measured bin. Parallel fitting partitions the identical original deterministic seeds and preserves their order. A regression compares complete sequential and parallel results, including held-out item identities and flags.

Field checkpoints bind the consumed phonetic comparator, exact lexical tables and Python version. The imported scorer dependency closure excludes CLI-only reporting and admission bodies; it retains all reachable functions/classes and top-level executable declarations. Saved item rows independently bind the full comparator modules, shared reader/work policy, every corpus file, population-question functions, NLTK version and exact tagger model bytes. Rows require matching file hashes, recorded counts and complete unique shard coverage before current adoption. A current check cannot consume an unverified historical TSV.

The final item remeasurement uses a bounded SQLite-backed cache with at most 512 decoded fields and projections retained. Prior complete measurements and their original source sidecars remain archived. After the named-screen fix and exact-frequency-header correction, all 8,545 items were recomputed again with a fresh item cache: 493.398 seconds, peak 773,038,080 bytes, zero cold phonetic fields. During the entire run, `FrequencyLayer._song_tables` was patched to raise on any call. It was never called, source hashes stayed fixed, and every row byte matched the 200-seed adoption inputs. This directly establishes that the corrected song-frequency parser does not affect these calibration coordinates. All five curve and MATTR/TTR gates passed against the newly measured source identity. These local research-runner measurements do not qualify the hosted pipeline.

A subsequent production repair changed only deferred question batching and its capacity guidance. The consumed phonetic dependency closure stayed exactly equal, but the deliberately conservative row gate also binds the full CLI bytes. To leave that maintained current gate actually passing, every item was remeasured again after the batching source freeze: 519.827 seconds, 773,111,808 peak bytes, fresh item memo, zero cold phonetic fields and zero song-table calls. All 8,545 row bytes still match the full200-seed fit inputs; the current-source five-curve and MATTR/TTR gates pass. Previous frequency-era rows, sidecars and source proof remain archived under their original identity. No fit parameters or acceptance tolerance changed.

The final native checkpoint repair persists authoritative proposal, verification outcome and application evidence. It changes the CLI's whole-file identity while leaving the consumed calibration functions and phonetic dependency closure unchanged. To satisfy the maintained current gate, all8,545 rows were measured again from a fresh item memo: 434.678 seconds, 772,784,128 peak bytes, zero cold phonetic fields and zero song-table calls. Row bytes remain identical and the current five-curve/MATTR-TTR gate passes. The complete prior103-artifact epoch is reconstructible byte-for-byte from archived aliases; none of its old runs is relabelled as post-repair evidence.

The mutable SQLite checkpoint should be outside a live synchronised folder. During this local run, repeated synchronisation temporary copies filled the filesystem; the canonical database passed `PRAGMA integrity_check`, all 10,000 committed fields survived, and only the unfinished fields were recomputed after relocation. No paid provider call was involved.

The mark-coverage closing census also passed after exact before/after attribution: 77,052 typed blocks, 125,501 decided refusals, 32 undecided marks and one numeral-apparatus block. Only the seven edited English files move; every refused-mark decision and witnessed-function count is unchanged.

The source-hash audit now checks the complete staged-file snapshot independently of local source rows. A matching record in one cannot excuse drift in the other. Snapshot parsing rejects duplicate files, malformed hashes, invalid counts and invalid dates. Snapshot publication resolves every owner before touching either existing file, stages both outputs, and binds the population record to the manifest SHA256. The real isolated CLI regression proves that a failed owner preserves both prior files and that mismatched published files refuse.

The manifest names six dependent adopters, including the active length curves and certified rhyme-capacity witnesses. Removed files are checked against recorded historical membership. Missing membership with deletions withholds the verdict. A reader/work-policy change requires re-adoption even when source text bytes do not change. After the actual gates completed, the final 1,430-file snapshot and six populations were published and the actual `corpus_manifest.py --check` returned byte-identical.

The closing corpus audit measures 1,430 files, one standing FAIL, 141 WARN and 1,195 NOTE. Complete snapshot coverage resolves 198 old missing-hash warnings; Read's preserved title-page apparatus accounts for one further warning. The audit's own enclitic arithmetic subtracted disjoint spaced counts from attached counts, inventing negative counts and 33 false dominance notes; contrast tests and the full census verify that repair. Raw-staging warnings now state their actual scope and do not claim to prove retention in the normalized reader. The known Persian-prefix license file remains a language-screen FAIL, explicitly outside calibration and release assets. The shape gate checks this disclosed census, not an assertion that the entire research corpus is free of warnings.

The capacity table contains 81 independently certified families, with 8,406 actually judged witness pairs and a maximum witnessed lower bound of 23. The named relation and ban gates were rerun for every family; this was a reconstruction and actual proof, not a checksum-only re-adoption. The final table SHA256 is `f1aaeb13fc34462c09808eb0698dd8e6c90ed7782f1388861218c23eb4e7a560`. See `RESULTS_CAPACITY_PRODUCTION_2026-09-08.md` for proof scope. After the frequency repair, all 81 witnesses were actually reverified under the frequency-epoch source identity `259de1d1e0dda759d9d0feb2cc689021ff7f00ec2afe47266e61a51505eb5ef3`: 475.222 seconds with four workers, unchanged table bytes, and no changed witness values. Strict receipt read and admission both pass. The independently assembled v4 runtime also validates that exact receipt against its own sources and Python 3.12.13. This local receipt does not certify Docker's Python 3.11; that image must generate its own proof. After the final batching and prompt-guidance changes, all 81 families were actually verified again: 549.696 seconds, source identity `259de1d1e0dda759d9d0feb2cc689021ff7f00ec2afe47266e61a51505eb5ef3`, no changed table bytes or failed witnesses. The exact serialized receipt passes strict read and admission, including validation from the independently assembled v6 runtime. The final CLI and proposal-source hashes are recorded before and after that proof. The Python3.12-versus-Docker3.11 qualification boundary remains unchanged.

## Final audit regressions and frequency parsing

The final gate exposed a production parser defect: prefix-based header skipping also discarded the real word `word` and every pair beginning with `a`. The corrected parser recognizes only the exact first declared header, validates each count/key/row, and refuses repeated headers or malformed tables before publishing either cache. It restores all 407 `word` occurrences and the `a/the` (77) and `a/ca` (9) counts. An independent full-table parser confirms every current count and exact parity on unaffected old keys. The stored derived tables were already correct and did not change. All 1,159 distinct capacity witness words have identical conditional counters before/after this repair; that impact analysis does not replace final current-source witness verification.

The raw census is distinct from calibration weighting: 8,667 historical raw titles become 8,661 after explicit editorial corrections, then 109 duplicate-edition votes and six Latin exclusions produce 8,546 weighted titles. Excluding the one note-only item gives 8,545 measured lyrics. Before/after measurements attribute every changed raw count by file, including 41 removed VERSE marks. The updated mark table is generated data with matching asset hashes. The six-adopter JSON now has its own source registration naming the real builder, while the provenance gate still rejects it as human lyric content.

The sonnet span audit now checks exact identities as well as totals: 1,064 requests partition into 967 judged and 97 refused, with four repeat violations. The 47 newly explicit pronunciation-uncertainty refusals explain the changes from 632 to 605 claimed span pairs and from 121 to 114 ties. All four violations, the full span-kind partition, and the causal refusal set are retained in the shared oracle. Independent positive, negative and attribution controls remain. The complete spans suite, live audit check and five affected corpus/provenance suites pass.

## Release data boundary

`runtime_assets.json` declares exact bytes and redistribution decisions. The release assembly includes the required English tagger under its upstream MIT notice, the pinned CMU dictionary, WordNet and required runtime tables. It excludes the research corpus, legacy tagger, Punkt, unused historical tables and uncleared concreteness norms. No original concreteness dataset clearance was established or invented.

The mandatory floor explicitly requests MATTR and function-word ratio from the general feature extractor; its other required checks remain active. Requests for unavailable concreteness fail explicitly. Development research fixtures can retain that asset, while the production assembly and byte/decision gate reject research-only or unresolved assets. In a fresh isolated approved assembly, all nine phonologies produced nonempty readings for both probe words with socket connections denied. Six actual `types` CLI pairs classified; Persian, Malay and Somali returned the expected indeterminacy because the default anchor needs a stress coordinate those ports do not declare. This is an availability check, not a claim that all nine supplied a rhyme verdict. The mandatory floor completed and the default full extractor refused the missing optional norms with exit 2. The probe records exact installed source and manifest hashes, with no source drift from the frozen tree; it does not qualify production workload performance.

The complete row TSV, full-precision adoption coefficients/knots, 200-seed output, recovery and equivalence proofs, and gate logs are retained in `quality/results/production_data_2026-09-08/`. The final-data epoch records actual file hashes for integration tests.

The final v7 assembly matches every copied Python source and passes its approved byte gate and ten actual offline checks. The checkpoint evidence patch does not change the consumed capacity judge identity. The previously measured after-batch81 receipt passes strict current-source and v7 validation; source changes and identity equality are explicitly recorded. No additional81-family measurement is claimed, and Docker3.11 still requires its own runtime proof.
