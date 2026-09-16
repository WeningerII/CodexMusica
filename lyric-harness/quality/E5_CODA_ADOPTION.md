# E-5 scalar adoption — 2026-09-15

Decision recorded before this sitting's measurements. The September 2 result
(one historical admitted pair lost under `cannot_tell`) has already been read;
this is an explicit revised acceptance policy, not an unseen holdout or a claim
that the original zero-loss registration passed.

Adopt `cannot_tell`: omit an absent coda from the evidence-weighted mean, keep
empty/empty agreement and relation typing, and retain explicit `gift` and `zero`
coordinates for reproduction. No threshold is loosened to compensate.

Acceptance budget: at most 0.5% (one in 200) of the legacy scalar-admitted
mandated pairs may leave admission. This is a chosen compatibility budget:
removing unsupported evidence should not broadly reject existing rhymes, but
perfect admission-set identity would preserve the defect indefinitely. It is
not a confidence interval or an estimate of correctness. Measure admission
with the current per-relation thresholds and report every lost pair separately
from schema rescue. Require identical refused sets and relation types on all
mandated pairs; `see/free` and `cat/hat` remain 1.0 RHYME, `now/why` falls.
Post-rescue violations may not increase above the legacy baseline.

Re-run the sonnet battery, four sampler cells of chance_rate, band controls,
FWER regressions and calibration, and held-out matrix evaluation. Random
admission must not increase in any sampler cell. Existing FWER safety gates
must pass unchanged. Matrix P3 remains a comparison to the fitted model, not
an adoption gate for that unshipped model; record any movement rather than
optimizing the scalar for it. Preserve historical measurements as historical.

## Instrument correction after the first run

The first run **failed** the literal aggregate-relation constraint on sonnet 7,
lines 2/4, eye/majesty: CONSONANCE 0.671 became NO_RELATION 0.523. Neither
reading was scalar-admitted. Inspection of the returned attribution shows that
`best_score` selected different spans: the old partial-word majesty ending lost
its absence bonus, and a three-syllable span won instead. Holding the aggregate
label fixed would require preserving the defective ranking or attaching a label
from a different span to the new score.

The corrected invariant is identical relation typing for **each fixed candidate
span pair**, including every candidate of every mandated sonnet pair. Aggregate
winner changes are reported, not hidden. The original aggregate-invariance
claim is withdrawn, not described as a passed preregistration. The 0.5% loss
budget, refusal equality, post-rescue ceiling, random-admission nonincrease and
FWER requirements are unchanged. This is a documented measurement correction
after inspection, not independent confirmation on unseen data.

## Completed measurement

`python3 quality/e5_coda_adoption.py` exits 0: 5,780 fixed candidate span
pairs preserve their relation type; 947 -> 946 scalar admissions, one loss
(sonnet 1 L2/L4, die/memory, 0.773 -> 0.697 CONSONANCE); unchanged refused sets
and 4 -> 4 post-rescue violations. The one aggregate winner-label change is
reported above. The loss is 0.106%, below the unchanged 0.5% budget.

At seed 20260810 and 4,000 draws per cell:

| Population / reader | Scalar admissions, gift -> adopted | Narrow admissions, gift -> adopted | Schema count, unchanged |
|---|---:|---:|---:|
| redteam / word | 175 -> 125 | 40 -> 38 | 914 |
| redteam / line | 188 -> 131 | 46 -> 40 | 914 |
| all entries / word | 173 -> 118 | 36 -> 33 | 889 |
| all entries / line | 193 -> 134 | 37 -> 34 | 889 |

The redteam cells judge all 4,000 pairs; all-entry cells judge 3,999 and refuse
one. These are the existing scalar-reader calibration populations, not the
separate production-consensus route. The band red-team instrument's classification
reference remains 84/4,000 (2.10% nonidentity pairs typed RHYME); that is a
relation-only reference, not the scalar-admission count.

Validation commands (from lyric-harness), all passed:

- `python3 battery.py`
- `python3 quality/e5_coda_adoption.py`
- `python3 quality/test_band.py` (including 225 vowel-pair controls)
- `python3 quality/test_readability.py`
- `python3 quality/test_fwer.py`
- `python3 quality/fwer_family.py --calibrate`
- `python3 quality/redteam_band.py`
- `python3 quality/eval_matrix.py --check`
- `python3 quality/test_production_relations.py` (23 tests)
- `python3 quality/test_computational_audit.py` (24 tests)
- `python3 quality/test_chance_rate.py`
- `python3 quality/chance_rate.py --check`
- `python3 quality/near_relation_pricing.py --check`
- `python3 quality/audit_register.py --only E-5`
- `python3 quality/door_census.py --check`

FWER's 30-sonnet null calibration still gives maximum band-pass 0.0562 and
retains the 0.1124 safety limit. All FWER regressions pass, including the planted
control and saturation refusal; this does not close the separate time-layer
power/discrimination work. Matrix changes and their cost are recorded in
`RESULTS_MATRIX.md`. No claim of cross-language validation is made.
