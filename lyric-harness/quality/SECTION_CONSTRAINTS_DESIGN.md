# The section-constraint layer — what a function knows about where it can go

**Design sitting 2026-08-22, opened by the owner on reading `MISSING.md` M-54:**
*"I have a nagging feeling that we're going to need more 'if then' type shit
than 'first' … does verse know it can be first, free, and/or last … what does
a prechorus actually mean to a chorus … there's a ton of thought we need to be
putting into this so it doesn't end up fruitless or counter productive."*

Every number here is measured against `grid.SECTION_FUNCTIONS` as it stands.
Nothing is implemented yet; this is the argument that has to hold before it is.

---

## 0. The finding that killed the first design

M-54 proposed `position ∈ {first, last, free}`. **It is the wrong primitive,
and the evidence is M-54's own failed derivation.** Reading each gloss by
keyword claimed a position for 11 of 21 rows and got 4 wrong — and the four
failures are not sloppy regexes, they are *category errors*:

| function | keyword said | the gloss actually says |
|---|---|---|
| `false_ending` | `last` | *"a close the song comes back from"* — REQUIRES something after it |
| `turnaround` | `last` | *"carries the end of one section into the next"* — REQUIRES a section on BOTH sides |
| `interlude` | — | *"between sung sections"* — REQUIRES a sung section on both sides |
| `reprise` | — | *"a declared return of EARLIER material"* — REQUIRES something before it |

Each of those is a **relational** fact that an **absolute** vocabulary cannot
hold, so it gets flattened into the nearest absolute value and comes out
inverted. `false_ending` is the sharpest: an absolute reading makes it the LAST
section, and its own definition is that it is not.

**So position is mostly DERIVED, not declared.** Exactly three rows carry a
genuine boundary fact — `intro` (*"opens the song"*), `outro` (*"closes the
song"*), `coda` (*"a closing section"*). Everything else that looks like
position falls out of a dependency. The owner's "if-then" instinct is the
correct primitive and `first/last/free` was the wrong one.

## 1. Constraints are DENIALS, and that is the move-37 guard

A constraint may only ever say **this cannot be here**. Anything not denied
stays reachable. Two consequences, and the second is the whole safety argument:

- **`verse` gets no constraint at all.** It may open a song, close one, or sit
  anywhere. That is the correct answer to *"does verse know it can be first,
  free, and/or last"* — it does not need to know, because nothing denies it.
  An allow-list would have had to enumerate `{first, mid, last}` and would go
  stale the moment a shape nobody enumerated turns up.
- **A denial is only admissible if it is DEFINITIONAL.** The test, applied per
  row and recorded in the row:

  > **Violate it. Is the result a NOVEL SONG, or a MISLABELLED SECTION?**

  A prechorus with no chorus is not an experimental structure — the word means
  *before the chorus*, so the section is simply something else. **Mislabelled →
  the constraint prunes.** Verse-chorus-verse-chorus-bridge-chorus violated is
  a novel song. **Novel → it is a convention, it goes to the grader as a NOTE
  and never near the planner** (doctrine 6, and the owner's "move 37" ban).

That test is what stops this being counter-productive. It is cheap, it is
per-row, and it is checkable by a reader.

## 2. THREE layers, not two — and the middle one does not exist

The owner's case *"I do want a chorus and a post chorus … and because of that a
pre chorus would mess that up"* does not fit either layer M-54 named, because
it is neither definitional nor conventional. It is a **choice about this song**.

| layer | example | who owns it | enforcement |
|---|---|---|---|
| **1 VOCABULARY** — definitional | a prechorus requires a chorus | `grid.SECTION_FUNCTIONS` | prunes the planner's space; a grader FLAG |
| **2 DECLARATION** — this song | "chorus and postchorus, no prechorus" | the writer | restricts the roster before sampling |
| **3 CONVENTION** — statistical | verse-chorus-verse-chorus-bridge | `grid.FormConvention` | a NOTE, never the planner |

**Layer 2 has no implementation.** `plan.make_plan(seed, form=...)` samples the
roster from `GENERATOR_ROSTER` and takes no declaration of which functions the
writer wants. So a writer cannot ask for a postchorus at all, and the answer to
"a prechorus would mess that up" is currently "you cannot say so." That is a
separate gap from M-54 and is filed as its own entry; M-54's layer-1 work is
the precondition, because a roster declaration has to be CHECKED against the
definitional constraints (asking for a prechorus and no chorus must REFUSE).

## 3. The relation kinds the vocabulary actually attests

Derived from the glosses, with the quotation that licenses each. **Nothing here
is invented** — where a gloss does not decide, the row REFUSES (doctrine 20).

**`requires` — an existential precondition on the ROSTER, checked before any
ordering happens.** This is the owner's "no chorus so neither pre nor post."

| row | requires | evidence in its own gloss |
|---|---|---|
| `prechorus` | `chorus` | "lifts from verse into **chorus**" |
| `postchorus` | `chorus` | "returns immediately after **the chorus**" |
| `burden` | `verse` | "printed AFTER **a stanza**" |
| `build` | `drop` | "raises tension toward a return" + `drop` = "the arrival **a build** points at" |

`drop → build` is **REFUSED**: `drop`'s gloss defines it BY REFERENCE to a
build, which is not the same as requiring one, and a drop can arrive without a
formal build section. That asymmetry is a ruling, not a reading, and it waits.

**`adjacent_after` / `adjacent_before` — strict immediate adjacency to a NAMED
function**, which is a different and stronger claim than `requires`.

| row | claim | evidence |
|---|---|---|
| `postchorus` | immediately after `chorus` | "returns **immediately after** the chorus" |
| `prechorus` | immediately before `chorus` | "lifts from verse **into** chorus" |
| `burden` | after `verse` | "printed **AFTER** a stanza in every staged instance (1,580 of 1,580, measured)" |

`burden`'s is the only one with a **measured** rate behind it rather than a
definition, and its row already records the measurement.

**`needs_before` / `needs_after` — requires SOME section on that side, not a
named one.** This is where the four failed keyword derivations actually live.

| row | claim | evidence |
|---|---|---|
| `false_ending` | needs_after | "a close the song **comes back from**" |
| `reprise` | needs_before | "a declared return of **earlier** material" |
| `turnaround` | needs_before AND needs_after | "carries the end of **one section** into **the next**" |
| `interlude` | needs_before AND needs_after | "**between** sung sections" |

**`boundary` — the genuinely absolute three.**

| row | claim | evidence |
|---|---|---|
| `intro` | first | "**opens the song**" |
| `outro` | last | "**closes the song** and does not recur" |
| `coda` | last | "a **closing** section with its own material" |

**REFUSED, and the refusal is the point.** `tag` — *"a short repeated fragment
closing a section **or the song**"* — carries both readings in one sentence and
must not be made to pick (doctrine 20). `vamp` — *"a repeating figure held
open"* — states no position at all; the keyword derivation read "open" as
"opens" and that is a coincidence of English, not evidence.

## 4. What must NOT be overloaded

`FunctionSpec.contrasts_with` **already names other functions** and is
populated on 4 rows: `prechorus → (verse, chorus)`, `bridge → (verse, chorus)`,
`chorus → (verse,)`, `postchorus → (chorus,)`. It is a claim about SOUND — this
section should not resemble that one — and `bridge_contrast` reads it.

Three of the four happen to name the same functions a `requires` edge would,
which is exactly what makes overloading it tempting and wrong: `bridge` names
`verse`/`chorus` and requires NEITHER. One field, two questions, and a reader
could not tell which one a row was answering (doctrine 1).

## 4b. Subsumption — `aliases` is symmetric and three of its claims are not

**Owner, same sitting:** *"While all middle eights are bridges, not all bridges
are middle eights… just for efficiency's sake."* The efficiency instinct is
right — subsumption is exactly what lets a dialect name exist without a 22nd
row — and the field currently doing that job models the wrong relation.

`_FUNCTION_SPELLINGS` is already correctly scoped to spelling variants, and its
own comment refuses to hold claims. `FunctionSpec.aliases` holds the claims,
and is documented as *"a genre dialect naming **the same function**"* —
symmetric. `middle-eight ⊂ bridge` is not.

MEASURED: `Section(bars=13, function="middle-eight")` resolves to `bridge` and
nothing objects, while the bridge gloss argues the middle-8 needs no row
because *"this model already records"* the bar count. It records a bar count
and never checks it against the claim; the claim is not kept. **The door
accepted a specialisation and stored the genus** — `MISSING.md` M-49's defect
in a second vocabulary.

`burden ⊂ refrain` is the same relation with the opposite error: stated in the
gloss (*"a refrain sung by all"*), correctly kept as its own row because the
corpus marks the two differently, and therefore recorded as UNRELATED when it
is a kind-of. An alias asserts identity where there is specialisation; separate
rows assert independence where there is specialisation.

`refrain`/`chorus` is **not** such an edge — checked, not assumed. A chorus is a
*section*; a refrain is *"not a standalone section"*. Siblings under returning
material, and per §6 not even the same KIND of object. The real edge in that
family is `burden ⊂ refrain`.

Owed: `specialises` as its own asymmetric field naming the genus, the
DIFFERENTIA recorded beside it (`middle-eight` = `bridge` + `bars == 8`, which
is the entire content of the claim), resolution that KEEPS what was declared so
the differentia can be checked, and `aliases` narrowed to true synonyms.
`MISSING.md` M-57.

## 5. Instance identity — a DECLARED scope decision, not an oversight

*"how are we going to distinguish between the first verse and the last verse?"*

Instance identity **already exists** and is already load-bearing:
`Song.instances_of(fn)` returns them ordered, the corpus prints `[VERSE 1]` /
`[VERSE 2]`, `compare_returns` grades instance against instance, and
`verse.returns_as = 'new words'` is precisely the field that says verse 2 is
the same tune and different words.

What does not exist is any constraint SCOPED to an instance — "the last verse
must X". **No gloss in the vocabulary attests one.** So constraints are
FUNCTION-scoped, instance identity stays where it already works, and this
paragraph is the record of that being a decision rather than something nobody
looked at. If an instance-scoped rule is wanted later it needs its own
evidence and its own entry.

## 6. Two defects this sitting found on the way in

**`_sample_pattern` encodes an exclusion with no warrant.**
`rng.choice((None, "outro", "coda"))` makes `outro` and `coda` **mutually
exclusive** — a song may have neither, or one, never both. Nothing in either
gloss says so, and a song can plainly carry a closing section with its own
material followed by an outro. A rule with no evidence, enforced by a tuple.

**Two of the twenty-one "section functions" deny in their own glosses that they
are sections.** `refrain` — *"a returning line or couplet INSIDE or after a
stanza, **not a standalone section**"* — and `hook` — *"A hook is properly a
**FRAGMENT** (`MISSING.md` D-2)"*. So `SECTION_FUNCTIONS` is 19 sections and 2
sub-section objects sharing one table, and both are among the functions the
planner cannot emit. Any position/adjacency coordinate applied to them is
answering a question about the wrong kind of object.

## 7. Build order

1. The four relation kinds as declared fields on `FunctionSpec`, every non-empty
   value quoting its own gloss, `refused` where the gloss does not decide.
2. `plan._sample_pattern` DERIVES from them; `_CELLS` either derives from the
   adjacency edges or its comment stops claiming it does (doctrine 45).
3. A grader finding, so a hand-written blueprint is held to the same rule the
   planner is — today an outro in the middle grades clean.
4. The sampler stays UNIFORM OVER SOLUTIONS. A greedy left-to-right collapse
   re-introduces exactly the enumeration bias planner v2's own smoke run found
   (weighting a cycle by how many groupings it admits). The constraint layer
   PRUNES the space; the sampler still draws by derivation, never by walking
   the tree.
5. Layer 2 (the roster declaration) is a separate entry and comes after 1-3,
   because it must be checked against them.
