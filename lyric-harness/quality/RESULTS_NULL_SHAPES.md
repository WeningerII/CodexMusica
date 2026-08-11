# What a control has to DESTROY to be a control

Cell Y, 2026-08-11. `BACKLOG.md` §3.5 (`MISSING.md` K-2/K-3) and `BACKLOG.md`
§4.2 (`MISSING.md` L-2), answered together because they are one question.

§3.5 asks for a replacement negative control. §4.2 owes "a null that destroys
the span multiset — across items rather than within one". Both are the same
question — *what must a randomisation destroy before it is a control?* — and
the answer this round is the same for both, and it is not the answer either
entry expects.

Every figure below was produced by execution. The command is printed beside
it. Nothing here was taken from a document, including from the brief that
commissioned it, and **three recorded numbers did not reproduce**.

---

## 0. The headline, before the arithmetic

1. **All four recorded Whitman figures are coordinates of a comparator this
   repo replaced.** 20.0% and 18.0% reproduce EXACTLY under the pre-`b1d7f64`
   head-aligned comparator at `theta_coda 0.60`, and under no other cell of
   the 2×2. Under the shipped comparator the same statistic reads **17.3%**.
   There is a fifth figure and it is today's.
2. **Under the shipped comparator the Whitman control now SEPARATES from its
   own line-permutation null** — p ≈ 0.006 at n = 2000, against the recorded
   p = 0.209 — and the band's effect on the separation has **flipped sign**:
   recorded +6.7 → +3.3 pp, measured +6.7 → **+9.3** pp.
3. **Whitman was never eligible for the role, and that needs no null.** Half
   of its detected chain links are REPEAT on an identical token; `now` closes
   four consecutive lines. A negative control is a text in which the property
   is ABSENT.
4. **§4.2's owed null is buildable, and it is an identity map too.** The
   reason is that the quantity is a property of ENGLISH, not of the item, so
   no randomisation drawn from the corpus's own words can be a null for it.
   That is a fifth shape of the identity-map trap and the first one that does
   not yield to a better randomisation.
5. **The positive now has three non-English languages in it**, measured
   through their own declared phonologies — and none of the three separates.

---

## 1. There is a fifth Whitman figure, and the other four are a comparator

### 1.1 It is the SAME quantity — the alternative reading is refuted

`battery.py` prints `lines captured in chains: 26 (17.3%)`.
`CLAUDE.md:297` records `Whitman 20.0% chained at theta 0.82`.

The candidate reading that these are different quantities is **wrong**, and
the code says so without a measurement being needed:
`quality/audit_band_control.py:captured()` is documented as *"battery.py's
statistic verbatim: share of lines inside a chain >= 2"*, and
`negative_control.py`'s P3 arm computes the same expression. One statistic,
three call sites, and 17.3% is what all three return today.

```
$ python3 battery.py
  lines captured in chains: 26 (17.3%) across 12 chains
$ python3 quality/negative_control.py          # P3-LEGACY arm
  Whitman chain capture   observed 0.1733
```

So: **the recorded 20.0% no longer reproduces.**

### 1.2 Where it went — the 2×2, and it is exactly additive

`quality/fwer_family.py` keeps the pre-`b1d7f64` flush-LEFT comparator
reachable as `head_agreement`, for exactly this purpose. Crossing it with
`theta_coda` recovers the record and nothing else does:

```
$ python3 <scratch>/probe_alignment.py

alignment  theta_coda  band  | theta_chain 0.82   theta_chain 0.85
TAIL(now)  0.60        ON    |  29 lines  19.3%    26 lines  17.3%
TAIL(now)  0.80        ON    |  26 lines  17.3%    24 lines  16.0%   <- SHIPPED
HEAD(pre)  0.60        ON    |  30 lines  20.0%    27 lines  18.0%   <- RECORDED
HEAD(pre)  0.80        ON    |  27 lines  18.0%    25 lines  16.7%
   band OFF is 26.0% at 0.82 in ALL FOUR cells   <- RECORDED, and invariant
```

| recorded | where it lives | reproduces at |
|---|---|---|
| 26.0% | `RESULTS_BAND.md` P4, `CLAUDE.md`, `NULL_AUDIT.md` §1.1 | **every cell** — band OFF is comparator-invariant here |
| 20.0% | same three | HEAD + `theta_coda` 0.60 + θ 0.82 **only** |
| 18.0% | `RESULTS_MATRIX.md` P5 hand-set, θ 0.85 | HEAD + `theta_coda` 0.60 + θ 0.85 **only** |
| 21.3% | `RESULTS_MATRIX.md` P5 fitted | not re-run — needs a fitted comparator threaded through `infer_chains` |
| **17.3%** | **nowhere yet** | **the shipped comparator, today** |

The decomposition is additive to the line: `theta_coda` 0.60 → 0.80 costs
−2.0 pp on its own, the alignment fix costs −0.7 pp on its own, and together
they cost −2.7 pp. Neither change was ever run against this control;
`CLAUDE.md:288` records the same pair of changes moving the sonnet rate
7.2% → 8.0% and says nothing about Whitman.

**Doctrine 58, in a shape the entry does not yet have.** A recorded rate is a
coordinate of the COMPARATOR, not only of the threshold and the rendering.
Three of the four figures in the dock are the old comparator's, and the audit
that put them there compared them to each other.

### 1.3 And the null moved further than the observation did

```
$ python3 quality/audit_band_control.py 200        # today, shipped comparator
  band OFF   obs 26.0%   null med 19.3%  max 27.3%   excess +6.7 pp   p 0.0547
  band ON    obs 17.3%   null med  8.0%  max 16.7%   excess +9.3 pp   p 0.0050
```
against `NULL_AUDIT.md` §1.1's record, at the same n and the same seed:
```
  band OFF   obs 26.0%   null med 19.3%  max 27.3%   p 0.0547     <- reproduces
  band ON    obs 20.0%   null med 16.7%  max 27.3%   p 0.2090     <- does not
```

The band-OFF row reproduces to the decimal, which is the check that the null
itself is the same null. The band-ON row does not: the **null median halved**,
16.7% → 8.0%.

**The band's effect on the separation has flipped sign.**

| | recorded | measured today |
|---|---:|---:|
| Whitman excess over null median, band OFF → ON | +6.7 → **+3.3** pp | +6.7 → **+9.3** pp |
| Whitman p, band ON | 0.209 | 0.005 |
| Sonnets excess, band OFF → ON | +23.6 → +23.5 pp | +23.6 → **+26.2** pp |

Doctrine 71's sentence — *"a filter that lowers chance and signal together has
not tightened anything"* — is a true sentence about the comparator it was
written against. Under the shipped comparator the band lowers chance **much
faster** than signal on this text, and the negative control separates.

### 1.4 Read the p, not the gap to the null MAX — measured, not argued

Whitman's gap to the null MAX changes SIGN with the seed, because a null MAX is
an extremum and an extremum grows with n. The p does not.

```
$ python3 <scratch>/probe_null_resolution.py 2000     # band ON, shipped
  n=200  seed 20260810   gap to MAX +0.0067   p 0.00498
  n=200  seed 20260811   gap to MAX +0.0267   p 0.00498
  n=200  seed 1          gap to MAX -0.0267   p 0.00995
  n=200  seed 2          gap to MAX +0.0200   p 0.00498
  n=200  seed 3          gap to MAX +0.0200   p 0.00498
  n=2000 seed 20260811   gap to MAX -0.0267   p 0.00550
  n=2000 seed 1          gap to MAX -0.0333   p 0.00650
```

The statistic's own granularity is one line in 150 = 0.667 pp, so every gap in
that column is between one and five lines. This is why
`quality/audit_band_control.py` and `quality/negative_control.py` — two files
running the same null on the same text under the same comparator — disagreed
about whether the observation cleared the null: +0.7 pp in one, −0.67 pp in
the other. **Both are right and the summary is wrong.** Doctrine 57 says an
empirical p at 1/(n+1) reports the resolution; this is its mirror — *a gap to
a null MAXIMUM reports the sample size*, and at n = 2000 it goes negative
while the p sits at 0.006.

`negative_control.py`'s `report()` and `audit_band_control.py`'s both print the
gap-to-MAX as the headline. On a result this close to its null that is the
wrong headline, and the excess over the null MEDIAN plus the p is the right
one.

---

## 2. Whitman is not a negative control, and this half needs no null

§1 is a statement about power. This is a statement about the material, it is
prior to any null, and it is decisive on its own.

```
$ python3 quality/negative_control.py          # P3-LEGACY, new decomposition
  WHAT THE CHAINS ARE MADE OF — 14 adjacent links:
    RHYME       7  (50%)
    REPEAT      7  (50%)
    links on the SAME TOKEN at both ends: 7 (50%)
```

The chains themselves:

```
  L16  (2)  it   -> it    REPEAT 1.00
  L45  (2)  end  -> end   REPEAT 1.00
  L47  (4)  now  -> now   REPEAT 1.00 | now -> now 1.00 | now -> now 1.00
  L110 (2)  own  -> own   REPEAT 1.00
  L136 (2)  laps -> laps  REPEAT 1.00
```

`now` closes four consecutive lines of `Song of Myself`. That is epistrophe,
and doctrine 3 is explicit that REPEAT's sign inverts by context: a violation
inside a verse, the requirement across chorus instances, licensed as
radif/refrain. **Half of this negative control's signal is a relation whose
sign is a function of a context the file does not declare.**

A negative control is a text in which the property under test is ABSENT.
`corpus/whitman.txt` carries line-final sound recurrence, in the one form the
taxonomy says cannot be read without a declared context — so the file was
never eligible for the role, whatever rate it had produced. This is
independent of §1 and it does not go away when the comparator changes.

`MISSING.md` K-2 already found the neighbouring fact — that the file records
no refrain marking for "O Captain! My Captain!"'s burden. This is the same
defect measured on the slice the control actually uses. 115 distinct final
tokens over 150 lines.

---

## 3. §4.2's owed null: built, measured, and an identity map

### 3.1 The construction, and what it preserves

`quality/controls.py:cross_item_redeal`. Rebuild each item word by word,
drawing every replacement from the pooled vocabulary of the OTHER items
(leave-one-out — doctrine 13) and matching on the word's **stress pattern**.

* **PRESERVES** the line count, words per line, syllables per word, hence the
  syllable stream length, the stress grid, the eligible slot set and the
  candidate-pair geometry; also the corpus word-frequency distribution and the
  declaration. Measured: `n_slots` 65.6 → 66.5, `n_pairs` 7566.8 → 7745.9.
* **DESTROYS** which particular words share an item — the item's private
  inventory of rime classes, which is exactly what the owed entry names.
* Draw quality, as three counts and not one: **exact stress-shape 2222,
  syllable-count-only fallback 4, kept 1.**

### 3.2 It destroys the right thing and the statistic does not care

```
$ python3 quality/negative_control.py --spans     # 20 sonnets, theta 0.80, window 32

arm                     n_slots  n_pairs | band_pass   r@theta     min_p
REAL sonnets               65.6   7566.8 |    0.0572    0.0135   0.00253
word scramble              66.0   7376.8 |    0.0601    0.0148   0.00290   1.15x
cross-item redeal          66.5   7745.9 |    0.0599    0.0144   0.00239   0.94x
-- DETECTION FLOOR; neither arm below is admissible as a null --
mono-rime redeal           55.4   5251.7 |    0.4187    0.1452   0.02990  11.83x
dispersed redeal           79.3  10323.6 |    0.0384    0.0079   0.00052   0.21x
```

`band_pass` and `r@theta` ARE the quantity `MISSING.md` L-2 names — the share
of chance re-pairings of the item's own spans that are rhyme relations, and
that clear theta. The word scramble was rejected for preserving it. **The
cross-item redeal preserves it just as exactly** (0.0599 against the
scramble's 0.0601 and the real text's 0.0572), and moves `min_p` by 0.94x
where the scramble moves it by 1.15x — i.e. the purpose-built null is, if
anything, *slightly worse* than the one it was commissioned to replace.

Doctrine 68's differ-count says the arms are not literally identical — 20/20
items move on `band_pass` — so this is not the Persian shape, where replicates
came back byte-for-byte. It is a null that moves the quantity by five percent
and needs to move it by an order of magnitude.

**And the five percent is real, which is the more careful verdict.** The
redeal is itself random, so its single number needs its own distribution
(doctrine 73):

```
REDEAL SEED BAND — min_p over 8 redeal seeds
   min 0.00227   median 0.00239   max 0.00246
   REAL sits at 0.00253 — OUTSIDE the redeal band.
```

Eight seeds, none of which reaches the observation. So the redeal does move
the quantity, consistently and in the predicted direction, by **5.5%**.
Against a detection floor spanning 58x that is *negligible*, not *zero* — a
different verdict from the word scramble's near-identity, and the honest one.
**A null can be REAL and USELESS**, and only the detection floor tells the two
apart from a bare p.

### 3.3 Doctrine 31/76: the instrument is not blind

Before reporting the above as a null, show the measurement CAN move. The two
floor arms replace words from a pool chosen to collapse (mono) or to maximise
(dispersed) rime-class entropy:

* `min_p` spans **58x** between them, 0.00052 to 0.02990.
* `band_pass` spans 11x, 0.0384 to 0.4187.
* The layer's own fixtures agree: `fwer_family.REAL` (one planted rhyme)
  reads 0.0948 / 0.00495 and `fwer_family.SATURATED` (one rhyme class)
  0.2256 / 0.02855.

The instrument reads this quantity with a dynamic range of fifty-eight. The
two candidate nulls move it by a factor of 0.94 and 1.15. **"No movement" is a
reading, not a shrug.**

Neither floor arm is admissible as a control: both change the language's rime
distribution, which is the one thing a matched control may not do. They are
the detection floor and they are reported as such. Both also behave exactly as
the layer's registered guards predict, which is a second check on them:
`mono-rime redeal` is MUTED 20/20 by doctrine 28's `max_null_band_pass`
tripwire (`band_pass` 0.4187, far above the guard), and that is the tripwire
working, not a failure of the arm.

### 3.4 Why — and it is the finding

The quantity is *"how many chance re-pairings of an item's own spans are
perfect rhymes"*. That is the **rime-class entropy of English at this
register**, and it is not a property of the item. Twenty sonnets by one author
have the same rime marginal as any one of them: the leave-one-out pool holds
**269 distinct rime classes over 937 word types**, and a redeal from it
produces an item with the same collision probability as the one it replaced.

So the word scramble is an identity map for the reason `MISSING.md` L-2 gives,
**and a cross-item redeal is an identity map for a deeper one**: re-ordering
English words does not change the language, and neither does re-dealing them.

> **The owed item is misstated, and this is the correction.** "A null that
> destroys the span multiset — across items rather than within one" cannot be
> built out of the corpus's own words, because the span multiset's rhyme
> redundancy is a LANGUAGE CONSTANT and not an item property. The remedy is
> not a better randomisation. Either the statistic stops being a function of
> that constant, or the comparison stops being a null and becomes a
> cross-language one.

**A fifth shape of the identity-map trap, and the first that does not yield to
a better null.** Doctrine 63 caught a predicate symmetric over a line's word
multiset (Finnish). 68 caught permuting identical elements (Persian). 75
caught a null right for one predicate and wrong for another (Sanskrit). 90
caught a right null hung on a wrong statistic (Bilhaṇa). Those four are all
fixable by choosing differently. This one is not: **the statistic is a
function of a property of the language, and no within-corpus randomisation can
be a null for something the corpus holds fixed by being in one language.**

### 3.5 One hypothesis of mine, killed by its own measurement

I predicted `min_p` was pinned at the p-value resolution floor
`1/(n_valid+1)`, which would have made every null an identity map by
arithmetic. **Measured, and false at the shipped setting.**

```
$ python3 <scratch>/probe_pfloor.py
TimeDeclaration.null_samples = 20000  =>  floor 0.00005
  arm                  min_p     min_p == floor
  REAL               0.00253         0/20
  word scramble      0.00290         0/20
  cross-item redeal  0.00239         0/20

sweep null_samples on REAL text:
   100  floor 0.00990  mean min_p 0.01238   16/20 AT THE FLOOR
   200  floor 0.00498             0.00697   14/20
   400  floor 0.00249             0.00449   11/20
   800  floor 0.00125             0.00368    5/20
  2000  floor 0.00050             0.00287    1/20
 20000  floor 0.00005             0.00253    0/20   <- shipped
```

At `null_samples` ≤ 400 the statistic reads the INSTRUMENT: 11–16 of 20 items
sit exactly on the resolution floor and no text could move them. At the
shipped 20000 it reads the text. **`BACKLOG.md` §4.1 owes exactly this sweep**
("Owed: `null_samples` and `window`, measured against the candidate family")
and this is half of it — the `null_samples` half, at `family=scored`. The
regime boundary is between 400 and 2000.

### 3.6 At the honest family the question does not arise — and WHY is now a number

```
family      arm                    mute   mean sat   items>0
scored      REAL sonnets          0/20      29.1%         20
scored      word scramble         0/20      29.0%         20
scored      cross-item redeal     0/20      31.8%         20
scored      mono-rime redeal     20/20       0.0%          0   <- tripwire, correct
scored      dispersed redeal      0/20      59.3%         20
candidate   REAL sonnets         18/20       0.0%          0
candidate   word scramble        16/20       0.0%          0
candidate   cross-item redeal    19/20       0.0%          0
candidate   mono-rime redeal     20/20       0.0%          0   <- tripwire, correct
candidate   dispersed redeal      3/20       0.6%          5   <- FIRES
```

At `family=candidate` — the honest family, per `BACKLOG.md` §4.1 — the layer
produces no event on real English, on scrambled English, or on redealt
English. §4.2 cannot be closed by a null while §4.1 is open, and that ordering
is now measured rather than suspected. Cell T reached the same wall on the
time layer last round by a different route.

**But the last row changes what that wall IS, and it is the most useful line
in this file.** `BACKLOG.md` §4.1 states the open item as *"at the honest
family the layer cannot produce an event at all — at `null_samples=2000` the
Šidák cut (2.5e-4) sits BELOW the p-value floor (5e-4)."* At the shipped
`null_samples=20000` the floor is 5e-5, and the dispersed-redeal arm **does
produce events at the candidate family**: 5 of 20 items fire, mean saturation
0.6%, and only 3 of 20 are muted where real English mutes 18 of 20.

So the honest family is not incapable in principle. It is incapable on English
text, and the binding quantity is the item's rime-class entropy — the same
quantity §3.4 says no null can move. **The layer needs a language, register or
form whose chance rhyme rate is lower than English verse's, not a bigger
corpus of it and not a fourth instrument.** That is a sharper statement of
§4.1's open half than "cannot produce an event at all", and it is falsifiable:
raise an item's rime dispersion and the events appear.

---

## 4. The positive, past English — doctrine 32

`MISSING.md` K-6: *"K-1 built a song corpus and every one of its 143 files is
English."* `corpus/song/` now holds 260 files under seven language prefixes.
The same P2 statistic and the same line-permutation null, with the rhyme
verdict asked of each language's OWN declared phonology — never of CMUdict,
because `quality/phonology`'s commitment 3 forbids a language falling back to
English and doctrine 50 is what a wrong phonology would cost.

```
$ python3 quality/negative_control.py --langs --n=200

lang  files  quatrains   mandated  judged  refused  rhyming | TV obs  null MAX   gap      p
cym       5         18        108       0      108        - | NO `rhymes` PREDICATE
eng     143        793       4758       0     4758        - | NO `rhymes` PREDICATE
fas      31          0          -       -        -        - | 0 four-line blocks
fin      11         85        510     507        3      122 | 0.1360   0.1542  -0.0182  0.0149
ltc      67        524       3144    2988      156      877 | 0.0324   0.0371  -0.0047  0.0100
msa       1          8         48      48        0       36 | 0.1122   0.1122  +0.0000  0.0249
san       2          0          -       -        -        - | 0 four-line blocks
```

**Three languages measured, three families, and NONE separates.** All three
sit at 2.1–3.2x the null median and inside the null's range at n = 200. The
honest reading is power, not absence: 122, 877 and 36 rhyming pairs against
the English arm's 1523, and msa's 8 quatrains are below any floor this repo
would accept (doctrine 72) — its gap of exactly +0.0000 is the observation
landing ON the null maximum, which is a resolution artifact and not a result.

`ltc` is the interesting one: 524 quatrains and 877 rhyming pairs is not a
small stratum, and its profile (d1 0.5325 / d2 0.3158 / d3 0.1517) is at
combinatorial chance (0.5000 / 0.3333 / 0.1667). Either these files are not
four-line rhyming forms, or the 同用 grouping admits enough chance agreement
to wash the position out — 877 of 2988 judged pairs rhyme, 29.4%. Not
diagnosed here; it is a corpus question, not a null question.

**The arms are not commensurable with each other and must not be tabled as a
comparison.** English goes through `lyric_harness.best_score` and the
conjunctive band; fin/ltc/msa go through `Phonology.rhymes`, a boolean with no
theta and no band. Each is interpretable only against its OWN null, which is
how each is reported.

**Two blockers found, and they are different blockers** (doctrine 44):

* `eng` and `cym` declare no `rhymes` predicate, so through this path they
  refuse 100% — 4758/4758 and 108/108. English is not thereby unmeasured; it
  has the whole arm in `negative_control.py`. **Welsh is.** The blocker is the
  MODULE and not the text or the licence — "hard to build", the cheap one.
* `fas` and `san` yield zero four-line blocks. That is a claim about the
  FILE's layout and not about the form: Bābā Ṭāhir's do-baytī *is* four
  hemistichs and the file does not lay them out as four lines. Also cheap, and
  also not a corpus problem.

Neither is doctrine 92's disjoint-sources case. Both are buildable.

---

## 5. What did NOT move

* `python3 battery.py` — `mandated 1064, judged 1014, refused 50`,
  `violations 81 (8.0%)`. Unchanged by everything in this file.
* `quality/negative_control.py`'s English arm reproduces, with drift confined
  to the two tradition groups whose corpus files were edited since the arm was
  written (`eng_british`, `eng_hymn` — five files changed in `debf64e`).
  `eng_hall`, `eng_american`, `eng_parlour`, `eng_celtic`, P3-corpus and
  P3-Whitman reproduce to four decimals; ALL-stratum TV moves 0.2456 → 0.2477.
  The arm's own docstring table is stale in five cells and the cause is the
  corpus, not the comparator.
* Every conclusion of `NULL_AUDIT.md` §1.1 that is a TAXONOMY argument. The
  band still ships on doctrines 3/24; §1 above changes the empirical column
  and touches none of that.

## 6. What this file does NOT claim

* **Not** that the band is now vindicated. §1.3 says the negative control
  separates under the shipped comparator; §2 says the text was never a
  negative control. A control that is not a control does not become evidence
  by acquiring a p-value. The empirical warrant withdrawn in `NULL_AUDIT.md`
  §1.1 stays withdrawn, and this file withdraws the *reason* it was withdrawn
  for as well.
* **Not** that 21.3% is wrong. It was not re-run; it needs a fitted comparator
  threaded through `infer_chains`, which is unbuilt (`NULL_AUDIT.md` §4 says
  the same).
* **Not** that Finnish, Middle Chinese and Malay do not fix rhyme by position.
  Three underpowered arms are three underpowered arms.

## 7. Reproduce

```
python3 battery.py                                  # the invariant
python3 quality/negative_control.py                 # English arm + P3 + P3-LEGACY
python3 quality/negative_control.py --spans         # §4.2, the owed null
python3 quality/negative_control.py --langs         # §4, doctrine 32
python3 quality/audit_band_control.py 200           # §1.3
python3 quality/fwer_family.py --arms               # the L-2 identity map
```
Seed 20260811 throughout `negative_control.py`; replicate *r* is seeded
`SEED + r` (doctrine 66).
