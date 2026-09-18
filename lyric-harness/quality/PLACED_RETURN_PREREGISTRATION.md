# Pre-registration — a PLACED word-identity judge, for M-142's open half

**Registered 2026-09-18, before any judge exists.** `MISSING.md` M-142 names
the gap and the code names it again at the point of refusal:

> A placed word-identity judge is M-142's open half; until it exists the
> honest answer is this sentence, not a silent flattening.
> — `quality/schemes.py`, `_normalise_returns`

This is that registration. It is written before the runner, because the thing
being added is a SIXTH member of a five-member closed vocabulary whose every
member carries a doctrine argument, and a vocabulary grown after the fact to
fit whatever the code did is not a vocabulary.

## The defect, measured rather than asserted

A recovered cover holds two demands and the CLI can state one. `--groups=` is
`REQUIRE_RHYME` — identity FORBIDDEN, REPEAT a violation — while `recover`
admits REPEAT edges deliberately, because a pasted song is full of refrains.
`--returns=` is the only flag under which identity is the REQUIREMENT, and it
refuses any member carrying a placement.

**RE-MEASURED 2026-09-18 on `74cb8889` through `recover.recover_file`,
`quality/fixtures/song.txt`:**

| quantity | measured |
| --- | ---: |
| edges in the web | 99 |
| `REPEAT` edges | **34** |
| `REPEAT` edges carrying a locus | **32 (94.1%)** |
| the module's own `repeats_at_a_placement` | **32** |
| flags `mandate_spelling` emits | `--groups=`, `--returns=` |

The entry's corpus-wide figure is 934 of 984 (94.9%) over 18 drafts. The
fixture reproduces it at 94.1%, and the module's own published count agrees
with an independent count of the same edges.

**So roughly 94% of the repeats a cover finds have no mandate spelling at
all**: `--groups=` charges them as violations, `--returns=` refuses them by
name.

## Why the refusal is correct today, and must stay correct until the judge lands

Every identity judge in this harness reads LINES — `returns_check`'s verbatim
comparison, the loop's pinning, and `repeat_is_violation` through
`Requirement`. Accepting `1.head` without a judge would take a declaration
about one WORD and judge a different thing about its whole line. **Partial
adoption is therefore forbidden by this registration**: the parser may not
start accepting a placed member in any commit that does not also land the
judge. A spelling accepted ahead of its judge is the silent flattening the
entry exists to refuse.

## What will be built

1. A sixth `Requirement`, distinct from `REQUIRE_RETURN`: the WORD at the
   declared locus must return verbatim, and **the rest of the line is not
   constrained**. `REQUIRE_RETURN` constrains the whole line and must keep
   meaning exactly that.
2. `Return` gains an optional locus per member. Readers that duck-type it as
   `getattr(r, "lines", r)` — `revise.py` at three sites,
   `ban_convergence.py`, and six sites inside `schemes.py` — must see
   unchanged lines for an unplaced return.
3. A judge that compares the word at a locus. The primitive already exists:
   `recover._slot_words(lex, line, placements)` returns exactly that word, and
   is what builds the placed web in the first place.
4. `quality/test_mandate_language.py` §7 currently PINS the refusal of
   `1.head` as a tripwire. The build flips that pin ON PURPOSE, and §11's
   equality pin between `repeat_is_violation` and `Requirement` is extended to
   the new member rather than left to drift.

## The claim that must be PROVEN, not argued: additivity

A placed return **refuses today**, so no mandate in this tree can be using
one. The build is therefore additive, and the proof is mechanical:

> Over the shipped fixtures and the maintained battery, every existing mandate
> grades BYTE-IDENTICALLY before and after. Not "no test went red" — the same
> bytes.

This is the shape M-135 used to prove `Declaration.search` additive, and it is
the only evidence this registration accepts for "nothing moved".

## Falsifiers, declared before the numbers

**F1 — the judge disagrees with the cover.** A placed REPEAT edge that
`recover` admits comes back a VIOLATION under the new requirement. That would
mean the two layers still disagree about the same pair, which is the whole
defect, relocated rather than fixed.

**F2 — additivity fails.** Any existing mandate's grade moves by a byte. The
build is then not additive and must be argued as a change in behaviour under
doctrine 58, not shipped as a widening.

**F3 — the locus is unreadable more often than it is readable.** If the word
at a declared locus cannot be resolved for a material share of the placed
edges, the judge REFUSES there, and a judge that mostly refuses is not a
judge. The threshold is declared here: **if more than 10% of the fixture's 32
placed edges cannot be read, the design is wrong and this registration fails**
rather than shipping something that answers `cannot tell` by default.

## What this registration does NOT decide

Whether `--groups=` should stop charging placed repeats. That is the other
half of the same defect and it belongs to the flag, not to the judge.

Whether a placed return implies anything about its line's rhyme. It does not,
by construction — that is what makes the sixth requirement different from
`REQUIRE_RETURN`, and any coupling must be declared separately.

Whether the corpus-wide 94.9% still holds. Only the fixture was re-measured
here; the 18-draft lane is the entry's and is not re-run by this document.
