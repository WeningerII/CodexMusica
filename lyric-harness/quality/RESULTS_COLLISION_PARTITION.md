# RESULTS — what a finding on a PASSING song should say

**Date:** 2026-08-11. **Cell:** BB. **Files changed:** `quality/revise.py`,
`quality/test_revise.py`, this file. **Nothing else was edited** — in
particular `examples/never_been_to_a_scene.txt` and `examples/cherokee_bill.txt`
are read-only to this cell and no line of either changed, and this cell
proposes no line change (see §7).

This is the follow-on to `RESULTS_REVISION_LOOP.md` §6, which ended:

> **So: on the mandate the song was written to, the loop has nothing useful to
> say about these 41 lines.**

That was true, and this file is about *why*, which turns out not to be the
reason §6 assumed. The loop was not silent. It was saying twenty-six things,
all in one undifferentiated code, most of them about something other than the
lines they were attached to, and **fifteen of the thirty-eight collisions across
the two songs were claims this same module contradicts three functions away.**

---

## 0 · THE TREE MOVED THREE TIMES WHILE THIS RAN, AND EVERY NUMBER SAYS WHICH SIDE IT IS ON

This cell ran in a parallel round and was told the battery would move under it.
It moved, and so did two other things. Timestamps, because a figure in this
file is meaningless without knowing which comparator produced it:

| 15:36 | `lyric_harness.py` | the coda channel: `coda_agreement` replaces the `cluster_sim` cut |
| 15:41 | `lyric_harness.py` | (second write) |
| 15:45 | `quality/floor.py` | the length profile that covers a song |
| 15:46 | `quality/schemes.py` | `Mandate.returns` — return classes |

**Every measurement in §2 onward is against the tree as of 15:46.** Where a
figure differs from one taken 40 minutes earlier the difference is recorded,
because the shape of that difference is itself a finding (§5).

None of the three is this cell's file and this cell edited none of them. The
`schemes.py` one is *read* rather than duplicated, which is §4.

---

## 1 · VERIFIED FIRST — AND ONE FIGURE IN THE BRIEF DOES NOT REPRODUCE

The block that commissioned this work asserted, for both songs, "26 findings,
every one `SCHEME_COLLISION`". Run:

```
python3 - <<'PY'
import sys; sys.path.insert(0, '.')
from quality.revise import Reviser
lines = [l.rstrip() for l in open('examples/cherokee_bill.txt') if l.strip()]
Reviser().report(lines, "".join(c * 2 for c in "ABCDEFGHIJKLMN"))
PY
```

| claim | `never_been_to_a_scene` | `cherokee_bill` |
|---|---|---|
| passes its declared mandate | ✅ 8/8, 0 violations | ✅ 14/14, 0 violations |
| collisions | ✅ **26** | ❌ **12**, not 26 |
| lines flagged | ✅ 17 | ❌ **6**, not 17 |
| every finding `SCHEME_COLLISION`, severity NOTE | ✅ | ✅ |
| zero candidate fields | ✅ | ✅ |
| `OUT_OF_CALIBRATED_LENGTH` fires | ✅ *(at 15:00; no longer — see §5)* | ✅ *(no longer)* |

**`cherokee_bill` reports 12 collisions and always has.** The 26 is
`never_been_to_a_scene`'s count, and it entered the record through commit
`88be7bf`'s own message ("Four of the 26 collisions this song reports…"). That
commit's own itemisation sums to 12: 4 `wall`/`call` × `floor`/`more`, 4
`will` × `gun`/`outrun`, 2 `kill`/`still`, 2 `will`/`will`. `check_scheme`
agrees with `grade()` at 12 on both sides. Routed to
`PATCHES-not-mine.md` §2 — `BACKLOG.md` and `MISSING.md` are not this cell's.

Everything load-bearing in the brief holds. The song passes and the loop
answers it with a wall of one code and no words.

---

## 2 · THE SECOND CAUSE WAS NOT THE ONE THE BLOCK NAMED, AND IT IS WORSE

The block named two causes: a letter scheme cannot say "refrain", and
`OUT_OF_CALIBRATED_LENGTH`. Both are real. There is a third that nobody had
looked for, and it is the same defect `RESULTS_REVISION_LOOP.md` §1 found in
`_field` — **the brief and the verdict asking different questions** — surviving
in a second place.

`grade()` accepts a mandated pair when `admits()` does: the scalar clears
`theta_rhyme` **and** the relation is in `RHYME_RELATIONS`. That is doctrine
3/24, the conjunctive band, and it is why an ASSONANCE is a named member of the
taxonomy and not a rhyme.

The collision detector twelve lines below it reads the scalar alone:

```python
if s["total"] >= THETA_COLLISION:      # 0.9. No relation test.
    collisions.append(...)
```

…and then the finding said, verbatim, `L9 and L13 rhyme but share no mandated
group`.

**Measured, both songs, current comparator:**

| song | collisions | RHYME | ASSONANCE | REPEAT |
|---|---:|---:|---:|---:|
| `never_been_to_a_scene` | 26 | 12 | **7** | 7 |
| `cherokee_bill` | 12 | 3 | **8** | 1 |
| **both** | **38** | 15 | **15 (39.5%)** | 8 |

Fifteen of thirty-eight pairs are reported as "unintended rhyme" by a module
that would call the identical pair a **violation** if a mandate had put the two
lines in one group. On `cherokee_bill` that is 8 of 12 — **two thirds of
everything the loop says about a song that passes 14/14 is a claim it
contradicts elsewhere in the same run.** And 8 more are REPEAT, which doctrine
3's first sentence says is not rhyme at all.

Under the pre-15:36 comparator the split was 7/38 ASSONANCE rather than 15/38,
because `wall`~`floor` and `ear`~`will` were typed RHYME then. The defect is
not a coordinate of that: it is the *polarity* of the predicate, and it was
there at every comparator this repo has shipped.

---

## 3 · THE DECISION, ARGUED — A COLLISION EARNS NO CANDIDATE FIELD

The block asked for this to be argued rather than assumed, and offered three
options. The answer is the second (partition), the first (candidates) is
**refused on a mechanism rather than on taste**, and the argument is short
enough to check.

### Why not candidates

**A candidate field is generated from a POSITIVE call.** `joint_field` takes
the words a line must ANSWER and intersects their rhyme fields; that is why the
result is small enough to hand to a writer — on this song's own pivot it is
one word, `dove`. A collision is the opposite constraint: *do not rhyme with
this word*. Its satisfying set, measured against the shipped lexicon of 18,010
entries:

| call word | rhyme field | words satisfying "do NOT rhyme with it" |
|---|---:|---:|
| `does` | 189 | 17,821 (98.95%) |
| `ear` | 137 | 17,873 (99.24%) |
| `will` | 215 | 17,795 (98.81%) |
| `floor` | 132 | 17,878 (99.27%) |

A "candidate field" for a collision is not a field. It is a copy of the
dictionary with one rhyme class deleted, and no `offered=24` slice of it means
anything.

**And doctrine 9's mechanism on top of that is worse than useless.** The modal
head of 98% of English is `the, of, and, to, a, in` — the six most frequent
entries in `wordfreq20k.txt`. The modal exclusion exists to push a writer off
the most predictable member of a RHYME CLASS; over a negative constraint there
is no rhyme class for it to be modal *in*, so it would forbid the six commonest
words in the language. **This is the one place where the verse-frequency work
happening in a sibling cell changes nothing**: the defect is the polarity of
the constraint, not the ranking over it. Any distribution gives the same
useless answer.

**The second reason is doctrine 7, and it decides what the loop IS.** The loop
is a floor: rejection, not selection. A collision on a draft with zero
violations is not a rejection — the mandate was satisfied — so offering
replacement words would be ordering the permitted region, which is the one
thing a floor may not do. It would also make the harness decide that an
unmandated rhyme is a defect, and an unmandated rhyme is quite often the best
thing in a song. That is the harness writing for the author, and this project
refuses it.

`test_revise.py` 24 is the permanent form of both halves.

### What is done instead

The collision set is **partitioned and each part is charged to the layer it
belongs to** — which is this repo's own triage rule (ingestion / projection /
anchor / comparator / band / structure / value) applied to the only output the
loop has on a passing song, and it is what the harness promises on its first
page: *locate the defect, name the layer, hand the line back.*

**The SET does not change.** It is still every pair at or above
`THETA_COLLISION = 0.9` sharing no mandated group, still exactly
`check_scheme`'s, and the two constants must not drift. What changes is what
each member is CALLED and who it is addressed to. Typing a finding is not
moving a threshold.

---

## 4 · THE THREE PARTS

### (a) `MANDATE_GROUPS_INDISTINGUISHABLE` — the projection layer

Two disjoint mandated groups where **every** cross pair is already a collision
**and** every cross pair would satisfy the mandate (`admits()` or REPEAT). That
conjunction says one checkable thing: *merge these two groups into one and the
mandate still holds.* It is reported once, about the mandate, with every edge
listed as evidence — instead of N times about N innocent lines.

```
never_been_to_a_scene   4 merges absorbing 16 of 26 collisions
    A[13,17] + E[33,37]   B[14,16] + F[34,36]
    C[15,19] + G[35,39]   D[18,20] + H[38,40]
cherokee_bill           1 merge  absorbing  4 of 12
    B[3,4]   + N[27,28]
```

Those 16 are **exactly** the 16 the block identified by hand as "the chorus
coming back" — recovered from the graph alone, with no blueprint, no section
name and no `Section.function`. `test_revise.py` 21 asserts the set equality
against the blueprint's section labels, which `group_merges` never reads.

**It absorbs and never adds.** Requirement (a) — that every cross pair already
be a collision — is not decoration. Without it the rule fires on
`cherokee_bill`'s C[5,6] and H[15,16] (`man`~`gun` at 0.878, which satisfies
the mandate jointly and is *not* a collision) and the loop would be volunteering
an opinion about a rhyme the writer did not make, on a song that passes 14/14.
That is the failure mode this whole file is about, reintroduced by the fix for
it. `test_revise.py` 23 pins `merged ⊆ collisions` and
`merged ⊎ residual = collisions` exactly.

**AND IT DOES NOT DECIDE THAT A RETURN HAPPENED.** A section returning and a
rhyme sound reused by accident are the same picture in a score, and nothing in a
number separates them. So the finding names both readings and stops:

> If it is a return, declare it and these stop being findings; if it is not,
> one of the two groups needs a different sound.

### (b) The sibling contract, read rather than duplicated

`quality/schemes.py` shipped `Mandate.returns` at 15:46 — return classes, sets
of line numbers that are THE SAME LINE. `Reviser._declared_return` reads it: two
groups are one section coming back exactly when return classes LINK them.
Declared → `GROUPS_DECLARED_RETURN`, *the form and not a defect*. Not declared →
derived from the graph, and the finding says DERIVED and asks (doctrine 14).
A `Mandate` with no `returns` is read exactly as it was.

The hook DISCRIMINATES, which is the check that it is doing work rather than
agreeing:

```
never_been_to_a_scene with returns=((13,33),(17,37),(15,35),(18,38),(19,39)):
  A+E  GROUPS_DECLARED_RETURN
  B+F  MANDATE_GROUPS_INDISTINGUISHABLE   <-- still derived, and correct
  C+G  GROUPS_DECLARED_RETURN
  D+H  GROUPS_DECLARED_RETURN
```

B+F stays derived because L16 ends `drive` and L36 ends `alive`: they are not
the same line, so no return class links them. **The chorus's fourth line is the
one that moves, and the mechanism can tell.** `test_revise.py` 23 pins 3 and 1.

### (c) `NEAR_COLLISION` / `REPEAT_ACROSS_GROUPS` — doctrine 3, doctrine 24

The residue is typed by relation, and doctrine 24 governs: a rule that would
delete a category must relabel instead. An ASSONANCE running across a song is a
real sonic event and dropping it from the collision set would be the worse
defect. So nothing is deleted; three names replace one, and the harness can say
more afterwards, which is doctrine 24's own test.

The *argument* is printed once, at the draft level
(`COLLISION_CUT_IS_SCALAR_ONLY`), not under every pair — repeating it eight
times is the shape of the BACKLOG §1.5 defect, which "does not hide a finding,
it hides the OTHER findings underneath it".

### (d) Two smaller things the run forced

- **`verify()` kept its resolution.** A whole-draft finding keyed on
  `(0, code)`, which was right while every one was unique per draft and stopped
  being right the moment a draft could carry four merges: dissolving one would
  leave the code present and `verify` would report *nothing was fixed* about a
  revision that fixed something. A whole finding with locations now keys on its
  first line. Still a 2-tuple, still sorts, one key per finding.
  `test_revise.py` 23 rewrites L37 `go`→`leave` and asserts
  `(13, 'MANDATE_GROUPS_INDISTINGUISHABLE')` appears in `fixed`.
- **A note is not a flag, and the header counted them the same.** It printed
  `17 line(s) flagged` while all 17 carried nothing but severity-`note`
  collisions — a certificate of 17 problems on a draft with zero. It now reports
  the two counts separately (doctrine 79's shape, one layer up), and when
  nothing carries a flag it says so in a sentence.
- **The brief never printed a finding's EVIDENCE** — the score, the two words,
  the reason. A brief reading `SCHEME_VIOLATION: L15 and L19 do not rhyme`
  withheld everything the finding measured, and a reader could not tell a 0.74
  from a 0.20. It prints now.

---

## 5 · THE BRIEF, VERBATIM, ON A REAL LINE

`cherokee_bill`, the whole head plus one line, exactly as it prints today:

```
REVISION BRIEF — 0 line(s) TO REVISE, 5 carrying notes only, of 28
  NO LINE REQUIRES REVISION. The draft satisfies every one of the 14 pair(s)
  its mandate declares. The 5 line(s) below carry NOTES — things the loop
  observed and does not ask you to change. None of them earns a candidate
  field and that is a decision, not a gap: see `brief`'s 'WHY A COLLISION
  EARNS NO FIELD'.
  candidate field: field_depth=complete pool, field_band='grader';
  modal_exclusion=6; group_merge='report'; frequency source wordfreq20k.txt
  [whole draft] MANDATE_GROUPS_INDISTINGUISHABLE: groups B [3, 4] and N [27,
      28] would pass as ONE group — every cross pair rhymes — so the mandate
      splits a group the graph does not, and each of the 4 cross pairs is
      reported as a collision purely because the letters differ (lines 3, 4,
      27, 28)
      derived from the rhyme graph; the mandate cannot state a return
      (doctrine 2 ...). THIS DOES NOT SAY WHICH IT IS: a section returning and
      a rhyme sound reused by accident are the same picture in the graph, and
      the loop does not read intent out of a score. If it is a return, declare
      it and these stop being findings; if it is not, one of the two groups
      needs a different sound. Edges: L3~L27 'kill'~'still' 1.000 RHYME;
      L3~L28 'kill'~'will' 1.000 RHYME; L4~L27 'will'~'still' 1.000 RHYME;
      L4~L28 'will'~'will' 1.000 REPEAT
  [whole draft] COLLISION_CUT_IS_SCALAR_ONLY: 8 of the 12 collision(s) on this
      draft are NOT rhymes under this harness's own band, and the collision
      detector reported them anyway
L13: It wasn't law that took him down, it was a friend's own floor:
    - [note] NEAR_COLLISION: L9 (E) and L13 (G) collide as ASSONANCE, WHICH IS
      NOT A RHYME — 'wall' ~ 'floor' 0.996 ASSONANCE
        scalar 0.996 >= 0.9 (the collision cut) but `admits()` is FALSE (the
        mandate cut), so this same module would call the pair a VIOLATION if
        L9 and L13 were mandated together. See the whole-draft note below
    - [note] NEAR_COLLISION: L10 (E) and L13 (G) collide as ASSONANCE, WHICH IS
      NOT A RHYME — 'call' ~ 'floor' 0.996 ASSONANCE
        ...
```

Against the same 28 lines this morning:

```
REVISION BRIEF — 6 line(s) flagged of 28
  [whole draft] OUT_OF_CALIBRATED_LENGTH: 327 tokens is outside every
      calibrated length; the length-sensitive checks did not run
L13: It wasn't law that took him down, it was a friend's own floor:
    - SCHEME_COLLISION: L9 and L13 rhyme but share no mandated group
    - SCHEME_COLLISION: L10 and L13 rhyme but share no mandated group
    keep unchanged: ...
```

Which of those a writer can use is not a close question, and the difference is
not that the second was made gentler. It is that the second said `rhyme` about
a pair the harness does not call a rhyme, and did not say so.

**`OUT_OF_CALIBRATED_LENGTH` is gone from both songs** as of 15:45 — the floor
cell's length profile now covers 327 and 291 tokens, so the length-sensitive
half runs. That is not this cell's change and this cell claims none of it. Its
consequence here is that `never_been_to_a_scene` now carries 14
`ANAPHORA_OVERLOAD` findings at severity `flag`, so the answer to "does the
loop have anything to say about this song" changed from *no* to *yes* on
another cell's work, in the middle of this one. **`cherokee_bill` still has
zero lines to revise.**

---

## 6 · SO WHAT DOES A FINDING ON A PASSING SONG SAY?

It says which layer it is about, and it does not offer a word.

Across both songs, 38 collisions become:

| | | |
|---|---:|---|
| the MANDATE, said once per group pair | 20 edges → **5 findings** | the projection cannot say "refrain" |
| the BAND, said once per draft | 15 edges | a near-relation, reported as a rhyme |
| the VALUE layer, said on the line | **3** | `does`/`mailboxes`, `does`/`winters`, `heat`/`receipt` |

**Three.** Three of thirty-eight are a rhyme the writer made without asking for
it, between two lines the mandate declares free, and those three are the only
part of the whole output that is about the writing. The loop is not silent on
these songs and it never was — it was miscounting one true sentence about a
mandate as sixteen accusations, and calling fifteen near-relations rhymes.

And on the honest version of §6's original claim: **after the partition, the
loop still has nothing to ASK of either song.** `cherokee_bill` has zero lines
to revise; `never_been_to_a_scene`'s flags all come from another cell's length
profile. That is the correct outcome for two drafts that pass their mandates
outright, and stating it plainly is the point — a floor that finds nothing on a
clean draft is a floor working, provided it is not also printing seventeen
things that look like problems.

---

## 7 · WHAT THIS CELL DID NOT TOUCH

- **The songs.** No line changed and none is proposed. There is no line this
  cell would ask to change: every finding on either song after the partition
  belongs to the mandate, the comparator or the floor. Proposing a rewrite to
  silence one would be the mistake a sibling correctly refused this round.
- **The threshold.** `THETA_COLLISION` is 0.9 and the collision SET is
  bit-identical to `check_scheme`'s, asserted in `test_revise.py` 23.
- **The comparator.** `test_revise.py` 13's third check — `grade()` against
  `check_scheme` pair for pair across all 152 sonnets — is unchanged and
  passing. Confirmed twice: the same five suite failures appear with **HEAD's**
  `revise.py` swapped back in, so none of them is this cell's.
- **`quality/schemes.py`, `quality/floor.py`, `lyric_harness.py`,
  `BACKLOG.md`, `MISSING.md`, `data/sources.tsv`** — read, not written.
  `PATCHES-not-mine.md` carries four items for them.

---

## 8 · BACKLOG §1.5, CLOSED ON THE MECHANISM

> `SHARED_SUFFIX` printed six times identically for one line.

Re-measured today by removing the `seen` key from `Reviser.inspect.add()` and
re-running the pre-`93a21f4` append:

```
theta_coda=0.80  declared mandate  max repeat 0
theta_coda=0.80  derived cover     max repeat 2   L1 SHARED_SUFFIX x2
theta_coda=0.60  declared mandate  max repeat 0
theta_coda=0.60  derived cover     max repeat 2   L1 SHARED_SUFFIX x2
SHIPPED path, both mandates: 0 duplicate (line, code) pairs
```

**Six appears at no setting**, and — a second turn of doctrine 58 —
`RESULTS_REVISION_LOOP.md` §7's own `theta_coda=0.60` figures (L1 ×4, L6 ×3) no
longer reproduce either, because `Declaration.coda_agreement` now defaults to
`"licensed"` and `theta_coda` governs only the `"scalar"` shape. A count that
was a coordinate of a threshold is now a coordinate of a threshold that no
longer governs. **The conclusion is unaffected and re-confirmed**: §1.5 closes
on the `seen` key, not on the number. `BACKLOG.md` is not this cell's file;
`PATCHES-not-mine.md` §3 carries the wording.

---

## 9 · TEST AND BATTERY STATE

```
python3 quality/test_revise.py       -> 94 PASS, 4 FAILING, all four the
                                        comparator's and annotated as such
python3 quality/test_floor.py        -> all slop-floor regressions pass  [exit 0]
python3 quality/verify_doctrines.py  -> RESULT: PASS                     [exit 0]
python3 battery.py                   -> mandated 1064, judged 1014, refused 50,
                                        violations 82 (8.1%)             [exit 0]
                                        Whitman 10.7% chained
```

**The battery moved and this cell did not repin it. Cell BA did, with the
argument.** It read 81 pinned / 82 measured and exited 1 mid-round; by the end
`battery.EXPECTED` is 82 and it exits 0, repinned on the coda channel with the
price stated. Whitman went 17.3% → 10.7% in the same move. This cell touched
nothing the oracle reads.

One consequence for this file: test 13 held a SECOND COPY of the oracle's pin
as a literal `(1064, 1014, 50, 81)`, so it went red on a number it does not own
and cannot argue. It now reads `battery.EXPECTED`. **That is a dedupe, not a
repin** — doctrine 48's "a roster copied into two files drifts in both", and the
claim test 13 exists to make (that `grade()` and `check_scheme` do not disagree)
never depended on where the oracle sits. That check and the pair-for-pair
violation-SET comparison across all 152 sonnets both pass.

The four remaining failures, each named with its cause, each carrying `CAUSE`
in its own printed detail so the red is self-explaining rather than a mystery
for the next reader:

| check | cause |
|---|---|
| its maximal cliques OVERLAP | comparator: the `ear`~`will` edge is gone, so 6 cliques and no pivots |
| the song's own clique cover has no letter scheme | same |
| a derived cover IS independent once the band moves | same |
| over the complete pool the pivot is satisfiable | comparator: `love`/`above`/`glove` no longer admit against `five` |

They are LEFT RED deliberately. Each is a claim about the song that the
comparator falsified today, and repinning them here would bury a real finding
about the coda change under a green suite — the layer that moved is the
comparator and the argument belongs to the cell that moved it.

**Proof they are not this cell's, rather than an argument:** `git show
HEAD:…/revise.py` was swapped in over this cell's version and the suite re-run.
The same failures appeared, plus test 21 in its old form. Restored immediately;
`revise.py` is this cell's file alone.

`test_revise.py` gains 23 (the partition — absorbs-never-adds, exact partition,
set equality with `check_scheme`, the typing, the declared-return hook, and
`verify`'s resolution) and 24 (the candidate-field decision, measured). Both
pass. Test 21 was rewritten: it used to pin `== 26` and `== 16`, and both are
coordinates of a comparator that changed under it mid-round, so it now pins
that the chorus's returns are a MAJORITY of the collision set and that
`group_merges` recovers exactly them — which is a property of the song rather
than of the cut (doctrine 58/91).
