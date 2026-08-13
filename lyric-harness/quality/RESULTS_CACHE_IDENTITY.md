# The cache identity WAS byte-granular, and a comment cost 2.3 CPU-hours

MEASURED 2026-08-13. Status: **FINDING RECORDED, FIX LANDED 2026-08-13** in
`quality/discriminate.py` as `_digest_source`. See §What landed.

TITLE AMENDED at the landing, from *"The cache identity **is** byte-granular,
and a comment **costs** 2.3 CPU-hours"*. The present tense was the finding
while it stood and is false for `SOURCE_FILES` now that it does not; leaving it
would be this document quoting its own falsified premise as current, which is
the half of doctrine 17 it exists to illustrate. Everything below is written in
the tense it was true in. Note that byte-granularity is NOT gone from the
identity — `RESOURCE_FILES` keeps it, deliberately and correctly (§What is NOT
closed, item 3).

STATUS HISTORY, kept visible rather than overwritten (doctrine 17):

| when | status |
|---|---|
| 2026-08-13, this file written | FINDING RECORDED, FIX PROPOSED |
| 2026-08-13, hours later | FINDING RECORDED, FIX DEMONSTRATED AND **HELD** — held for sequencing, so as not to discard a cache under a concurrent 70-minute cold measurement (§What is NOT closed, item 1, as it then read) |
| 2026-08-13, this edit | FINDING RECORDED, FIX **LANDED**. The hold is released: the measurement it was protecting has been taken and pinned in `quality/test_discriminate.py`, and the cache is invalid at HEAD independently of this change (verified, §What landing cost) |

REPINNED 2026-08-13, hours after this file was written, from **3.2 CPU-hours**.
That figure rested on `discriminate.py`'s cold path costing "~70 min ≈ 4,200
CPU-s", which this document inherited from an estimate and restated without
measuring — in a document whose entire subject is a number someone wrote down
without measuring it. Doctrine 58 applied to itself, within a day. See §What it
costs.

## What the identity is

`quality/discriminate.py`'s `cache_identity()` keys the stored feature-vector
cache on, among other things, a `_digest_file` of every entry in
`SOURCE_FILES`:

    SOURCE_FILES = (features.py, within_item.py, ../lyric_harness.py)

`_digest_file` is a sha256 prefix **of the file's bytes**. Its own docstring
says the identity is "everything that, if changed, makes a stored vector a
different number" — and a byte digest is a conservative over-approximation of
that set. It never wrongly REUSES. That direction is correct and this document
does not propose weakening it.

## What it costs

The over-approximation is not free, and the price is not small. A discard
rebuilds:

  - `discriminate.py`'s 384 entries — **1,050 CPU-s, MEASURED 2026-08-13**,
    twice: 1049.5 s and 1067.8 s over 384 items, 2.73–2.78 s/item.
    SUPERSEDES `~70 min ≈ 4,200 CPU-s`, which was this document's own figure
    for a few hours on 2026-08-13 and was never measured by anyone — it was
    the header of `audit_joint_auc_null.py`, restated here without checking.
    Doctrine 17: kept visible, not quoted as current.
  - `song_profile_calibration`'s predictability cache — 2.0–2.2 CPU-hours
    ≈ 7,400 CPU-s

≈ **8,450 CPU-s, ~2.3 CPU-hours, per discard.**

A document about numbers written down without being measured contained a number
written down without being measured, and it survived about four hours. That is
the honest version of doctrine 58 and it is left standing here rather than
quietly corrected, because the mechanism is the point: the figure was plausible,
it was in the right order of magnitude, and nothing in the writing of it
required anyone to run the thing.

AND THE REPIN WAS INCOMPLETE FOR THE REST OF THE DAY — corrected 2026-08-13,
at the landing. The repin above changed the headline and left **three other
sites** quoting the superseded figure in the present tense: `3.2 CPU-hours` at
§It fired three times, `3.2-CPU-hour cache` at §The perverse incentive, and
`11,600 CPU-s` at §The fix — that last being 3.2 CPU-hours rendered in seconds,
which is why a grep for the digits `3.2` would have found only two of the
three. All three now read the measured figure with the old one kept visible
(doctrine 17). Doctrine 58 a third time in one document, and the specific
lesson is narrower than "measure it": **a repin is a sweep, not an edit**, and
the unit-converted restatement is the copy that survives the sweep.

## It fired three times in one session, and the last one was a comment

`quality/features.py` at four commits, digest = sha256 prefix of the bytes:

| commit | bytes | byte digest | cache |
|---|---:|---|---|
| `6d0c9b8` | 14,643 | `58586dc07cb77ec3` | — |
| `2c9ef1b` | 16,900 | `d19ffe04ab1af829` | DISCARDED |
| `b8047e8` | 20,588 | `1ff08f3cc9dab88f` | DISCARDED |
| `ef21639` | 20,682 | `affe2209d56e24b5` | DISCARDED |

`b8047e8 -> ef21639` is **94 bytes of docstring**. It repinned three memory
figures in `RhymeField`'s docstring from estimates (`~16 bytes`, `~0.46 GiB`,
`~3.0 GiB`) to measured values (17 B/entry over 102,695 entries, 0.48 GiB,
2.99 GiB at 105 B/entry). Not one executable byte moved. The change was proven
bit-identical over 606,186 + 168,002 equivalence probes and 2,921 `float.hex()`
comparisons with zero differences — and it discarded 2.3 CPU-hours.
(REPINNED 2026-08-13 from **3.2 CPU-hours**, along with two other sites; see
the last paragraph of §What it costs.)

## Independently confirmed by a lot that watched it happen

MEASURED 2026-08-13 by the `audit_joint_auc_null` lot, which was not looking for
this and reported it as an obstacle to its own measurement.

During its **first 17.5-CPU-minute cold rebuild**, a concurrent cell edited
`quality/features.py` **twice**: digests `d19ffe04` → `2efbffbe` → `1ff08f3c`.
The cache was stale before it finished being written. That lot had to freeze a
snapshot of the comparator in scratch to get a stable measurement at all.

Two things follow that the byte-count table above cannot show.

**`2efbffbe` is in no history.** It is an intermediate working-tree state that
never became a commit. Only a process holding the file open across the round
could have seen it — which means the true discard count for a working session is
strictly higher than the commit count, and is not recoverable afterwards from
`git log`.

**The cost is not merely high, it is sometimes unpayable.** A rebuild that takes
17.5 CPU-minutes cannot complete during a round in which the file it is keyed on
moves every few minutes. Under parallel work the cache is not expensive-to-warm;
it is unwarmable, and stays cold until the round stops. The per-discard price is
therefore a floor on the cost, not a description of it.

## The perverse incentive, which is the actual defect

The safety is right. The consequence is that **the cheapest way to preserve a
2.3-CPU-hour cache is to not fix a wrong comment**, and the lot that measured
`_predictability` this session arrived exactly there on its own: it recommended
holding back a proven-identical 7.55x speedup, or landing it only as a rider on
some other edit that was going to invalidate anyway.

That recommendation was correct arithmetic on a false premise. The invalidation
is not a cost the change can decline to pay — anything that edits the file pays
it in full, and this file had already paid three times before the question was
asked. But the reasoning is the thing to notice, because a repo that makes
comment-fixing expensive gets stale comments, and this one has found four stale
records in a week (`quality/audit_register.py`, adversary 8). Doctrine 17's
failure mode with a price tag attached to the remedy.

## The fix, demonstrated on this session's own history

Digest the AST with module/class/function docstrings stripped, instead of the
raw bytes. Still conservative — it never reuses across a semantic change — and
blind to exactly the edits that cannot move a number.

| transition | what changed | byte | semantic |
|---|---|---|---|
| `2c9ef1b -> b8047e8` | `words()`/`ranks()` added, `_predictability` rewritten | DIFF | **DIFF** |
| `b8047e8 -> ef21639` | docstring only | DIFF | **same** |

The first row is the control and it is not constructed: it is a real code change
from this session, and the semantic digest catches it. The second row is the
case, and the semantic digest would have saved one full 8,450 CPU-s rebuild.
(REPINNED 2026-08-13 from **11,600 CPU-s**, which is 3.2 CPU-hours rendered in
seconds — the same superseded figure, one unit out.)

Comments (as opposed to docstrings) are already invisible to `ast.parse`, so
they come along free.

## What landed

`quality/discriminate.py` grew `_digest_source`, and `cache_identity()` calls
it for `SOURCE_FILES` only. `_digest_file` is untouched and still keys
`RESOURCE_FILES` byte for byte (§What is NOT closed item 3, unchanged and
re-confirmed).

The value carries its own MODE: `ast:<sha>` for a file that parsed, `raw:<sha>`
for one that did not, `ABSENT` for one that is not there. `main` prints these
on every run, so the mode is disclosed to a reader rather than inferred.

**A SOURCE FILE THAT DOES NOT PARSE FALLS BACK TO THE BYTE DIGEST.** Three
reasons, in the order that decided it:

  1. Raising is worse than falling back. `_digest_source` is called from
     inside a cache-key builder; a `SyntaxError` out of it surfaces three
     frames down naming `discriminate.py`, not the file the writer just broke.
  2. The byte digest is the CONSERVATIVE answer, not a weakening of one. A
     file whose structure we cannot read is the case where we know least, so
     the strictest available key is the right one. It is also exactly the
     behaviour every entry had before this change.
  3. The degradation cannot be silent, because the mode is IN the value.
     `ast:` and `raw:` are different strings, so a cache written while a file
     was broken can never be served to a run in which it parses.

WHAT THE FALLBACK IS ACTUALLY FOR, since through this module's own path it is
nearly unreachable: all three `SOURCE_FILES` are imported at the top of
`discriminate.py`, so a file that does not parse has already killed the import
long before any digest is taken. The reachable case is the one recorded two
sections above — a concurrent cell editing `features.py` under a running
rebuild, where the digest reads a half-written working-tree state. `2efbffbe`
was such a state. A partially flushed write is also why `ValueError` (a NUL
byte in the buffer) is caught alongside `SyntaxError`.

`ast.dump` is taken WITHOUT attributes. That is the default, and it is the
whole mechanism: `lineno`/`col_offset` are excluded, so adding a line to a
docstring does not shift the digest of every function beneath it.

## Proved both directions, on real history, at the shipped function

Not the demonstration above re-read — the SHIPPED `_digest_source` run over
**every commit that has ever touched any of the three `SOURCE_FILES`**: 44
revisions, 41 transitions.

| file | commits | transitions | read SAME across a byte change |
|---|---:|---:|---:|
| `quality/features.py` | 4 | 3 | 1 |
| `quality/within_item.py` | 1 | 0 | — |
| `lyric_harness.py` | 39 | 38 | 2 |

**Exactly three transitions read SAME, and all three were verified by READING
THE DIFF before the digest was believed:**

| transition | file | what moved |
|---|---|---|
| `b8047e8 -> ef21639` | `features.py` | 94 B, one hunk, `RhymeField` docstring memory figures estimate -> measured |
| `e85609a -> 756af5e` | `lyric_harness.py` | 217 B, one hunk, `token_pieces` docstring |
| `d83cd81 -> ff3fc6a` | `lyric_harness.py` | 1,871 B, two hunks, `is_apparatus_line` and `token_pieces` docstrings |

**The other 38 read DIFF.** That is the direction that matters and it is the
one this file does not propose weakening: no semantic change in this
repository's real history reads as SAME.

`e85609a -> 756af5e` is the sharpest of the three and it was not in the
original demonstration. That commit's own subject is *"Fix readability.py's
`read_lines()` to exclude apparatus lines"* — real work, in a DIFFERENT file.
Its entire effect on `lyric_harness.py` was to update a docstring that
described the behaviour it had just changed. Under the byte digest, telling
the truth about a fix elsewhere cost a full rebuild here.

INDEPENDENTLY WITNESSED, so the digest is not the only thing vouching for
itself: all six named transitions were also compiled with docstrings stripped
and compared at the BYTECODE — `co_code`, `co_consts`, `co_names`,
`co_varnames`, recursively over every code object, line numbers deliberately
excluded. Bytecode and digest agree on all six, SAME and DIFF alike.

## What landing cost, and it was already owed

Changing `cache_identity()` changes the fingerprint and discards the cache one
final time. **That was verified rather than assumed, on both sides of the
edit.** Before the change, `load_cache` against `data/feature_cache.json`
already read:

    fingerprint MISMATCH; DISCARDED -- changed: sources.features.py,
    sources.lyric_harness.py

After it, the same call reads the same thing plus `sources.within_item.py` —
that file's BYTES never moved, but `ast:1a4ae086a55a1e43` is not the string
`703b700a530925c7`, so the format change alone expires it. The cache served
**0 entries either way**. Nothing was thrown away by landing this that HEAD had
not already thrown away.

`quality/audit_joint_auc_null.py --check` therefore behaves identically before
and after: it REFUSES at exit 2 on the fingerprint mismatch, as it already did
at HEAD, and its refusal text names one more drifted coordinate than it used
to. It grades nothing in either case. Re-arming it needs a warm cache from
`python3 quality/discriminate.py` — ~1,050 CPU-s, a bill HEAD already owed.

`quality/test_discriminate.py` does not break. Its 44 pins come from
`measure()`, which takes `(cache, stats)` and never reads the identity; it
defaults to COLD and never opens `data/feature_cache.json` under any flag. It
calls `cache_identity()` in exactly two places, neither of which this change
touches: printing the digests, and its doctrine-20 refusal gate, which reads
`identity["resources"]` — still byte-granular, still `ABSENT`-marked.

## The two-digest agreement in `test_discriminate.py` is weaker than it reads

Found by the semantic digest, in a file this lot does not own, and reported
rather than fixed. `quality/test_discriminate.py`'s pin block says the 44
numbers were taken twice, *"ONCE at `lyric_harness.py` `10c1dca86b15860a`
... and once at `7c894bfce92a48a7`"*, and argues that this matters: *"A cold
pin in this repo has to be shown to survive the rate at which the comparator
moves, or it is a pin on one moment."*

Those two byte digests are `d83cd81` and `ff3fc6a`. They are the third row of
the SAME table above — **1,871 bytes of docstring, and the same code**. Both
digest to `ast:5152feb647dd4be0`.

So the comparator did not move between those two runs; only its prose did. The
agreement is still a real check — the two runs are different MODULES
(`discriminate.py --cold` and `test_discriminate.py`) computing the same 44
numbers, which is a genuine cross-implementation witness — but it is not
evidence that the pins survive comparator movement, and that is the claim the
paragraph makes. The remedy belongs to that file's owner: either restate the
provenance in `ast:` digests, where the two runs are visibly one comparator, or
take a second run at a genuinely different one.

This is the fix and the finding being the same fact seen twice. A byte digest
cannot tell "the comparator moved" from "someone corrected a comment", and a
record built on byte digests inherits exactly that blindness.

## What is NOT closed

1. **`SOURCE_FILES` has three entries and only one had been examined. All
   three have now been swept** — see the table above. Two results are worth
   keeping: `lyric_harness.py` carries 2 of the 3 docstring-only transitions in
   the whole history, so the expensive file is the one the byte digest was
   costing most; and **`within_item.py` has exactly one commit** — it has never
   been edited since the day it was added, so there is no transition on it to
   test in either direction, and no claim about it is made here.

2. **A semantic digest is still not the true identity.** Unchanged from when
   this was item 3, and now with two more instances:
   - `ast.dump` includes variable NAMES, so the `out` -> `outside` rename in
     `quality/revise.py` would register as a change if that file were in
     `SOURCE_FILES`. It is not, so nothing in this session hit it.
   - Reordering two independent function definitions registers as a change.
   - The dump format is a coordinate of the PYTHON VERSION, so the same file
     can digest differently under a different interpreter. This is a NEW
     over-approximation that the byte digest did not have; it discards where
     it did not have to, and never reuses where it should not.

   All three discard when they need not. None of them reuses when it must not.
   The over-approximation is narrowed, not eliminated, and this document should
   not be read as claiming otherwise.

3. **`RESOURCE_FILES` stays byte-granular — but the reason this file gave for
   it was WRONG, and checking it is how that was found.** The conclusion is
   unchanged and the code is unchanged; the argument under it is replaced.

   This document said *"there is no docstring layer to strip"* and this lot
   was asked to confirm that it still holds. **It does not hold for one of the
   three.** MEASURED at the landing: `cmudict.dict` has a `#` COMMENT LAYER —
   22 lines carry a trailing one (`aalborg AO1 L B AO0 R G # place, danish`) —
   and `Lexicon.__init__` strips it with `line.split("#")[0].strip()` before
   parsing a single phone. So a `#` comment in `cmudict.dict` provably cannot
   move a number, which is exactly the property that justified stripping
   docstrings out of the source digest. The premise was asserted, was
   plausible, and was false, in the section of the document that exists to say
   the resource case is DIFFERENT. (The other two are as described:
   `concreteness.txt` is a CRLF TSV with a header row and zero comment lines,
   `wordfreq20k.txt` is one bare word per line, also zero.)

   **The conclusion survives on better ground, and the new ground is the one
   that would have been load-bearing all along.** For a source file the
   stripper is `ast.parse` — CPython's OWN parser, the same one that executes
   the file, so there is no second implementation that can drift from the
   truth. For a resource there is no such shared authority: the only reader of
   `cmudict.dict`'s comment rule is a bespoke line in `Lexicon.__init__`, and a
   digest that stripped comments would be a SECOND, unsynchronized reader of
   the same format. If those two ever disagreed, the digest would discard bytes
   the loader actually reads — and that is the direction that wrongly REUSES,
   the one failure this key exists to prevent. This repo has already paid for
   the general version of that mistake four times in two days: one apparatus
   rule, four separate spellings, each wrong differently.

   And the motive is absent anyway. The whole case for the source change is
   that making comment-fixing expensive gets you stale comments. Nobody
   hand-edits a comment in a downloaded pronunciation dictionary; these three
   files are fetched artifacts, not written ones, so there is no incentive to
   distort. Doctrine 58 stands unchanged: every byte of a resource is a
   coordinate of the number, and the cheap safe key is the right key when no
   one is being taxed by it.

4. **The unwarmable-cache problem is untouched.** Nothing here makes a 17.5-
   CPU-minute rebuild complete during a round in which its inputs move every
   few minutes; it only removes the docstring edits from the set of things that
   move them. This was measured again while landing the fix, unintentionally:
   `lyric_harness.py` changed under this lot mid-round (byte
   `7c894bfce92a48a7` -> `022c22430df553b4`), and the semantic digest moved
   with it, correctly, because that edit was not a docstring.
