# M-78 — convention versus failure, 2026-09-17

Implementation and comparator re-verification are complete; the entry closed
2026-09-17 with the merge `8e589b4e` (PR #333). The comparator pin was
advanced on the receipt in this directory (`curve-check.txt`, see the repin
section below). The paragraphs that follow were written while the work was
in progress and are kept as the record of what was checked when. Based on
main fe9181f7, with open PRs 328 and 329 inspected for changed files; neither
changes comparator inputs. PR 330 concerns shared counters and was integrated
before final validation.

Doctrine 96 formalizes the existing convention policy without changing a
finding's severity or the permitted region. The census now enforces that
policy on membership as well as counts. The mutation controls exchange a
convention and a flag while holding every aggregate count constant, and
separately test mandatory pursuit and the length gate. Removing the new
check recreates the old false pass. Declared requirements still gate.

The first four compute attempts refused (exit 2) because the research
concreteness resource was absent. They are retained as staging refusals,
not measurements. The established research stager supplies and checks it
before the fresh computations. Each recomputation uses its own initially
absent memo; no invalidated memo is reused.

The comparator edit is confined to doctrine numbers in comments, the CLI help
and diagnostic strings. `comparator-source-comparison.json` compares the
before/after Python ASTs after normalizing only doctrine-reference numbers;
they are equal. This explains the expected absence of numeric movement but
is not used to waive recomputation or advance the pin.

Focused verification completed so far:
- `gate-census-tests.txt`: all sections pass, including promotion mutations.
- `doctrines.txt`: 96 definitions, contiguous numbering, matching index,
  preserved pre-split baseline, valid registry and references; PASS.
- `entries.txt`: no false entry claims.
- `record-gates.json`: pin argv, figures, census, battery rounds, data rows,
  and triage checks all exit 0.
- `docs.txt`, `format.txt`, `promises.txt`: documentation paths, workflow
  formatting, and promise coverage pass.

These are local working-tree receipts. The later source hashes identify the
published files; CI must qualify the final published head and current base.

## Repin measurement — 2026-09-17, on the tree merged with main `f657d3a2`

The comparator gate refused this head as expected (`comparator-before-repin.txt`:
MOVED, 1 of 7 inputs, `lyric_harness.py`). The re-verification it demands was
run on the MERGED tree (this branch plus main through #331), cold, in four
isolated shards with fresh memo files and no reuse of any invalidated memo:

    python3 quality/length_curve_calibration.py compute --shard 1/4 \
        --out quality/results/m78_2026-09-17/calibration-rows.1.tsv \
        --cache-path memo-1.tsv          # likewise 2/4, 3/4, 4/4; the memos
                                         # are scratch and were not banked
    python3 quality/length_curve_calibration.py check \
        --rows quality/results/m78_2026-09-17/calibration-rows.1.tsv \
               quality/results/m78_2026-09-17/calibration-rows.2.tsv \
               quality/results/m78_2026-09-17/calibration-rows.3.tsv \
               quality/results/m78_2026-09-17/calibration-rows.4.tsv

Receipts in this directory: `compute-1.txt` .. `compute-4.txt` (the four shard
logs, each ending in its COMPUTE line), `calibration-rows.1.tsv` ..
`calibration-rows.4.tsv` (the rows the check read), and `curve-check.txt`
(the verdict).

| shard | files | rows | CPU-s | wall-s |
|--:|--:|--:|--:|--:|
| 1/4 | 325 | 2,105 | 4,197 | 4,214 |
| 2/4 | 324 | 2,830 | 5,279 | 5,302 |
| 3/4 | 324 | 1,453 | 3,772 | 3,792 |
| 4/4 | 324 | 2,148 | 4,563 | 4,585 |

8,536 items, 1,297 files, 17,811 CPU-s cold on this host (memo hits 0, misses
8,536) — the same population as `comparator_repin_2026-09-16`.

The verdict is `RESULT: HOLDS — the lyric row's 5 curves re-derive from the
corpus`: `mattr`, `fwr` and `anaphora` re-derive to the shipped coefficients to
16 significant figures, and `cv` and `predictability` re-derive all 21 knots.
Stronger than the verdict: the data lines of each of the four row files are
byte-identical to the corresponding `calibration-rows.N.tsv` banked by the
2026-09-16 repin (compared with the provenance header stripped), so every
feature value the comparator produces is unchanged by this edit. That is what
`comparator-source-comparison.json` predicted from the ASTs, now measured
rather than argued (doctrine 58: no constant was touched, nothing was tuned).

The pin was advanced against that receipt:

    python3 quality/check_comparator_pin.py --write --pinned-on 2026-09-17 \
        --verified-by quality/results/m78_2026-09-17/curve-check.txt \
        --verdict "RESULT: HOLDS — the lyric row's 5 curves re-derive from the corpus"

`check_comparator_pin.py` now exits 0 on this tree (fingerprint
`18be93ffb403…`). The predictability memo in any environment that carries the
old fingerprint is discarded by construction on the next run, so the first
Production qualification after this lands is COLD by design: budget ~3 hours
for its `song`, `curves` and `short` components and do not read that as a
regression.
