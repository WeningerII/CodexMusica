# Pre-registration — pricing the near-relation door, and the empty/empty coda

The sitting `MISSING.md` M-138 has been parking since 2026-08-22 and E-5 since
2026-08-21. Both entries were parked for ONE stated reason — pricing is *"a
re-adoption that moves recorded verdicts without a preregistration of its
own"* — and this file is that preregistration.

**Committed with the runner and BEFORE the numbers exist.** `quality/near_relation_pricing.py`
lands in the same commit as this file; `quality/RESULTS_NEAR_RELATION_PRICING.md`
lands in a later one, and no per-relation admitted count, no swept threshold and
no re-derived violation count appears anywhere until it does. That ordering is
the only thing that makes an adoption here mean anything, and this repository
has said so three times in the meter-bands series — three runs, two refusals,
one adoption, each decided by rules written before their numbers.

> **THE ORDERING CLAIM, AND ITS ONE WEAKNESS, STATED RATHER THAN GLOSSED.**
> `METER_BANDS_PREREGISTRATION.md` can say *"`git log` proves the order"*. This
> file cannot say it in its own voice: the sitting that wrote it was forbidden to
> commit, so the proof of order is the commit the OWNER makes when landing it —
> this file and the runner in one commit, the results in a later one. If it lands
> as a single commit with the results, the ordering is an assertion and not a
> proof, and a reader should discount it accordingly (doctrine 20: say which of
> the two you have).

## The hypothesis

`admits()` at `theta_rhyme=0.75` is, since M-59 widened `Declaration.admit`, the
**sole numeric gate** on ASSONANCE and CONSONANCE — a cut calibrated on neither
— and `cluster_sim([], []) == 1.0` gives two vowel-final words a free 1.0 on a
channel weighted 0.35. Each admits random word pairs at a rate that has never
been priced against the canon arm. The hypothesis is that

1. **per-relation thresholds** can be adopted on `Declaration` that bring each
   near relation's random-admission rate under **2x** the canon arm's
   violation rate, **without raising sonnet violations above the canon arm's own
   interval**; and
2. an **empty/empty coda evidence rule** can replace the free 1.0 in `total`
   **without moving `see`/`free`-class pairs out of the admitted set**, because
   the AGREEMENT side (`coda_agrees`, `channel_agreement`'s own empty/empty
   branch) is CORRECT and is what carries them.

Either half may be refused independently. **A refusal is a complete result**
and the declared-policy option is what a refusal adopts instead.

## The precedent this is measured against, verbatim

`quality/RESULTS_REDTEAM.md:75-76`, the sentence that got `theta_coda`
recalibrated 0.60 -> 0.80:

> **The harness was more likely to call two random dictionary words a rhyme
> (11.10%) than to fail one of Shakespeare's mandated pairs (7.2%).**

That is a **1.5x** ratio and it was treated as disqualifying. The admit door's
ratio today is **6.1–7.2x** (`quality/chance_rate.py`, a band over its 2x2
sampler grid). The 2x target below is chosen as the smallest round multiple
strictly above the disqualifying precedent — declared here, before it is
measured against, precisely so that nobody can choose it afterwards
(doctrine 58).

## Populations, with their sizes

| arm | population | size | reader |
|---|---|---|---|
| **RANDOM (band)** | `chance_rate.GRID` — the declared 2x2 of {`redteam(isalpha,2..12)`, all CMUdict entries} x {word anchor + `score`, line anchor + `best_score`} at seed **20260810** | 4 cells x **4,000** drawn pairs | as the cell declares |
| **RANDOM (seeds)** | the `chance_rate.SHIPPED` cell — production's own reader on the precedent's own population — re-drawn at seeds **20260810 + 0..199** | **200** draws x 4,000 pairs | `line anchor + best_score` |
| **CANON** | every rhyme-mandated pair of the 152 Shakespeare sonnets `battery.py` parses, scheme ABABCDCDEFEFGG | **1,064 mandated / 1,014 judged / 50 refused** | `check_scheme` at the shipped `Declaration` |
| **CANON (split)** | the same, split by sonnet index — FIT = odd, HELD = even | 76 / 76 sonnets | as above |

**A REFUSAL IS NEVER IN A NUMERATOR** (doctrine 79). The random arm's door
counts are shares of **JUDGED**, never of drawn; the canon arm's violations are
over **1,014 judged**, never over 1,064 mandated. Drawn / refused / judged are
reported as three counts and never summed.

## The statistic

Per relation *r* in {ASSONANCE, CONSONANCE} (and reported for RHYME and
RIME_RICHE as the control arm), at a candidate cut *t*:

    ratio_r(t)  =  ( admitted_r(t) / judged )  /  CANON_RATE

where `admitted_r(t)` counts drawn pairs the comparator types *r* and scores
`total >= t`, and `CANON_RATE = 12/1014 = 1.1834%` is read from
`chance_rate.CANON_VIOLATIONS / CANON_JUDGED` rather than retyped, so a battery
repin moves this statistic (standing rule 3).

**The cut is adopted over the BAND, never over a cell** (doctrine 57/73, and
`chance_rate.ADOPTED`'s own discipline). Define

    t*_r  =  the smallest t on the declared sweep grid at which
             ratio_r(t) < 2.0 in ALL FOUR cells of `chance_rate.GRID`

**Declared sweep grid:** t from **0.75 to 1.00 inclusive in steps of 0.01** (26
points). Nothing off this grid is tried, and the grid is stated here so that
"the smallest t that works" cannot become "the t that made the answer come out"
(doctrine 58 is exactly this error).

If no t on the grid brings a relation under 2x, that relation has **no
per-relation cut** and the pricing is refused for it — reported as such, not
extended to a finer grid.

## The falsifiers, each with the number that fires it

### E1 — the per-relation cut costs more than the canon arm can carry

Re-derive the sonnet arm at `(theta_ASSONANCE = t*_ASSONANCE,
theta_CONSONANCE = t*_CONSONANCE)`, RHYME and RIME_RICHE left at 0.75, every
other layer untouched.

**E1 FIRES when the re-derived violation count exceeds 20.**

**Where 20 comes from, computed before the run from the ALREADY-PINNED
baseline** (`battery.py`'s `EXPECTED`, not from anything measured here): the
exact Clopper–Pearson 95% interval on 12 of 1,014 is
**[0.006130, 0.020581]**, which over 1,014 judged pairs is **[6.215, 20.869]**
pairs, i.e. counts **[6, 20]** taking the floor at each edge. "12 plus its
interval" is therefore **20**, and 21 violations is outside it.

**On firing:** the pricing is **REFUSED**. The declared-policy option — the
third of M-138's three named options, *"rule that a near relation satisfying a
mandate is a DECLARED policy whose false-positive rate is accepted and say so
where the rate can be read"* — is adopted instead, and is stated AT THE DOOR:
`Declaration` carries the policy as a named coordinate rather than as an
unexamined default, and the `ADMIT DOOR` line says the rate is accepted, by
which ruling, and where the refusal is recorded. **No threshold is tuned to
make E1 pass.** Doctrine 58 is precisely about that, and a refusal here is a
complete result.

### E2 — the empty/empty coda rule moves the pairs it must not move

Two candidate rules for the empty/empty coda **in `total` only**:

- **`zero`** — `cs = 0.0` when both codas are empty. Absence of evidence scored
  as disagreement.
- **`cannot_tell`** — the coda channel is DROPPED from that syllable's weighted
  mean and the remaining channel weights are renormalised. Absence of evidence
  scored as nothing at all, which is the doctrine-20 shape and the shape E-5's
  cheap half already prints in `flags`.

**The change is confined to `total` by construction and this is preregistered as
a CONSTRAINT, not discovered as a result.** `channel_agreement`'s own
`1.0 if (not ca and not cb)` branch and `coda_agrees` are NOT touched under
either rule, because E-5 records the agreement side as CORRECT — *"it is what
keeps `see`/`free` a rhyme, a quarter of the sonnets' mandated pairs"*. So
relation TYPING cannot move; only the scalar can.

**E2 FIRES when a candidate rule moves any currently-admitted mandated sonnet
pair out of the admitted set** — that is, when the re-derived violation count
under that rule exceeds **20**, the same interval E1 uses and for the same
reason. `see`/`free` is the named class: it scores 1.0 today, and a rule that
drops it below `theta_rhyme` has broken the thing the agreement side exists to
carry.

**On firing for a rule:** that rule is **REFUSED** and the measured cost is
recorded. **If both rules fire, E-5's expensive half is refused in this sitting
and E-5 stays `OPEN`** with the price on the record — which is more than the
entry has ever had. If exactly one holds, it is the adopted rule. If both hold,
**`cannot_tell` is adopted**, declared here in advance: it names the channel
unasked instead of asserting a disagreement nobody heard (doctrine 20), and it
is the same shape as the disclosure that already ships.

### E0 — the instrument does not reproduce the oracle

Before either falsifier is read, the canon arm's re-derivation at the SHIPPED
thresholds must reproduce `battery.py` exactly: **mandated 1064, judged 1014,
refused 50, violations 12**. **E0 FIRES on any disagreement**, and on firing
NOTHING BELOW IT IS READ — every number in the run is void and the result is
that the instrument was wrong. A re-derivation that cannot reproduce the pin it
re-derives from is not a measurement (doctrine 1: one question, one definition;
and M-138's own founding defect was a figure from an instrument nobody could
re-run).

## What is adopted if it holds

- **Per-relation thresholds on `Declaration`** — a declared `theta_by_relation`
  coordinate, defaulting to the adopted cuts, with the historical behaviour
  reachable by declaring it empty.
- **D18 repinned from 0.902** (`quality/audit_register.py`, `quality/test_readability.py`
  §14, `RESULTS_REGISTER_AUDIT.md`) — the superseded value struck and dated,
  never deleted (doctrine 17).
- **The FWER pins and the matrix P3 pin re-adopted as BANDS** rather than as
  points, since a band move is what M-4a records the price of.
- **`battery.py`'s `EXPECTED`** repinned, with the price stated in the
  file's own repin-comment style, and `chance_rate.CANON_VIOLATIONS` with it.

**Every one of those is RE-DERIVED by running its own instrument, never edited
to match.** The command that produced each new value is recorded beside it.

## What this will NOT claim

- **Not that 2x is correct.** It is a target chosen from a precedent, not a
  measured optimum. A cut that reaches it is defensible against this
  repository's own recorded standard; it is not thereby right.
- **Not that the random arm is ground truth.** Two random CMUdict words are not
  a rhyme mandate. The arm measures how often a door answers on pairs nobody
  declared, which is a property of the door and not of English.
- **Not that the two doors can be added.** The `SCHEMA DEFAULT` door (M-140,
  20.3–21.0x) is NOT priced here and its count is never summed with the admit
  door's (doctrine 79). A pair a schema rescued is the other door's.
- **Not that E-5 closes.** Even a held E2 moves the SCALAR only. The entry's own
  standing controls (`cat`/`hat` unflagged, `see`/`free` still admitted) and the
  agreement side are unchanged, and the disclosure flag that shipped
  2026-09-02 is not what closes it either.
- **Not a claim about non-English relations.** `chance_rate`'s population is
  CMUdict and the canon arm is Shakespeare. Nothing here transfers to `fin`,
  `cym`, `fas`, `san` or `ltc`, whose own rate instruments exist and were not run.
- **Not a power claim.** No positive control is run on the canon arm here, so a
  held E1 says the cut is affordable on THIS corpus, never that a cut that
  mattered would have been detected (doctrines 31/76).

## Already looked at, disclosed

Before this registration: the baseline battery at HEAD
(`python3 battery.py` — mandated 1064, judged 1014, refused 50, violations 12,
1.2% of judged); the pinned bands already in `chance_rate.ADOPTED`
(`admit 289..339`, `narrow 36..46`, `schema 960..994`) and its `CANON_RATE`,
which are HEAD's own committed constants and not measurements of this sitting;
the Clopper–Pearson arithmetic on 12/1014 above; and a **cost probe** that timed
one 200-pair random draw (0.029 s), one `check_scheme` call (0.054 s) and one
`whole_vocabulary_pairs` call (4.661 s) **without aggregating any of them** —
that probe is why the seeds arm is sized at 200 x 4,000 rather than smaller, and
why the schema-rescue arm is computed lazily per sonnet.

**No per-relation admitted count exists yet. No swept threshold exists yet. No
re-derived violation count exists yet.**

## The runner

    python3 quality/near_relation_pricing.py            # both falsifiers, ~5 min
    python3 quality/near_relation_pricing.py --seeds    # the 200-seed arm, ~3 min
    python3 quality/near_relation_pricing.py --check    # re-derive, exit 3 on drift

A prediction that misses is REPORTED in `quality/RESULTS_NEAR_RELATION_PRICING.md`
next to the number that missed it. **Nothing in this file is edited after the
run.**
