# RESULTS — the comparator was reporting rhymes that are not rhymes

Cell BA, 2026-08-11. Every number below was produced by running the command
printed beside it against the shipped `cmudict.dict` and the declared General
American dialect. Nothing here is recalled.

---

## 0. The brief's claims, verified before anything was changed

Two cells found the same defect on the same day from different directions. The
brief asked for verification first, because "multiple register claims have been
falsified this week".

    python3 lyric_harness.py score wall -- floor        (and the other four)

| claim | measured | verdict |
|---|---|---|
| `ear ~ will` 0.996 RHYME | **0.996 RHYME**, nucleus 1.0, coda 0.988 | reproduces |
| `wall ~ floor` 0.996 RHYME, coda 0.988 | **0.996 RHYME**, coda 0.988 | reproduces |
| `call ~ floor` | **0.996 RHYME** | reproduces |
| `wall ~ more` | **0.996 RHYME** | reproduces |
| `call ~ more` | **0.996 RHYME** | reproduces |
| `cons_sim(R, L)` ≈ 0.9875 | **0.9875** | reproduces |
| no value of `theta_coda` reaches it | confirmed, §2 | reproduces |
| `will ~ gun` 0.906, "the same generosity on L against N" | **0.906 — but ASSONANCE, and it always was** | **DOES NOT REPRODUCE AS STATED** |

### The one discrepancy, and it is a finding

`will ~ gun` is not a band leak and never was. `cons_sim('L','N')` is **0.730**,
below `theta_coda` 0.80, so the conjunctive band has always typed that pair
ASSONANCE. The claim in commit `88be7bf` —

> A fifth class, `will ~ gun` at 0.906, is the same generosity on L against N.

— is false. What produced the appearance is a different layer. `check_scheme`
builds its `collisions` list with

```python
else:
    if s["total"] >= 0.9:
        collisions.append((i + 1, j + 1, s["total"],
                           "unintended rhyme across scheme letters"))
```

That branch reads the **scalar only** and never consults `s["relation"]`, so a
correctly-typed ASSONANCE edge is printed in a list headed "unintended rhyme"
with a number beside it. `wall/floor` belongs in that list; `will/gun` and
`will/outrun` do not. **REPORT layer, not comparator** — and it is adversary 7's
territory (does the number, the label and the evidence agree?). Left unfixed
because `check_scheme`'s reporting is not this cell's block; recorded in
`PATCHES-not-mine.md`.

The 0.906 itself is a coordinate of a setting (doctrine 58): at the word level
`score will -- gun` gives **0.756**, because `will` matches on its unstressed
CMUdict variant with a stress MISMATCH. 0.906 is the value under
`promote=final_promotion`, which is what `check_scheme` uses. Both are right;
neither is "the" number.

---

## 1. Is it one defect or a class? — GENERAL TO THE CONSTRUCTION

    python3 quality/redteam_band.py        (section 7)

The generosity is **not specific to liquids, and not specific to sonorants. It
is general to the whole `cons_sim` construction**, and the manner axis is what
buys it.

```
cons_sim = 1 - [0.30*(voicing differs) + 0.25*|place difference|
                + 0.45*MANNER_DIST]
```

Manner **identity** is worth 0.45 of a 1.0 budget while the **entire** place
axis can only take away 0.25. So every same-manner same-voicing pair scores
≥ 0.75 no matter how far apart its places are — measured floor **0.7750**
(`F~HH`) over 27 such pairs. At `theta_coda` 0.80 that admits **36 of 276**
unordered non-identical pairs (13%) as agreeing codas, spanning **six** manner
classes:

| manner pair | admitted | argmax |
|---|---:|---|
| fricative/fricative | 15 | `S~TH` 0.9750 (*miss/myth*) |
| affricate/fricative | 8 | `JH~ZH` 0.8875 |
| stop/stop | 6 | `P~T` 0.9250 (*cap/cat*) |
| nasal/nasal | 3 | `M~N` 0.9250 |
| affricate/stop | 2 | `D~JH` 0.8275 |
| liquid/liquid | 1 | `L~R` 0.9875 |
| glide/glide | 1 | `W~Y` 0.9250 |

`R~L` is not one defect. It is the **top row** of that table, and it is the
argmax of the entire matrix. `miss/myth`, `cap/cat`, `rob/rod` and `back/bat`
all scored RHYME under the shipped comparator and none of them is a General
American rhyme.

---

## 2. No value of `theta_coda` reaches it — the revision-loop cell was right

| `theta_coda` | non-identical pairs admitted | `R~L` (0.9875) |
|---:|---:|---|
| 0.80 (shipped) | 36 | ADMITTED |
| 0.90 | 17 | ADMITTED |
| 0.95 | 9 | ADMITTED |
| 0.98 | 1 | ADMITTED |
| 0.99 | **0** | refused |

The first cut that refuses a lateral against a rhotic is the first cut that
refuses **every** non-identical consonant pair in English — i.e. identity,
reached by the back door and stated as a point on a scale rather than as a rate
(doctrine 22). This was never reachable from the threshold, which is why it is
a **shape** change.

The decisive row is `scalar 0.95`: it pays the **full** true-positive cost
(12.48% mandated refused, identical to identity's) **and still admits
`wall`/`floor`**. There is no cut that buys the fix.

---

## 3. The admitted set and the attested set are almost disjoint

    python3 quality/redteam_band.py        (section 8)

This is the measurement that decided the shape rather than the cut. Over the
1003 readable mandated sonnet pairs, every non-identical coda pair seen more
than once:

| coda pair | n | `cluster_sim` | scalar verdict | what it is |
|---|---:|---:|---|---|
| `S ~ Z` | 8 | 0.700 | REFUSED | obstruent voicing |
| `0 ~ N` | 7 | 0.000 | REFUSED | anchor reach |
| `D ~ RD` | 4 | 0.667 | REFUSED | **rhotic** |
| `0 ~ R` | 4 | 0.000 | REFUSED | **rhotic** |
| `RT ~ T` | 3 | 0.667 | REFUSED | **rhotic** |
| `RTH ~ TH` | 3 | 0.667 | REFUSED | **rhotic** |
| `DZ ~ RDZ` | 2 | 0.800 | admitted | **rhotic** |

Exactly **4** distinct non-identical coda pairs clear 0.80 in the whole
mandated set (5 observations: *words/affords*, *deserts/parts*, *costs/boast*,
*remember'd/tender'd*), while every frequent attested pair is refused by it. In
the fit half, of the 25 distinct non-identical coda pairs the scalar admits
anywhere, **4** occur at all in mandated positions; in the held-out half,
**1 of 26** does.

`Spearman(cluster_sim, lift)` = **+0.156** (fit) and **+0.122** (held). Read
the way doctrine 57 says to: what reproduces is that it is small, not the
digit — the same verdict `vowel_sim` already carries at +0.02/−0.03. The
matrix's ordering carries essentially no information about which coda pairs a
form actually rhymes.

### A line in the record that this falsifies

`lyric_harness.py`'s `theta_coda` comment said, and `quality/redteam_band.py`
and METHOD doctrine 94 repeated:

> what 0.60 -> 0.80 cost there is S~Z x8 (`glass`/`was`, `muse`/`use`) and
> D~RD x2 -- the VOICING OF A FINAL OBSTRUENT, which English did not change
> between 1609 and General American.

Measured: `D~RD` is **n=4, not x2**, and it is **not the voicing of a final
obstruent** — it is an R present on one side and absent on the other
(*herd/beard*, *tir'd/expired*, *word/afford*, *err'd/transferr'd*), with the
nucleus differing in 4 of 4. Counting `RT~T`, `RTH~TH`, `0~R`, `DZ~RDZ` and
`RTS~TS`, the coda channel's mandated evidence is **17 rhotic observations
against 9 obstruent-voicing ones**. So the claim that the coda channel is free
of the dialect problem the nucleus has is half wrong, and the half that is
wrong is the larger half. The corrected text is printed by section 9.

---

## 4. What shipped, and the held-out price

Two changes, deliberately measured **separately**.

### 4a. COMPARATOR — `Declaration.coda_agreement`

The coda channel now has the declared SHAPE coordinate the nucleus channel
already had, defaulting to `identity`. Priced on both halves of both corpora
before shipping (doctrine 5; known gap 2's bar):

| shape | FIT FPR | FIT refused | HELD FPR | HELD refused |
|---|---:|---:|---:|---:|
| scalar 0.80 (incumbent) | 3.55% | 12.28% | 3.65% | 9.44% |
| scalar 0.90 | 2.55% | 12.28% | 2.60% | 9.44% |
| scalar 0.95 | 2.25% | 12.48% | 2.30% | 9.44% |
| **identity (SHIPPED)** | **2.05%** | **12.48%** | **2.15%** | **9.44%** |
| licensed +`S~Z` final | 2.10% | 11.49% | 2.40% | 8.84% |
| licensed +`S~Z`,`T~D` | 2.25% | 11.49% | 2.55% | 8.84% |

Identity cuts the false-positive rate by a third in **both** halves for
**+0.20pp** of mandated pairs in the fit half and **exactly zero** in the
held-out half. Same direction in both halves, which is the standard
`theta_coda` 0.60 → 0.80 was shipped on.

`licensed` and `coda_licence` are reachable and **the licence is empty** —
see §5, which is why.

### 4b. INGESTION — `plural_s_tail`

`transcribe_word`'s OOV `-s` fallback appended a hard-coded `["Z"]` to any
base, producing phone sequences English does not have: `wights` → `W AY1 T Z`,
and /tz/ is not an English coda. **515 distinct words across the 268 corpus
files** carried such a coda. Replaced with the standard voicing rule and
**validated against CMUdict itself** (doctrine 37 — test a phonology against
its tradition, not against its own rules), on the 12,470 dictionary words
ending in orthographic `-s` whose base is a true phonetic prefix of them:

| class | n | voicing rule | old append-Z |
|---|---:|---:|---:|
| voiceless | 3,322 | **99.8%** | 0.2% |
| voiced/other | 8,342 | 98.6% | 98.6% |
| sibilant | 806 | **62.8%** | 0.0% |
| **all** | **12,470** | **96.61%** | **66.03%** |

The sibilant residue is not a competing rule: CMUdict writes that syllable
`IH0 Z` 506 times and `AH0 Z` 211 times, and AH~IH is precisely the pair
`nucleus_licence` already declares, so the remainder is absorbed one channel
down.

---

## 5. The licence that was NOT earned, and why that is the result

`S~Z` was the obvious candidate — 8 observations, the best-attested
non-identical coda pair in the mandated set — and held out it is a genuine
trade rather than a loss (FPR 2.10%/2.40% against identity's 2.05%/2.15%;
mandated refusals 11.49%/8.84% against 12.48%/9.44%). Neither shape dominates.

What decided it was looking at **what the eight observations are**, and every
one is another layer's defect wearing a coda mismatch:

- **`wights`/`knights` is not CMUdict at all.** `wights` is absent from the
  dictionary; it reached the comparator through our own OOV plural fallback
  (§4b). **Ingestion.**
- **`muse`/`use` is a homograph.** CMUdict lists `use` only as the noun
  `Y UW1 S`; Shakespeare's is the verb /juːz/, which rhymes exactly.
- **`glass`/`was`, `pass`/`was`, `is`/`amiss`, `this`/`is` are Early Modern
  English** — the *love/prove* class, and doctrine 94's own warning says a
  threshold cannot be calibrated on a corpus whose dialect differs from the
  declared one on the channel the difference lives in.

A licence would have been a comparator-shaped patch over an ingestion bug, a
homograph and a dialect gap: **doctrine 79's triage error made three times in
one tuple.** The mechanism ships and stays reachable (doctrine 84) so a later
cell with real evidence can fill it; the licence does not, for the same reason
the fitted matrix does not (known gap 2) — nothing showed it helped.

The clean demonstration that this was the right call:

| | violations |
|---|---:|
| ingestion OLD + coda identity | **83** |
| ingestion NEW + coda identity (shipped) | **82** |

The pair the ingestion fix rescues is exactly `wights`/`knights`. Fixing the
right layer removed the only apparent evidence for the wrong fix.

---

## 6. The battery, four counts, before and after

    python3 battery.py

| | mandated | judged | refused | violations |
|---|---:|---:|---:|---:|
| **A** ingestion OLD + coda scalar (the old pin) | 1064 | 1014 | 50 | **81** |
| **B** ingestion NEW + coda scalar | 1064 | 1014 | 50 | **81** |
| **C** ingestion NEW + coda identity (SHIPPED) | 1064 | 1014 | 50 | **82** |

So the ingestion change moves the sonnet oracle by **exactly nothing** and the
whole delta is the comparator. `EXPECTED` is repinned to 82 in `battery.py`
with this argument in the check's own text.

### Every pair whose verdict moved, with its layer

**Newly failing: 1.** Sonnet 91 L10/L12, `costs`/`boast`, 0.765, RHYME →
ASSONANCE. **Layer: comparator (coda shape).** Codas `S T S` against `S T`,
nuclei `AO` against `OW`. Not a rhyme in the declared dialect — the same
sentence this repo already accepts for *love/prove* and *words/affords*. It had
been passing on a coda margin of **exactly zero**:
`cluster_sim(['S','T','S'], ['S','T'])` is 0.800 against a `theta_coda` of
0.800. The one true positive the change costs is a pair the old rule admitted
by rounding.

**Newly passing: 0.**

**Off the mandated set,** the discovered-chain layer moved once and correctly:
sonnet 17's chain `eyes/lies/age/rage` splits into `eyes/lies` and `age/rage`,
because the link joining them was `lies`~`rage` — coda `Z` against `JH`,
`cons_sim` 0.85. **Layer: comparator.** /laɪz/ and /reɪdʒ/ do not rhyme.

### It is not improving by refusing more

The brief asked for this shown rather than asserted, and the arithmetic is
direct: **`refused` is unchanged at 50**, `judged` at 1014, `mandated` at 1064.
The change *cannot* touch them — a refusal is an ingestion verdict reached
before any comparison happens. Against that fixed denominator the red-team FPR
falls 3.60% → 2.10% while the true-positive arm costs one pair in 1014. **60
false positives removed for 1 true positive.**

---

## 7. The red team, before and after

    python3 quality/redteam_band.py        (seed 20260810, n=4000)

**FPR against the strict-identity reference: 3.60% (144/4000) → 2.10%
(84/4000).**

The confusion matrix is where the real result is. Rows are the identity
reference, columns the harness:

| identity says | → RHYME (before) | → RHYME (after) |
|---|---:|---:|
| ASSONANCE | 4 | **0** |
| CONSONANCE | 84 | 84 |
| NO_RELATION | 56 | **0** |

**The coda channel's contribution to the false-positive rate is now exactly
zero.** Every one of the 84 survivors is the CONSONANCE row — codas *identical*,
the **nucleus** over-reaching — and all fifteen of the thinnest admissions now
print `coda 1.000` with `nuc 0.60x`. The residual FPR is `theta_nucleus`,
which is declared uncalibrated, which METHOD explicitly declines to move on
this corpus, and which is not this change's to touch.

Also gone: the `NO_RELATION → CONSONANCE` cell, 59 → 0.

### The adversary now attacks the channel that broke

`quality/redteam_band.py` gained sections **7–9**, mirroring the nucleus
channel's 4–6. That asymmetry is *how this shipped*: adversary 3 interrogated
the nucleus SHAPE and took the coda's on trust, so a positive-case blind spot
survived inside the file written to find positive-case blind spots. Doctrine 94
applies to an adversary that only attacks one channel of two.

---

## 7a. A hole in adversary 4, found on the way past and closed

    python3 quality/mutate.py --only M3

`quality/mutate.py` M3 replaces `min(codas)` with `max(codas)` in
`channel_agreement`, so one agreeing syllable carries a whole multi-syllable
anchor — doctrine 21's compensation defect moved from the comparator into the
band. It reported **SURVIVED, having run 34 checks with none failing.**

Verified **pre-existing, not introduced**: the battery reports 81 violations
with *and* without M3 under the old comparator, and 82 with and without it
under the new one, and `nation`/`nasal` flips ASSONANCE → RHYME under M3 on
both. Nothing in the oracle was ever going to see it. What it needs is an
anchor whose syllables **disagree** about the coda, and every comparator
example in this repo is a monosyllable or a pair that agrees throughout —
doctrine 94's shape again, one level in: a suite of examples chosen by an
author cannot find a rule that is too generous *across syllables* either.

`quality/test_coda.py` §5 now pins `nation`/`nasal` and **M3 is caught**.

Two mutation anchors (M3 and M5) also both key on the exact line

    return nuc >= decl.theta_nucleus, min(codas) >= decl.theta_coda

which this cell's first draft had rewritten, leaving both mutants stale. The
shipped version keeps that line **verbatim** and computes the non-scalar
shape's verdict **per syllable** into `codas`, so the conjunction across
syllables stays where the mutants can break it. Hiding it inside the predicate
would have left two mutants with nothing to break, and the suite would have
reported that as strength.

---

## 8. Whitman

`battery.py` prints it and it moved: **17.3% → 10.7%** chained at theta 0.82.

It is **not** offered as evidence for anything. CLAUDE.md withdrew that control
on the prior ground that the text carries the property under test as
epistrophe — half its detected links are REPEAT on an identical token, and
`now` still closes four consecutive lines in the run above. A number printed by
a withdrawn control is a number, not a warrant.

---

## 9. What this does NOT fix

- **`theta_nucleus`.** 100% of the remaining red-team false positives are that
  channel. `five`/`of` still passes at 0.603 against 0.600.
- **`check_scheme`'s collision list** still prints on `total >= 0.9` without
  consulting the relation, which is what made `will ~ gun` look admitted.
  Report layer; recorded in `PATCHES-not-mine.md`.
- **The scalar shape is still reachable** and still leaks, on purpose
  (doctrine 84) — a doctrine whose demonstration has been optimised away is a
  sentence nobody can check. `quality/test_coda.py` §3 exercises it.
- **`cons_sim` itself is untouched.** It is still the function `cluster_sim`
  and every `onset` score reads, and §1 shows its ordering is not trustworthy
  on the coda. Replacing it is a larger question than this cell; what shipped
  is a band that no longer *depends* on it for the RHYME/ASSONANCE verdict.
