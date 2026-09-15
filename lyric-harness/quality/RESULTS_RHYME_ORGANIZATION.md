# L-1–L-2: rhyme organization redesign

The replacement demonstrates **item-level rhyme organization with controlled
false stratum discoveries under explicit exchangeability nulls**. It does not
certify individual rhyme events. L-1's original per-position capability and
L-2's internal-sonnet event-rate claim remain OPEN; changing the inferential
unit is not evidence that those old claims are solved.

## Design and the failed first attempt

`quality/RHYME_EVENTS_PREREGISTRATION.md` was committed at `9913705b` before
implementation. Counting nearby end-rhyme edges separated real sonnets from
scrambles, but only 54/122 real items were discoveries (44.3%), missing the
registered 50% power gate. Its result is retained in
`quality/results/rhyme_organization_2026-09-15.json`; reproduce with:

```sh
python3 quality/audit_rhyme_organization.py --design=v1 --check
```

That command **exits 1 by design** because the first design failed. Its
synthetic controls passed; neither their success nor a favorable corpus gap
overrides the failed gate.

The second design was registered at `78c33060`, in
`quality/RHYME_ORGANIZATION_V2_PREREGISTRATION.md`, before it was implemented.
Its end statistic counts edges at each line distance 1–4 and takes the maximum.
Every null draw performs the same search. The sonnets are development evidence
for this revision, not held-out evidence. Forty previously unevaluated excerpts
from Burns and Moore provide a separate-author/form replication.

## Measurements

All tests use 999 permutations, inclusive ties, alpha 0.05, and Bonferroni over
the two declared strata. Both strata stay in the family even if one refuses.
An internal edge has at least one nonfinal word and both words in one line.
An end edge links final words. Internal shuffles hold final words fixed;
end shuffles move only final words. Both preserve occurrence counts, repeated
words, unreadable words, and line token counts.

| Population, second design | Real end discoveries | Scrambled end discoveries |
|---|---:|---:|
| Shakespeare, sonnets numbered above 30 | 102/122 (83.6%) | 2/488 (0.4%) |
| Burns, first 20 eligible fourteen-line excerpts | 4/20 (20%) | 0/80 |
| Moore, first 20 eligible fourteen-line excerpts | 17/20 (85%) | 0/80 |

The replication's pooled within-item label-randomization p is **0.0001**, the
resolution floor of 9,999 draws, not a measurement of a smaller probability.
Each author's direction holds separately. Burns's much lower detection rate
is part of the result; this does not establish broad English-song recall.

| Control, second design | Seed 20260915 | Seed 20260916 |
|---|---:|---:|
| H0: any false stratum discovery per synthetic item | 16/1000 (1.6%) | 10/1000 (1.0%) |
| Planted internal organization detected | 100/100 | 100/100 |
| Planted end organization detected | 100/100 | 100/100 |

Across both strata, scrambled-sonnet discoveries are 15/488 (3.1%); the new
authors' scrambled discoveries are 1/160 (0.6%). All frozen second-design
gates pass. Refusals are zero in these measured populations, so low H0 rates
are not an artifact of counting refusals as successful tests.

Internal organization in the sonnets does **not** separate positively:
1/122 real versus 14/488 scrambled discoveries. The original preregistration
did not identify sonnets as an internal-rhyme positive control. This result
must not be described as restored internal rhyme detection or periodicity.
The synthetic internal control establishes sensitivity to its planted
population, not sensitivity to every real internal-rhyme practice.

These are discovery rates under a specified null, not annotated individual
rhyme precision/recall. Natural language exchangeability is a modeling
assumption. The mathematical family bound follows from valid permutation ranks
and a union bound; simulation checks the implementation, not the assumption.
The bound is per item, not simultaneous over every item in this table.

Full item identities, text hashes, token counts, unreadable occurrence counts,
declarations, observations, unresolved pairs, null summaries, adjusted p-values,
and all four twins appear in
`quality/results/rhyme_organization_v2_2026-09-15.json`.

```sh
python3 quality/audit_rhyme_organization.py --check
python3 quality/test_rhyme_organization.py
python3 quality/rhyme_organization.py songs/stay_awake.txt
```

The last command analyzes one supplied lyric item and prints JSON. A collection
refuses rather than silently treating multiple songs as one family. Exit 2
means both strata could not answer or the request was invalid; exit 0 means
the analysis ran, not that a song earned certification. `--voices` retains
parenthetical sung words. `--end-statistic=edge_count` reaches the first design.
This standalone instrument is discoverable through `lyric_harness.py wiring`;
it adds no work to planning, grading, or the lyrics revision pipeline.

## Consumers and regression guards

The direct consumers of the old event function are the historical FWER and
attainability experiments and tests, plus `time_layer.analyse` and its
line-final control. No songwriting production path calls it. The historical
experiments remain reproducible. Event diagnostics now state that individual
inference is unsupported. Automatic time analysis refuses before producing a
placement p-value; its independent-slot null did not preserve paired events.
The line-final wrapper carries the same origin so it cannot launder detected
events through the caller-supplied-events seam. Explicit supplied-slot controls
remain available and are labeled as conditional research controls.

The CI suite checks exact conditional permutation orbits, inclusive ties,
the full-family correction, exhaustive replay of the spacing search within
the null, positive controls, an identical-position/no-rhyme control, an
all-rhyming-final-inventory control, unreadable words, repetitions, declaration
validation, CLI item boundaries, and the unsupported timing refusal.

Method reference: [Phipson and Smyth, permutation p-values](https://arxiv.org/abs/1603.05766).
