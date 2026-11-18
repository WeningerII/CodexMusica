# Song Forms review verification

**Coverage receipt.** 364 diagrams, 2,734 nodes, 418 vocabulary matches and 406 supported relationships across 448 decisions. All 215 component relationships have validated node paths.

**Evidence receipt.** The ledger has 568 claim/source decisions. Direct passages support the stated scope for 92 supported diagrams, 8 partial diagrams, and 68 supported relationships. The README gives the complete evidence breakdown.

**Meter and compatibility.** The 203-ID research ledger still round-trips to 105 unique ID/form pairs. The old 1,624-field and 12-plus-three comparator checks are historical manual records, with their unshipped inputs explicitly identified. Andrej-meter.md provides the separate two-revision checks and replay recipe for the Onegin parser, section placement, planned schemes and bridge recurrence.

**Rebuild.** Run `python3 -I -B verify-offline.py` from the extracted directory. It compares the shipped summary and headline wording with their review snapshot and the underlying row data, compares the displayed relationships with the ledger, regenerates the seven original outputs in a temporary clean copy, rebuilds from either inventory, and checks byte-for-byte agreement including the archived catalog. It also checks ordinary invocation for unwanted bytecode under a C locale. Run `python3 -I -B source-ledger.py --check` to compare the additional evidence output. The current and archived sources are UTF-8. The original baseline builder is invoked with Python UTF-8 mode for faithful replay.

**Search and browser.** The previous search pass exercised 534 distinct queries and ranked the intended owner first for all six disputed search terms. New regression checks cover Binary, Rondine, Byr a thoddaid and the Monk’s Tale stanza. They passed against fresh catalog data and the real review renderer. Chromium could not open a process socket in this environment. The desktop and mobile interaction checks are supplied for replay.

**File verification.** The complete archive contains the corrected explorer, working inputs, generated outputs and findings. `andrej-file-changes.tsv` compares its contents against the 79-file input at 4976432d624a3a8db61c6004814e19d5f8b86409. Its own hash is excluded from that ledger to avoid self-reference. `r2-file-changes.tsv` remains a historical manifest of the previous stage. Both source inventories and the original baseline assets retain their original bytes.

**Public export.** The current schema excludes research prose and URL fields. Source substitution across both inventories, reviews, raw aliases, source URLs, claim passages and unrecognized model properties reproduced identical public bytes. Node syntax checks passed. The new test covers both link directions and their recorded node paths. Chromium stopped during process initialization with a socket permission error, before rendering.
