# Default end: zero bound syllables refuse (2026-10-14)

Receipt for the reviser's default-end splice under reader scheme v2 (3PO #519
6163216518, contract blocker 1; BB8's packet #527 6163195621). Code commit
`3e77a5d97` makes `quality/loop.py` `_end_occurrence_bound` refuse where
`slots.resolve` binds ZERO syllables on the line's end. It was first measured
at `0af39c6ff`; this receipt now also carries the FULL per-case dumps for the
before tree (`61b6618a`) and the current code head (`7c26d40c4`, which has the
same `loop.py` and `revise.py`), and the exact comparison procedure, so every
figure below can be reconstructed from files in this folder (3PO #519
6167042191).

## Scope

- **The gate measured here is the default/no-fallback one on BB8's
  3,990-line population:** the tool's own lexicon (the v2 supplemented
  lexicon, no fallback, `coverage_census.build_lexicon("v2", "none")`) in both
  aside modes, and its v1 twin. Every count under "Results" is on that
  population and that lexicon only.
- **Kept separate from it:** the five spaced-enclitic lines the tool excludes
  as `excluded_transformed` ("Five excluded witnesses" below), and any other
  lexicon (BB8's alternate-lexicon runs, a G2P fallback). They are not folded
  into the 3,990-line figures.
- **Trees are archives, not checkouts.** Each tree is a `git archive` of the
  commit's `lyric-harness/`, with the staged data (`cmudict.dict`,
  `data/concreteness.txt`, `data/moby/`, `data/nltk/`) copied in. So the tool's
  own commit and dirty-state pins read null, and the commits are named here
  instead. This is not a checkout-backed run.
- Interpreter: `/dev/shm/py311`, CPython 3.11.17 (CI pins 3.11.16).

## How it was run

- Tool: BB8's `slot_occurrence.py` (version 3.3, sha256 `e543b4f4…edc88`) and
  `slot_binding.py` (sha256 `42e878a0…a026`), from
  `lyric-harness/quality/results/acceptance_2026-10-13/` on the branch
  `bb8/shape-sweep-2026-10-13` at `9ae80be5`, run unmodified. The tool and
  the population live on BB8's branch, so this CANNOT RUN FROM A CLEAN
  CHECKOUT of this branch; `TOOL` is that folder:

      cd <archive>/lyric-harness
      python3 -I $TOOL/slot_occurrence.py OUT_PREFIX \
          $TOOL/slot_match_67889851/population.txt <archive>/lyric-harness

- Population: that folder's `slot_match_67889851/population.txt` (3,990
  lines, sha256 `87946276…76c0`).
- Comparison: `compare_runs.py` (sha256 `e0d06574…aeb9` at this commit) reads
  only the per-case records (never the tool's summaries):

      cd lyric-harness
      R=quality/results/slot_default_end_zero_binding_2026-10-14
      python3 -I $R/compare_runs.py $R/full_dumps/so_61b6618a.jsonl.gz \
          $R/full_dumps/so_7c26d40c4.jsonl.gz $BB8/so_67889851.jsonl.gz

  where `$BB8/so_67889851.jsonl.gz` is BB8's dump at `67889851`, committed at
  `f67851bf` under `acceptance_2026-10-13/slot_occurrence_61b6618a/` (file
  sha256 `0a43310c…616c`, decompressed `e376c879…7e1b`); it is used only for
  the 989 cohort. Its output is `full_dumps/comparison_61b6618a_7c26d40c4.json.gz`.

## Files

| file | what | sha256 (file) |
|---|---|---|
| `full_dumps/so_61b6618a.jsonl.gz` | every case at `61b6618a` (190,530 records) | `36636f74ee9283ed74f75d25734f9a151421a58f51234c1fa90469966ca3a27a` |
| `full_dumps/so_61b6618a.summary.json.gz` | the tool's summary at `61b6618a` | `f7524ff611488690c6eb676a9e7fb1a4ebb3d3d3b5952c29083564aeda4e19c1` |
| `full_dumps/so_61b6618a.log` | its run log | `df9cbde62e70394261c0c7208353dc8b4e54407ee2fcd9516c8a5322d46c0aeb` |
| `full_dumps/so_7c26d40c4.jsonl.gz` | every case at `7c26d40c4` (190,530 records) | `3aca16f85af1d94bd0fe5e638dc7333f0cfcc68f6b34475f0527a6a640bb2b50` |
| `full_dumps/so_7c26d40c4.summary.json.gz` | the tool's summary at `7c26d40c4` | `7e1457ba8be439fe7d84b41a3395bdb29a71be69ad1f89d342e14a140d66f293` |
| `full_dumps/so_7c26d40c4.log` | its run log | `a7a7d75a7032f2d01f6f5694a01fb7fd69cce3cc90aa2c29ab1cd69091700cf7` |
| `full_dumps/comparison_61b6618a_7c26d40c4.json.gz` | `compare_runs.py`'s output | `ad4e2e96b92866ab23b202e90c0071d186bbdc29788e49e5e27a3b4ba5fcce6f` |
| `full_dumps/default_end_direct_61b6618a.json.gz` | `default_end_direct.py` at `61b6618a` | `f2ce63e6bf532020179ffdd21471cbbe58eb4d51ff0314bee7a75065c68dda3f` |
| `full_dumps/default_end_direct_7c26d40c4.json.gz` | `default_end_direct.py` at `7c26d40c4` | `b7142b54f2251991ca69b25f6a130189b253ce1ad419efa5448ac844404e605b` |
| `summary.json`, `changed_cases.json` | the first run's reduced outputs (`61b6618a` against `0af39c6f`) | unchanged |

Decompressed content hashes, for comparing with copies compressed elsewhere:
`so_61b6618a.jsonl` `6f194ffa…ba37`, identical to BB8's committed
`so_61b6618a.jsonl.gz` at `f67851bf` (decompressed); `so_7c26d40c4.jsonl`
`da395e29…140b`, identical to this receipt's first run at `0af39c6f`
(decompressed), so the reduced `summary.json` and `changed_cases.json` still
describe the current code head.

## Results (3,990-line population, default/no-fallback lexicon)

| | `61b6618a` | `7c26d40c4` (= `0af39c6f`, record for record) |
|---|---:|---:|
| v2 gate (process scheme) | FAIL | **PASS** |
| v2 `edit_unbound` (stripped / sung) | 191 / 191 | **0 / 0** |
| v2 `refused_unbound` (stripped / sung) | 1,071 / 1,331 | 1,262 / 1,522 |
| v2 `occ_agree` (stripped / sung) | 33,591 / 39,143 | 33,591 / 39,143 |
| v2 `occ_wrong`, `unplaceable_edit`, `no_op_edit` | 0 | 0 |
| controls / readable controls / negative controls failed | 0 / 0 / 0 | 0 / 0 / 0 |
| declared-path cases failed (v2) | 0 | 0 |
| v1 | FAIL (pre-batch behaviour) | identical, record for record |

Reconstructed by `compare_runs.py` from the per-case records:

- 190,530 cases in each dump; none present in only one.
- **382 cases differ, and every one is v2 default `end`:** 191 per aside mode
  go from `edit_unbound` to `refused_unbound`, split per mode as 181 unread,
  7 numeral and 3 hyphenated end words. REPAIRED 0 / REFUSED 191 / NO-OP 0 per
  mode: none is edited any more, because the grader binds nothing there.
- **All 6,052 readable v2 default-end cases** (`occ_agree` at `61b6618a`,
  multi-word anchors included) are byte-identical at the head.
- **All 95,265 v1 cases are byte-identical** (whole record). The v1 failures
  (353/348 `occ_wrong`, 1,099 `edit_unbound` per mode, 18 declared-path
  cases, 2 resolver mismatches per mode) are pre-batch behaviour, as on
  `fce4bf0f`.
- All 174,660 non-end cases are byte-identical.
- **The 989 cohort** (v2 cases whose `literal` at `67889851` was
  `grader_elsewhere`): 989 found, `occ_agree` in both dumps, all 989
  byte-identical.

"Readable default ends unchanged" is a statement about THIS population and
lexicon. It is not a corpus claim: on BB8's crafted and fuzzed lines,
`61b6618a` refused 1,760 default-end edits (on 187 lines) that `67889851`
made, where the last raw run is wider than the last token (`go кот5`, a
ligature, a combining overlay). Those are conservative refusals and stay
disclosed. At `7c26d40c4` the probed examples (`go кот5`, `it is ﬁne`,
`a black ca̶t`, `we go 5́`) all bind ZERO syllables, so the zero-binding rule
refuses them; BB8's full crafted set was not re-run here.

## Five excluded witnesses (separate from the gate)

BB8's direct calls found 196 unbound default-end edits per v2 mode at
`61b6618a`, against the tool's 191: the tool excludes 5 population lines as
`excluded_transformed` because each holds a token joined across a spaced
enclitic. `default_end_direct.py` (sha256 `1f8e54eb…1b11`) re-measures that
one question by direct call on every population line, those 5 included
(`slots.resolve(lex, line, 1)` empty and `swap_at_slot(line, 1, mark, ...,
lex=lex)` editing):

| | `61b6618a` | `7c26d40c4` |
|---|---:|---:|
| unbound default-end edits, stripped | 196 (191 + 5) | **0** |
| unbound default-end edits, sung | 196 (191 + 5) | **0** |

The 5, each with a multi-piece token mid-line, the same in both modes:
`An' Charlie he 's our ain.`, `He said, "My dear, ye 're sune asteer;`,
`My wrath I 'll vent forth upon old Auchtertool.`,
`And I 'm nae mair in doubts o' the spoilin' o't.`,
`There 's some hae land, and some hae gowd,`. The v2 zero-binding refusal
covers them. They are reported here and NOT added to the 3,990-line gate's
counts.

## What this does not establish

The zeros cover this population, its controls and the tool's seven declared
lines, not the corpus. `occ_agree` shows the reviser edits what the grader
binds, not that the binding is musically right. The tool splices a non-empty
marker, so it cannot see the pre-existing empty-replacement deletion (an
empty `GroupBrief` pivot spliced by the stock proposer; `mcp/LYRICS_RUNTIME.md`,
pre-existing items): nothing here shows that production candidates are safe.
