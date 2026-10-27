#!/usr/bin/env python3
"""Mechanical fixture lines: seeded dictionary words in fixed frames.

Added 2026-10-27 with the owner-approved deletion of every AI-written song:
fixtures that quoted those songs are replaced by lines no one wrote. A line
here is a FRAME (a closed list of function words and commas) whose open slots
are seeded draws from the staged dictionary (`phonological_twin`'s pool:
words with one CMUdict reading that the staged frequency list also holds),
filtered by the project's own tagger (`quality/features.py`) for the part of
speech each slot needs. The same seed gives the same line on every machine
with the same staged assets.

Frames:
  stack(seed)       "N, N, N, N, N"          verbless, function-word-poor,
                                              comma-dense: a noun stack
  phrase(seed)      "the N of the N"          verbless and function-rich
  clause(seed)      "we V the N"              a finite verb (past tense)
  imperative(seed)  "V it, N, do not V it"    imperatives, comma-spliced
"""
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

_POOLS = {}


def _pool(kind):
    """Sorted dictionary words the tagger reads as `kind` in a frame."""
    if kind in _POOLS:
        return _POOLS[kind]
    from quality.features import _tagger
    from quality.fixtures.phonological_twin import _load
    readings, _ = _load()
    words = sorted(w for w in readings
                   if w.isalpha() and len(w) >= 4 and len(readings[w]) == 1)
    from quality.fixtures.phonological_twin import BLOCKED, FUNCTION
    words = [w for w in words if w not in BLOCKED and w not in FUNCTION]
    freq = set()
    with open(os.path.join(ROOT, "data", "opensubtitles_en_50k.tsv"),
              encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            if not line.startswith("#") and line.strip():
                freq.add(line.split("\t")[0].strip().lower())
            if len(freq) >= 8000:
                break
    words = [w for w in words if w in freq]
    tag = _tagger()
    if kind == "noun":
        frame = lambda w: (tag(["the", w, "of", "the", "night"])[1][1] == "NN"
                           and tag(["a", w, "is", "here"])[1][1] == "NN"
                           and tag([w, ",", "stone", ",", "rope"])[0][1] == "NN"
                           and tag(["stone", ",", w, ",", "rope"])[2][1] == "NN"
                           and not w.endswith(("ed", "ing", "ly")))
    elif kind == "past":
        frame = lambda w: (w.endswith("ed")
                           and tag(["we", w, "the", "door"])[1][1] == "VBD")
    elif kind == "verb":
        frame = lambda w: (tag([w, "it", "now"])[0][1] == "VB"
                           and tag(["to", w, "it"])[1][1] == "VB")
    else:
        raise ValueError(kind)
    _POOLS[kind] = [w for w in words if frame(w)]
    return _POOLS[kind]


def _draw(seed, kind, n):
    rng = random.Random(f"{seed}:{kind}")
    pool = _pool(kind)
    return [rng.choice(pool) for _ in range(n)]


def _cap(s):
    return s[0].upper() + s[1:]


def stack(seed):
    return _cap(", ".join(_draw(seed, "noun", 5)))


def phrase(seed):
    a, b = _draw(seed, "noun", 2)
    return f"The {a} of the {b}"


def clause(seed):
    (v,), (n,) = _draw(seed, "past", 1), _draw(seed, "noun", 1)
    return f"We {v} the {n}"


def imperative(seed):
    v1, v2 = _draw(seed, "verb", 2)
    (n,) = _draw(seed, "noun", 1)
    return f"{_cap(v1)} it, {n}, do not {v2} it"


def draft(seed, n, stacked=()):
    """`n` lines: `stack` at the 1-based positions in `stacked`, otherwise
    alternating `clause` and `phrase`."""
    out = []
    for i in range(1, n + 1):
        s = f"{seed}:{i}"
        if i in stacked:
            out.append(stack(s))
        else:
            out.append(clause(s) if i % 2 else phrase(s))
    return out


if __name__ == "__main__":
    for x in draft(int(sys.argv[1]) if len(sys.argv) > 1 else 0, 8, (3,)):
        print(x)
