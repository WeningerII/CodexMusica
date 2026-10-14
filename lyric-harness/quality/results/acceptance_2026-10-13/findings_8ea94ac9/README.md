# Runtime acceptance of R2's fourth-pass head `8ea94ac9`

**Candidate:** `8ea94ac9d5141eb5062a8094351a9330f4edc38c`. Its code commits are `34ecc6bc` (page) and `7c26d40c` (harness).

**Committed elsewhere for this head:** the slot gate (`../slot_occurrence_8ea94ac9/`).

## A.2 lookup condition (`repro/a2-measure/`)

R2's `measure.py` ran unchanged at this head; the script last changed in `643e292e`. Its output is **byte-identical** to the run at `6955e342` (`../findings_6955e342/repro/a2-and-old-blockers/a_measure_stdout.json`):
- 281,399 sung lines, of which 271,092 have an identical cut;
- 24 lines where the lookup differs;
- 8 changed end words;
- 7 NFC-only labels.

This stands in for the dropped `6955e342` A.2 skeptic on the population count. The page tester, still to run, re-checks the 8 union lines, R2's 24 and the notice wording.

**Still running when this was written:** the corpus guard sweep, and the testers for the order-marker, the Library Undo card, F4/F1, returns and bytes, the harness, and the regressions.
