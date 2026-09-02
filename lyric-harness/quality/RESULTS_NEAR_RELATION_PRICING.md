# Results — pricing the near-relation door: E1 ADOPTED, E2 REFUSED TWICE

Method: `quality/NEAR_RELATION_PRICING_PREREGISTRATION.md`, written with the
runner and before any number below existed. Re-derive with

    python3 quality/near_relation_pricing.py             # E0, E1, E2   ~11 min
    python3 quality/near_relation_pricing.py --seeds     # the 200-seed arm ~3 min
    python3 quality/near_relation_pricing.py --interval  # where 20 comes from

**VERDICT, IN ONE LINE EACH.**

| falsifier | fired? | outcome |
|---|---|---|
| **E0** the instrument reproduces the oracle | **no** | pair for pair, 1064/1014/50/12 |
| **E1** the per-relation cut costs too much | **NO** | **ADOPTED** — ASSONANCE cut at **0.82**, sonnet violations **12 → 14** against a ceiling of 20 |
| **E2 `zero`** | **YES** | **REFUSED** — 208 of 979 admitted pairs leave the admitted set |
| **E2 `cannot_tell`** | **YES** | **REFUSED** — 1 pair leaves, and the registration said *any* |

**Three outcomes, one adoption and two refusals, each decided by a rule
written before its number.** M-138's pricing half is closed. E-5's expensive
half is NOT, and the price of it is now on the record for the first time.

## E0 — the instrument reproduces the oracle, pair for pair

    mandated 1064  judged 1014  refused 50  violations 12  rescued by schema 23

Identical to `battery.py` and identical in MEMBERSHIP, not only in count —
the re-derivation's violating pairs and `check_scheme`'s are the same set.
That comparison is the point: two readings can agree on 12 and disagree about
which twelve, and reproducing a number checks the arithmetic and never the
construction (doctrine 79's closing sentence). Nothing below would have been
read had this disagreed.

## The random arm, by relation, at the shipped cut

Over `chance_rate.GRID` — 4 cells, seed 20260810, n=4,000 each. Shares of
JUDGED. Ratios against the canon arm as pinned when the pricing was derived,
12/1014 = 1.1834%.

| cell | RHYME | RIME_RICHE | ASSONANCE | CONSONANCE |
|---|---:|---:|---:|---:|
| redteam pop / word anchor | 40 (0.85x) | 0 | **220 (4.65x)** | 56 (1.18x) |
| redteam pop / line anchor **(SHIPPED)** | 46 (0.97x) | 0 | **233 (4.92x)** | 60 (1.27x) |
| all entries / word anchor | 36 (0.76x) | 0 | **189 (3.99x)** | 64 (1.35x) |
| all entries / line anchor | 37 (0.78x) | 0 | **217 (4.59x)** | 70 (1.48x) |

**THE FINDING IS THAT IT IS ONE RELATION AND NOT TWO.** M-138 filed ASSONANCE
and CONSONANCE together and they do not behave together: at the shipped 0.75,
**ASSONANCE runs 3.99x–4.92x the canon arm while CONSONANCE runs 1.18x–1.48x
and is already under the 2x target on every cell.** RHYME itself is UNDER 1x —
the door is likelier to fail one of Shakespeare's mandated pairs than to call
two random words a perfect rhyme, which is the 2026-08-11 `theta_coda`
calibration still holding. The 6.1–7.2x whole-door figure M-138 records is a
SUM over these four, and reading it as one relation's rate is doctrine 79.

**RIME_RICHE is 0 in every cell.** Reported as a measured zero, not omitted: it
requires exact channel identity between two DIFFERENT words, and 16,000 random
draws produced none.

## The sweep, and the cut it lands on

Smallest t on the declared grid (0.75–1.00, step 0.01) whose ratio is under 2x
in ALL FOUR cells:

| t | ASSONANCE admitted (min..max) | ratio |
|---:|---:|---|
| 0.75 | 189..233 | 3.99x..4.92x |
| 0.78 | 129..157 | 2.73x..3.32x |
| 0.80 | 99..122 | 2.09x..2.58x |
| 0.81 | 86..100 | 1.82x..**2.11x** |
| **0.82** | **73..86** | **1.54x..1.82x** ← first cell-wide under target |

**t\*(ASSONANCE) = 0.82. t\*(CONSONANCE) = 0.75** — already under target at
the shipped cut, so it is MEASURED AND UNMOVED rather than absent. 0.81 is the
instructive row: it clears 2x on three cells and misses on the fourth at
2.11x, which is exactly what adopting over the BAND rather than a cell is for
(doctrine 57/73). A cut chosen on the friendliest sampler would have been 0.81.

## E1 — does that cut cost more than the canon arm can carry?

**TWO READINGS, REPORTED APART, AND THE SECOND IS THE ONE THE REGISTRATION
NAMED** (doctrine 79):

| reading | before | after |
|---|---:|---:|
| SCALAR DOOR (pairs the scalar admits) | 35 | **39** (+4) |
| AFTER the 77-schema rescue (**what `battery.py` prints**) | 12 | **14** (+2) |
| pairs the schema door absorbed | 23 | 25 (+2) |

**Ceiling 20. Measured 14. E1 DOES NOT FIRE.**

The two newly-violating pairs, named because a repin that cannot name what
moved is a repin nobody can check:

    sonnet 49  L5~L7    pass/was      0.772  ASSONANCE
    sonnet 91  L10~L12  costs/boast   0.765  ASSONANCE

**STOPPED violating: 0.** One-directional, as a tightening must be — a cut
that REMOVED a violation would mean the change did something other than what
it says. And `costs`/`boast` is the pair cell BA already named on 2026-08-11,
which passed then on a coda margin of EXACTLY ZERO and has passed ever since on
an assonance cut nobody had priced. It stops passing on a cut somebody did.

### The split-half, and it is the weakest thing in this document

Registered as a REPORTED population rather than as a falsifier, and it does not
reproduce in both halves:

| half | before | after |
|---|---:|---:|
| FIT (odd sonnets) | 4 | **6** (+2) |
| HELD (even sonnets) | 8 | **8** (+0) |

**Both moving pairs are in the odd half and the held half does not move at
all.** Doctrine 5 asks a shipped change to reproduce its direction in both
halves; this one cannot be said to, because at n=2 the effect has no direction
to reproduce. **This is stated as a limitation and not resolved.** It is not
evidence the cut is wrong — 8 → 8 is consistent with a cut that costs little
everywhere — but a reader should not take the held half as confirmation. The
honest summary is that the sonnet corpus contains two pairs the cut refuses and
they happen to sit in one half.

## E2 — the empty/empty coda, in `total` only

Baseline: **979 of 1,014 judged mandated pairs are admitted** by the scalar
door; 12 violations after the schema rescue.

| rule | left the admitted set | scalar door | after rescue | schema absorbed | `now`/`why` | `see`/`free` | `cat`/`hat` |
|---|---:|---:|---:|---:|---|---|---|
| `gift` (shipped) | — | 35 | 12 | 23 | 0.902 RHYME | 1.000 RHYME | 1.000 RHYME |
| **`zero`** | **208 (21.2%)** | **243** | 12 | **231** | 0.552 **not admitted** | 0.650 **not admitted** | 1.000 RHYME |
| **`cannot_tell`** | **1 (0.1%)** | 36 | 12 | 24 | **0.850** RHYME | 1.000 RHYME | 1.000 RHYME |

**BOTH RULES FIRE E2. BOTH ARE REFUSED.**

### `zero` — refused, and the way it "passed" is the finding

Scoring an empty/empty coda as DISAGREEMENT takes **208 of 979 admitted
mandated pairs out of the admitted set** and moves the scalar door from 35
charged pairs to 243. `see`/`free` — the named class, and E-5's own reason the
agreement side must be left alone — falls to **0.650**, below `theta_rhyme`.

**AND THE VIOLATION COUNT STAYS AT 12, WHICH IS THE MOST IMPORTANT NUMBER IN
THIS DOCUMENT.** The 77-schema default absorbed **231 pairs against 23 today**
— a tenfold jump in a door `MISSING.md` M-140 pins at 20.3x–21.0x the canon arm
and leaves explicitly UNPRICED. A registration reading only `battery.py`'s
headline would have recorded `+0 violations` and adopted a rule that displaced
a fifth of the admitted set into an uncalibrated door.

**THE REGISTRATION GAVE TWO READINGS OF E2 AND THIS DATA SEPARATES THEM.** It
said E2 fires when a rule *"moves any currently-admitted mandated sonnet pair
out of the admitted set — that is, when the re-derived violation count exceeds
20"*. The clause and its gloss disagree here: 208 pairs leave the admitted set
and the violation count is 12. **The primary clause is taken and the gloss is
recorded as a defect in the registration**, found by the run rather than by
reading. Taking the gloss would let an unpriced door launder the rate this
whole sitting exists to price, which is M-138's own subject turned on the
document measuring it. The runner now prints both readings on every arm so the
next sitting cannot make the same substitution.

### `cannot_tell` — refused by ONE pair, and it is refused anyway

Renormalising the coda channel away when both codas are empty behaves exactly
as the hypothesis predicted: `see`/`free` **stays 1.0** (the agreement side
carries it, untouched), `cat`/`hat` stays 1.0 with no flag, and `now`/`why`
goes **0.902 → 0.850** — the 0.35 of agreement-by-absence gone from `total`
with the relation typing unmoved. The scalar door moves 35 → 36. One pair
leaves the admitted set:

    sonnet 1  L2~L4  die/memory  0.773 CONSONANCE  (gift)

**The registration said E2 fires when a rule moves ANY currently-admitted pair
out of the admitted set. One is any. E2 FIRES, and `cannot_tell` is REFUSED.**

This is the refusal most worth arguing with and it is not being argued with
here. One pair of 979 is 0.1%, the rule does everything E-5 asks of it, and
nothing would be easier than declaring one pair a rounding error after seeing
that it is one pair. **That is doctrine 58 exactly** — a tolerance chosen after
the number is a threshold nobody wrote down — and the meter-bands series
refused twice before it adopted once. The registration's own words were *"any"*,
written when the author did not know whether the answer would be 0, 1 or 208.

**WHAT THE NEXT SITTING INHERITS, and it is a short one.** `cannot_tell` is
built, reachable (`Declaration.coda_empty_evidence`), and measured at a cost of
exactly one named sonnet pair. Closing E-5's expensive half needs a
registration that declares a TOLERANCE in advance — with its own argument for
the number — and re-runs this arm against it. That is a real sitting and it is
much smaller than the one E-5 has been waiting for since 2026-08-21, because
the instrument and the measurement now exist.

## The 200-seed arm — and the adopted band understates the spread

`chance_rate.SHIPPED`, re-drawn at seeds 20260810+0..199, admitted counts at
the shipped `theta_rhyme`:

| relation | min | p5 | median | p95 | max |
|---|---:|---:|---:|---:|---:|
| RHYME | 21 | 31 | 41.5 | 51 | 62 |
| RIME_RICHE | 0 | 0 | 0.0 | 1 | 3 |
| ASSONANCE | 184 | 198 | 222.0 | 246 | 263 |
| CONSONANCE | 52 | 59 | 69.0 | 84 | 100 |
| ADMIT (all) | 291 | 302 | 332.5 | 362 | **400** |

**`chance_rate.ADOPTED['admit']` was (289, 339) over four SAMPLERS at ONE
seed; over 200 SEEDS of one sampler the same quantity spans 291..400.** The
two are different quantities and are not summed — but a reader should know that
the band this repository adopted is narrower than the seed-to-seed spread of
the thing it bands. That is doctrine 73 arriving at a pin that already cites
doctrine 73, and it is recorded here rather than acted on: repinning
`chance_rate`'s grid design is its own sitting.

**RIME_RICHE's max of 3 retires this document's own "measured zero" above** for
the 200-seed population: it is zero at the canonical seed and not structurally
zero.

## What moved, what did not, and the command for each

| pin | before | after | command |
|---|---|---|---|
| `battery.EXPECTED["violations"]` | ~~12~~ | **14** | `python3 battery.py` |
| `chance_rate.CANON_VIOLATIONS` | ~~12~~ | **14** | (reads `battery.py`'s oracle) |
| `chance_rate.ADOPTED["admit"]` | ~~(289, 339)~~ | **(173, 193)** | `python3 quality/chance_rate.py --check` |
| `Declaration.theta_by_relation` | (did not exist) | `{ASSONANCE: 0.82, CONSONANCE: 0.75}` | `python3 quality/near_relation_pricing.py` |
| `chance_rate.ADOPTED["narrow"]` | (36, 46) | **(36, 46) HELD** | `python3 quality/chance_rate.py --check` |
| `chance_rate.ADOPTED["schema"]` | (960, 994) | **(960, 994) HELD** | `python3 quality/chance_rate.py --check` |
| D18 `now ~ why` | 0.902 | **0.902 UNMOVED** | `python3 lyric_harness.py score now -- why` |
| `test_fwer.py` (4 assertions) | pass | **pass, UNMOVED** | `python3 quality/test_fwer.py` |
| `redteam_band` FPR | 2.10% (84/4000) | **2.10% (84/4000) UNMOVED** | `python3 quality/redteam_band.py` |
| `eval_matrix` P3 | −0.000 bits, CONFIRMED | **−0.000 bits, CONFIRMED** | `python3 quality/eval_matrix.py` |

**THE UNMOVED PINS ARE NOT RE-ADOPTED AS BANDS, AND THAT IS DELIBERATE.**
M-138's banked outline expected the FWER and matrix P3 pins to be re-adopted as
bands. They were RUN and they did not move — `test_fwer` because the near
relations were never in its family, `redteam_band` because adversary 3 reads
the NARROW door and its own `DOOR READ` line says so, `eval_matrix` P3 because
E2 refused and no scalar moved. Re-shaping a pin that did not move would be a
change with no measurement behind it.

**D18 STAYS 0.902 BECAUSE E2 REFUSED.** The outline expected it to repin; that
expectation was conditional on the E-5 half holding and it did not.

### The repin argues in a circle unless the baseline is pinned, so it is

Adopting the cut moved `CANON_RATE` — the DENOMINATOR of the statistic that
chose the cut — from 12/1014 to 14/1014. Every ratio falls by 12/14, and
**re-sweeping against the moved value hands back 0.81 for free.** That is a
calibration arguing in a circle, in the loosening direction.
`near_relation_pricing.PRICING_CANON` pins 12/1014 as the rate the pricing was
derived at, and the sweep reads it rather than the live pin.

**The adoption is stable under its own repin and this is checked rather than
assumed.** At the repinned 14/1014 the adopted cuts read **ASSONANCE
1.32x–1.56x, CONSONANCE 1.01x–1.27x, RHYME 0.65x–0.83x** — every relation still
under the 2x target, printed by `chance_rate.py --check` rather than typed. Had
it not held, the cut would have been REFUSED rather than re-swept.

## One test was repinned, and it is the only one

`quality/test_homeoteleuton.py` §5 asserted that declaring
`admit=("RHYME","RIME_RICHE","ASSONANCE")` makes `sun`/`much` (0.772) satisfy.
Under the priced cut it does not. **The claim was kept and PROVEN on a pair
above the cut** (`chores`/`norm`, 0.932 ASSONANCE) rather than deleted, the new
refusal is asserted WITH the message naming its cut, and a third check asserts
the escape hatch — `theta_by_relation={}` restores the pre-pricing scalar
exactly, so the cut is a declared coordinate and not a new law. Net +2 checks.

**Why the priced cut binds a DECLARED door at all**, since it is a ruling:
`admit` and `theta_by_relation` are two coordinates and that caller declared
the first. The random-admission evidence does not care who opened the door — if
anything it bears harder on a caller who deliberately admits assonance.

## What this does NOT claim

Restated from the registration, unchanged, because a result inherits its
method's limits:

- **Not that 2x is correct.** It is a target chosen from the 1.5x precedent.
- **Not that the random arm is ground truth.** Two random CMUdict words are not
  a rhyme mandate.
- **Not that the two doors can be added.** The `SCHEMA DEFAULT` door is not
  priced here and its 231-pair absorption above is a MEASUREMENT of that door's
  reach, not a pricing of it. M-140 stays open.
- **Not that E-5 closes.** Both candidate rules were refused.
- **Not a claim about non-English relations.** CMUdict and Shakespeare only.
- **Not a power claim.** No positive control was run on the canon arm, so a
  held E1 says the cut is affordable on THIS corpus, never that a cut which
  mattered would have been detected (doctrines 31/76).
- **And not that the split-half confirms anything** — see above; it is the
  weakest part of the E1 result and is reported next to the number.

Nothing in the registration has been edited.
