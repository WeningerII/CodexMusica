# Capacity re-adoption, 2026-09-08

The corrected artifact contains 81 actual class:RHYME witnesses, covering every construction family with at least 20 spelling classes. All 81 were reconstructed at the unchanged attempt cap 40 and actually reverified, including the current pronunciation-consensus rule and the unchanged HOMEOTELEUTON/MODAL_RHYME bans. The complete witness values and measured inputs are in [the companion result](RESULTS_CAPACITY_PRODUCTION_2026-09-08.json) and [the table](../data/rhyme_capacity_eng.tsv).

| Measurement | Result |
|---|---:|
| Eligible words |39,969|
| First-reading construction families |12,387|
| Families requiring certification |81|
| Reconstructed and reverified witnesses |81|
| Judged witness pairs |8,406|
| Smallest witnessed lower bound |4|
| Largest witnessed lower bound |23, family IY-Z|
| Construction attempt cap |40|

The former published witnesses had been constructed under the default relation even though the table declared RHYME. The default can admit rich-rime subtypes and other relations that explicit class:RHYME excludes; current pronunciation disagreements also refuse certification. Checking all 81 former witnesses against the actual declared class found zero that satisfied every required pair. The construction pool uses a first-reading perfect-tail key; membership in that pool is not a class:RHYME verdict and never substitutes for the actual group grade.

The adopted generator rhyme-group bound is now 23, the largest witnessed group. This is a lower bound from bounded construction, not a maximum-clique proof or a claim that larger valid groups cannot exist. The separate writer workload limit remains 31 lines. Neither construction attempt cap 40 nor writer workload 31 is a witnessed rhyme-group size.

The all-family re-verification underlying these witness values ran locally under Python 3.12.13. A strict source identity includes the full Python runtime, consumed judge and verifier source, lexical data, modal tables and declarations. Production uses its own actual-runtime proof; a six-family smoke or a different Python build cannot renew it.

Build the unchanged reviewed table into the final image, then run from its assembled lyric-harness directory:

```sh
python3 quality/verify_capacity.py --output /app/mcp/capacity_verification.json --workers=1
python3 quality/verify_capacity.py --output /app/mcp/capacity_verification.json --check
```

The first command actually checks all 81 witnesses and writes a deterministic receipt bound to the exact table SHA256 and runtime/source identity. The second only validates that existing receipt. It does not generate new proof. Missing, stale, wrong-table, wrong-runtime or incomplete receipts refuse installed capacity lookup and planning when `LYRIC_RELEASE_ASSETS_REQUIRED=1`. Receipt generation does not rewrite approved data assets; it writes the build artifact separately. Failed renewal removes the older receipt at the requested output path.

Focused tests cover an actual earned bone/sown witness and actual same-spelling, uncertain-reading and wrong-relation negatives, plus strict receipt admission and missing-receipt planning refusal. The tiny protocol fixture does not claim to replace the full 81-family qualification. Actual Docker Python 3.11 generation remains an image-build qualification gate until that build executes.

The preceding corrected-source local run verified all 81 witnesses and 8,406 pairs again after the frequency-reader header repair. Its receipt survived the actual JSON write/read boundary, the strict `--check`, and installed-mode capacity lookup plus a real seed-31 plan. The source identity remained `259de1d1e0dda759d9d0feb2cc689021ff7f00ec2afe47266e61a51505eb5ef3`; the table bytes and witness values stayed unchanged. The companion JSON records the receipt hash and full runtime identity.

That four-worker run took 475.222 seconds wall and 1,637.718 seconds total process CPU locally. The largest process reached 658.027 MiB; sampled wrapper-and-descendant RSS reached 3,286.723 MiB, with shared pages counted per process. Other functional work ran concurrently, so these are local execution measurements, not isolated production-container qualification.

An earlier complete one-worker run measured 1,600.725 seconds wall and 1,596.374 seconds process CPU on the preceding wire/parser epoch. Its post-write check exposed the integer-to-string JSON summary-key bug; that receipt was not restamped. Six focused controls now include a real producer/write/read/admission round trip and malformed nested count negatives. The one-worker measurement establishes that the former 15-minute setup allowance was insufficient locally; the actual final-image build and its Python 3.11 runtime remain separate qualification requirements.

After the final deferred-batch and whole-draft prompt guidance repairs, another complete local run again verified all 81 witnesses and 8,406 pairs. Strict JSON post-write validation and installed lookup plus seed-31 planning passed. The full CLI and proposer hashes remained unchanged before/after, alongside the consumed judge identity and reviewed table. The new measurement reproduced the deterministic receipt bytes because those prompting changes do not alter the capacity judge dependency graph; it did not restamp or reuse the previous measurement.

This final four-worker repeat took 549.696 seconds wall and 2,042.343 seconds total process CPU. The largest process reached 655.539 MiB; sampled wrapper-and-descendant RSS reached 3,278.340 MiB, counting shared pages per process. Calibration and functional tests ran concurrently. These local Python 3.12.13 observations still do not qualify the separately gated final production image or its Python 3.11 runtime.

The subsequent kitchen outcome/application receipt repair changes the CLI journal and loop notification hooks. Strict validation of the existing all-81 receipt passes on this current source: the consumed capacity judge identity and reviewed table are unchanged. The companion JSON records the new full CLI/loop hashes separately. The earlier full-CLI source fence and 549.696-second run remain measurements of their stated epoch; this later strict check is not a new 81-family run or a production-image qualification.
