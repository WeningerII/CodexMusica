# RESULTS — the mandate language: RHYME, RETURN, and the licence per PAIR

**Cell BC, 2026-08-11.** `quality/schemes.py`, `quality/test_mandate_language.py`.

The mandate language could say *these lines must rhyme* and nothing else. It
had to say three things. This is what it says now, what it refuses, and what
the numbers did.

**Everything below is MEASURED. Every figure names the command that produced
it and the state of the files it was measured against, because two of them
moved mid-cell.**

> ## BOTH SONGS ARE GONE FROM HEAD — ANNOTATED 2026-08-13
>
> **`examples/never_been_to_a_scene.txt` and `examples/cherokee_bill.txt` no
> longer exist**, and neither does `examples/`. Deleted in commit `11aa19b`,
> *"Remove Claude-authored example lyrics from the repo; fix the CLI's
> apparatus-line gap"*, 2026-08-12. Confirmed by `ls lyric-harness/examples` →
> *No such file or directory* and by `git log --diff-filter=D --
> 'lyric-harness/examples/*'` → `11aa19b`, nothing since. **§0, §5, §6 and §7
> all rest on these two files and every command they print is unrunnable as
> written.** Recover them, read-only:
>
>     git show 11aa19b^:lyric-harness/examples/never_been_to_a_scene.txt > /tmp/nbtas.txt
>     git show 11aa19b^:lyric-harness/examples/cherokee_bill.txt        > /tmp/cbill.txt
>
> Re-run against the recovered text at head on 2026-08-13. Superseded values
> are kept visible (doctrine 17); nothing is repinned that was not measured
> here.
>
> | § | figure | 2026-08-13 verdict |
> |---|---|---|
> | §0 | 27 distinct findings, 26 `SCHEME_COLLISION`, 16 of the 26 the chorus against its own return | **DOES NOT REPRODUCE as a count** — and §0 already says so ("They are recorded here because they no longer reproduce — see §6"). The **26** and the **16** themselves still reproduce exactly as collision arithmetic; see `RESULTS_COLLISION_PARTITION.md`'s own 2026-08-13 annotation, which re-measures both |
> | §0 | the seven identical chorus end words `slow/slow five/five ear/ear go/go went/went clear/clear sent/sent` | **REPRODUCES EXACTLY** — all seven, at 1.000 REPEAT |
> | §0 | `cherokee_bill` returns 12 collisions including `(4, 28) 'will' ~ 'will'` at 1.000 | **REPRODUCES EXACTLY** — 12 collisions, and that edge prints verbatim in the `MANDATE_GROUPS_INDISTINGUISHABLE` evidence |
> | §5(a)/(b) | the three spellings, verified equal | **NOT RE-RUN — COST.** `returns="chorus:33-40<=13-20"` is a string spelling this annotation did not exercise |
> | §5(c) | the A-1 notation string reaches the shipped CLI unchanged | **REPRODUCES** — `python3 lyric_harness.py brief /tmp/nbtas.txt 'XXXXXXXXXXXXA^1B^1C^1B^2A^2D^1C^2D^2XXXXXXXXXXXXA^1B^1C^1B^2A^2D^1C^2D^2X'` runs and exits 0 |
> | §5(c) | the quoted output block, **as CLI output** | **DOES NOT REPRODUCE.** `brief` no longer prints the mandate header at all — its first line is now `BLUEPRINT: none declared …`. The block below is `Mandate.describe()`, which is still reachable at the API and is where it should now be quoted from |
> | §5(c) | `mandate: **8** group(s) over 41 lines, **8** mandated pair(s)` | **DOES NOT REPRODUCE.** `describe()` says **4 group(s) … 24 mandated pair(s)**, because the returns transport unions the four chorus groups with their returns. The same line's tail moves with it: `a VIOLATION at the 8 rhyme pair(s)` is now `at the 24 rhyme pair(s)` |
> | §5(c) | `8 return class(es) / 8 identity pair(s)` | **REPRODUCES EXACTLY** |
> | §5(c) | `RETURN chorus: lines [13, 33] — VERBATIM required … x8` | **REPRODUCES in substance, not in label** — eight `RETURN` lines, `[13,33]` first, all `VERBATIM required`; the labels are `A1 B1 C1 B2 A2 D1 C2 D2`, not `chorus`. `chorus` is the label the (a)/(b) spellings give it, not the A-1 notation's |
> | §5(c) | `rhyme groups after the returns are transported (return_rhyme='union'): [[13,17,33,37], [14,16,34,36], [15,19,35,39], [18,20,38,40]]` | **REPRODUCES EXACTLY**, all four groups |
> | §5 | declaring `cherokee_bill`'s refrain costs it its letter scheme (L4/L28 become pivots) | **NOT RE-RUN — COST** |
> | §6 | the "at 14:5x UTC" column: 8 cliques / 1 pivot (L27); 12 groups / 5 pivots / 53 pairs | historical, correctly labelled, kept |
> | §6 | the "at 16:0x UTC" column: **6 cliques, 0 pivots**; **7 groups, 0 pivots** | **REPRODUCES EXACTLY.** Measured today: `promote=False` → 6 groups, 0 pivots, 28 pairs; `promote=True` → 7 groups, 0 pivots, 35 pairs. This is the column `RESULTS_REVISION_LOOP.md` §0 never received, and it is right |
> | §6 | `battery.py` `1064/1014/50/82`, Whitman 10.7% | **NOT RE-RUN — COST**, and not example-dependent. `CLAUDE.md`'s test-discipline section carries the live values |
> | §6 | paths A / B / C at **16 / 16 / 20** findings, chorus↔chorus2 collisions **0 / 0 / 0** | **The zero REPRODUCES; the counts DO NOT.** Path C measured today: **53** findings — 14 `ANAPHORA_OVERLOAD` + 7 `REPEAT_IN_VERSE` + 4 `RETURN_NOT_VERBATIM` (flags), 11 `MODAL_RHYME` + 7 `NEAR_COLLISION` + 7 `REFRAIN_REPEAT` + 3 `SCHEME_COLLISION` (notes). Not one chorus↔chorus2 collision among them. **Not repinned to 53 as a replacement for 20**: 25 of those 53 come from two layers (`ANAPHORA_OVERLOAD` off the song length profile, `MODAL_RHYME` off doctrine 9's proactive check) that did not exist when 16/16/20 was measured, so the two counts are not the same statistic. Paths A and B were **not re-run — COST** |
> | §6 | the A → B substitution: 4 × `MANDATE_GROUPS_INDISTINGUISHABLE` → 4 × `GROUPS_DECLARED_RETURN` | **NOT RE-RUN in that spelling.** The neighbouring pairwise spelling WAS: with `returns=((13,33),(17,37),(15,35),(18,38),(19,39))` the substitution happens on A+E, C+G and D+H and correctly **does not** happen on B+F, because no return class links L16 `drive` to L36 `alive`. So the hook still discriminates; the 4-of-4 figure is for the block spelling and is unchecked |
> | §6 | the residue: path C carries 7 `SCHEME_VIOLATION` + 1 `REPEAT_IN_VERSE` on licensed return pairs, and `repeat_is_violation` per pair would close it | **CLOSED, and measured closed.** Path C today reports **zero** `SCHEME_VIOLATION` and 7 `REFRAIN_REPEAT` **notes** on those pairs — `grade()` consults `Mandate.repeat_is_violation` per pair now (`CLAUDE.md`, 2026-08-11). The 7 `REPEAT_IN_VERSE` flags that remain are `quality/floor.py`'s, a mandate-independent layer that by design does not consult `Mandate.requirement`; this section's four `repeat_is_violation` return values were **not re-run — COST** |
> | §7 | `Mandate.returns_check()` fires **4 times** on `never_been_to_a_scene.txt` unmodified: L14/L34 `LEXICAL_VARIATION`, L15/L35 `LEXICAL_VARIATION`, L16/L36 `ANAPHORIC_RETURN`, L20/L40 `LEXICAL_VARIATION` | **REPRODUCES EXACTLY** — four findings, the same four line pairs, the same four named kinds, the same quoted text on each side. This is doctrine 94's demonstration for the whole cell and it is intact |
> | §7 | the four `test_mandate_language.py` fixtures; **61 checks, 0 failing** | **NOT RE-RUN — COST** |
> | §8 | `refrain villanelle` prints the 19-line notation | **NOT RE-RUN — COST**, and not example-dependent |
>
> **Bounded (doctrine 79):** 10 figures re-measured, 9 not run for COST. No test
> suite, no `battery.py`, no calibration runner. Run time for what was measured:
> `lyric_harness.py brief` on path C, ~20 s; `Mandate.describe()`, instant;
> the `mandate_from_graph` sweep, 0.2 s; the `returns=` inspect, 17.0 s.
>
> **Read §6's own two-column table before reading the table above.** This cell
> already anticipated most of this: it recorded that the comparator moved under
> it, published both columns, and refused to chase. Today's re-run lands on its
> RIGHT-HAND column to the number. The document that did not get told is
> `RESULTS_REVISION_LOOP.md` §0, which still prints the 14:5x figures as
> current; that file now carries its own annotation saying so.

---

## 0 · What was wrong, measured before anything was built

    python3 -c "... Reviser().inspect(lines, SONG_SCHEME) ..."
    SONG_SCHEME = "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX"   # test_revise.py:63

At `quality/revise.py` md5 `1c9a62fe…` (14:5x UTC) this returned **27 distinct
findings, 26 of them `SCHEME_COLLISION`**, and **16 of the 26 were the chorus
(L13–L20) against its own return (L33–L40)**. Seven of the sixteen were REPEAT
on an identical word:

    slow/slow  five/five  ear/ear  go/go  went/went  clear/clear  sent/sent

`examples/cherokee_bill.txt` under couplet groups `[[1,2],[3,4],…,[27,28]]`
returned 12 collisions including `(4, 28) 'will' ~ 'will'` at 1.000.

Nothing is wrong with either song. A letter is a property of a LINE, so a
letter scheme MUST spend two letters on one returning section, and the
collision detector then correctly reports the identity the projection was
forced to hide. Doctrine 2, arriving as noise.

**The brief's figures reproduce exactly.** They are recorded here because they
no longer reproduce — see §6.

---

## 1 · The three statements

| # | statement | before | now |
|---|---|---|---|
| 1 | these lines must RHYME | `Mandate.groups` | unchanged |
| 2 | this line must return VERBATIM | `RefrainScheme.refrains` only, unreachable from `brief`/`verify` | `Mandate.returns` |
| 3 | this group is a RETURN of that group, so identity is REQUIRED | nowhere | `Mandate.returns` + transport |

Doctrine 3 already knew the distinction — *"REPEAT is a violation inside a
verse, the requirement across chorus instances"*. The taxonomy inverts by
context; the mandate had no way to state a context, so
`ReviseDeclaration.repeat_licence` had to be one song-wide string with two
settings for a question that has three answers:

- `"unlicensed"` flags all seven correct chorus returns as violations;
- `"refrain"` licenses every REPEAT in the lyric **including one inside a
  verse**, which is the defect the flag exists to catch.

A per-song switch cannot express a per-pair inversion.

---

## 2 · The one new primitive

**A RETURN CLASS is a set of line numbers that are THE SAME LINE.** That is
all it is — the generalisation of `RefrainScheme.refrains` off a single line
class. Deliberately ONE primitive, because both shapes a song has reduce to it:

    a villanelle refrain returning 4x  ->  one class {1, 6, 12, 18}
    an 8-line chorus returning once    ->  8 classes of two, {13,33} … {20,40}

It states three things at once:

| | |
|---|---|
| **IDENTITY** | every pair inside it must be VERBATIM identical |
| **LICENCE** | REPEAT at every pair inside it is the REQUIREMENT, not a violation |
| **TRANSPORT** | a line carries its rhyme obligations into the class it returns into |

TRANSPORT is what dissolves the sixteen: L33 IS L13, L13 must answer L17, so
L33 must answer L17 and it is not a coincidence. It is forced, not chosen —
identity is an equivalence relation.

### The text spelling

    --returns=33-40<=13-20      a BLOCK return, aligned by position
    --returns=1,6,12,18         a REFRAIN class
    --returns=chorus:33-40<=13-20     labelled;  ';' separates;  '<-' == '<='

---

## 3 · Doctrine 28, made mechanical rather than conventional

`Mandate.requirement(i, j)` returns **one of a closed set of five**, and the
set is closed:

| value | rhyme required | identity required | REPEAT is a violation | declared |
|---|---|---|---|---|
| `REQUIRE_RHYME` | True | False | **True** | yes |
| `REQUIRE_RETURN` | True | **True** | **False** | yes |
| `LICENSE_REPEAT` | True | `UNKNOWN` | False | yes |
| `FREE` | False | False | `UNKNOWN` | yes |
| `UNDECLARED` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | **no** |

`FREE` and `UNDECLARED` are **different values**: "the author declared nothing
is required here" against "the mandate never reached this pair". A mandate
written over a chorus says nothing about the verses, and reporting a verse
rhyme as *unintended* against it charges the writer for a question nobody
asked. `Mandate.scope` is what separates them.

### `UNKNOWN` raises on `bool()` — doctrine 48

`None` is falsy, so `if req.identity_required:` would read a missing
declaration as a denial, silently, forever. `UNKNOWN` is a singleton whose
`__bool__` raises `TypeError` naming doctrine 28 and showing the three-way
branch. **The distinction is enforced by the interpreter, not by a caller
remembering it.** That is the whole difference between this and a convention.

---

## 4 · Doctrine 20 — six refusals, and not one degrades

| refused | why |
|---|---|
| `33-40<=13-19` | a correspondence that cannot be established is not a weak one; a zip cut to the shorter run mandates nothing about the tail while looking as though it did |
| a return class of one line | a line is not a return of anything on its own |
| `13-20<=13-20` | a line cannot be a return of itself |
| a return line outside `1..n` | 1-based over the whole song, same as groups |
| two declarations that transitively merge and **disagree** about verbatim | two requirements that cannot both hold — not a tie broken by declaration order (doctrine 66) |
| `Mandate.to_letters()` when returns exist | **see below** |

### `to_letters()` REFUSES rather than degrading

A letter says exactly one thing — which rhyme class. It cannot say *this line
is that line come back*. Handing back a letter string for a mandate carrying
returns would silently drop every identity requirement, which is the deletion
the primitive exists to undo. So it raises, and names the two things to reach
for instead:

- `to_rhyme_letters()` — the same projection, with the loss in its name;
- `to_notation()` — the A-1 notation, which CAN carry a verbatim return.

`to_notation()` refuses in two more places, and **verifies its own round-trip
rather than promising it**: it re-parses its output and raises if the result is
not the mandate it started from. That caught a real ambiguity — the shipped
`is_refrain_notation` discriminator reads an ALL-UPPERCASE string as the
>26-sound reading, so this song (whose verses are all `X`, no lowercase
anywhere) rendered as `A1B1C1…` and read straight back as eight separate
SOUNDS. It now emits the `^` spelling, which the module already ships as the
explicit discriminator.

---

## 5 · The mandate for `never_been_to_a_scene.txt`, written out

Three spellings of the same object. All three verified equal.

**(a) the author's own letters, plus the one thing they cannot say**

    mandate = "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX"
    returns = "chorus:33-40<=13-20"

**(b) the chorus declared once, the return doing the rest**

    groups  = [[13,17], [14,16], [15,19], [18,20]]
    returns = "chorus:33-40<=13-20"

**(c) the A-1 notation — one string, and it reaches the shipped CLI with no
change to any file this cell does not own**

    XXXXXXXXXXXXA^1B^1C^1B^2A^2D^1C^2D^2XXXXXXXXXXXXA^1B^1C^1B^2A^2D^1C^2D^2X

    # the lyric is gone from head — recover it first (see the block at the top)
    git show 11aa19b^:lyric-harness/examples/never_been_to_a_scene.txt > /tmp/nbtas.txt
    python3 lyric_harness.py brief /tmp/nbtas.txt \
      'XXXXXXXXXXXXA^1B^1C^1B^2A^2D^1C^2D^2XXXXXXXXXXXXA^1B^1C^1B^2A^2D^1C^2D^2X'

What it says, in full — **but not from that command any more.** `brief` no
longer prints the mandate header; as of 2026-08-13 the block below is what
`Mandate.describe()` returns, and the first two lines of it have moved (4
groups / 24 mandated pairs, not 8 / 8, because the returns transport unions the
chorus groups with their returns). The `8 return class(es) / 8 identity
pair(s)` line and the transported rhyme groups reproduce exactly. Kept as
written, per doctrine 17; the head block has the full verdict:

    mandate: 8 group(s) over 41 lines, 8 mandated pair(s),
             8 return class(es) / 8 identity pair(s)
      RETURN chorus: lines [13, 33] — VERBATIM required      ... x8
      doctrine 3, per PAIR: REPEAT is the REQUIREMENT at the 8 pair(s) above
        and a VIOLATION at the 8 rhyme pair(s); the mandate no longer needs
        one song-wide licence to mean both.
      rhyme groups after the returns are transported (return_rhyme='union'):
        [[13,17,33,37], [14,16,34,36], [15,19,35,39], [18,20,38,40]]

And `cherokee_bill.txt`:

    groups  = [[1,2],[3,4],…,[27,28]]
    returns = "refrain:4,28"

**Declaring cherokee_bill's refrain costs it its letter scheme.** The couplet
declaration is a partition; the return makes L4 and L28 pivots, because L4
must answer L3 *and* L27 — L28 IS L4, and rhyme is not transitive, so the two
classes stay two. Doctrine 2 arriving from the identity direction, on a song
whose letters looked settled.

---

## 6 · The numbers, and the two that moved under the cell

**THE COMPARATOR MOVED MID-CELL AND THE BATTERY WITH IT. A sibling owns both.
Nothing here is chased or repinned.** What I saw:

| | at 14:5x UTC | at 16:0x UTC |
|---|---|---|
| `rhyme_graph` on this song | 8 cliques, 1 pivot (L27) | **6 cliques, 0 pivots** |
| `mandate_from_graph` | 12 groups, 5 pivots, 53 pairs | **7 groups, 0 pivots** |
| `battery.py` | pinned `1064/1014/50/81` | **`1064/1014/50/82`** (8.1%) |
| Whitman chained | recorded 17.3% | **10.7%** |

`quality/revise.py` also gained `NEAR_COLLISION`, `REPEAT_ACROSS_GROUPS`,
`GROUPS_DECLARED_RETURN` and `MANDATE_GROUPS_INDISTINGUISHABLE` mid-cell. So
the "26 collisions, 16 of them the chorus" figure is a coordinate of a
comparator that no longer ships — doctrine 58, one axis out. **Both arms below
are therefore re-measured in ONE process, against `revise.py` md5
`33b408cc…`, `lyric_harness.py` md5 `2cc05a94…`.**

| path | findings | chorus↔chorus2 collisions |
|---|---:|---:|
| **A** letters only | 16 | 0 |
| **B** letters + RETURN | 16 | 0 |
| **C** A-1 notation | 20 | 0 |

The interesting number is not the total, it is **which finding**:

    A -> B :  4x MANDATE_GROUPS_INDISTINGUISHABLE   becomes   4x GROUPS_DECLARED_RETURN
              evidence: "derived from the rhyme       evidence: "…and the mandate
              graph; the mandate cannot state         SAYS SO, so the 4 cross
              a return"                               pair(s) are the form and
                                                      not a defect"

The sibling cell's own finding **names this gap in its evidence string** and my
half closes it. On `cherokee_bill.txt` the same single substitution occurs:
`MANDATE_GROUPS_INDISTINGUISHABLE (3,4,27,28)` → `GROUPS_DECLARED_RETURN`.

### The residue, and it is one predicate

Path C's extra 4 findings are 7 `SCHEME_VIOLATION` + 1 `REPEAT_IN_VERSE` on the
licensed return pairs. `grade()` still reads the song-wide
`repeat_licence == "refrain"`. **The language answers all seven:**

    m.repeat_is_violation(13, 33)  ->  False    # licensed, it is the return
    m.repeat_is_violation(13, 17)  ->  True     # slow/go, must still rhyme
    m.repeat_is_violation(13, 37)  ->  True     # L37 IS L17 — transported
    m.repeat_is_violation(1, 5)    ->  UNKNOWN  # free, the mandate does not say

Consulting it per pair takes path C to **12 findings + 4 RETURN drift findings
= 16**, the same as A and B. That call is `quality/revise.py`'s and is filed as
a patch, not made here.

---

## 7 · Doctrine 94 — the zero, and the fixture that proves it can fire

This work makes 16 findings into 0. Doctrine 94 requires a demonstration that
the detector could still have fired, and **this repo has already shipped one
zero justified by a test that did not exist**, so the fixture is not
constructed — it is the song.

`Mandate.returns_check()` fires **4 times on `never_been_to_a_scene.txt`
unmodified**, because 4 of the 8 declared returns are not verbatim:

    L14/L34  LEXICAL_VARIATION   'I will find you…'  vs  'I did find you…'
    L15/L35  LEXICAL_VARIATION   'I will put…'       vs  'I did put…'
    L16/L36  ANAPHORIC_RETURN    'and hold it there while you drive'
                                 vs 'and I held it there. You were alive'
    L20/L40  LEXICAL_VARIATION   'Next one sent'     vs  'Nothing sent'

Each is a NAMED KIND from `quality.grid.compare_returns`, not a boolean —
doctrine 24, because a refrain that keeps its rhyme and changes a word is a
move and a broken villanelle is a defect. **These four findings are new
information: nothing in this repo could produce them before, on either song.**

Four more fixtures, all in `quality/test_mandate_language.py`:

| §3 | drift a verbatim chorus line -> the count goes 4 → 5 |
| §3 | cherokee_bill's L4/L28 pass VERBATIM, **and the same check fires when L28 is altered** — so the pass is a measurement, not a silence |
| §5 | **the licence does not leak**: with the chorus return declared, a mandated verse pair keeps `repeat_is_violation == True`. This is the exact failure of `repeat_licence="refrain"` |
| §6 | all ten non-chorus collisions stay `FREE` — the return licensed nothing about them |

**61 checks, 0 failing:** `python3 quality/test_mandate_language.py`

---

## 8 · The A-1 notation shipped and could not reach the loop

`MISSING.md` A-1 says the villanelle "cannot be written down here". **Verified
stale by execution** — `python3 lyric_harness.py refrain villanelle` prints
`A1bA2abA1abA2abA1abA2abA1A2 (19 lines)`, `A1: [1,6,12,18]`, `A2: [3,9,15,19]`,
12 required REPEAT pairs.

But it could not reach `brief`/`verify`, and the reason was in **this file**:
`mandate()` routed a notation string through `parse()`, which returns the rhyme
partition and drops the identity one **in silence**. So

    brief FILE A1bA2abA1abA2abA1abA2abA1A2

mandated the villanelle's rhyme and said nothing whatever about the twelve
lines that have to come back — the requirement the form is FOR.

Fixed at the source: `mandate()` now routes an A-1 string through
`RefrainScheme.to_mandate()`, and the identity half lands in `Mandate.returns`
rather than in `Mandate.groups` — the note above `check_identity` is right that
handing REPEAT pairs to a rhyme grader flags every correct refrain.

    S.mandate("A1bA2abA1abA2abA1abA2abA1A2")
      -> 2 return classes, 12 identity pairs, round-trips to itself
      -> repeat_is_violation False at all 12, True at (1,4) in the same class

The old reading stays reachable as `carry_returns=False`, so the defect is
demonstrable rather than a sentence nobody can check — the shape
`modal_exclusion=0` and `field_band="scalar"` already use. It is not the
default, because the default was the bug.

---

## 9 · Declared coordinates added, and what the alternative would have been

Doctrine 1: a disagreement lands in a coordinate, never argued at large. Three
were added and every alternative is reachable, so the choice is measurable
rather than settled by fiat — the shape `overlap_rule` and `field_band` use.

**`ReturnRule.return_verbatim` — default `"verbatim"`.**
Alternatives `"rhyme"` (the return need only keep its rhyme) and `"unknown"`
(the caller declines to say; every identity question returns `UNKNOWN` and
propagates). Verbatim is the default because a refrain that has drifted by a
word is the commonest way a fixed form fails and is invisible to every other
check here — the rhyme partition passes, the band passes, and the line that was
supposed to come back did not. Defaulting to `"rhyme"` would make the language
unable to state the requirement it exists to state. Under `"rhyme"` the four
drift findings in §7 do not exist.

**`ReturnRule.return_rhyme` — default `"union"`.**
Alternative `"positional"`: only the corresponding pairs are mandated and the
cross pairs stay `FREE`. Union is the default for the reason `overlap_rule`
defaults to conjunctive — it is strictly stronger. Under `"positional"` the
mandate would require `five/five` (an identity, trivially true) while leaving
`drive/alive` unmandated: the projection defect one level down, where the only
pair carrying a risk is the one nobody checks.

**`Mandate.scope` — default `()`, meaning all lines.**
Alternative: an explicit line set, making everything outside `UNDECLARED`
rather than `FREE`. The default preserves today's behaviour byte for byte for
every existing caller; the alternative is what doctrine 28 needs in order for
"never asked" to be a different answer from "nothing required".

**`mandate(carry_returns=)` — default `True`.** See §8.

---

## 10 · What is NOT claimed

- **No finding-count claim survives a comparator change.** The 26/16 figures in
  §0 are a coordinate of `revise.py` md5 `1c9a62fe…` and reproduce nowhere
  else; §6's are a coordinate of `33b408cc…`. Doctrine 58/91.
- **The 7 licensed REPEAT pairs are still charged as violations by the shipped
  grader.** The language answers them; `grade()` does not ask. Filed, not made.
- **A return is a DECLARATION and this module never infers one.** Two groups
  being indistinguishable in the graph is compatible with a refrain and with an
  accidentally reused rhyme sound, and nothing in a score separates them.
  Reading intent out of a number is the one thing this project refuses to do.
- **`returns_check` uses `quality.grid.compare_returns`**, which is not owned
  by this cell and whose kind vocabulary (`LEXICAL_VARIATION`,
  `ANAPHORIC_RETURN`) is reported as it comes.
