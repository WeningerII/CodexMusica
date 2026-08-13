# The cache identity is byte-granular, and a comment costs 3.2 CPU-hours

MEASURED 2026-08-13. Status: FINDING RECORDED, FIX DEMONSTRATED AND HELD.

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

  - `discriminate.py`'s 384 entries — ~70 min ≈ 4,200 CPU-s
  - `song_profile_calibration`'s predictability cache — 2.0–2.2 CPU-hours
    ≈ 7,400 CPU-s

≈ **11,600 CPU-s, ~3.2 CPU-hours, per discard.**

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
comparisons with zero differences — and it discarded 3.2 CPU-hours.

## The perverse incentive, which is the actual defect

The safety is right. The consequence is that **the cheapest way to preserve a
3.2-CPU-hour cache is to not fix a wrong comment**, and the lot that measured
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
case, and the semantic digest would have saved one full 11,600 CPU-s rebuild.

Comments (as opposed to docstrings) are already invisible to `ast.parse`, so
they come along free.

## What is NOT closed, and why the fix is held

1. **Held pending the discriminate lots.** Changing `cache_identity()` changes
   the fingerprint, which discards the cache one final time. That is free
   RIGHT NOW — `ef21639` already left it invalid — but a lot is concurrently
   measuring `discriminate.py` cold in order to pin its AUCs, and landing this
   underneath it would throw away a 70-minute measurement. Sequencing, not
   doubt.

2. **`SOURCE_FILES` has three entries and only one was examined.**
   `within_item.py` and `lyric_harness.py` carry the same granularity and were
   not measured here.

3. **A semantic digest is still not the true identity.** `ast.dump` includes
   variable NAMES, so the `out` -> `outside` rename in `quality/revise.py`
   would register as a change if that file were in `SOURCE_FILES`. It is not,
   so nothing in this session hit it — but the over-approximation is narrowed,
   not eliminated, and this document should not be read as claiming otherwise.

4. **`RESOURCE_FILES` is genuinely byte-granular and should stay that way.**
   `concreteness.txt`, `wordfreq20k.txt` and `cmudict.dict` are data, not code;
   there is no docstring layer to strip and every byte is a coordinate of the
   number (doctrine 58).
