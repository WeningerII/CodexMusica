# Rhetorical application to the supplied Frost poem

This version applies the researched methods to all 16 lines and 108 word occurrences. It adds 33 grouped evidence cards and an exact 91-row method application record. These are different counting units: several labels can describe one span, and a useful close-reading observation need not be an executed research method.

The original sound data in `dist/data.js` is unchanged. The original audited output has 911 annotated connected pairs and 1,248 dictionary-union connected pairs. The declared refinement is applied separately, giving 946 and 1,277 current connected pairs out of 5,778 pairs per scope. A connected pair may have broad sound or identity relations; these are not counts of perfect rhymes. The 64 feet and 128 displayed syllables remain intact.

## Provenance

- Existing Codex Musica sound rules plus the previously audited English adapters ran over all occurrence pairs.
- Unmodified ProseRhythmDetector repetition functions ran through a declared token/unit adapter, with line and sentence units and both default and empty stop filters.
- A bounded adapter independently verified complete adjacent repeated lines, every exact lexical recurrence, and specified finite structural tests.
- The JaDe punctuation gate ran. Its parser-dependent classifier did not run.
- Grammar, morphology, metaphor, personification and discourse observations disclose manual application by the assistant. No independent human adjudication or newly trained model is claimed.
- Manual metaphor checking inspected candidate lexical meanings. It was not a full dictionary audit of all 108 lexical units.

`analysis/rhetoric-inputs/` holds the exact input findings, ledger, canonical poem, native repetition outputs, structural audit, and execution notes. `build-rhetoric.py` packages those actual results. It is not itself a general rhetorical detector.

## Results and limits

The 91 method entries resolve to 17 observed, 25 bounded no-match checks, 14 partial/interpretive results, 23 source-scope exclusions, and 12 methods not run. The other 324 inventory entries remain research-only. The inventory has not gained 415 automatic detectors.

The original repetition source truncates the default beginning witness at “And miles”; no-stop line anaphora raises an IndexError on the identical final lines. Its sentence-level polysyndeton result crosses grammatical levels. Raw outputs remain available, while the UI explains the independent complete-line verification and these scope limits.

The source E9 alliteration predicate requires complete-onset equality and different spellings; all 147 positives remain. The new A1 initial-consonant check finds 235 pairs in both modes: those 147, another 37 distinct-word pairs and 51 repeated-word pairs. It excludes empty onsets and keeps complete pronunciation witnesses.

The active E63 rule now compares the actual final vowel and complete coda, then requires one of four explicit adjacent/parallel positions. It returns 34 pairs in either mode: 27 distinct-word and seven repeated-final-line correspondences. The original five affix-heuristic positives are archived; their real E18 sound matches remain. The original H1 predicate is unchanged but accurately named same spelled rhyme ending. Morphology is reviewed separately: his is not hi plus plural -s; evening is a time-of-day noun; promises/miles shares plural inflection in parallel phrases but not a complete final rime.

`analysis/scope-inputs/` retains complete pronunciation declarations, two independent calculation reports, the morphology audit and source scripts. `build-scope-refinement.py` recomputes the actual predicates over all pairs using the saved manifest, verifies them against the independent reader audits, and emits compact positive results and witnesses. `dist/scope-refinement.js` applies only these declared changes to the preserved base data. The downloadable refinement audit states all scopes; it does not store prose for thousands of negative pairs.

The final repeated line is one passage with scoped overlapping labels. Symbolic mortality and life-journey readings remain interpretations. Broad antithesis can describe contrasted ideas without parallel syntax, while “But” alone is insufficient proof.

## Regeneration and verification

Run `python analysis/build-scope-refinement.py`, then `python analysis/build-rhetoric.py` from this checkout. Verify with `node analysis/verify-scope-refinement.cjs` and `node analysis/verify-rhetoric.cjs`. The existing `node analysis/verify-data.cjs` also passed against the original saved sound-analysis files. Browser QA exercises interior-word selection, exact evidence highlighting, function-word recurrence, the application-record filters, the sound view, and retained meter/pronunciation.

The UI defaults to Rhetoric. Sound & meter and Connection map use the preserved core comparisons plus the declared refinement. Every orthographic word occurrence is independently clickable; source IDs never use the spelling alone as an occurrence identifier.
