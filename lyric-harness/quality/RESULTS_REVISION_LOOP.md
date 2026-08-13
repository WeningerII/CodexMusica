# RESULTS — the revision loop, run end to end on the song this repo wrote

**Date:** 2026-08-11. **Cell:** AF. **Files changed:** `quality/revise.py`,
`quality/test_revise.py`, this file. **`examples/never_been_to_a_scene.txt`
was NOT touched** — it is read-only to this cell and no line of it changed.

`quality/revise.py` has had tests since it was built. What it had not had was
a run against the real 41 lines with a real mandate, start to finish, with the
output READ rather than counted. This is that run. Three of the defects below
were invisible to a green suite for exactly the reason doctrine 94 gives: every
test in `test_revise.py` 1–17 was a positive case against a four-line fixture,
and a rule that is too generous passes every positive case by construction.

---

## 0 · WHICH MANDATE, SAID FIRST

There are two correct structural readings of this song and they disagree,
because they are read at different values of `promote`. Doctrine 91: a count is
a coordinate of the rendering. Every number below names its reading.

| reading | promote | REPEAT edges | groups | pivots | mandated pairs |
|---|---|---|---|---|---|
| `graph` / `rhyme_graph` | `False` | not admitted | **8** | **1** (L27) | — |
| `brief --cliques` / `mandate_from_graph` | `True` | admitted | **12** | **5** (L1, L26, L27, L29, L32) | **53** |
| the author's declared letter mandate | `True` | n/a | **8** | 0 | **8** |

**Everything in §1–§5 is driven with the second reading** — `promote=True`,
12 groups, 5 pivots, 53 pairs — because it is the one that produces findings.
`graph` would have given 8 cliques and 1 overlapping node, which is what
`BACKLOG.md` §1.4 already records. §6 is the third.

The derived cover carries `source="derived"` and prints
`MANDATE_NOT_INDEPENDENT` on every run (doctrine 14). That is honest and it is
also the thing that limits what §1–§5 can be evidence *for*: the rhyme
verdicts against a cover read off the rhyme graph are identities. What is
still evidence is everything the band did not decide — the floor, the
refusals, the REPEAT edges the graph admits and a mandate rejects, and the
CANDIDATE FIELD, which is where all four defects below live.

Reproduce:

```
python3 - <<'PY'
import sys; sys.path.insert(0, '.')
from quality.revise import Reviser
lines = [l.rstrip() for l in open('examples/never_been_to_a_scene.txt') if l.strip()]
r = Reviser(); r.report(lines, r.mandate_from_graph(lines))
PY
```

---

## 1 · THE BRIEF AND THE VERDICT WERE ASKING DIFFERENT QUESTIONS

`grade()` accepts a mandated pair when `admits()` does: the scalar clears
`theta_rhyme` **and** the relation is in `RHYME_RELATIONS`. That second half is
the conjunctive band, doctrine 3/24 — an ASSONANCE is a named member of the
taxonomy and it is not a rhyme.

`_field()`, which builds the words the brief hands a writer, kept the first
half and dropped the second:

```python
res = self.engine.candidates(w, n=200)
passing = [c["word"] for c in res.get("candidates", [])
           if c["score"] >= self.decl.theta_rhyme]      # scalar only
```

**Measured, on the song's own flagged lines: 58 of 336 offered words (17.3%)
were words `grade()` calls a non-rhyme.** Taking one MANUFACTURES the violation
the brief was written to remove. It concentrated on the cluster codas —
`ones` at 15/24, `went`/`sent` at 7/24 — and left the open syllables clean, so
a spot check on `slow`/`go` would have found nothing.

The brief for L6 as shipped, verbatim:

```
L6: by which dogs are out, by which bridge floods
    - SHARED_SUFFIX: 4 pair(s) rhyme only on a shared grammatical ending
    must answer group E [6, 27]: L27 ('ones')
    FORBIDDEN (modal ...): of, from, one, some, does, terms, floods
    offered: love, come, programs, above, girls, month, sun, become, run, once, months, fun ...
```

`love`, `come`, `above`, `sun`, `run`, `once`, `fun`, `done` — every one is
ASSONANCE against `ones` under the shipped band, and every one would have been
reported as a SCHEME_VIOLATION on the next pass.

The same defect runs in the other direction, because the FORBIDDEN list is the
head of the same population: **29 of 101 forbidden entries were not in the
field at all.** For `ones`, five of the six words doctrine 9 named as the slop
direction (`of`, `from`, `one`, `some`, `does`) were words no writer could have
taken; only `terms` was real. The exclusion was running at 1/6 strength on that
line while printing six words.

**FIXED.** `_field_one` now applies `admits()` — the grader's own predicate,
computed with `best_score` over every pronunciation variant, which is what
`grade()` uses. After the fix: **0 of 338 offered words (0.0%)** are ones the
grader rejects. The pre-fix predicate stays reachable as
`ReviseDeclaration(field_band="scalar")`, so the defect is demonstrable rather
than a sentence nobody can check — the argument that keeps `modal_exclusion=0`
reachable (doctrine 84). `test_revise.py` 18 pins both halves.

---

## 2 · "THE MANDATE, NOT THE LINE, IS WHAT NEEDS REVISING" WAS A CONSTANT

The strongest claim this loop can make is `joint_conflict`. On a pivot — a line
in two groups — it reports that no word in the lexicon answers all of them, and
it tells the writer to revise **the mandate**. On this song it fired on L1, L14
and L34.

It was wrong on L14 and L34. The pivot there must answer `does`, `five`,
`drive`, `of` and `alive` at once. Seven words do:

```
above  buzz  dove  glove  gov  love  thereof
```

Each of the seven passes the grader against each of the five call words. The
intersection came out empty only because `_field` truncated each per-call pool
at a hard-coded `n=200`, and `love` sits below rank 200 in three of the five
score-ordered pools. **The claim was never about the lexicon. It was about a
literal nobody had written down** — doctrine 58, and doctrine 91's axis: the
count that was a coordinate here is a count of ZERO.

The same literal decided which words are modal. **The modal-6 differs between
depth 200 and the complete pool on 10 of the song's 11 call words.** On
`clear`, depth 200 gives `will their there here year software` and the complete
pool gives `in is this with it an`.

**FIXED.** `ReviseDeclaration.field_depth` is a declared coordinate whose
default is `None` = the **complete pool**, and every brief now prints
`field_depth=…, field_band=…` beside the counts those settings produce.
`test_revise.py` 19 pins the old value's behaviour and the new one's.

L14 after the fix, verbatim — and this is a brief a writer can act on, because
it says exactly how much room the mandate leaves:

```
L14: I will find you on line five
    - REPEAT_IN_VERSE: 7 pair(s) rhyme a word with itself
    must answer group A [1, 14, 16, 26, 34, 36]: L1 ('does'), L16 ('drive'),
        L26 ('of'), L34 ('five'), L36 ('alive')
    FORBIDDEN (modal ...): love, above, thereof, buzz, glove, gov, five
    offered: dove
```

Seven words in the field, six of them modal, one left. `dove`.

---

## 3 · THE MODAL EXCLUSION IS REAL, AND WHAT IT IS MODAL *IN* IS THE WEB

Doctrine 9 is mechanical (doctrine 48) and after §1–§2 the mechanism reads the
right population: the forbidden set is now the frequency head of the grader's
own field, and **98 of 113 forbidden entries are in that field** — the other 15
are the current end words, which `brief` appends by hand and which are excluded
from their own field because a word does not rhyme with itself.

Two things it is NOT, and both were asked for:

**(a) It is not modal in song.** `lex.freq_rank` is `wordfreq20k.txt`, and the
ranks say what kind of list that is:

| word | rank | | word | rank |
|---|---:|---|---|---:|
| `email` | 114 | | `moon` | 2800 |
| `software` | 151 | | `rain` | 2946 |
| `yahoo` | 498 | | `dust` | 4565 |
| `browse` | 602 | | `grief` | 10699 |
| `subscribe` | 866 | | `sorrow` | 14620 |
| `gmbh` | 7442 | | `weep` | *absent* |

It is a web-crawl frequency list. So "the most predictable word in the field"
means most predictable **on the 2000s web**, and the direction doctrine 9
pushes away from is only approximately the one it names. It shows on the page:
the first word this loop OFFERS as the non-obvious alternative for the chorus's
`ear`/`clear` rhyme is `software`.

**The file has no row in `data/sources.tsv`.** Doctrine 34 — "Every corpus file
must have a row in data/sources.tsv, including the local ones… a file with no
row is the defect" — and doctrine 13, which counts frequency lists as
resources by name. `data/sources.tsv` is not this cell's file; the row is owed
and named in `PATCHES-not-mine.md`. There is no verse-frequency list in this
repo to swap in, so this is a declaration gap, not a fix that was skipped.

> **WIRED CLOSED 2026-08-11.** Every claim in this section describes the state
> before the fix and is kept as the record of why it was needed (doctrine 17).
> `wordfreq20k.txt` now has a row in `data/sources.tsv`, `lex.freq_rank` reads
> `data/opensubtitles_en_50k.tsv` instead of it, and `quality/revise.py`'s
> `Reviser.joint_field` ranks primarily by the call-conditional table this
> repo built afterward (`quality/frequency.py`'s `eng-song` cell) rather than
> by any global rank. Re-measured: `R.modal_field("fire")` now forbids
> `desire, higher, conspire, sire, choir, tire` — `email` and `software` are
> gone, and `desire` is ranked FIRST, ahead of every other word, because it is
> the partner writers in `corpus/song/` reached for 95 times against the next
> word's 16. See §3(b) below: this is the pair doctrine 9 is explained with,
> and the old mechanism's failure to catch it is now closed too.

**(b) It does not catch its own worked example.** `CLAUDE.md` and
`revise.py`'s docstring both explain doctrine 9 with `fire`/`desire`:

> "Passing the band by taking `fire`/`desire` is exactly the failure the whole
> quality layer was built to detect"

Measured: `desire` sits at position **136** of `fire`'s band-filtered field.
`fire`'s forbidden set is `our, other, data, power, water, another`.
`desire`'s forbidden set contains no `fire`. A revision from `dog` to `desire`
against a `fire` mandate **is** rejected — but by rule 2, the net-new rule,
because `fire`/`desire` is on `floor.py`'s hard-coded `CLICHE_PAIRS` list. The
modal exclusion had nothing to do with it. **Doctrine 9's mechanism does not
catch the pair doctrine 9 is explained with**, and a modal-but-not-clichéd pair
in the same shape has nothing stopping it. That is not a defect in the
implementation — the implementation is doing precisely what the doctrine says
— it is a finding about the doctrine's example, which describes *cliché*, and
cliché is a different feature that the floor already owns.

> **CLOSED 2026-08-11**, and by the mechanism this finding said was missing,
> not by the cliché floor. Re-measured: `R.modal_field("fire")` forbids
> `desire, higher, conspire, sire, choir, tire` — `desire` is now ranked
> FIRST of six, at a measured 95 realised occurrences against `corpus/song/`
> to the runner-up's 16, because the conditional table this repo built after
> this finding (`quality/frequency.py`'s `eng-song` cell) ranks by what a
> writer actually paired `fire` with, not by how common a candidate is on the
> web. A revision from `dog` to `desire` against a `fire` mandate is now
> rejected by rule 2 (modal exclusion) as well as rule 2's net-new check —
> redundant on this exact pair, but no longer ABSENT on the
> modal-but-not-clichéd pairs this section warned had nothing stopping them.

---

## 4 · WHAT THE FORBIDDEN WORDS ACTUALLY ARE

Doctrine 94's method, applied one layer later than `redteam_band.py` applied
it. Reference line: strict identity of the tail-aligned nucleus and coda,
**declared as a REFERENCE and not as truth**, because a band tuned to agree
with identity would delete slant rhyme, which is the point of having a band.

**4 of 54 (7.4%)** of the words this loop names as "the modal candidate, the
slop direction" are strict-identity rhymes of their call word. The other 50 are
admitted by the band's licences. Per field:

| line | calls | forbidden | strict-identity |
|---|---|---|---:|
| L13/L17/L33/L37 | `go` `slow` | to you new do no so | 2/6 (`no`, `so`) |
| L6/L24 | `ones` | and find years terms hotels send | 0/6 |
| L15/L19/L35/L39 | `ear` `clear` | will their there here year email | **0/6** |
| L18/L20/L38/L40 | `went` `sent` | help send link end think since | 0/6 |
| L14/L34 | `does` `five` `drive` `of` `alive` | love above thereof buzz glove gov | 0/6 |

The `ear`/`clear` row is the one to read. `ear` ~ `will` scores **0.996** and is
typed **RHYME**. The mechanism is two licences stacking, and neither is a
threshold:

- CMUdict gives `ear` a second pronunciation `IH R`, and `best_score`
  maximises over variants, so the nucleus is `IH`~`IH` — identity, 1.0.
- `cluster_sim(['R'], ['L']) = 0.9875`. The conjunctive coda rule
  (`theta_coda = 0.80`) exists to stop a strong nucleus buying a weak coda, and
  it never fires, because a lateral coda and a rhotic one are 0.9875 similar.

**No value of `theta_coda` reaches this.** It is a fact about `cluster_sim`'s
feature table, not about the cut, and doctrine 94's held-out
`theta_coda` 0.60 → 0.80 move could not have found it. So on this song's
largest rhyme group the six words doctrine 9 forbids include three
(`will`, `their`, `email`) that are not rhymes of `ear` by any ear, and the
first alternative offered is `software`. `lyric_harness.cluster_sim` and
`quality/rhyme_constraints.py` are not this cell's files;
`PATCHES-not-mine.md` carries it.

---

## 5 · THE FOUR REJECTIONS, ON 41 REAL LINES

Doctrine 47 — a loop that only checks the line it was told to fix is a rubber
stamp. Doctrine 94 — construct the failing cases. All four fire on this song's
shape, and the accept case is run beside them so that "rejected" is not simply
what this loop always says. `test_revise.py` 20 is the permanent form.

| # | constructed revision | verdict |
|---|---|---|
| 4 | 41 lines in, 40 out (L41 dropped) | REJECTED — `line count changed 41 -> 40; the loop revises lines, it does not restructure the draft` |
| 3 | L33 targeted, L41 also rewritten | REJECTED — `lines [41] were changed but not targeted; revise flagged lines only` |
| 2 | L33 ends on `to`, the head of its own field | REJECTED — `L33 took the modal candidate 'to' — it passes the band and it is the most predictable word in the field` |
| 1a | L33 ends on `clear`: fixes its REPEAT with L13, breaks group G | REJECTED — `introduced 2 new finding(s) [(33, 'SCHEME_COLLISION'), (39, 'SCHEME_COLLISION')] while fixing 1` |
| 1b | the same defect fixed at L13 instead: breaks L13/L17 *and* L13/L37 | REJECTED — `introduced 3 new finding(s) … while fixing 2` |
| 0 | L33 ends on `who`, an offered candidate | **ACCEPTED** — `fixed 2, introduced 0, changed only [33]` |

Rule 2's per-line report (`modal_violations`) and rule 1's finding diff both
name what moved, so the rejection is a location and not a score (doctrine 6).

Note what case 1b demonstrates that the four-line fixture could not: the
targeted line was L13 and **two of the three new findings are on other lines**,
L17 and L39. A loop that accepted on "the flagged finding is gone" would have
taken it.

---

## 6 · AND ON THE MANDATE THE SONG WAS ACTUALLY WRITTEN TO — NOTHING

This is the finding the block asked for plainly, so it is stated plainly.

The author's declared mandate is a letter string,
`XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX`: the two choruses rhyme ABCB/ADCD
and EFGF/EHGH, and the other 25 lines are declared free. Against it:

```
  mandated 8   judged 8   refused 0   violations 0   collisions 26

REVISION BRIEF — 17 line(s) flagged of 41
  [whole draft] OUT_OF_CALIBRATED_LENGTH: 291 tokens is outside every
      calibrated length; the length-sensitive checks did not run
```

**Every one of the 17 flagged lines carries exactly one finding code:
`SCHEME_COLLISION`. Not one earns a candidate field**, because
`SCHEME_COLLISION` is not in `RHYME_FINDINGS`. So the brief on the mandate this
song was written to contains **zero words a writer could act on**, and its
17-line flag list is not a list of 17 problems.

And 16 of the 26 collisions are **the chorus coming back**:

```
  L13(chorus) ~ L33(chorus2)   'slow' ~ 'slow'    1.000 REPEAT
  L14(chorus) ~ L34(chorus2)   'five' ~ 'five'    1.000 REPEAT
  L15(chorus) ~ L35(chorus2)    'ear' ~ 'ear'     1.000 REPEAT
  L17(chorus) ~ L37(chorus2)     'go' ~ 'go'      1.000 REPEAT
  L18(chorus) ~ L38(chorus2)   'went' ~ 'went'    1.000 REPEAT
  L19(chorus) ~ L39(chorus2)  'clear' ~ 'clear'   1.000 REPEAT
  L20(chorus) ~ L40(chorus2)   'sent' ~ 'sent'    1.000 REPEAT
  … and 9 more joining each chorus line to its group-mate's return
```

A letter scheme cannot say *these two groups are the same words*, so it is
forced to give chorus and chorus2 different letters — and the collision
detector then reports, as "unintended rhyme across groups", the identity the
projection was forced to hide. Doctrine 2, in the most concrete instance this
repo has: **the loss in the lossy projection is not an approximation, it is a
false accusation.** `test_revise.py` 21 pins it.

The other layer is quiet for a declared reason. `OUT_OF_CALIBRATED_LENGTH`
means 291 tokens sits outside both calibrated profiles (section 29–37, sonnet
108–126, ×2 tolerance), so every length-sensitive check — MATTR, anaphora,
line-length CV — **did not run at all** (doctrine 15). The relation-level half
did run, and against 8 mandated pairs it found nothing: no `CLICHE_PAIR`, no
`SHARED_SUFFIX`, no `REPEAT_IN_VERSE`. The value layer's findings on this song
are entirely a coordinate of how many pairs the mandate declares — 53 pairs
(derived) produce 3 `SHARED_SUFFIX` and 7 `REPEAT_IN_VERSE`; 8 pairs (declared)
produce none.

**So: on the mandate the song was written to, the loop has nothing useful to
say about these 41 lines.** Everything actionable in this whole run came from
the derived cover, which prints `MANDATE_NOT_INDEPENDENT` on itself.

### What would make it useful

Three things, in order of how much they would buy:

1. **A length profile that covers a song.** 291 tokens is a normal lyric sheet
   and it falls outside every profile, so the entire length-sensitive half of
   the floor is dark on the only song this repo has. Doctrine 15 is being
   obeyed exactly and the cost is that the value layer is half off. This needs
   a human-verse calibration at song length, which is a corpus question
   (doctrine 32), not a threshold question.
2. **A collision detector that knows a return from an accident.** 16 of 26
   collisions here are a section repeating. `Section.function` exists for
   exactly this and is `None` on all seven sections of this blueprint, so
   nothing can currently read it. With it declared, chorus↔chorus2 collisions
   become the REFRAIN they are, and 26 findings become 10.
3. **`SCHEME_COLLISION` earning a field.** It is the only code the declared
   mandate ever emits and it is the one code that offers nothing. Whether it
   *should* is a real question — a collision may be a virtue — but "17 lines
   flagged, no instructions" is not a useful state either way.

---

## 7 · TWO THINGS CHECKED AND FOUND NOT AS RECORDED

**`BACKLOG.md` §1.5 — "duplicate findings in the brief".** The entry reads:

> `SHARED_SUFFIX` printed six times identically for one line. Cosmetic, one
> line of code, actively obscures the real findings.

**The acceptance is MET and the figure does not reproduce.** The shipped path
emits zero duplicate `(line, code)` pairs on the song — the `seen` key in
`Reviser.inspect.add()`, added in `93a21f4`. Removing that key and re-running
the pre-fix append gives **L1 `SHARED_SUFFIX` ×2** at the shipped
`theta_coda=0.80`, and **L1 ×4 plus L6 ×3** at the old `theta_coda=0.60`. Six
appears at neither. It is almost certainly a coordinate of the pre-`6c265ad`
X-is-a-rhyme-class defect, where 24 free lines became one 276-pair class and
every floor finding carried far more locations. Doctrine 58: the count was a
coordinate of a setting and the setting has moved. §1.5 can be closed on the
mechanism, not on the number.

**The end word of L21 is not the line's last word.** The blueprint declares:

> `'Tonight it is County Road 6' keeps its numeral and the numeral is REFUSED,
> so the line's count is a LOWER BOUND (doctrine 79).`

The grid layer refuses it. The **rhyme layer never sees it**:
`lyric_harness.line_tokens` matches `[A-Za-z'\-]+`, so `6` is not a token at
all, and both `raw_final_token` and `line_anchors` return **`Road`** with no
refusal and no note. L21 then appears in this run's collision list as
`L9 ~ L21 'tone' ~ 'Road' 0.921 ASSONANCE` — a verdict about a word that is not
the line's end word. This is `raw_final_token`'s own docstring firing on this
repo's own song:

> "A path that instead takes the last word the DICTIONARY COULD READ
> substitutes an earlier word without saying so"

Two layers, two readings of one line, and only one of them says which it took.
`lyric_harness.py` is not this cell's file; `PATCHES-not-mine.md` carries it.

---

## 8 · WHAT THIS RUN DID NOT TOUCH

- **The song.** No line changed. Nothing here proposes one. The `dove` in §2 is
  the loop reporting the size of the field, not a suggestion.
- **The `--subdivision 2` chorus question.** Six chorus lines are
  UNSATISFIABLE and the harness's own answer needs a tune that does not exist
  (`NO_SETTING`). It does not interact with anything above: this run is
  end-rhyme and value only, and every line it names keeps its syllable count
  or is untouched. The one place it *would* bite is §6's remedy 3 — if
  `SCHEME_COLLISION` earned a candidate field, five of the six unsatisfiable
  lines carry mandated end words and any replacement re-opens both the mandate
  and the slot count at once. Noted, not settled.

  > **WIRED 2026-08-11.** `brief`/`inspect`/`verify` now take optional
  > `blueprint=`/`subdivision=`/`assume=`, and when given, fold `fit.py`'s
  > per-line findings into the SAME set this document's rhyme findings live
  > in — `SLOTS_EXCEEDED` as a hard flag (mathematically impossible once
  > `subdivision` is declared, matching `fit.py`'s own `satisfiable=False`),
  > `PROMINENCE_EXCEEDS_HEADS` and its siblings as soft notes. It adds NO new
  > rejection rule: the existing "fixes the flagged line and breaks another"
  > diff already catches a revision that overflows a bar, the moment a meter
  > finding is a member of the set that diff reads — demonstrated directly in
  > `quality/test_revise.py` test 25 by lengthening L1 past its bar's
  > capacity while targeting a real flagged rhyme, which is rejected with
  > `(1, 'SLOTS_EXCEEDED')` in the new-finding list. `NO_SETTING` itself is
  > UNCHANGED and remains true: no beat-grid or isochrony assumption is
  > wired in by this, on purpose (doctrine 4 — there is no audio, so "lands
  > on the beat" stays a claim this project does not make); what closed is
  > narrower and load-bearing anyway — whether a line's syllables COULD fit
  > its bars at all is now checked by the SAME loop that checks rhyme,
  > instead of a separate command nobody was running automatically.
- **`repeat_licence='refrain'`.** Reachable and it works: 7 violations become 7
  `REFRAIN_REPEAT` notes. The floor's own `REPEAT_IN_VERSE` keeps firing beside
  them, and that is correct rather than a contradiction — the loop's licence is
  DECLARED and the floor's is EARNED at `radif_min_pair_fraction=0.50`, which
  1-of-53 does not reach. Doctrine 18. Both are printed, so the disagreement is
  visible instead of silent, and nothing was changed.

---

## 9 · TEST AND BATTERY STATE

```
python3 battery.py               -> mandated 1064, judged 1014, refused 50,
                                    violations 82 (8.1% of judged)   [pinned, exit 0]
                                    (was 81/8.0% when this was recorded;
                                     repinned 2026-08-13 after cell BA's
                                     coda-identity fix moved it. "exit 0"
                                     means the pin HELD -- since 9396946
                                     battery.py exits 1 on drift.)
python3 quality/test_revise.py   -> all revision-loop regressions pass (22 groups)
python3 quality/verify_doctrines.py -> RESULT: PASS
```

Not one sonnet's violation set moved: `test_revise.py` 13 compares
`grade()` against `check_scheme` pair for pair across all 152 sonnets and is
unchanged. The fixes in §1–§2 are confined to the candidate field, which the
oracle never reads.
