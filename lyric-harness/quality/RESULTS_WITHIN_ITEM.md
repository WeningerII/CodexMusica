# Results — within-item respecification

Predictions in `PREREGISTRATION_WITHIN_ITEM.md`, committed before
`within_item.py` existed. Reproduce with `python3 quality/discriminate.py`,
which now runs both feature sets over the same corpora.

## Head to head

| | Exp 1 hits | Exp 1 AUC | Exp 2 hits | Exp 2 AUC | Exp 2 wrong-sign |
|---|---|---|---|---|---|
| ABSOLUTE (original ten) | 4 | 0.659 | 2 | **0.975** | 5 |
| WITHIN-ITEM (respecified eight) | 1 | **0.604** | 1 | **0.877** | 4 |

## Scoring the pre-registered predictions

**P1 — Exp 2 AUC must fall substantially. PARTIALLY MET.**
0.975 → 0.877. In error terms that is 0.025 → 0.123, i.e. **~4.9x the error**,
which is a substantial fall by any reading. But 0.877 is still a strong
classifier. Within-item normalization removed a large part of what the 0.975
was made of, and what remains is still not quality.

**P2 — Exp 1 AUC must hold or improve on 0.659. FAILED.**
0.659 → 0.604. It fell. The survival signal was itself partly level-based, and
removing levels removed some of it.

**P3 — Exp 2 wrong-sign count must fall below five. MET, TRIVIALLY.**
5 → 4. Technically a pass; substantively unchanged. Concreteness still inverts
(`wi_concreteness_delta` 0.382, `wi_conc_spread` 0.367), which means the
concreteness inversion was **not** merely a level/era artifact — the two classes
genuinely differ in how they distribute concreteness relative to their own
internal baselines.

## The finding

**The diagnosis was confirmed. The cure did not work.**

The diagnosis — that Experiment 2's 0.975 was substantially a register-and-period
classifier rather than a quality classifier — is now supported by direct
evidence: strip the levels and nearly five times as much error appears. That was
the load-bearing claim and it held.

But the feature set was not rescued. After respecification:

- **1/8 hits in each experiment.**
- **Experiment 1 fell to 0.604** at n=15, which does not come close to excluding
  chance.
- **Experiment 2 remains at 0.877**, so the within-item features still carry
  substantial style signal that is not quality.

Per the falsification clause written in advance: *"A result where Exp 2 falls to
near chance and Exp 1 also falls to near chance is not a failure of this
pre-registration. It is the finding that the quality layer has no demonstrated
signal at all, and it must be reported as such rather than reframed."*

Experiment 1 did fall toward chance. **The quality layer has no demonstrated
cross-design signal.** That is the result.

## An uncomfortable detail about the one surviving feature

`wi_predictability_advantage` scores AUC **0.304 in Experiment 1 — identical to
the absolute `rhyme_predictability_mean`, to three decimals.**

That is not a coincidence and not a bug. `mean(pred) − 0.5` is a *monotone*
transform of `mean(pred)`, and AUC is rank-based, so it is mathematically
invariant. **The within-item respecification of feature 1 adds exactly zero
discriminative power within a single corpus.**

Its value is real but narrower than advertised: 0.5 is the exact expectation of
a uniform draw from a candidate field of *any* size, so the recentred statistic
is comparable across languages, lexicon sizes and field structures in a way the
raw value is not. That is a cross-tradition comparability property, **not** a
power gain, and this document should not be read as claiming otherwise.

## Per-feature detail

Experiment 1 (survived vs forgotten, n=15 vs 117):

```
 *wi_predictability_advantage       0.304   0.0117      lower  HIT (FDR)
  wi_concreteness_delta             0.509   0.9095     higher  null
  wi_abstract_delta                 0.582   0.3053      lower  null
  wi_freq_delta                     0.579   0.3290     higher  null
  wi_function_delta                 0.394   0.1840      lower  null
  wi_binding_excess                 0.533   0.6775     higher  null
  wi_type_ratio                     0.657   0.0502     higher  null
  wi_conc_spread                    0.520   0.8030     higher  null
```

Experiment 2 (human vs generated, n=152 vs 40):

```
  wi_predictability_advantage       0.422   0.1304      lower  null
 xwi_concreteness_delta             0.382   0.0222     higher  WRONG SIGN
  wi_abstract_delta                 0.431   0.1826      lower  null
 *wi_freq_delta                     0.614   0.0262     higher  HIT (FDR)
 xwi_function_delta                 0.680   0.0005      lower  WRONG SIGN
  wi_binding_excess                 0.580   0.1245     higher  null
 xwi_type_ratio                     0.103   0.0000     higher  WRONG SIGN
 xwi_conc_spread                    0.367   0.0097     higher  WRONG SIGN
```

`wi_type_ratio` at 0.103 is the largest single effect anywhere in the study and
it is **backwards**: relative to their own lexical diversity, Shakespeare's
rhyme words are far *less* varied than the generated sonnets'. He reuses rhyme
vocabulary; the model does not. Whatever that is measuring, it is not quality —
and it is the third feature now caught pointing the wrong way.

`wi_binding_excess` is null in both designs (0.533, 0.580) even after being
given a proper permutation baseline drawn from each item's own line-final tag
multiset. Wimsatt's binding claim has now failed under two separate
operationalizations and should be considered unsupported by this corpus rather
than merely badly measured.

## What this does not license

It does not license "the approach is dead." One tradition, one form, a
model-derived label, n=15 on the survival side, and a single generator on the
detection side. This is a null in a small English cell, not a general result —
and treating a null here as a general finding would be the same error as
treating the earlier 0.971 as one.

It does license retiring the specific claim that these features measure quality.
Nothing in either feature set has now demonstrated a signal that survives across
both designs.
